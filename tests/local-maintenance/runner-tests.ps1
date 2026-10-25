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
  nodeBin = 'C:\Program Files\nodejs'
  applicationRole = 'restore_admin'; expectedApplicationHost = '127.0.0.1'
}
$source = $null
$restore = $null
$substitutePath = $null
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
  foreach ($unsafe in @(
      'CREATE TABLE "Probe" ("id" INTEGER DEFAULT 0 + unexpected_function());',
      'CREATE TABLE "Probe" ("id" INTEGER DEFAULT false::integer);',
      'CREATE TABLE "Probe" ("id" custom_type);',
      'CREATE TABLE "Probe" ("id" INTEGER DEFAULT 1 * 2);')) {
    [IO.File]::WriteAllText($badSql, $unsafe, [Text.UTF8Encoding]::new($false))
    Expect-Block { Test-MigrationSql $badSql } 'SQL_CREATE_TABLE_ITEM_UNSUPPORTED'
  }
  [IO.File]::WriteAllText($badSql, 'CREATE TABLE "Probe" ("id" INTEGER CHECK (id > 0));',
    [Text.UTF8Encoding]::new($false))
  Expect-Block { Test-MigrationSql $badSql } 'SQL_DESTRUCTIVE_OR_UNSUPPORTED'

  foreach ($stage in @('BeforeInitdb', 'AfterInitdb', 'AfterStart',
      'AfterReady', 'AfterCreatedb')) {
    $faultId = 'fault' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
    $code = 'TEST_INJECTED_' + (($stage -creplace '([a-z])([A-Z])', '$1_$2').ToUpperInvariant())
    Expect-Block { New-DisposableCluster $config $faultId $stage } $code
    Assert (-not (Test-Path -LiteralPath (Join-Path $private "isolated/$faultId"))) `
      "partial cluster cleanup $stage"
  }

  $canaries = @{
    PGHOSTADDR = '198.51.100.99'; PGSERVICEFILE = 'CANARY_SERVICE_FILE'
    NODE_OPTIONS = '--require=CANARY_NODE_MODULE'; OTHER_DATABASE_URL = 'CANARY_SECRET'
  }
  $oldCanaries = @{}
  foreach ($key in $canaries.Keys) {
    $oldCanaries[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $canaries[$key], 'Process')
  }
  try {
    $child = Invoke-WithIsolatedEnvironment $config $null @{} {
      & (Join-Path $config.nodeBin 'node.exe') -e `
        'console.log([process.env.PGHOSTADDR,process.env.PGSERVICEFILE,process.env.NODE_OPTIONS,process.env.OTHER_DATABASE_URL].join("|"))'
    }
    Assert ($child -eq '|||') 'malicious ambient environment removed from child'
  } finally {
    foreach ($key in $canaries.Keys) {
      [Environment]::SetEnvironmentVariable($key, $oldCanaries[$key], 'Process')
    }
  }

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
  $readConfig = Read-MaintenanceConfig $configFile $true
  $readUri = Get-PrivateDatabaseUri $readConfig 'DIRECT_URL' $true
  $lock1 = Enter-TargetLock $config $readUri
  try {
    Expect-Block { Enter-TargetLock $config $readUri } 'TARGET_APPLY_ALREADY_RUNNING'
  } finally { $lock1.Dispose() }
  $lock2 = Enter-TargetLock $config $readUri
  $lock2.Dispose()
  Write-Output 'PASS target-wide apply lock and release'
  Assert ($readUri.Host -eq '127.0.0.1' -and
    $readUri.AbsolutePath.TrimStart('/') -eq $dbName) 'synthetic target accepted'
  $dbLock = Start-DatabaseApplyLock $config $readUri
  try {
    Expect-Block { Start-DatabaseApplyLock $config $readUri } `
      'TARGET_DATABASE_APPLY_ALREADY_RUNNING'
  } finally { Stop-DatabaseApplyLock $dbLock }
  $dbLock = Start-DatabaseApplyLock $config $readUri
  Stop-DatabaseApplyLock $dbLock
  Write-Output 'PASS database-wide advisory apply lock and release'
  [IO.File]::WriteAllText($config.environmentFile,
    'DIRECT_URL=postgresql://test:CANARY_SECRET@db.fake.supabase.co:5432/postgres',
    [Text.UTF8Encoding]::new($false))
  Expect-Block { Get-PrivateDatabaseUri $readConfig 'DIRECT_URL' $true } 'ENV_TARGET_MISMATCH_DIRECT_URL'
  [IO.File]::WriteAllText($config.environmentFile,
    "DIRECT_URL=$($sourceUri.AbsoluteUri)`nDATABASE_URL=$($sourceUri.AbsoluteUri)`n", [Text.UTF8Encoding]::new($false))

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
  $timeoutDb = 'legalhub_runner_synthetic_lock_' + $testId
  [void](Invoke-PostgresTool $config $source.Uri 'createdb.exe' @(
      '-T', 'template0', $timeoutDb) 'SYNTHETIC_LOCK_DB_FAILED')
  $timeoutUri = [Uri]::new($sourceUri.AbsoluteUri.Replace($dbName, $timeoutDb))
  $timeoutFixture = Join-Path $root 'timeout-prisma'
  $baseMigration = Join-Path $timeoutFixture 'migrations/20261024000000_base'
  $timeoutMigration = Join-Path $timeoutFixture 'migrations/20261025000000_lock_probe'
  [void](New-Item -ItemType Directory -Path $baseMigration -Force)
  [IO.File]::WriteAllText((Join-Path $timeoutFixture 'schema.prisma'), @'
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
}
'@, [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $timeoutFixture 'migrations/migration_lock.toml'),
    'provider = "postgresql"', [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $baseMigration 'migration.sql'),
    'CREATE TABLE public."LeadMessage" (id INTEGER PRIMARY KEY);',
    [Text.UTF8Encoding]::new($false))
  $baseUri = (Get-PinnedPrismaUri $config $timeoutUri $false).AbsoluteUri
  $baseExit = Invoke-WithIsolatedEnvironment $config $null @{
    DATABASE_URL = $baseUri; DIRECT_URL = $baseUri
  } {
    Push-Location $timeoutFixture
    try {
      $output = @(& (Join-Path $config.nodeBin 'node.exe') `
          (Join-Path $repo 'node_modules/prisma/build/index.js') migrate deploy `
          --schema (Join-Path $timeoutFixture 'schema.prisma') 2>$null)
      return $LASTEXITCODE
    } finally { Pop-Location }
  }
  Assert ($baseExit -eq 0) 'synthetic Prisma baseline applied'
  [void](New-Item -ItemType Directory -Path $timeoutMigration)
  [IO.File]::WriteAllText((Join-Path $timeoutMigration 'migration.sql'),
    'ALTER TABLE public."LeadMessage" ADD COLUMN "probe" BOOLEAN DEFAULT false;',
    [Text.UTF8Encoding]::new($false))
  $blocker = Invoke-WithIsolatedEnvironment $config $timeoutUri @{} {
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = Join-Path $config.postgresBin 'psql.exe'
    $psi.Arguments = '-X -q -A -t -v ON_ERROR_STOP=1'
    $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    [Diagnostics.Process]::Start($psi)
  }
  try {
    $blockerError = $blocker.StandardError.ReadToEndAsync()
    $blocker.StandardInput.WriteLine('BEGIN; LOCK TABLE public."LeadMessage" IN ACCESS EXCLUSIVE MODE; SELECT ''LOCKED'';')
    $blocker.StandardInput.Flush()
    $lockLine = $blocker.StandardOutput.ReadLineAsync()
    Assert ($lockLine.Wait(10000) -and $lockLine.Result -eq 'LOCKED') `
      'synthetic DDL blocker acquired'
    $bounded = Get-PinnedPrismaUri $config $timeoutUri $true
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $migrationResult = Invoke-WithIsolatedEnvironment $config $null @{
      DATABASE_URL = $bounded.AbsoluteUri; DIRECT_URL = $bounded.AbsoluteUri
    } {
      $psi = [Diagnostics.ProcessStartInfo]::new()
      $psi.FileName = Join-Path $config.nodeBin 'node.exe'
      foreach ($argument in @((Join-Path $repo 'node_modules/prisma/build/index.js'),
          'migrate', 'deploy', '--schema', (Join-Path $timeoutFixture 'schema.prisma'))) {
        [void]$psi.ArgumentList.Add($argument)
      }
      $psi.WorkingDirectory = $timeoutFixture
      $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
      $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
      $process = [Diagnostics.Process]::Start($psi)
      try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(15000)) {
          $process.Kill($true)
          Stop-Maintenance 'PRISMA_DDL_TIMEOUT_NOT_ENFORCED'
        }
        return [pscustomobject]@{ ExitCode = $process.ExitCode;
          Diagnostic = (((($stdout.Result + ' ' + $stderr.Result) -replace
            [regex]::Escape($timeoutUri.UserInfo), '<redacted>') -replace
            [regex]::Escape([Uri]::UnescapeDataString($timeoutUri.UserInfo.Split(':',2)[1])), '<redacted>')) }
      } finally { $process.Dispose() }
    }
    $timer.Stop()
    $timeoutEvidence = $migrationResult.Diagnostic -match '55P03|lock[_ ]timeout|statement due to lock timeout'
    Assert ($migrationResult.ExitCode -ne 0 -and $timer.Elapsed.TotalSeconds -ge 4 -and
      $timer.Elapsed.TotalSeconds -lt 15 -and $timeoutEvidence) `
      'Prisma DDL lock timeout bounded near five seconds'
    $probe = Invoke-ReadOnlyQuery $config $timeoutUri `
      "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='LeadMessage' AND column_name='probe'" 'DDL_PROBE_FAILED'
    Assert ($probe -eq '0') 'blocked synthetic DDL made no schema change'
  } finally {
    if (-not $blocker.HasExited) {
      $blocker.StandardInput.WriteLine('ROLLBACK;')
      $blocker.StandardInput.WriteLine('\q')
      $blocker.StandardInput.Flush()
      $blocker.StandardInput.Close()
      if (-not $blocker.WaitForExit(10000)) { $blocker.Kill($true) }
    }
    $blocker.Dispose()
  }
  $snapshot = Get-DatabaseSnapshot $config $readUri
  Assert ([long]$snapshot.leadMessageRows -eq 1) 'synthetic snapshot'
  Assert-LockSafety $config $readUri $snapshot @('LeadMessage')
  Expect-Block { Assert-SequenceRolePermissions $config $source @(
      [pscustomobject]@{ audit = [pscustomobject]@{ CreatedSequences = @('SyntheticSequence') } }) `
      'restore_admin' 'restricted_app' } 'SEQUENCE_PERMISSION_UNPROVEN_DIFFERENT_ROLE'
  $snapshotHolder = Start-ExportedSnapshot $config $readUri
  try {
    $before = Get-RepresentativeFingerprints $config $readUri @{} $snapshotHolder.Id
    $structureBefore = Get-StructureFingerprint $config $readUri $snapshotHolder.Id
    $concurrentWrite = Join-Path $root 'synthetic-concurrent-write.sql'
    [IO.File]::WriteAllText($concurrentWrite,
      'UPDATE public."LeadMessage" SET body=''SYNTHETIC CONCURRENT VERSION'' WHERE id=1;',
      [Text.UTF8Encoding]::new($false))
    [void](Invoke-PostgresTool $config $readUri 'psql.exe' @(
        '-X', '-v', 'ON_ERROR_STOP=1', '-f', $concurrentWrite) 'SYNTHETIC_CONCURRENT_WRITE_FAILED')
    Expect-Block { Compare-RepresentativeFingerprints $before `
        (Get-RepresentativeFingerprints $config $readUri) } 'RESTORED_DATA_MISMATCH'
    $backup = New-PrivateBackup $config $readUri $testId $snapshotHolder.Id
  } finally { Stop-ExportedSnapshot $snapshotHolder }
  Assert ($backup.Bytes -gt 0 -and $backup.TocEntries -gt 6) 'private synthetic backup'
  $restore = New-DisposableCluster $config ('restore' + $testId)
  Restore-DisposableBackup $config $restore $backup
  $after = Get-RepresentativeFingerprints $config $restore.Uri
  Compare-RepresentativeFingerprints $before $after
  Assert-StructureEqual $structureBefore (Get-StructureFingerprint $config $restore.Uri)
  Write-Output 'PASS synthetic isolated restore and row fingerprints under concurrent source write'
  $structureMutation = Join-Path $root 'synthetic-structure-mutation.sql'
  [IO.File]::WriteAllText($structureMutation,
    'CREATE INDEX "SyntheticProbeIndex" ON public."LeadMessage" (id);',
    [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $restore.Uri 'psql.exe' @(
      '-X', '-v', 'ON_ERROR_STOP=1', '-f', $structureMutation) 'SYNTHETIC_STRUCTURE_CHANGE_FAILED')
  Expect-Block { Assert-StructureEqual $structureBefore `
      (Get-StructureFingerprint $config $restore.Uri) } 'RESTORED_STRUCTURE_MISMATCH'
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
  Expect-Block { Assert-ChildPath $private (Join-Path $root 'outside-private') } `
    'PATH_OUTSIDE_PRIVATE_ROOT'
  $substituteTarget = Join-Path $root 'substitute-target'
  [void](New-Item -ItemType Directory -Path $substituteTarget)
  [IO.File]::WriteAllText((Join-Path $substituteTarget 'migration.sql'),
    'CREATE TABLE "Unapproved" (id INTEGER);', [Text.UTF8Encoding]::new($false))
  $substitutePath = Join-Path $dirtyRepo 'prisma/migrations/20260101000001_substitution'
  [void](New-Item -ItemType Junction -Path $substitutePath -Target $substituteTarget)
  Expect-Block { Get-MigrationFiles $dirtyRepo } 'REPARSE_POINT_FORBIDDEN'
  Write-Output 'PASS migration path substitution refused'
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
    if ($substitutePath -and (Test-Path -LiteralPath $substitutePath)) {
      [void](Assert-ChildPath $safeRoot $substitutePath)
      if (((Get-Item -LiteralPath $substitutePath -Force).Attributes -band
            [IO.FileAttributes]::ReparsePoint) -ne 0) {
        [IO.Directory]::Delete($substitutePath, $false)
      }
    }
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
