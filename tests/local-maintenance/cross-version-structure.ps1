if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'TEST_REQUIRES_POWERSHELL_7' }
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
. (Join-Path $repo 'scripts/local-maintenance/sql-audit.ps1')

function Copy-ReviewedGitBlob([string]$Reference, [string]$Destination) {
  $gitProcess = [Diagnostics.ProcessStartInfo]::new('git')
  foreach ($argument in @('-C', $repo, 'show', $Reference)) {
    [void]$gitProcess.ArgumentList.Add($argument)
  }
  $gitProcess.UseShellExecute = $false
  $gitProcess.CreateNoWindow = $true
  $gitProcess.RedirectStandardOutput = $true
  $gitProcess.RedirectStandardError = $true
  $gitResult = [Diagnostics.Process]::Start($gitProcess)
  try {
    $errorDrain = $gitResult.StandardError.ReadToEndAsync()
    $stream = [IO.File]::Open($Destination, [IO.FileMode]::CreateNew,
      [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $gitResult.StandardOutput.BaseStream.CopyTo($stream) }
    finally { $stream.Dispose() }
    $gitResult.WaitForExit()
    if ($gitResult.ExitCode -ne 0) { Stop-Maintenance 'PR9_REVIEWED_BLOB_UNAVAILABLE' }
  } finally { $gitResult.Dispose() }
  Set-PrivateAcl $Destination
}

$id = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$base = Join-Path $env:LOCALAPPDATA 'LegalHubMaintenanceRunnerTests'
if (-not (Test-Path -LiteralPath $base)) {
  [void](New-Item -ItemType Directory -Path $base)
  Set-PrivateAcl $base
}
Assert-PrivateAcl $base
$root = Assert-ChildPath $base (Join-Path $base $id)
[void](New-Item -ItemType Directory -Path $root)
Set-PrivateAcl $root
$marker = Join-Path $root 'cross-version-owned.txt'
[IO.File]::WriteAllText($marker, $id, [Text.UTF8Encoding]::new($false))
Set-PrivateAcl $marker
$private = Join-Path $root 'private'
$backups = Join-Path $root 'backups'
foreach ($path in @($private, $backups)) {
  [void](New-Item -ItemType Directory -Path $path)
  Set-PrivateAcl $path
}
$config = [pscustomobject]@{
  targetKind = 'synthetic'; environmentFile = (Join-Path $root 'synthetic.env')
  expectedHost = '127.0.0.1'; backupDirectory = $backups
  privateDirectory = $private; postgresBin = 'C:\Program Files\PostgreSQL\18\bin'
  nodeBin = 'C:\Program Files\nodejs'
  applicationRole = 'postgres'; expectedApplicationHost = '127.0.0.1'
}
$image = 'public.ecr.aws/supabase/postgres:17.6.1.166'
$container = 'legalhub-pg17-' + $id
$containerCreated = $false
$target = $null
$cleanupVerified = $false
try {
  $imageId = @(& docker image inspect --format '{{.Id}}' $image 2>$null)
  if ($LASTEXITCODE -ne 0 -or $imageId.Count -ne 1) {
    Stop-Maintenance 'PG17_IMAGE_NOT_CACHED'
  }
  $passwordBytes = [byte[]]::new(32)
  [Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
  $password = [Convert]::ToBase64String($passwordBytes)
  $envFile = Join-Path $root 'pg17.env'
  [IO.File]::WriteAllText($envFile, "POSTGRES_PASSWORD=$password`n",
    [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $envFile
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  try { $listener.Start(); $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port }
  finally { $listener.Stop() }
  if ($port -eq 5432) { Stop-Maintenance 'SYNTHETIC_PORT_UNSAFE' }
  $created = @(& docker run --detach --name $container `
      --label "legalhub.runner.test=$id" --publish "127.0.0.1:${port}:5432" `
      --env-file $envFile $image postgres -c 'listen_addresses=*' 2>$null)
  if ($LASTEXITCODE -ne 0 -or $created.Count -ne 1) {
    Stop-Maintenance 'PG17_CONTAINER_START_FAILED'
  }
  $containerCreated = $true
  $adminUri = [Uri]::new("postgresql://postgres:$([Uri]::EscapeDataString($password))@127.0.0.1:$port/postgres")
  $ready = $false
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    $probe = Invoke-WithIsolatedEnvironment $config $adminUri @{} {
      $oldPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $discard = @(& (Join-Path $config.postgresBin 'pg_isready.exe') `
            '-h' '127.0.0.1' '-p' ([string]$port) '-q' 2>$null)
        return $LASTEXITCODE
      } finally { $ErrorActionPreference = $oldPreference }
    }
    if ($probe -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { Stop-Maintenance 'PG17_NOT_READY' }
  $serverVersion = Invoke-ReadOnlyQuery $config $adminUri 'SHOW server_version' 'PG17_VERSION_UNKNOWN'
  if ($serverVersion -notmatch '^17\.6(?:\.|$)') { Stop-Maintenance 'PG17_VERSION_UNEXPECTED' }
  $dbName = 'legalhub_runner_synthetic_cross_' + $id
  [void](Invoke-PostgresTool $config $adminUri 'createdb.exe' @(
      '-T', 'template0', $dbName) 'PG17_CREATE_DB_FAILED')
  $sourceUri = [Uri]::new("postgresql://postgres:$([Uri]::EscapeDataString($password))@127.0.0.1:$port/$dbName")
  $fixture = Join-Path $root 'fixture'
  $migrationRoot = Join-Path $fixture 'migrations'
  [void](New-Item -ItemType Directory -Path $migrationRoot -Force)
  [IO.File]::Copy((Join-Path $repo 'prisma/schema.prisma'),
    (Join-Path $fixture 'schema.prisma'))
  [IO.File]::Copy((Join-Path $repo 'prisma/migrations/migration_lock.toml'),
    (Join-Path $migrationRoot 'migration_lock.toml'))
  $all = @(Get-MigrationFiles $repo)
  if ($all.Count -ne 53) { Stop-Maintenance 'SYNTHETIC_CHAIN_COUNT_UNEXPECTED' }
  foreach ($migration in $all) {
    $destination = Join-Path $migrationRoot $migration.Name
    [void](New-Item -ItemType Directory -Path $destination)
    [IO.File]::WriteAllBytes((Join-Path $destination 'migration.sql'),
      (Get-ApprovedMigrationBytes $repo $migration.Name))
  }
  $cli = Join-Path $repo 'node_modules/prisma/build/index.js'
  if (-not (Test-Path -LiteralPath $cli)) { Stop-Maintenance 'PRISMA_CLI_MISSING' }
  $migrationExit = Invoke-WithIsolatedEnvironment $config $null @{
    DATABASE_URL = $sourceUri.AbsoluteUri; DIRECT_URL = $sourceUri.AbsoluteUri
  } {
    Push-Location $fixture
    try {
      $oldPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $discard = @(& (Join-Path $config.nodeBin 'node.exe') $cli migrate deploy `
            --schema (Join-Path $fixture 'schema.prisma') 2>$null)
        return $LASTEXITCODE
      } finally { $ErrorActionPreference = $oldPreference }
    } finally { Pop-Location }
  }
  if ($migrationExit -ne 0) { Stop-Maintenance 'PG17_SYNTHETIC_MIGRATIONS_FAILED' }
  $fixtureSql = Join-Path $root 'synthetic-representative-data.sql'
  [IO.File]::WriteAllText($fixtureSql, @'
ALTER TABLE public."LeadMessage"
  ADD COLUMN "qaFloat" double precision,
  ADD COLUMN "qaNumeric" numeric,
  ADD COLUMN "qaBytes" bytea,
  ADD COLUMN "qaInterval" interval,
  ADD COLUMN "qaInstant" timestamptz;
INSERT INTO public."Organization" ("id","name","slug","settings","createdAt","updatedAt") VALUES
  ('synthetic-org-a','Synthetic A','synthetic-a','{"nested":{"numbers":[1,2.5],"label":"Żółć"}}'::jsonb,'2026-01-15 10:00:00','2026-01-15 10:00:00'),
  ('synthetic-org-b','Synthetic B','synthetic-b','{"nested":{"numbers":[3,4.75],"label":"Тест"}}'::jsonb,'2026-07-15 10:00:00','2026-07-15 10:00:00');
INSERT INTO public."User" ("id","email","password","name","organizationId","preferences") VALUES
  (1001,'synthetic-a@example.invalid','synthetic-only','Synthetic A','synthetic-org-a','{"locale":"pl","nested":{"enabled":true}}'::jsonb),
  (1002,'synthetic-b@example.invalid','synthetic-only','Synthetic B','synthetic-org-b','{"locale":"uk","nested":{"enabled":false}}'::jsonb);
INSERT INTO public."Lead" ("id","organizationId","assignedToId","fullName","updatedAt") VALUES
  ('synthetic-lead-a','synthetic-org-a',1001,'Synthetic A','2026-01-15 11:00:00'),
  ('synthetic-lead-b','synthetic-org-b',1002,'Synthetic B','2026-07-15 11:00:00');
INSERT INTO public."LeadMessage" ("id","organizationId","leadId","authorId","text","payload","sentAt","qaFloat","qaNumeric","qaBytes","qaInterval","qaInstant") VALUES
  (1001,'synthetic-org-a','synthetic-lead-a',1001,'Synthetic winter Żółć','{"nested":{"items":[1,null,{"ok":true}]}}'::jsonb,'2026-01-15 12:00:00',1.23456789012345,123456.789012,E'\\x00aaff'::bytea,interval '1 day 2 hours 3.456 seconds','2026-01-15 12:00:00.123456+01'),
  (1002,'synthetic-org-b','synthetic-lead-b',1002,'Synthetic summer Тест','{"nested":{"items":[2,null,{"ok":false}]}}'::jsonb,'2026-07-15 12:00:00',-0.000000123456789,-987.654321,E'\\x1234'::bytea,interval '2 months 4 minutes','2026-07-15 12:00:00.654321+02');
INSERT INTO public."NotificationPreference" ("id","organizationId","userId","events","updatedAt") VALUES
  ('synthetic-pref-a','synthetic-org-a',1001,'{"channels":{"mail":false},"levels":[1,2]}'::jsonb,'2026-01-15 13:00:00'),
  ('synthetic-pref-b','synthetic-org-b',1002,'{"channels":{"mail":true},"levels":[3,4]}'::jsonb,'2026-07-15 13:00:00');
UPDATE public."_prisma_migrations" SET finished_at = CASE
  WHEN migration_name < '20260901000000' THEN '2026-01-15 14:00:00.123456+01'::timestamptz
  ELSE '2026-07-15 14:00:00.654321+02'::timestamptz END;
'@, [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $fixtureSql
  [void](Invoke-PostgresTool $config $sourceUri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $fixtureSql) 'PG17_SYNTHETIC_ROWS_FAILED')
  foreach ($setting in @(
      "TimeZone='Europe/Warsaw'", "DateStyle='SQL, DMY'",
      "IntervalStyle='sql_standard'", 'extra_float_digits=0',
      "bytea_output='escape'")) {
    [void](Invoke-PostgresTool $config $sourceUri 'psql.exe' @(
        '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
        "ALTER DATABASE `"$dbName`" SET $setting;") 'PG17_SESSION_DEFAULTS_FAILED')
  }
  $ledgerSource = Invoke-ReadOnlyQuery $config $sourceUri `
    'SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL' `
    'PG17_LEDGER_FAILED'
  if ($ledgerSource -ne '53') { Stop-Maintenance 'PG17_LEDGER_COUNT_UNEXPECTED' }
  Write-Output 'PASS PostgreSQL 17.6 full 53-migration chain'
  $snapshot = Start-ExportedSnapshot $config $sourceUri
  try {
    $sourceData = Get-RepresentativeFingerprints $config $sourceUri @{} $snapshot.Id
    $sourceStructure = Get-StructureFingerprint $config $sourceUri $snapshot.Id
    foreach ($table in @('LeadMessage','Lead','Organization','User','NotificationPreference')) {
      if ([int]$sourceData[$table].count -lt 2) {
        Write-Output "SYNTHETIC COUNT $table=$($sourceData[$table].count)"
        Stop-Maintenance 'SYNTHETIC_REPRESENTATIVE_COUNT_UNEXPECTED'
      }
    }
    [void](Invoke-PostgresTool $config $sourceUri 'psql.exe' @(
        '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
        'UPDATE public."LeadMessage" SET "text"=''Synthetic concurrent change'' WHERE "id"=1001;') `
      'PG17_CONCURRENT_MUTATION_FAILED')
    $mutationBlocked = $false
    try {
      Compare-RepresentativeFingerprints $sourceData `
        (Get-RepresentativeFingerprints $config $sourceUri) $false 'RESTORE' @{}
    } catch {
      if ($_.Exception.Message -ne 'LMR:RESTORED_DATA_MISMATCH') { throw }
      $mutationBlocked = $true
    }
    if (-not $mutationBlocked) { Stop-Maintenance 'PG17_CONCURRENT_MUTATION_UNDETECTED' }
    $backup = New-PrivateBackup $config $sourceUri $id $snapshot.Id
  } finally { Stop-ExportedSnapshot $snapshot }
  Write-Output 'PASS source fingerprints and pg_dump share exported snapshot'
  $target = New-DisposableCluster $config ('target' + $id)
  $targetVersion = Invoke-ReadOnlyQuery $config $target.Uri 'SHOW server_version' 'PG18_VERSION_UNKNOWN'
  if ($targetVersion -notmatch '^18\.6(?:\.|$)') { Stop-Maintenance 'PG18_VERSION_UNEXPECTED' }
  Restore-DisposableBackup $config $target $backup
  foreach ($setting in @(
      "TimeZone='UTC'", "DateStyle='ISO, YMD'", "IntervalStyle='postgres'",
      'extra_float_digits=1', "bytea_output='hex'")) {
    [void](Invoke-PostgresTool $config $target.Uri 'psql.exe' @(
        '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
        "ALTER DATABASE `"$($target.Database)`" SET $setting;") `
      'PG18_SESSION_DEFAULTS_FAILED')
  }
  $targetData = Get-RepresentativeFingerprints $config $target.Uri
  Compare-RepresentativeFingerprints $sourceData $targetData
  Write-Output 'PASS six representative data fingerprints, including Prisma ledger'
  Assert-StructureEqual $sourceStructure (Get-StructureFingerprint $config $target.Uri)
  Write-Output 'PASS PostgreSQL 17.6 -> 18.6 structure fingerprint'
  $ledgerTarget = Invoke-ReadOnlyQuery $config $target.Uri `
    'SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL' `
    'PG18_LEDGER_FAILED'
  if ($ledgerTarget -ne '53') { Stop-Maintenance 'PG18_LEDGER_COUNT_UNEXPECTED' }
  $pr9SqlPath = Join-Path $root 'pr9-additive-migration.sql'
  $pr9Ref = '5d71d4c43e14637fbb556e5ddd445e819378ceae:prisma/migrations/20261027120000_meta_lead_ads_multitenant/migration.sql'
  $pr9GuardPath = Join-Path $root 'pr9-sql-audit.ps1'
  Copy-ReviewedGitBlob $pr9Ref $pr9SqlPath
  Copy-ReviewedGitBlob `
    '5d71d4c43e14637fbb556e5ddd445e819378ceae:scripts/local-maintenance/sql-audit.ps1' `
    $pr9GuardPath
  . $pr9GuardPath
  $pr9Audit = Test-MigrationSql $pr9SqlPath
  if ($pr9Audit.StatementCount -ne 8) { Stop-Maintenance 'PR9_SQL_GUARD_CHANGED' }
  [void](Invoke-PostgresTool $config $target.Uri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $pr9SqlPath) 'PR9_ISOLATED_MIGRATION_FAILED')
  Assert-CreatedObjects $config $target.Uri @([pscustomobject]@{ audit = $pr9Audit })
  Compare-RepresentativeFingerprints $sourceData `
    (Get-RepresentativeFingerprints $config $target.Uri)
  Write-Output 'PASS PR #9 approved additive SQL guard, isolated migration and old data'
  [void](Invoke-PostgresTool $config $target.Uri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
      'UPDATE public."LeadMessage" SET "payload"='' {"changed":true} ''::jsonb WHERE "id"=1001;') `
    'PG18_JSONB_MUTATION_FAILED')
  $jsonBlocked = $false
  try {
    Compare-RepresentativeFingerprints $sourceData `
      (Get-RepresentativeFingerprints $config $target.Uri) $false 'RESTORE' @{}
  } catch {
    if ($_.Exception.Message -ne 'LMR:RESTORED_DATA_MISMATCH') { throw }
    $jsonBlocked = $true
  }
  if (-not $jsonBlocked) { Stop-Maintenance 'PG18_JSONB_MUTATION_UNDETECTED' }
  Write-Output 'PASS cross-version concurrent text and JSONB mutation detection'
  Write-Output 'CROSS_VERSION_GATE_PASS'
} finally {
  $cleanupSafe = $true
  try { if ($target) { Stop-DisposableCluster $config $target } }
  catch { $cleanupSafe = $false }
  if ($containerCreated) {
    try {
      $inspection = @(& docker inspect $container 2>$null | ConvertFrom-Json)
      if ($LASTEXITCODE -ne 0 -or $inspection.Count -ne 1 -or
          $inspection[0].Config.Labels.'legalhub.runner.test' -ne $id) {
        $cleanupSafe = $false
      } else {
        $discard = @(& docker stop --time 15 $container 2>$null)
        if ($LASTEXITCODE -ne 0) { $cleanupSafe = $false }
        if ($cleanupSafe) {
          $discard = @(& docker rm $container 2>$null)
          if ($LASTEXITCODE -ne 0) { $cleanupSafe = $false }
        }
      }
    } catch { $cleanupSafe = $false }
  }
  if ($cleanupSafe -and (Test-Path -LiteralPath $root)) {
    try {
      [void](Assert-ChildPath $base $root)
      Assert-NotReparsePoint $root
      Assert-PrivateAcl $root
      if ((Get-Content -LiteralPath $marker -Raw).Trim() -ne $id) {
        Stop-Maintenance 'CROSS_VERSION_MARKER_INVALID'
      }
      $stack = [Collections.Generic.Stack[string]]::new()
      $stack.Push($root)
      while ($stack.Count -gt 0) {
        foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($stack.Pop())) {
          $attributes = [IO.File]::GetAttributes($entry)
          if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            Stop-Maintenance 'CROSS_VERSION_REPARSE_FORBIDDEN'
          }
          if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) { $stack.Push($entry) }
        }
      }
      Remove-Item -LiteralPath $root -Recurse -Force
      $cleanupVerified = $true
    } catch { $cleanupSafe = $false }
  }
  if (-not $cleanupSafe -or -not $cleanupVerified) {
    Write-Output "CROSS_VERSION_CLEANUP_BLOCKED: $root"
    throw 'CROSS_VERSION_CLEANUP_BLOCKED'
  }
}
