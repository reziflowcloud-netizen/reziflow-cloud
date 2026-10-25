Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
. (Join-Path $repo 'scripts/local-maintenance/plan.ps1')

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
  nodeBin = 'C:\Program Files\nodejs'
  applicationRole = 'restore_admin'; expectedApplicationHost = '127.0.0.1'
}
$source = $null
try {
  $source = New-DisposableCluster $config ('source' + $testId)
  $dbName = 'legalhub_runner_synthetic_' + $testId
  [void](Invoke-PostgresTool $config $source.Uri 'createdb.exe' @(
      '-T', 'template0', $dbName) 'SYNTHETIC_CREATE_FAILED')
  $sourceUri = [Uri]::new(($source.Uri.AbsoluteUri -replace '/legalhub_runner_source[^?]+', "/$dbName"))
  [IO.File]::WriteAllText($config.environmentFile,
    "DIRECT_URL=$($sourceUri.AbsoluteUri)`nDATABASE_URL=$($sourceUri.AbsoluteUri)`n", [Text.UTF8Encoding]::new($false))
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
  $batch = Join-Path $repo 'PREFLIGHT.bat'
  $decoy = Join-Path $root 'decoy-cwd'
  $decoyMigrations = Join-Path $decoy 'prisma/migrations/20990101000000_decoy'
  [void](New-Item -ItemType Directory -Path $decoyMigrations -Force)
  [IO.File]::WriteAllText((Join-Path $decoy 'prisma/schema.prisma'), @'
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
}
'@, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $decoyMigrations 'migration.sql'),
    'CREATE TABLE public."Decoy" (id INTEGER);', [Text.UTF8Encoding]::new($false))
  $runnerErr = Join-Path $root 'runner.err'
  $ErrorActionPreference = 'Continue'
  $initialStatus = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
      -Mode Status -Synthetic -ConfigPath $configFile 2>$runnerErr)
  if ($LASTEXITCODE -ne 0 -or ($initialStatus -join ' ') -notmatch 'NO_HISTORY') {
    Stop-Maintenance 'NO_HISTORY_REPORT_FAILED'
  }
  Write-Output 'PASS offline status with no history'
  $blocked = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
      -Mode Preflight -Synthetic -ApprovedCommit $head `
      -ExpectedMigrations '20990101000000_unexpected' -ConfigPath $configFile 2>$runnerErr)
  if ($LASTEXITCODE -eq 0 -or
      (Get-Content -LiteralPath $runnerErr -Raw) -notmatch 'PENDING_SET_MISMATCH') {
    Stop-Maintenance 'BLOCKED_PREFLIGHT_REPORT_SETUP_FAILED'
  }
  $blockedStatus = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
      -Mode Status -Synthetic -ConfigPath $configFile 2>$runnerErr)
  if ($LASTEXITCODE -ne 0 -or ($blockedStatus -join ' ') -notmatch 'PREFLIGHT_BLOCKED') {
    Stop-Maintenance 'BLOCKED_PREFLIGHT_REPORT_FAILED'
  }
  Write-Output 'PASS blocked preflight persisted to offline status'
  Push-Location $decoy
  try {
    $result = @(& $batch -Synthetic -ApprovedCommit $head -ExpectedMigrations $pending `
        -ConfigPath $configFile 2>$runnerErr)
  } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0 -or ($result -join ' ') -notmatch 'PREFLIGHT PASS') {
    $codes = @(Get-Content -LiteralPath $runnerErr | Where-Object {
        $_ -match 'LOCAL MAINTENANCE BLOCKED:|SYNTHETIC DIAGNOSTIC:' })
    Write-Output "PREFLIGHT BLOCK: $($codes -join ' ')"
    Write-Output ('SYNTHETIC RAW DIAGNOSTIC: ' +
      ((Get-Content -LiteralPath $runnerErr -Raw) -replace [regex]::Escape($sourceUri.UserInfo), '<redacted>'))
    Stop-Maintenance 'FULL_SYNTHETIC_PREFLIGHT_FAILED'
  }
  $visible = ($result -join ' ') + (Get-Content -LiteralPath $runnerErr -Raw)
  if ($visible.Contains($sourceUri.UserInfo)) { Stop-Maintenance 'SECRET_LEAK_IN_RUNNER_OUTPUT' }
  Write-Output 'PASS full synthetic preflight, backup, restore and isolated Prisma migration'
  $decoyRows = Invoke-ReadOnlyQuery $config $sourceUri `
    "SELECT count(*) FROM pg_class WHERE oid=to_regclass('public.`"Decoy`"')" 'DECOY_CHECK_FAILED'
  if ($decoyRows -ne '0') { Stop-Maintenance 'DECOY_MIGRATION_WAS_USED' }
  Write-Output 'PASS BAT launched from decoy CWD, pinned Prisma schema and migration folder'
  Write-Output 'PASS synthetic credential not emitted'
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
  $ErrorActionPreference = 'Stop'
  Write-Output 'PASS offline status'
  $planForStatus = Read-SealedPlan $config $planPath
  $reportPath = Join-Path $private "reports/$($planForStatus.runId).json"
  $originalReport = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8
  try {
    foreach ($resultName in @('APPLIED', 'APPLY_ERROR')) {
      $reportState = $originalReport | ConvertFrom-Json
      $reportState.result = $resultName
      $reportState.apply = $resultName
      $reportState.lastObservedPending = if ($resultName -eq 'APPLIED') { @() } else { $null }
      $reportState.observationUtc = [DateTime]::UtcNow.ToString('o')
      [IO.File]::WriteAllText($reportPath, ($reportState | ConvertTo-Json -Depth 20),
        [Text.UTF8Encoding]::new($false))
      Assert-PrivateAcl $reportPath
      $view = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
          -Mode Status -Synthetic -ConfigPath $configFile -PlanPath $planPath 2>$runnerErr)
      if ($LASTEXITCODE -ne 0 -or ($view -join ' ') -notmatch "STATUS $resultName") {
        Stop-Maintenance 'APPLY_REPORT_STATUS_FAILED'
      }
    }
  } finally {
    [IO.File]::WriteAllText($reportPath, $originalReport, [Text.UTF8Encoding]::new($false))
    Assert-PrivateAcl $reportPath
  }
  Write-Output 'PASS offline status after synthetic applied/error report fixtures'
  $backupCount = @(Get-ChildItem -LiteralPath $backups -Filter '*.dump' -File).Count
  $syntheticTarget = [pscustomobject]@{ Uri = $sourceUri; Port = $source.Port;
    Database = $dbName }
  Invoke-DisposableMigration $config $syntheticTarget $repo
  $skip = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
      -Mode Preflight -Synthetic -NoMigration -ApprovedCommit $head `
      -ConfigPath $configFile 2>$runnerErr)
  if ($LASTEXITCODE -ne 0 -or ($skip -join ' ') -notmatch 'SKIPPED_NO_MIGRATION' -or
      @(Get-ChildItem -LiteralPath $backups -Filter '*.dump' -File).Count -ne $backupCount) {
    Stop-Maintenance 'NO_MIGRATION_SKIP_FAILED'
  }
  Write-Output 'PASS no-migration skip without new backup'
  $reportBatch = Join-Path $repo 'REPORT.bat'
  Push-Location $decoy
  try { $skipReport = @(& $reportBatch -Synthetic -ConfigPath $configFile 2>$runnerErr) }
  finally { Pop-Location }
  if ($LASTEXITCODE -ne 0 -or ($skipReport -join ' ') -notmatch 'SKIPPED_NO_MIGRATION') {
    Stop-Maintenance 'REPORT_BATCH_SKIP_FAILED'
  }
  Write-Output 'PASS REPORT.bat shows skipped no-migration state'
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
