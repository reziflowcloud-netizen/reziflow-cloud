Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')

$pending = '20261024160000_meta_message_reads'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$testId = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$testBase = Join-Path $env:LOCALAPPDATA 'LegalHubMaintenanceRunnerTests'
if (-not (Test-Path -LiteralPath $testBase)) {
  [void](New-Item -ItemType Directory -Path $testBase)
  Set-PrivateAcl $testBase
}
Assert-PrivateAcl $testBase
$root = Assert-ChildPath $testBase (Join-Path $testBase $testId)
[void](New-Item -ItemType Directory -Path $root)
Set-PrivateAcl $root
$private = Join-Path $root 'private'
$backups = Join-Path $root 'backups'
foreach ($path in @($private, $backups)) {
  [void](New-Item -ItemType Directory -Path $path)
  Set-PrivateAcl $path
}
$config = [pscustomobject]@{
  targetKind = 'synthetic'; environmentFile = (Join-Path $root 'synthetic.env')
  expectedHost = '127.0.0.1'; backupDirectory = $backups
  privateDirectory = $private; postgresBin = $pgBin
}
$source = $null
try {
  $source = New-DisposableCluster $config ('source' + $testId)
  $dbName = 'legalhub_runner_synthetic_' + $testId
  [void](Invoke-PostgresTool $config $source.Uri 'createdb.exe' @(
      '-T', 'template0', $dbName) 'SYNTHETIC_CREATE_FAILED')
  $sourceUri = [Uri]::new(($source.Uri.AbsoluteUri -replace '/legalhub_runner_source[^?]+', "/$dbName"))
  [IO.File]::WriteAllText($config.environmentFile,
    "DIRECT_URL=$($sourceUri.AbsoluteUri)`n", [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $config.environmentFile
  $configFile = Join-Path $root 'config.json'
  [IO.File]::WriteAllText($configFile, ($config | ConvertTo-Json),
    [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $configFile

  $fixture = Join-Path $root 'fixture'
  [void](New-Item -ItemType Directory -Path $fixture)
  $migrationDir = Join-Path $fixture 'migrations'
  [void](New-Item -ItemType Directory -Path $migrationDir)
  [IO.File]::Copy((Join-Path $repo 'prisma/schema.prisma'),
    (Join-Path $fixture 'schema.prisma'))
  [IO.File]::Copy((Join-Path $repo 'prisma/migrations/migration_lock.toml'),
    (Join-Path $migrationDir 'migration_lock.toml'))
  $all = @(Get-MigrationFiles $repo)
  if ($all.Count -lt 2 -or $all[-1].Name -ne $pending) {
    Stop-Maintenance 'FIXTURE_PENDING_NOT_LAST'
  }
  foreach ($migration in $all | Where-Object Name -ne $pending) {
    $dest = Join-Path $migrationDir $migration.Name
    [void](New-Item -ItemType Directory -Path $dest)
    [IO.File]::Copy($migration.Path, (Join-Path $dest 'migration.sql'))
  }
  $cli = Join-Path $repo 'node_modules/prisma/build/index.js'
  if (-not (Test-Path -LiteralPath $cli)) { Stop-Maintenance 'PRISMA_CLI_MISSING' }
  $oldDatabase = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
  $oldDirect = [Environment]::GetEnvironmentVariable('DIRECT_URL', 'Process')
  try {
    $env:DATABASE_URL = $sourceUri.AbsoluteUri
    $env:DIRECT_URL = $sourceUri.AbsoluteUri
    $output = @(& node $cli migrate deploy --schema (Join-Path $fixture 'schema.prisma') 2>$null)
    if ($LASTEXITCODE -ne 0) { Stop-Maintenance 'SYNTHETIC_BASE_MIGRATIONS_FAILED' }
  } finally {
    [Environment]::SetEnvironmentVariable('DATABASE_URL', $oldDatabase, 'Process')
    [Environment]::SetEnvironmentVariable('DIRECT_URL', $oldDirect, 'Process')
  }
  $ledger = @(Get-ProductionLedger $config $sourceUri)
  Write-Output "SYNTHETIC LEDGER rows=$($ledger.Count) firstType=$($ledger[0].GetType().FullName) fields=$($ledger[0].PSObject.Properties.Name -join ',')"
  [void](Compare-MigrationLedger $all $ledger @($pending))
  Write-Output "PASS synthetic base migration chain ($($ledger.Count) migrations)"

  $head = (& git -C $repo rev-parse HEAD).Trim()
  $runner = Join-Path $repo 'scripts/local-maintenance/runner.ps1'
  $runnerErr = Join-Path $root 'runner.err'
  $result = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
      -Mode Preflight -Synthetic -ApprovedCommit $head -ExpectedMigrations $pending `
      -ConfigPath $configFile 2>$runnerErr)
  if ($LASTEXITCODE -ne 0 -or ($result -join ' ') -notmatch 'PREFLIGHT PASS') {
    $codes = @(Get-Content -LiteralPath $runnerErr | Where-Object { $_ -match 'LOCAL MAINTENANCE BLOCKED:' })
    Write-Output "PREFLIGHT BLOCK: $($codes -join ' ')"
    Stop-Maintenance 'FULL_SYNTHETIC_PREFLIGHT_FAILED'
  }
  Write-Output 'PASS full synthetic preflight, backup, restore and isolated Prisma migration'
  $denied = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
      -Mode Apply -Synthetic -ConfigPath $configFile 2>$runnerErr)
  if ($LASTEXITCODE -eq 0 -or
      (Get-Content -LiteralPath $runnerErr -Raw) -notmatch 'SYNTHETIC_APPLY_FORBIDDEN') {
    Stop-Maintenance 'SYNTHETIC_APPLY_WAS_NOT_DENIED'
  }
  Write-Output 'PASS synthetic apply refused'
  $planPath = Get-ChildItem -LiteralPath (Join-Path $private 'plans') `
    -Filter '*.sealed.json' -File | Select-Object -First 1 -ExpandProperty FullName
  $status = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
      -Mode Status -Synthetic -ConfigPath $configFile -PlanPath $planPath 2>$runnerErr)
  if ($LASTEXITCODE -ne 0 -or ($status -join ' ') -notmatch 'PREFLIGHT_ONLY') {
    Stop-Maintenance 'OFFLINE_STATUS_FAILED'
  }
  Write-Output 'PASS offline status'
  Write-Output 'FULL WINDOWS PREFLIGHT TEST PASS'
} finally {
  if ($source) { Stop-DisposableCluster $config $source }
  $safeRoot = Assert-ChildPath $testBase $root
  if ((Split-Path -Leaf $safeRoot) -eq $testId -and
      (Test-Path -LiteralPath $safeRoot -PathType Container)) {
    for ($attempt = 0; $attempt -lt 8; $attempt++) {
      try { [IO.Directory]::Delete($safeRoot, $true); break }
      catch [IO.IOException] { Start-Sleep -Milliseconds 500 }
    }
  }
}
