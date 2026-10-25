Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
. (Join-Path $repo 'scripts/local-maintenance/sql-audit.ps1')
. (Join-Path $repo 'scripts/local-maintenance/plan.ps1')

function Assert([bool]$Condition, [string]$Name) {
  if (-not $Condition) { throw "TEST FAIL: $Name" }
  Write-Output "PASS $Name"
}

function Expect-Block([scriptblock]$Action, [string]$Code) {
  try { & $Action | Out-Null }
  catch {
    if ($_.Exception.Message -eq "LMR:$Code") {
      Write-Output "PASS blocked $Code"
      return
    }
    throw
  }
  throw "TEST FAIL: expected block $Code"
}

$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
foreach ($tool in @('initdb.exe', 'pg_ctl.exe', 'createdb.exe', 'pg_dump.exe',
    'pg_restore.exe', 'psql.exe')) {
  Assert (Test-Path -LiteralPath (Join-Path $pgBin $tool)) "PostgreSQL 18 $tool"
}

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
$restore = $null
try {
  $migration = Join-Path $repo 'prisma/migrations/20261024160000_meta_message_reads/migration.sql'
  $audit = Test-MigrationSql $migration
  Assert ($audit.StatementCount -eq 8 -and $audit.Risk -eq 'MEDIUM') 'approved additive SQL audit'
  $badSql = Join-Path $root 'bad.sql'
  [IO.File]::WriteAllText($badSql, 'DROP TABLE "LeadMessage";', [Text.UTF8Encoding]::new($false))
  Expect-Block { Test-MigrationSql $badSql } 'SQL_DESTRUCTIVE_OR_UNSUPPORTED'
  [IO.File]::WriteAllText($badSql, 'ALTER TABLE "Lead" ADD COLUMN "x" TEXT DEFAULT now();',
    [Text.UTF8Encoding]::new($false))
  Expect-Block { Test-MigrationSql $badSql } 'SQL_ADD_COLUMN_UNSUPPORTED'

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
  $readConfig = Read-MaintenanceConfig $configFile $true
  $readUri = Get-PrivateDatabaseUri $readConfig 'DIRECT_URL' $true
  Assert ($readUri.Host -eq '127.0.0.1' -and
    $readUri.AbsolutePath.TrimStart('/') -eq $dbName) 'synthetic target accepted'
  [IO.File]::WriteAllText($config.environmentFile,
    'DIRECT_URL=postgresql://test:CANARY_SECRET@db.fake.supabase.co:5432/postgres',
    [Text.UTF8Encoding]::new($false))
  Expect-Block { Get-PrivateDatabaseUri $readConfig 'DIRECT_URL' $true } 'ENV_TARGET_MISMATCH_DIRECT_URL'
  [IO.File]::WriteAllText($config.environmentFile,
    "DIRECT_URL=$($sourceUri.AbsoluteUri)`n", [Text.UTF8Encoding]::new($false))

  $schema = @'
CREATE TABLE public."_prisma_migrations" (migration_name text PRIMARY KEY, checksum text NOT NULL,
  started_at timestamptz DEFAULT now(), finished_at timestamptz DEFAULT now(), rolled_back_at timestamptz);
CREATE TABLE public."LeadMessage" (id integer PRIMARY KEY, body text);
CREATE TABLE public."Lead" (id integer PRIMARY KEY);
CREATE TABLE public."Organization" (id integer PRIMARY KEY);
CREATE TABLE public."User" (id integer PRIMARY KEY);
CREATE TABLE public."NotificationPreference" (id integer PRIMARY KEY);
INSERT INTO public."_prisma_migrations"(migration_name, checksum) VALUES ('20260101000000_synthetic_init', 'abc');
INSERT INTO public."LeadMessage" VALUES (1, 'SYNTHETIC ONLY');
INSERT INTO public."Lead" VALUES (1);
INSERT INTO public."Organization" VALUES (1);
INSERT INTO public."User" VALUES (1);
INSERT INTO public."NotificationPreference" VALUES (1);
'@
  $schemaPath = Join-Path $root 'synthetic-schema.sql'
  [IO.File]::WriteAllText($schemaPath, $schema, [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $readUri 'psql.exe' @(
      '-X', '-v', 'ON_ERROR_STOP=1', '-f', $schemaPath) 'SYNTHETIC_SCHEMA_FAILED')
  $snapshot = Get-DatabaseSnapshot $config $readUri
  Assert ([long]$snapshot.leadMessageRows -eq 1) 'synthetic snapshot'
  Assert-LockSafety $config $readUri $snapshot @('LeadMessage')
  $before = Get-RepresentativeFingerprints $config $readUri
  $backup = New-PrivateBackup $config $readUri $testId
  Assert ($backup.Bytes -gt 0 -and $backup.TocEntries -gt 6) 'private synthetic backup'
  $restore = New-DisposableCluster $config ('restore' + $testId)
  Restore-DisposableBackup $config $restore $backup
  $after = Get-RepresentativeFingerprints $config $restore.Uri
  Compare-RepresentativeFingerprints $before $after
  Write-Output 'PASS synthetic isolated restore and row fingerprints'
  $additiveSql = Join-Path $root 'synthetic-additive.sql'
  [IO.File]::WriteAllText($additiveSql,
    'ALTER TABLE public."LeadMessage" ADD COLUMN "liveReceipt" integer;',
    [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $restore.Uri 'psql.exe' @(
      '-X', '-v', 'ON_ERROR_STOP=1', '-f', $additiveSql) 'SYNTHETIC_MIGRATION_FAILED')
  $afterMigration = Get-RepresentativeFingerprints $config $restore.Uri @{
    LeadMessage = @('liveReceipt')
  }
  Compare-RepresentativeFingerprints $before $afterMigration
  Write-Output 'PASS synthetic isolated additive migration integrity'
  $mutationPath = Join-Path $root 'synthetic-mutation.sql'
  [IO.File]::WriteAllText($mutationPath,
    'UPDATE public."LeadMessage" SET body=''CHANGED'' WHERE id=1;',
    [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $restore.Uri 'psql.exe' @(
      '-X', '-v', 'ON_ERROR_STOP=1', '-f', $mutationPath) 'SYNTHETIC_MUTATION_FAILED')
  $changed = Get-RepresentativeFingerprints $config $restore.Uri @{
    LeadMessage = @('liveReceipt')
  }
  Expect-Block { Compare-RepresentativeFingerprints $before $changed } 'RESTORED_DATA_MISMATCH'
  $missingBackup = [pscustomobject]@{ Path = (Join-Path $root 'missing.dump'); Sha256 = $backup.Sha256 }
  Expect-Block { Restore-DisposableBackup $config $restore $missingBackup } 'BACKUP_CHANGED_BEFORE_RESTORE'
  $corruptPath = Join-Path $backups 'corrupt.dump'
  [IO.File]::WriteAllText($corruptPath, 'SYNTHETIC CORRUPT ARCHIVE',
    [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $corruptPath
  $corruptBackup = [pscustomobject]@{
    Path = $corruptPath
    Sha256 = (Get-FileHash -LiteralPath $corruptPath -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  Expect-Block { Restore-DisposableBackup $config $restore $corruptBackup } 'ISOLATED_RESTORE_FAILED'

  $plan = [ordered]@{ version = 1; runId = $testId; createdUtc = [DateTime]::UtcNow.ToString('o');
    approvedCommit = ('a' * 40); pending = @('20261024160000_meta_message_reads');
    backup = [ordered]@{ path = $backup.Path; sha256 = $backup.Sha256; bytes = $backup.Bytes } }
  $planPath = Save-SealedPlan $config $plan
  $sealed = Read-SealedPlan $config $planPath
  Assert ($sealed.runId -eq $testId) 'sealed plan round trip'
  Assert-BackupSealed $config $sealed
  $sealed.backup.path = Join-Path $backups 'missing.dump'
  Expect-Block { Assert-BackupSealed $config $sealed } 'SEALED_BACKUP_MISSING'
  $sealed.backup.path = $backup.Path
  Expect-Block { Mark-PlanAttempted $config $sealed; Mark-PlanAttempted $config $sealed } 'PLAN_ALREADY_ATTEMPTED'
  Assert (-not (Test-ApprovalPhrase $config $sealed 'yes')) 'unauthorized apply refused'
  $tampered = Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
  $tampered.payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{}'))
  [IO.File]::WriteAllText($planPath, ($tampered | ConvertTo-Json -Compress),
    [Text.UTF8Encoding]::new($false))
  Expect-Block { Read-SealedPlan $config $planPath } 'PLAN_SEAL_MISMATCH'
  Expect-Block { Get-GitCheckpoint $repo ('0' * 40) $true } 'APPROVED_COMMIT_MISMATCH'
  $dirtyRepo = Join-Path $root 'dirty-repo'
  [void](New-Item -ItemType Directory -Path $dirtyRepo)
  [void](& git -C $dirtyRepo init -q)
  [void](& git -C $dirtyRepo config user.name 'Synthetic Test')
  [void](& git -C $dirtyRepo config user.email 'synthetic@example.invalid')
  $migrationRoot = Join-Path $dirtyRepo 'prisma/migrations/20260101000000_synthetic'
  [void](New-Item -ItemType Directory -Path $migrationRoot -Force)
  $migrationPath = Join-Path $migrationRoot 'migration.sql'
  [IO.File]::WriteAllText($migrationPath,
    'CREATE TABLE "Synthetic" ("id" INTEGER);', [Text.UTF8Encoding]::new($false))
  [void](& git -C $dirtyRepo add .)
  [void](& git -C $dirtyRepo commit -qm 'Synthetic baseline')
  $head = (& git -C $dirtyRepo rev-parse HEAD).Trim()
  $originalHash = (Get-MigrationFiles $dirtyRepo)[0].Sha256
  [IO.File]::AppendAllText($migrationPath, "`n-- changed after approval")
  $changedHash = (Get-MigrationFiles $dirtyRepo)[0].Sha256
  Assert ($originalHash -ne $changedHash) 'changed SQL checksum detected'
  Expect-Block { Get-GitCheckpoint $dirtyRepo $head $true } 'DIRTY_CHECKOUT'
  Write-Output 'WINDOWS SYNTHETIC TESTS PASS'
} catch {
  Write-Output "TEST ERROR: $($_.Exception.Message)"
  throw
} finally {
  if ($restore) { try { Stop-DisposableCluster $config $restore } catch { Write-Warning $_.Exception.Message } }
  if ($source) { try { Stop-DisposableCluster $config $source } catch { Write-Warning $_.Exception.Message } }
  $safeRoot = Assert-ChildPath $testBase $root
  if ((Split-Path -Leaf $safeRoot) -eq $testId -and
      (Test-Path -LiteralPath $safeRoot -PathType Container)) {
    foreach ($file in [IO.Directory]::EnumerateFiles($safeRoot, '*',
        [IO.SearchOption]::AllDirectories)) {
      [IO.File]::SetAttributes($file, [IO.FileAttributes]::Normal)
    }
    for ($attempt = 0; $attempt -lt 8; $attempt++) {
      try { [IO.Directory]::Delete($safeRoot, $true); break }
      catch [IO.IOException] { Start-Sleep -Milliseconds 500 }
    }
  }
}
