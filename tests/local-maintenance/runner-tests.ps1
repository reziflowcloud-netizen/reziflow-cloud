param(
  [switch]$InjectPeerPartialStopFailure,
  [string]$InjectedTestId
)
if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw 'TEST_REQUIRES_POWERSHELL_7: use pwsh -NoProfile -File tests/local-maintenance/runner-tests.ps1'
}
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

function Assert-RegisteredDisposableRoots([object[]]$Configs, [string]$Root,
    [object[]]$Clusters, [bool]$RequireEmpty) {
  if (@($Configs).Count -eq 0) { Stop-Maintenance 'TEST_PRIVATE_ROOT_REGISTRY_EMPTY' }
  $seen = [Collections.Generic.HashSet[string]]::new(
    [StringComparer]::OrdinalIgnoreCase)
  foreach ($registered in $Configs) {
    if (-not $registered -or -not $registered.privateDirectory) {
      Stop-Maintenance 'TEST_PRIVATE_ROOT_REGISTRY_INVALID'
    }
    $privateRoot = Assert-ChildPath $Root $registered.privateDirectory
    if (-not $seen.Add([IO.Path]::GetFullPath($privateRoot))) {
      Stop-Maintenance 'TEST_PRIVATE_ROOT_DUPLICATE'
    }
    Assert-NotReparsePoint $privateRoot
    Assert-PrivateAcl $privateRoot
    $isolatedRoot = Join-Path $privateRoot 'isolated'
    if (-not (Test-Path -LiteralPath $isolatedRoot)) { continue }
    Assert-NotReparsePoint $isolatedRoot
    foreach ($entry in @(Get-ChildItem -LiteralPath $isolatedRoot -Force)) {
      if ($RequireEmpty) { Stop-Maintenance 'TEST_PARTIAL_CLUSTER_UNVERIFIED' }
      if (-not $entry.PSIsContainer -or
          ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-Maintenance 'TEST_PARTIAL_CLUSTER_UNVERIFIED'
      }
      $match = @($Clusters | Where-Object {
          $_ -and [IO.Path]::GetFullPath($_.Root) -eq
            [IO.Path]::GetFullPath($entry.FullName)
        })
      if ($match.Count -ne 1) { Stop-Maintenance 'TEST_PARTIAL_CLUSTER_UNVERIFIED' }
    }
  }
}

function Assert-TestCleanupSafe([object[]]$Configs, [string]$Base, [string]$Root,
    [string]$Id, [object[]]$Clusters, [string]$AllowedJunction = '') {
  $Config = $Configs[0]
  if ($Id -notmatch '^[0-9a-f]{12}$' -or
      [IO.Path]::GetFullPath($Root) -ne [IO.Path]::GetFullPath((Join-Path $Base $Id))) {
    Stop-Maintenance 'TEST_CLEANUP_PATH_SUBSTITUTED'
  }
  [void](Assert-ChildPath $Base $Root)
  Assert-NotReparsePoint $Root
  $marker = Join-Path $Root 'runner-test-owned.txt'
  if (-not (Test-Path -LiteralPath $marker -PathType Leaf) -or
      (Get-Content -LiteralPath $marker -Raw).Trim() -ne $Id) {
    Stop-Maintenance 'TEST_CLEANUP_MARKER_MISMATCH'
  }
  foreach ($cluster in $Clusters) {
    if (-not $cluster) { continue }
    if ($cluster.Port -gt 0) {
      $ready = Invoke-WithIsolatedEnvironment $Config $null @{} {
        $oldPreference = $ErrorActionPreference
        try {
          $ErrorActionPreference = 'Continue'
          $output = @(& (Join-Path $Config.postgresBin 'pg_isready.exe') '-h' '127.0.0.1' `
              '-p' ([string]$cluster.Port) '-q' 2>$null)
          return $LASTEXITCODE
        } finally { $ErrorActionPreference = $oldPreference }
      }
      if ($ready -eq 0) { Stop-Maintenance 'TEST_CLUSTER_STILL_RUNNING' }
    }
    if (Test-Path -LiteralPath $cluster.Root) {
      Stop-Maintenance 'TEST_CLUSTER_CLEANUP_UNVERIFIED'
    }
  }
  $stack = [Collections.Generic.Stack[string]]::new()
  $stack.Push([IO.Path]::GetFullPath($Root))
  while ($stack.Count -gt 0) {
    foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($stack.Pop())) {
      $attributes = [IO.File]::GetAttributes($entry)
      if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        if ($AllowedJunction -and
            [IO.Path]::GetFullPath($entry) -eq [IO.Path]::GetFullPath($AllowedJunction)) {
          continue
        }
        Stop-Maintenance 'TEST_REPARSE_DESCENDANT_FORBIDDEN'
      }
      if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) { $stack.Push($entry) }
    }
  }
  Assert-RegisteredDisposableRoots $Configs $Root $Clusters $true
}

$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
foreach ($tool in @('initdb.exe', 'pg_ctl.exe', 'createdb.exe', 'pg_dump.exe',
    'pg_restore.exe', 'psql.exe')) {
  Assert (Test-Path -LiteralPath (Join-Path $pgBin $tool)) "PostgreSQL 18 $tool"
}

if ($InjectPeerPartialStopFailure -and $InjectedTestId -notmatch '^[0-9a-f]{12}$') {
  throw 'TEST_INJECTED_ID_INVALID'
}
$testId = if ($InjectPeerPartialStopFailure) { $InjectedTestId }
  else { [Guid]::NewGuid().ToString('N').Substring(0, 12) }
$testBase = Join-Path $env:LOCALAPPDATA 'LegalHubMaintenanceRunnerTests'
if (-not (Test-Path -LiteralPath $testBase)) {
  [void](New-Item -ItemType Directory -Path $testBase)
  Set-PrivateAcl $testBase
}
Assert-PrivateAcl $testBase
$root = Assert-ChildPath $testBase (Join-Path $testBase $testId)
[void](New-Item -ItemType Directory -Path $root)
Set-PrivateAcl $root
[IO.File]::WriteAllText((Join-Path $root 'runner-test-owned.txt'), $testId,
  [Text.UTF8Encoding]::new($false))
if ($InjectPeerPartialStopFailure) {
  [IO.File]::WriteAllText((Join-Path $root 'cleanup-sentinel.txt'), 'retain-on-failure',
    [Text.UTF8Encoding]::new($false))
}
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
$registeredConfigs = [Collections.Generic.List[object]]::new()
[void]$registeredConfigs.Add($config)
$source = $null
$restore = $null
$identityPeer = $null
$peerConfig = $null
$substitutePath = $null
try {
  if ($InjectPeerPartialStopFailure) {
    $source = New-DisposableCluster $config ('source' + $testId)
    $peerPrivate = Join-Path $root 'peer-private'
    [void](New-Item -ItemType Directory -Path $peerPrivate)
    Set-PrivateAcl $peerPrivate
    [IO.File]::WriteAllText((Join-Path $peerPrivate 'peer-sentinel.txt'),
      'retain-on-failure', [Text.UTF8Encoding]::new($false))
    $peerConfig = $config | ConvertTo-Json | ConvertFrom-Json
    $peerConfig.privateDirectory = $peerPrivate
    [void]$registeredConfigs.Add($peerConfig)
    $identityPeer = New-DisposableCluster $peerConfig ('source' + $testId) `
      'AfterStartStopFailure'
    Stop-Maintenance 'TEST_PEER_FAULT_DID_NOT_BLOCK'
  }
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

  $childId = [Guid]::NewGuid().ToString('N').Substring(0, 12)
  $childRoot = Join-Path $testBase $childId
  $childError = Join-Path $root 'partial-stop-child.err'
  $childOutputPath = Join-Path $root 'partial-stop-child.out'
  $child = Start-Process -FilePath (Get-Command pwsh).Source -ArgumentList @(
      '-NoProfile', '-File',
      ('"' + (Join-Path $repo 'tests/local-maintenance/full-preflight.ps1') + '"'),
      '-InjectPartialStartStopFailure', '-InjectedTestId', $childId) `
    -PassThru -WindowStyle Hidden -RedirectStandardOutput $childOutputPath `
    -RedirectStandardError $childError
  try {
    if (-not $child.WaitForExit(90000)) {
      $child.Kill($true)
      Stop-Maintenance 'PARTIAL_STOP_CHILD_TIMEOUT'
    }
    $childExit = $child.ExitCode
  } finally { $child.Dispose() }
  $childOutput = Get-Content -LiteralPath $childOutputPath -Raw
  $sentinel = Join-Path $childRoot 'cleanup-sentinel.txt'
  $lifecyclePath = Join-Path $childRoot `
    "private/isolated/source$childId/runner-lifecycle.json"
  Assert ($childExit -ne 0 -and (Test-Path -LiteralPath $sentinel) -and
    (Test-Path -LiteralPath $lifecyclePath) -and
    ((($childOutput -join ' ') + (Get-Content -LiteralPath $childError -Raw)) -match
      'TEST_PARTIAL_CLUSTER_UNVERIFIED')) `
    'outer finally refused recursive cleanup after partial-start/failed-stop'
  $lifecycle = Get-Content -LiteralPath $lifecyclePath -Raw | ConvertFrom-Json
  Assert ($lifecycle.phase -eq 'STOP_UNVERIFIED' -and $lifecycle.port -gt 0) `
    'partial cluster lifecycle retained before constructor return'
  $childConfig = [pscustomobject]@{
    targetKind = 'synthetic'; privateDirectory = (Join-Path $childRoot 'private')
    postgresBin = $pgBin; nodeBin = 'C:\Program Files\nodejs'
  }
  $live = Invoke-WithIsolatedEnvironment $childConfig $null @{} {
    $oldPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $output = @(& (Join-Path $pgBin 'pg_isready.exe') '-h' '127.0.0.1' `
          '-p' ([string]$lifecycle.port) '-q' 2>$null)
      return $LASTEXITCODE
    } finally { $ErrorActionPreference = $oldPreference }
  }
  Assert ($live -eq 0) 'post-start injection left a real isolated server for guarded recovery'
  Stop-DisposableCluster $childConfig $lifecycle
  Assert ((Test-Path -LiteralPath $sentinel) -and (Test-Path -LiteralPath $childRoot)) `
    'failed outer cleanup retained sentinel and local test root'
  Write-Output "PASS partial-start/failed-stop regression; retained local path: $childRoot"

  $peerChildId = [Guid]::NewGuid().ToString('N').Substring(0, 12)
  $peerChildRoot = Join-Path $testBase $peerChildId
  $peerChildOut = Join-Path $root 'peer-partial-child.out'
  $peerChildErr = Join-Path $root 'peer-partial-child.err'
  $peerChild = Start-Process -FilePath (Get-Command pwsh).Source -ArgumentList @(
      '-NoProfile', '-File',
      ('"' + (Join-Path $repo 'tests/local-maintenance/runner-tests.ps1') + '"'),
      '-InjectPeerPartialStopFailure', '-InjectedTestId', $peerChildId) `
    -PassThru -WindowStyle Hidden -RedirectStandardOutput $peerChildOut `
    -RedirectStandardError $peerChildErr
  try {
    if (-not $peerChild.WaitForExit(90000)) {
      $peerChild.Kill($true)
      Stop-Maintenance 'PEER_PARTIAL_STOP_CHILD_TIMEOUT'
    }
    $peerChildExit = $peerChild.ExitCode
  } finally { $peerChild.Dispose() }
  $peerChildText = (Get-Content -LiteralPath $peerChildOut -Raw) +
    (Get-Content -LiteralPath $peerChildErr -Raw)
  $peerPrivateRoot = Join-Path $peerChildRoot 'peer-private'
  $peerLifecyclePath = Join-Path $peerPrivateRoot `
    "isolated/source$peerChildId/runner-lifecycle.json"
  $primaryLifecyclePath = Join-Path $peerChildRoot `
    "private/isolated/source$peerChildId/runner-lifecycle.json"
  $peerSentinel = Join-Path $peerPrivateRoot 'peer-sentinel.txt'
  $parentSentinel = Join-Path $peerChildRoot 'cleanup-sentinel.txt'
  Assert ($peerChildExit -ne 0 -and
    $peerChildText -match 'TEST_PARTIAL_CLUSTER_UNVERIFIED' -and
    $peerChildText -match 'identityPeer=NULL' -and
    (Test-Path -LiteralPath $peerLifecyclePath) -and
    (Test-Path -LiteralPath $primaryLifecyclePath) -and
    (Test-Path -LiteralPath $peerSentinel) -and
    (Test-Path -LiteralPath $parentSentinel)) `
    'runner-tests outer finally blocked peer partial-start/failed-stop before deletion'
  $peerLifecycle = Get-Content -LiteralPath $peerLifecyclePath -Raw | ConvertFrom-Json
  $primaryLifecycle = Get-Content -LiteralPath $primaryLifecyclePath -Raw | ConvertFrom-Json
  Assert ($peerLifecycle.phase -eq 'STOP_UNVERIFIED' -and
    $primaryLifecycle.phase -eq 'DATABASE_CREATED' -and
    $peerLifecycle.port -gt 0 -and $primaryLifecycle.port -gt 0) `
    'peer and primary lifecycle records retained intact'
  foreach ($candidate in @($peerLifecycle, $primaryLifecycle)) {
    $candidateConfig = [pscustomobject]@{
      targetKind = 'synthetic'
      privateDirectory = if ($candidate.runId -eq ('source' + $peerChildId) -and
          $candidate.root.StartsWith($peerPrivateRoot, [StringComparison]::OrdinalIgnoreCase)) {
        $peerPrivateRoot
      } else { Join-Path $peerChildRoot 'private' }
      postgresBin = $pgBin; nodeBin = 'C:\Program Files\nodejs'
    }
    $live = Invoke-WithIsolatedEnvironment $candidateConfig $null @{} {
      $oldPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $output = @(& (Join-Path $pgBin 'pg_isready.exe') '-h' '127.0.0.1' `
            '-p' ([string]$candidate.port) '-q' 2>$null)
        return $LASTEXITCODE
      } finally { $ErrorActionPreference = $oldPreference }
    }
    Assert ($live -eq 0) 'injected peer case retained live owned server before recovery'
    Stop-DisposableCluster $candidateConfig $candidate
  }
  Assert ((Test-Path -LiteralPath $peerSentinel) -and
    (Test-Path -LiteralPath $parentSentinel) -and
    (Test-Path -LiteralPath $peerChildRoot)) `
    'peer failed cleanup retained parent root and both sentinels'
  Write-Output "PASS peer-private partial-start/failed-stop regression; retained local path: $peerChildRoot"

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
  $peerPrivate = Join-Path $root 'peer-private'
  [void](New-Item -ItemType Directory -Path $peerPrivate)
  Set-PrivateAcl $peerPrivate
  $peerConfig = $config | ConvertTo-Json | ConvertFrom-Json
  $peerConfig.privateDirectory = $peerPrivate
  [void]$registeredConfigs.Add($peerConfig)
  $identityPeer = New-DisposableCluster $peerConfig ('source' + $testId)
  $directIdentity = Get-DatabaseIdentityState $config $source.Uri
  $peerIdentity = Get-DatabaseIdentityState $peerConfig $identityPeer.Uri
  Assert ($directIdentity.database -eq $peerIdentity.database -and
    [string]$directIdentity.databaseOid -eq [string]$peerIdentity.databaseOid -and
    $directIdentity.role -eq $peerIdentity.role -and
    $directIdentity.clusterIdentity -ne $peerIdentity.clusterIdentity) `
    'distinct clusters share name/OID/role but have distinct system identifiers'
  Expect-Block { Get-ApplicationRoleState $config $identityPeer.Uri $directIdentity } `
    'APPLICATION_ROLE_TARGET_MISMATCH'
  $appRole = 'identity_app_' + $testId
  $appPassword = [Guid]::NewGuid().ToString('N')
  $identitySql = Join-Path $root 'synthetic-identity.sql'
  [IO.File]::WriteAllText($identitySql,
    "CREATE ROLE `"$appRole`" LOGIN PASSWORD '$appPassword' NOSUPERUSER;" +
    ' REVOKE EXECUTE ON FUNCTION pg_control_system() FROM PUBLIC;',
    [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $readUri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $identitySql) 'SYNTHETIC_IDENTITY_ROLE_FAILED')
  $appUri = [Uri]::new("postgresql://${appRole}:$appPassword@127.0.0.1:$($source.Port)/${dbName}?schema=public")
  $appConfig = $config | ConvertTo-Json | ConvertFrom-Json
  $appConfig.applicationRole = $appRole
  $sameDbSnapshot = Get-DatabaseSnapshot $config $readUri
  Expect-Block { Get-ApplicationRoleState $appConfig $appUri $sameDbSnapshot } `
    'CLUSTER_IDENTITY_UNAVAILABLE'
  [IO.File]::WriteAllText($identitySql,
    "GRANT EXECUTE ON FUNCTION pg_control_system() TO `"$appRole`";",
    [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $readUri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $identitySql) 'SYNTHETIC_IDENTITY_GRANT_FAILED')
  $confirmedApp = Get-ApplicationRoleState $appConfig $appUri $sameDbSnapshot
  Assert ($confirmedApp.clusterIdentity -eq $sameDbSnapshot.clusterIdentity -and
    $confirmedApp.role -eq $appRole) 'two credentials reach same confirmed database cluster'
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
  Expect-Block { Assert-SequenceRolePermissions $config $readUri $source @(
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
  $sequenceAudit = @([pscustomobject]@{
      audit = [pscustomobject]@{ CreatedSequences = @('SyntheticSequence') }
    })
  $sequenceSql = Join-Path $root 'synthetic-sequence.sql'
  [IO.File]::WriteAllText($sequenceSql,
    'CREATE SEQUENCE public."SyntheticSequence";', [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $restore.Uri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $sequenceSql) 'SYNTHETIC_SEQUENCE_CREATE_FAILED')
  Assert-SequenceRolePermissions $config $readUri $restore $sequenceAudit `
    'restore_admin' 'restore_admin'
  Write-Output 'PASS sequence privilege model uses isolated non-superuser role'
  $finalState = [pscustomobject]@{
    audits = $sequenceAudit; snapshot = [pscustomobject]@{ role = 'restore_admin' }
    applicationRole = 'restore_admin'
  }
  $targetLock = Enter-TargetLock $config $readUri
  $databaseLock = $null
  try {
    $databaseLock = Start-DatabaseApplyLock $config $readUri
    Assert-FinalSequencePermissions $config $readUri $finalState
    Assert (-not $databaseLock.Process.HasExited) `
      'unchanged sequence ACL passed under both Apply locks'
  } finally {
    if ($databaseLock) { Stop-DatabaseApplyLock $databaseLock }
    $targetLock.Dispose()
  }
  Expect-Block { Assert-SequenceRolePermissions $config $null $restore $sequenceAudit `
      'restore_admin' 'restore_admin' } 'SEQUENCE_PRIVILEGE_SOURCE_UNKNOWN'
  [IO.File]::WriteAllText($sequenceSql,
    "ALTER DEFAULT PRIVILEGES FOR ROLE `"restore_admin`" REVOKE USAGE, UPDATE ON SEQUENCES FROM `"restore_admin`";",
    [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $readUri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $sequenceSql) 'SYNTHETIC_DEFAULT_ACL_FAILED')
  Assert ((Get-ApplicableSequenceDefaultAclCount $config $readUri) -gt 0) `
    'revoked sequence default ACL detected'
  Expect-Block { Assert-SequenceRolePermissions $config $readUri $restore $sequenceAudit `
      'restore_admin' 'restore_admin' } 'SEQUENCE_DEFAULT_ACL_UNMODELED'
  $targetLock = Enter-TargetLock $config $readUri
  $databaseLock = $null
  $migrationCommandStarted = $false
  $attemptMarker = Join-Path $root 'synthetic-attempted.marker'
  try {
    $databaseLock = Start-DatabaseApplyLock $config $readUri
    Expect-Block {
      Assert-FinalSequencePermissions $config $readUri $finalState
      $migrationCommandStarted = $true
      [IO.File]::WriteAllText($attemptMarker, 'attempted')
    } 'SEQUENCE_DEFAULT_ACL_UNMODELED'
    Expect-Block { Assert-FinalSequencePermissions $config $null $finalState } `
      'SEQUENCE_PRIVILEGE_SOURCE_UNKNOWN'
    Assert (-not $migrationCommandStarted -and
      -not (Test-Path -LiteralPath $attemptMarker)) `
      'ACL drift and unavailable source blocked before attempted marker and command'
  } finally {
    if ($databaseLock) { Stop-DatabaseApplyLock $databaseLock }
    $targetLock.Dispose()
  }
  [IO.File]::WriteAllText($sequenceSql,
    "GRANT USAGE, CREATE ON SCHEMA public TO `"$appRole`";",
    [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $readUri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $sequenceSql) 'SYNTHETIC_APP_SCHEMA_GRANT_FAILED')
  [IO.File]::WriteAllText($sequenceSql,
    'CREATE SEQUENCE public."RevokedSequence";', [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $appUri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $sequenceSql) 'SYNTHETIC_APP_SEQUENCE_CREATE_FAILED')
  Assert-NonSuperuserSequenceAccess $config $appUri 'RevokedSequence' $appRole
  [IO.File]::WriteAllText($sequenceSql,
    "REVOKE USAGE, UPDATE ON SEQUENCE public.`"RevokedSequence`" FROM `"$appRole`";",
    [Text.UTF8Encoding]::new($false))
  [void](Invoke-PostgresTool $config $appUri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $sequenceSql) 'SYNTHETIC_APP_REVOKE_FAILED')
  Expect-Block { Assert-NonSuperuserSequenceAccess $config $appUri `
      'RevokedSequence' $appRole } 'SEQUENCE_PERMISSION_MISSING'
  Expect-Block { Invoke-PostgresTool $config $appUri 'psql.exe' @(
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
      'SELECT nextval(''public."RevokedSequence"''::regclass);') `
      'SEQUENCE_NEXTVAL_DENIED' } 'SEQUENCE_NEXTVAL_DENIED'
  Write-Output 'PASS revoked application USAGE/UPDATE denies nextval'
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

  $eolRepo = Join-Path $root 'eol-repo'
  [void](New-Item -ItemType Directory -Path $eolRepo)
  [void](& git -C $eolRepo init -q)
  [void](& git -C $eolRepo config user.name 'Synthetic Test')
  [void](& git -C $eolRepo config user.email 'synthetic@example.invalid')
  [void](& git -C $eolRepo config core.autocrlf false)
  $eolCases = [ordered]@{
    '20260101000000_lf_source' = "CREATE TABLE `"LfSource`" (`"id`" INTEGER);`n"
    '20260102000000_crlf_source' = "CREATE TABLE `"CrlfSource`" (`"id`" INTEGER);`r`n"
    '20260103000000_literal' = "SELECT 'first`nsecond';`n"
    '20260104000000_pending' = "CREATE TABLE `"Pending`" (`"id`" INTEGER);`n"
  }
  foreach ($name in $eolCases.Keys) {
    $directory = Join-Path $eolRepo "prisma/migrations/$name"
    [void](New-Item -ItemType Directory -Path $directory -Force)
    [IO.File]::WriteAllText((Join-Path $directory 'migration.sql'), $eolCases[$name],
      [Text.UTF8Encoding]::new($false))
  }
  [void](& git -C $eolRepo add .)
  [void](& git -C $eolRepo commit -qm 'Synthetic EOL sources')
  foreach ($name in @('20260101000000_lf_source', '20260103000000_literal',
      '20260104000000_pending')) {
    $file = Join-Path $eolRepo "prisma/migrations/$name/migration.sql"
    [IO.File]::WriteAllText($file, $eolCases[$name].Replace("`n", "`r`n"),
      [Text.UTF8Encoding]::new($false))
  }
  $crlfFile = Join-Path $eolRepo 'prisma/migrations/20260102000000_crlf_source/migration.sql'
  [IO.File]::WriteAllText($crlfFile, $eolCases['20260102000000_crlf_source'].Replace("`r`n", "`n"),
    [Text.UTF8Encoding]::new($false))
  $eolFiles = @(Get-MigrationFiles $eolRepo)
  $lfSource = @($eolFiles | Where-Object Name -eq '20260101000000_lf_source')[0]
  $crlfSource = @($eolFiles | Where-Object Name -eq '20260102000000_crlf_source')[0]
  $literal = @($eolFiles | Where-Object Name -eq '20260103000000_literal')[0]
  $pendingName = '20260104000000_pending'
  Assert ($lfSource.Sha256 -ne $lfSource.ApprovedSha256 -and
      $lfSource.Sha256 -in $lfSource.AllowedAppliedSha256) 'LF Git / CRLF checkout exact variant'
  Assert ($crlfSource.Sha256 -ne $crlfSource.ApprovedSha256 -and
      $crlfSource.Sha256 -in $crlfSource.AllowedAppliedSha256) 'CRLF Git / LF checkout exact variant'
  Assert (-not $literal.PendingExecutableSafe -and
      $literal.Sha256 -notin $literal.AllowedAppliedSha256) 'literal line break rejects EOL variant'
  $eolLedger = @(
    [pscustomobject]@{ name = $lfSource.Name; checksum = $lfSource.Sha256; applied = $true; failed = $false }
    [pscustomobject]@{ name = $crlfSource.Name; checksum = $crlfSource.Sha256; applied = $true; failed = $false }
    [pscustomobject]@{ name = $literal.Name; checksum = $literal.ApprovedSha256; applied = $true; failed = $false }
  )
  $eolCompared = Compare-MigrationLedger $eolFiles $eolLedger @($pendingName)
  Assert ($eolCompared.AppliedCount -eq 3 -and
      @($eolCompared.Pending).Count -eq 1) 'pending migration exact set preserved'
  Assert (@($eolFiles | Where-Object Name -eq $pendingName)[0].Sha256 -eq
      (Get-FileHash -LiteralPath (Join-Path $eolRepo "prisma/migrations/$pendingName/migration.sql") `
        -Algorithm SHA256).Hash.ToLowerInvariant()) 'pending raw checksum preserved'
  Expect-Block { Compare-MigrationLedger $eolFiles $eolLedger @() } 'PENDING_SET_MISMATCH'
  $withoutLiteral = @($eolLedger | Where-Object name -ne $literal.Name)
  Expect-Block { Compare-MigrationLedger $eolFiles $withoutLiteral @($literal.Name, $pendingName) } `
    'PENDING_SQL_EOL_UNSAFE'
  $badLedger = @($eolLedger | ForEach-Object { $_.PSObject.Copy() })
  $badLedger[0].checksum = ('0' * 64)
  Expect-Block { Compare-MigrationLedger $eolFiles $badLedger @($pendingName) } `
    'APPLIED_CHECKSUM_MISMATCH'
  $badLedger[0].checksum = (Get-Sha256Bytes ([Text.Encoding]::UTF8.GetBytes(
        "CREATE TABLE `"Altered`" (`"id`" INTEGER);`r`n")))
  Expect-Block { Compare-MigrationLedger $eolFiles $badLedger @($pendingName) } `
    'APPLIED_CHECKSUM_MISMATCH'
  $badLedger[0].checksum = Get-Sha256Bytes ([byte[]](@(239, 187, 191) +
      @([Text.Encoding]::UTF8.GetBytes($eolCases['20260101000000_lf_source']))))
  Expect-Block { Compare-MigrationLedger $eolFiles $badLedger @($pendingName) } `
    'APPLIED_CHECKSUM_MISMATCH'
  $badLedger[0].checksum = $lfSource.Sha256
  $badLedger[2].checksum = $literal.Sha256
  Expect-Block { Compare-MigrationLedger $eolFiles $badLedger @($pendingName) } `
    'APPLIED_CHECKSUM_MISMATCH'
  $lfFile = Join-Path $eolRepo 'prisma/migrations/20260101000000_lf_source/migration.sql'
  $originalCheckout = [IO.File]::ReadAllBytes($lfFile)
  try {
    [IO.File]::WriteAllBytes($lfFile, [byte[]](@(239, 187, 191) + @($originalCheckout)))
    Expect-Block { Get-MigrationFiles $eolRepo } 'MIGRATION_BOM_FORBIDDEN'
    [IO.File]::WriteAllBytes($lfFile, [byte[]](@($originalCheckout) + @(10)))
    Expect-Block { Get-MigrationFiles $eolRepo } 'MIGRATION_CHECKOUT_BYTES_MISMATCH'
    [IO.File]::WriteAllText($lfFile, "CREATE TABLE `"LfSource`" (`"id`"  INTEGER);`r`n",
      [Text.UTF8Encoding]::new($false))
    Expect-Block { Get-MigrationFiles $eolRepo } 'MIGRATION_CHECKOUT_BYTES_MISMATCH'
    [IO.File]::WriteAllText($lfFile, "CREATE TABLE `"Changed`" (`"id`" INTEGER);`r`n",
      [Text.UTF8Encoding]::new($false))
    Expect-Block { Get-MigrationFiles $eolRepo } 'MIGRATION_CHECKOUT_BYTES_MISMATCH'
  } finally { [IO.File]::WriteAllBytes($lfFile, $originalCheckout) }
  $productionFiles = @(Get-MigrationFiles $repo)
  $historical = @($productionFiles | Where-Object Name -eq '20261011180000_document_checklist_v2')[0]
  Assert ('95254cd60c62e2013b2f92696a012ab6698bfd0452b272f6d22049bcbdcbbe0b' -in
      $historical.AllowedAppliedSha256) 'historical mixed-EOL exact checksum'
  Assert ('e46065067be1b22c70e88b04b9b4f2becbec33e30e12d8aaabe1c65c6b24e179' -notin
      $historical.AllowedAppliedSha256) 'historical extra LF rejected'
  $productionShapeLedger = @($productionFiles | ForEach-Object {
    $hash = if ($_.Name -eq $historical.Name) {
      '95254cd60c62e2013b2f92696a012ab6698bfd0452b272f6d22049bcbdcbbe0b'
    } elseif ($_.Name -in @('20261023120000_case_decision_received',
        '20261024160000_meta_message_reads')) { $_.Sha256 }
    else { $_.ApprovedSha256 }
    [pscustomobject]@{ name = $_.Name; checksum = $hash; applied = $true; failed = $false }
  })
  $productionShape = Compare-MigrationLedger $productionFiles $productionShapeLedger @()
  Assert ($productionShape.AppliedCount -eq 53) 'offline reconstructed 53-row checksum pattern'
  $extraLfLedger = @($productionShapeLedger | ForEach-Object { $_.PSObject.Copy() })
  @($extraLfLedger | Where-Object name -eq $historical.Name)[0].checksum =
    'e46065067be1b22c70e88b04b9b4f2becbec33e30e12d8aaabe1c65c6b24e179'
  Expect-Block { Compare-MigrationLedger $productionFiles $extraLfLedger @() } `
    'APPLIED_CHECKSUM_MISMATCH'

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
  Expect-Block { Get-MigrationFiles $dirtyRepo } 'MIGRATION_CHECKOUT_BYTES_MISMATCH'
  Write-Output 'PASS changed SQL checksum refused against Git blob'
  Expect-Block { Get-GitCheckpoint $dirtyRepo $head $true } 'DIRTY_CHECKOUT'
  [IO.File]::WriteAllText($migrationPath,
    'CREATE TABLE "Synthetic" ("id" INTEGER);', [Text.UTF8Encoding]::new($false))
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
  $testMarker = Join-Path $root 'runner-test-owned.txt'
  [IO.File]::WriteAllText($testMarker, 'wrong-owner', [Text.UTF8Encoding]::new($false))
  Expect-Block { Assert-TestCleanupSafe @($registeredConfigs) $testBase $root $testId @() } `
    'TEST_CLEANUP_MARKER_MISMATCH'
  [IO.File]::WriteAllText($testMarker, $testId, [Text.UTF8Encoding]::new($false))
  Expect-Block { Assert-TestCleanupSafe @($registeredConfigs) $testBase $root $testId @($source) } `
    'TEST_CLUSTER_STILL_RUNNING'
  Expect-Block { Assert-TestCleanupSafe @($registeredConfigs) $testBase $root $testId @() } `
    'TEST_REPARSE_DESCENDANT_FORBIDDEN'
  Expect-Block { Assert-TestCleanupSafe @($registeredConfigs) $testBase `
      (Join-Path $root 'substituted') $testId @() } 'TEST_CLEANUP_PATH_SUBSTITUTED'
  Assert (Test-Path -LiteralPath $testMarker) 'cleanup refusals retained owned root'
  Write-Output 'WINDOWS SYNTHETIC TESTS PASS'
} catch {
  Write-Output "TEST ERROR: $($_.Exception.Message)"
  throw
} finally {
  if ($InjectPeerPartialStopFailure) {
    if ($identityPeer) { Stop-Maintenance 'TEST_PEER_IDENTITY_WAS_RETURNED' }
    Write-Output 'identityPeer=NULL'
  }
  try {
    Assert-RegisteredDisposableRoots @($registeredConfigs) $root `
      @($restore, $source, $identityPeer) $false
  } catch {
    Write-Output "SYNTHETIC CLEANUP FAIL; retained local path: $root"
    throw
  }
  $stopFailure = $null
  if ($identityPeer) {
    try { Stop-DisposableCluster $peerConfig $identityPeer }
    catch { $stopFailure = $_.Exception.Message }
  }
  foreach ($cluster in @($restore, $source)) {
    if ($stopFailure) { break }
    if (-not $cluster) { continue }
    try { Stop-DisposableCluster $config $cluster }
    catch { $stopFailure = $_.Exception.Message; break }
  }
  if ($stopFailure) {
    Write-Output "SYNTHETIC CLEANUP FAIL; retained local path: $root"
    throw "TEST CLEANUP FAILED: $stopFailure"
  }
  try {
    Assert-TestCleanupSafe @($registeredConfigs) $testBase $root $testId `
      @($restore, $source, $identityPeer) $substitutePath
    if ($substitutePath -and (Test-Path -LiteralPath $substitutePath)) {
      [void](Assert-ChildPath $root $substitutePath)
      if (((Get-Item -LiteralPath $substitutePath -Force).Attributes -band
            [IO.FileAttributes]::ReparsePoint) -eq 0) {
        Stop-Maintenance 'TEST_JUNCTION_SUBSTITUTED'
      }
      [IO.Directory]::Delete($substitutePath, $false)
    }
    Assert-TestCleanupSafe @($registeredConfigs) $testBase $root $testId `
      @($restore, $source, $identityPeer)
    $entries = [Collections.Generic.Stack[string]]::new()
    $entries.Push($root)
    while ($entries.Count -gt 0) {
      foreach ($entry in [IO.Directory]::EnumerateFileSystemEntries($entries.Pop())) {
        $attributes = [IO.File]::GetAttributes($entry)
        if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
          Stop-Maintenance 'TEST_REPARSE_DESCENDANT_FORBIDDEN'
        }
        if (($attributes -band [IO.FileAttributes]::ReadOnly) -ne 0) {
          [IO.File]::SetAttributes($entry,
            $attributes -band (-bnot [IO.FileAttributes]::ReadOnly))
        }
        if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) { $entries.Push($entry) }
      }
    }
    [IO.Directory]::Delete($root, $true)
    Write-Output 'PASS normal primary and peer private-root cleanup'
  } catch {
    Write-Output "SYNTHETIC CLEANUP FAIL; retained local path: $root"
    throw
  }
}
