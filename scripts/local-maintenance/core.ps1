Set-StrictMode -Version Latest

function Stop-Maintenance([string]$Code) {
  throw "LMR:$Code"
}

function Get-Sha256Bytes([byte[]]$Bytes) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
}

function Get-Sha256Text([string]$Value) {
  return Get-Sha256Bytes ([System.Text.Encoding]::UTF8.GetBytes($Value))
}

function Assert-ChildPath([string]$Parent, [string]$Child) {
  $parentPath = [IO.Path]::GetFullPath($Parent).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
  $childPath = [IO.Path]::GetFullPath($Child)
  if (-not $childPath.StartsWith($parentPath, [StringComparison]::OrdinalIgnoreCase)) {
    Stop-Maintenance 'PATH_OUTSIDE_PRIVATE_ROOT'
  }
  return $childPath
}

function Assert-NotReparsePoint([string]$Path) {
  $current = [IO.Path]::GetFullPath($Path)
  while ($current) {
    if (-not (Test-Path -LiteralPath $current)) { Stop-Maintenance 'PATH_MISSING' }
    if (((Get-Item -LiteralPath $current -Force).Attributes -band
          [IO.FileAttributes]::ReparsePoint) -ne 0) {
      Stop-Maintenance 'REPARSE_POINT_FORBIDDEN'
    }
    $parent = [IO.Path]::GetDirectoryName($current.TrimEnd('\', '/'))
    if (-not $parent -or $parent -eq $current) { break }
    $current = $parent
  }
}

function Assert-PrivateAcl([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { Stop-Maintenance 'PRIVATE_PATH_MISSING' }
  Assert-NotReparsePoint $Path
  $acl = Get-Acl -LiteralPath $Path
  $allowed = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,
    'S-1-5-18', 'S-1-5-32-544')
  foreach ($entry in $acl.Access) {
    if ($entry.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
    try { $sid = $entry.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value }
    catch { Stop-Maintenance 'PRIVATE_ACL_UNVERIFIABLE' }
    if ($sid -notin $allowed) { Stop-Maintenance 'PRIVATE_ACL_TOO_BROAD' }
  }
}

function Set-PrivateAcl([string]$Path) {
  $acl = Get-Acl -LiteralPath $Path
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($entry in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($entry) }
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $inheritance = [Security.AccessControl.InheritanceFlags]::None
  if (Test-Path -LiteralPath $Path -PathType Container) {
    $inheritance = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
      [Security.AccessControl.InheritanceFlags]::ObjectInherit
  }
  foreach ($sid in @($identity, [Security.Principal.SecurityIdentifier]'S-1-5-18',
      [Security.Principal.SecurityIdentifier]'S-1-5-32-544')) {
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
      $sid, [Security.AccessControl.FileSystemRights]::FullControl, $inheritance,
      [Security.AccessControl.PropagationFlags]::None,
      [Security.AccessControl.AccessControlType]::Allow)
    $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Path -AclObject $acl
  Assert-PrivateAcl $Path
}

function Read-MaintenanceConfig([string]$ConfigPath, [bool]$Synthetic) {
  if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) { Stop-Maintenance 'CONFIG_MISSING' }
  try { $config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { Stop-Maintenance 'CONFIG_INVALID_JSON' }
  foreach ($name in @('targetKind', 'environmentFile', 'expectedHost', 'backupDirectory',
      'privateDirectory', 'postgresBin')) {
    if (-not $config.PSObject.Properties[$name] -or -not $config.$name) {
      Stop-Maintenance "CONFIG_MISSING_$name"
    }
  }
  if ($Synthetic) {
    if ($config.targetKind -ne 'synthetic' -or $config.expectedHost -ne '127.0.0.1') {
      Stop-Maintenance 'SYNTHETIC_TARGET_INVALID'
    }
  } elseif ($config.targetKind -ne 'production' -or
      $config.expectedHost -notmatch '(^|\.)supabase\.(co|com)$') {
    Stop-Maintenance 'PRODUCTION_TARGET_INVALID'
  }
  foreach ($name in @('environmentFile', 'backupDirectory', 'privateDirectory', 'postgresBin')) {
    if ([string]$config.$name -notmatch '^[A-Za-z]:\\') {
      Stop-Maintenance "CONFIG_PATH_NOT_ABSOLUTE_$name"
    }
  }
  if (-not (Test-Path -LiteralPath $config.environmentFile -PathType Leaf)) {
    Stop-Maintenance 'ENV_FILE_MISSING'
  }
  if (-not (Test-Path -LiteralPath $config.backupDirectory -PathType Container)) {
    Stop-Maintenance 'BACKUP_DIRECTORY_MISSING'
  }
  foreach ($tool in @('psql.exe', 'pg_dump.exe', 'pg_restore.exe', 'initdb.exe',
      'pg_ctl.exe', 'createdb.exe', 'pg_isready.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $config.postgresBin $tool) -PathType Leaf)) {
      Stop-Maintenance "POSTGRES_TOOL_MISSING_$tool"
    }
  }
  Assert-PrivateAcl $config.backupDirectory
  return $config
}

function Get-PrivateDatabaseUri([object]$Config, [string]$Key, [bool]$Synthetic) {
  $matches = @(Get-Content -LiteralPath $Config.environmentFile -Encoding UTF8 |
      Where-Object { $_ -match "^$([regex]::Escape($Key))=" })
  if ($matches.Count -ne 1) { Stop-Maintenance "ENV_KEY_COUNT_$Key" }
  $value = $matches[0].Substring($Key.Length + 1).Trim().Trim('"').Trim("'")
  try { $uri = [Uri]::new($value) }
  catch { Stop-Maintenance "ENV_URL_INVALID_$Key" }
  if ($uri.Scheme -notin @('postgres', 'postgresql') -or $uri.Host -ne $Config.expectedHost -or
      $uri.UserInfo.Split(':', 2).Count -ne 2) {
    Stop-Maintenance "ENV_TARGET_MISMATCH_$Key"
  }
  $database = $uri.AbsolutePath.TrimStart('/')
  if ($Synthetic) {
    if ($uri.Host -ne '127.0.0.1' -or $database -notmatch '^legalhub_runner_synthetic_') {
      Stop-Maintenance 'SYNTHETIC_DB_IDENTITY_INVALID'
    }
  } elseif (($Key -eq 'DIRECT_URL' -and $uri.Port -ne 5432) -or
      ($Key -ne 'DIRECT_URL' -and $uri.Port -notin @(5432, 6543)) -or
      $database -ne 'postgres') {
    Stop-Maintenance 'PRODUCTION_DB_IDENTITY_INVALID'
  }
  return $uri
}

function Invoke-WithPgEnvironment([Uri]$Uri, [scriptblock]$Action) {
  $names = @('PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE',
    'PGOPTIONS', 'PGSERVICE', 'PGPASSFILE', 'DATABASE_URL', 'DIRECT_URL')
  $previous = @{}
  foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
  $parts = $Uri.UserInfo.Split(':', 2)
  try {
    $env:PGHOST = $Uri.Host
    $env:PGPORT = [string]$Uri.Port
    $env:PGUSER = [Uri]::UnescapeDataString($parts[0])
    $env:PGPASSWORD = [Uri]::UnescapeDataString($parts[1])
    $env:PGDATABASE = $Uri.AbsolutePath.TrimStart('/')
    $env:PGSSLMODE = if ($Uri.Host -eq '127.0.0.1') { 'disable' } else { 'require' }
    foreach ($name in @('PGOPTIONS', 'PGSERVICE', 'PGPASSFILE')) {
      [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    if ($Uri.Host -eq '127.0.0.1') {
      [Environment]::SetEnvironmentVariable('DATABASE_URL', $null, 'Process')
      [Environment]::SetEnvironmentVariable('DIRECT_URL', $null, 'Process')
    }
    return & $Action
  } finally {
    foreach ($name in $names) {
      [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
  }
}

function Invoke-PostgresTool([object]$Config, [Uri]$Uri, [string]$Tool,
    [string[]]$Arguments, [string]$FailureCode) {
  $binary = Join-Path $Config.postgresBin $Tool
  $result = Invoke-WithPgEnvironment $Uri {
    $oldPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $output = @(& $binary @Arguments 2>$null)
      return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
    } finally { $ErrorActionPreference = $oldPreference }
  }
  if ($result.ExitCode -ne 0) { Stop-Maintenance $FailureCode }
  return @($result.Output)
}

function Invoke-ReadOnlyQuery([object]$Config, [Uri]$Uri, [string]$Query,
    [string]$FailureCode) {
  $sql = "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; " +
    "SET LOCAL statement_timeout = '30s'; SET LOCAL search_path = pg_catalog, public; " +
    $Query + '; ROLLBACK;'
  Assert-PrivateAcl $Config.privateDirectory
  $sqlPath = Join-Path $Config.privateDirectory ('query-' + [Guid]::NewGuid().ToString('N') + '.sql')
  $bytes = [Text.Encoding]::UTF8.GetBytes($sql)
  $stream = [IO.File]::Open($sqlPath, [IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
  Set-PrivateAcl $sqlPath
  try {
    $lines = @(Invoke-PostgresTool $Config $Uri 'psql.exe' @(
        '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', $sqlPath) $FailureCode)
  } finally {
    if (Test-Path -LiteralPath $sqlPath -PathType Leaf) { [IO.File]::Delete($sqlPath) }
  }
  $data = @($lines | Where-Object { $_ -is [string] -and $_.Trim() -and
        $_ -notmatch '^(BEGIN|SET|ROLLBACK)$' })
  if ($data.Count -ne 1) { Stop-Maintenance "${FailureCode}_OUTPUT" }
  return [string]$data[0]
}

function Get-GitCheckpoint([string]$Repo, [string]$ApprovedCommit, [bool]$Synthetic) {
  if ($ApprovedCommit -notmatch '^[0-9a-f]{40}$') { Stop-Maintenance 'APPROVED_SHA_INVALID' }
  $head = (& git -C $Repo rev-parse HEAD 2>$null).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -ne $ApprovedCommit) {
    Stop-Maintenance 'APPROVED_COMMIT_MISMATCH'
  }
  $dirty = @(& git -C $Repo status --porcelain --untracked-files=all 2>$null)
  if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) { Stop-Maintenance 'DIRTY_CHECKOUT' }
  if (-not $Synthetic) {
    $remote = (& git -C $Repo config --get remote.origin.url 2>$null).Trim()
    if ($remote -notmatch '^(?:git@github\.com:|https://github\.com/|ssh://git@github\.com/)reziflowcloud-netizen/reziflow-cloud(?:\.git)?$') {
      Stop-Maintenance 'WRONG_REPOSITORY'
    }
  }
  return $head
}

function Assert-GuardedCommand([string]$Repo) {
  $packagePath = Join-Path $Repo 'package.json'
  $guardPath = Join-Path $Repo 'scripts/vercel-migrate.js'
  if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf) -or
      -not (Test-Path -LiteralPath $guardPath -PathType Leaf)) {
    Stop-Maintenance 'GUARDED_SCRIPT_MISSING'
  }
  try { $scripts = (Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json).scripts }
  catch { Stop-Maintenance 'PACKAGE_INVALID' }
  if ($scripts.'db:migrate:deploy' -ne 'node scripts/vercel-migrate.js' -or
      $scripts.PSObject.Properties['predb:migrate:deploy'] -or
      $scripts.PSObject.Properties['postdb:migrate:deploy']) {
    Stop-Maintenance 'GUARDED_COMMAND_CHANGED'
  }
  $source = Get-Content -LiteralPath $guardPath -Raw -Encoding UTF8
  foreach ($name in @('DB_MIGRATE_TARGET', 'DB_MIGRATE_CONFIRM', 'DB_MIGRATE_EXPECTED_HOST',
      'DIRECT_URL')) {
    if (-not $source.Contains($name)) { Stop-Maintenance 'MIGRATION_GUARD_MISSING' }
  }
}

function Get-MigrationFiles([string]$Repo) {
  $root = Join-Path $Repo 'prisma/migrations'
  if (-not (Test-Path -LiteralPath $root -PathType Container)) { Stop-Maintenance 'MIGRATIONS_MISSING' }
  $result = @()
  foreach ($directory in @(Get-ChildItem -LiteralPath $root -Directory | Sort-Object Name)) {
    $file = Join-Path $directory.FullName 'migration.sql'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
    if ($directory.Name -notmatch '^[0-9]{14}_[a-z0-9_]+$') {
      Stop-Maintenance 'MIGRATION_NAME_INVALID'
    }
    $result += [pscustomobject]@{
      Name = $directory.Name
      Path = $file
      Sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  return $result
}

function Get-ProductionLedger([object]$Config, [Uri]$Uri) {
  $sql = @'
SELECT COALESCE(json_agg(json_build_object(
  'name', migration_name,
  'checksum', checksum,
  'applied', finished_at IS NOT NULL,
  'failed', finished_at IS NULL AND rolled_back_at IS NULL
) ORDER BY migration_name), '[]'::json)::text FROM public."_prisma_migrations"
'@
  try {
    $parsed = ConvertFrom-Json -InputObject (Invoke-ReadOnlyQuery $Config $Uri $sql 'LEDGER_READ_FAILED')
    foreach ($row in $parsed) { Write-Output $row }
  }
  catch { if ($_.Exception.Message -like 'LMR:*') { throw }; Stop-Maintenance 'LEDGER_JSON_INVALID' }
}

function Compare-MigrationLedger([object[]]$Migrations, [object[]]$Ledger,
    [string[]]$ExpectedPending) {
  $files = @{}
  foreach ($migration in $Migrations) {
    if ($files.ContainsKey($migration.Name)) { Stop-Maintenance 'DUPLICATE_MIGRATION' }
    $files[$migration.Name] = $migration
  }
  $applied = @{}
  foreach ($row in $Ledger) {
    if ($row.failed) { Stop-Maintenance 'FAILED_MIGRATION' }
    if (-not $row.applied) { Stop-Maintenance 'UNFINISHED_MIGRATION' }
    if ($applied.ContainsKey($row.name)) { Stop-Maintenance 'DUPLICATE_LEDGER_ROW' }
    if (-not $files.ContainsKey($row.name)) { Stop-Maintenance 'UNKNOWN_APPLIED_MIGRATION' }
    if ($files[$row.name].Sha256 -ne [string]$row.checksum) {
      Stop-Maintenance 'APPLIED_CHECKSUM_MISMATCH'
    }
    $applied[$row.name] = $true
  }
  $pending = @($Migrations | Where-Object { -not $applied.ContainsKey($_.Name) } |
      ForEach-Object Name)
  if (@($pending).Count -ne @($ExpectedPending).Count -or
      (($pending | Sort-Object) -join '|') -ne (($ExpectedPending | Sort-Object) -join '|')) {
    Stop-Maintenance 'PENDING_SET_MISMATCH'
  }
  return [pscustomobject]@{ AppliedCount = $applied.Count; Pending = @($pending); FailedCount = 0 }
}

function Get-DatabaseSnapshot([object]$Config, [Uri]$Uri) {
  $sql = @'
SELECT json_build_object(
  'database', current_database(),
  'role', current_user,
  'databaseOid', (SELECT oid FROM pg_database WHERE datname=current_database()),
  'serverVersion', current_setting('server_version_num'),
  'leadMessageRows', (SELECT count(*) FROM public."LeadMessage"),
  'leadMessageBytes', pg_total_relation_size('public."LeadMessage"'),
  'waitingRelationLocks', (SELECT count(*) FROM pg_locks l
    WHERE l.database=(SELECT oid FROM pg_database WHERE datname=current_database())
      AND l.relation IS NOT NULL AND NOT l.granted),
  'longTransactions', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()
    AND xact_start IS NOT NULL AND now()-xact_start > interval '30 seconds' AND pid<>pg_backend_pid()),
  'idleTransactions', (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()
    AND state='idle in transaction' AND pid<>pg_backend_pid())
)::text
'@
  try { return Invoke-ReadOnlyQuery $Config $Uri $sql 'TARGET_SNAPSHOT_FAILED' | ConvertFrom-Json }
  catch { if ($_.Exception.Message -like 'LMR:*') { throw }; Stop-Maintenance 'TARGET_SNAPSHOT_INVALID' }
}

function Get-TargetFingerprint([Uri]$Uri, [object]$Snapshot) {
  return Get-Sha256Text ("$($Uri.Host.ToLowerInvariant())|$($Uri.Port)|$($Snapshot.database)|" +
    "$($Snapshot.role)|$($Snapshot.databaseOid)|$($Snapshot.serverVersion)")
}

function Get-RelationSize([object]$Config, [Uri]$Uri, [string]$Table) {
  if ($Table -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { Stop-Maintenance 'INDEX_TABLE_INVALID' }
  $sql = "SELECT COALESCE(pg_total_relation_size(to_regclass('public.`"$Table`"')), 0)"
  $value = Invoke-ReadOnlyQuery $Config $Uri $sql 'RELATION_SIZE_FAILED'
  if ($value -notmatch '^\d+$') { Stop-Maintenance 'RELATION_SIZE_INVALID' }
  return [long]$value
}

function Assert-LockSafety([object]$Config, [Uri]$Uri, [object]$Snapshot,
    [string[]]$IndexedTables) {
  if ([int]$Snapshot.waitingRelationLocks -gt 0 -or
      [int]$Snapshot.longTransactions -gt 0 -or [int]$Snapshot.idleTransactions -gt 0) {
    Stop-Maintenance 'DDL_LOCK_RISK'
  }
  foreach ($table in @($IndexedTables | Where-Object { $_ } | Select-Object -Unique)) {
    $size = Get-RelationSize $Config $Uri $table
    if ($size -gt 67108864) { Stop-Maintenance 'DDL_INDEX_TABLE_TOO_LARGE' }
  }
}

function Get-RepresentativeFingerprints([object]$Config, [Uri]$Uri,
    [hashtable]$ExcludedColumns = @{}) {
  $tables = @('_prisma_migrations', 'LeadMessage', 'Lead', 'Organization', 'User',
    'NotificationPreference')
  $result = [ordered]@{}
  foreach ($table in $tables) {
    $expression = 'to_jsonb(t)'
    if ($ExcludedColumns.ContainsKey($table) -and @($ExcludedColumns[$table]).Count -gt 0) {
      $columns = @($ExcludedColumns[$table] | ForEach-Object {
          if ($_ -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { Stop-Maintenance 'COLUMN_NAME_UNSAFE' }
          "'$_'"
        }) -join ','
      $expression = "(to_jsonb(t) - ARRAY[$columns]::text[])"
    }
    $sql = "SELECT json_build_object('count',count(*),'digest'," +
      "md5(COALESCE(string_agg(md5(($expression)::text), '' " +
      "ORDER BY md5(($expression)::text)),'')))::text FROM public.`"$table`" t"
    try { $result[$table] = Invoke-ReadOnlyQuery $Config $Uri $sql 'DATA_FINGERPRINT_FAILED' | ConvertFrom-Json }
    catch { if ($_.Exception.Message -like 'LMR:*') { throw }; Stop-Maintenance 'DATA_FINGERPRINT_INVALID' }
  }
  return $result
}

function Compare-RepresentativeFingerprints([object]$Before, [object]$After,
    [bool]$SkipLedger = $false) {
  foreach ($key in $Before.Keys) {
    if ($SkipLedger -and $key -eq '_prisma_migrations') { continue }
    if (-not $After.Contains($key) -or [long]$Before[$key].count -ne [long]$After[$key].count -or
        [string]$Before[$key].digest -ne [string]$After[$key].digest) {
      Stop-Maintenance 'RESTORED_DATA_MISMATCH'
    }
  }
}

function New-PrivateBackup([object]$Config, [Uri]$SourceUri, [string]$RunId) {
  Assert-PrivateAcl $Config.backupDirectory
  $name = 'legalhub-maintenance-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $RunId + '.dump'
  $path = Join-Path $Config.backupDirectory $name
  if (Test-Path -LiteralPath $path) { Stop-Maintenance 'BACKUP_COLLISION' }
  [void](Invoke-PostgresTool $Config $SourceUri 'pg_dump.exe' @(
      '--format=custom', '--schema=public', '--no-owner', '--no-privileges',
      "--file=$path") 'BACKUP_FAILED')
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Stop-Maintenance 'BACKUP_MISSING' }
  Set-PrivateAcl $path
  $toc = @(& (Join-Path $Config.postgresBin 'pg_restore.exe') --list $path 2>&1)
  if ($LASTEXITCODE -ne 0) { Stop-Maintenance 'BACKUP_TOC_INVALID' }
  foreach ($table in @('_prisma_migrations', 'LeadMessage', 'Lead', 'Organization', 'User',
      'NotificationPreference')) {
    if (-not @($toc | Where-Object { $_ -match "TABLE DATA public $table " }).Count) {
      Stop-Maintenance "BACKUP_REQUIRED_TABLE_MISSING_$table"
    }
  }
  return [pscustomobject]@{
    Path = $path
    Sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    Bytes = (Get-Item -LiteralPath $path).Length
    TocEntries = $toc.Count
    CreatedUtc = [DateTime]::UtcNow.ToString('o')
  }
}

function New-DisposableCluster([object]$Config, [string]$RunId) {
  if (-not (Test-Path -LiteralPath $Config.privateDirectory -PathType Container)) {
    Stop-Maintenance 'PRIVATE_DIRECTORY_MISSING'
  }
  Assert-NotReparsePoint $Config.privateDirectory
  Assert-PrivateAcl $Config.privateDirectory
  $isolationRoot = Join-Path $Config.privateDirectory 'isolated'
  if (-not (Test-Path -LiteralPath $isolationRoot -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $isolationRoot)
    Set-PrivateAcl $isolationRoot
  }
  Assert-NotReparsePoint $isolationRoot
  Assert-PrivateAcl $isolationRoot
  $root = Assert-ChildPath $isolationRoot (Join-Path $isolationRoot $RunId)
  if (Test-Path -LiteralPath $root) { Stop-Maintenance 'ISOLATED_PATH_EXISTS' }
  [void](New-Item -ItemType Directory -Path $root)
  Set-PrivateAcl $root
  $marker = Join-Path $root 'runner-owned.txt'
  [IO.File]::WriteAllText($marker, $RunId, [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $marker
  $cluster = Join-Path $root 'cluster'
  $passwordFile = Join-Path $root 'initdb-password.tmp'
  $bytes = [byte[]]::new(32)
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $password = [Convert]::ToBase64String($bytes)
  [IO.File]::WriteAllText($passwordFile, $password + [Environment]::NewLine,
    [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $passwordFile
  try {
    $binary = Join-Path $Config.postgresBin 'initdb.exe'
    $output = @(& $binary '-D' $cluster '-U' 'restore_admin' '--encoding=UTF8' `
        '--auth-host=scram-sha-256' '--auth-local=scram-sha-256' `
        "--pwfile=$passwordFile" '--no-instructions' 2>&1)
    if ($LASTEXITCODE -ne 0) { Stop-Maintenance 'ISOLATED_INITDB_FAILED' }
  } finally {
    if (Test-Path -LiteralPath $passwordFile -PathType Leaf) { [IO.File]::Delete($passwordFile) }
  }
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  try { $listener.Start(); $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port }
  finally { $listener.Stop() }
  if ($port -eq 5432) { Stop-Maintenance 'ISOLATED_PORT_UNSAFE' }
  $log = Join-Path $root 'postgres.log'
  $binary = Join-Path $Config.postgresBin 'pg_ctl.exe'
  $control = Start-Process -FilePath $binary -ArgumentList @(
    '-D', "`"$cluster`"", '-l', "`"$log`"", '-o',
    "`"-h 127.0.0.1 -p $port`"", '-w', '-t', '45', 'start') -PassThru `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'control.out') `
    -RedirectStandardError (Join-Path $root 'control.err')
  try {
    if (-not $control.WaitForExit(50000)) { Stop-Maintenance 'LOCAL_POSTGRES_CONTROL_TIMEOUT' }
  } finally { $control.Dispose() }
  $ready = @(& (Join-Path $Config.postgresBin 'pg_isready.exe') '-h' '127.0.0.1' `
      '-p' ([string]$port) '-q' 2>&1)
  if ($LASTEXITCODE -ne 0) { Stop-Maintenance 'ISOLATED_NOT_READY' }
  $database = 'legalhub_runner_' + $RunId.Replace('-', '_')
  $encoded = [Uri]::EscapeDataString($password)
  $adminUri = [Uri]::new("postgresql://restore_admin:$encoded@127.0.0.1:$port/postgres")
  [void](Invoke-PostgresTool $Config $adminUri 'createdb.exe' @(
      '-T', 'template0', $database) 'ISOLATED_CREATE_DB_FAILED')
  $uri = [Uri]::new("postgresql://restore_admin:$encoded@127.0.0.1:$port/${database}?schema=public")
  return [pscustomobject]@{
    RunId = $RunId; Root = $root; Cluster = $cluster; Port = $port
    Database = $database; Uri = $uri; Password = $password
  }
}

function Restore-DisposableBackup([object]$Config, [object]$Cluster, [object]$Backup) {
  if ($Cluster.Uri.Host -ne '127.0.0.1' -or $Cluster.Port -eq 5432 -or
      $Cluster.Database -notmatch '^legalhub_runner_') {
    Stop-Maintenance 'RESTORE_TARGET_NOT_DISPOSABLE'
  }
  if (-not (Test-Path -LiteralPath $Backup.Path -PathType Leaf) -or
      (Get-FileHash -LiteralPath $Backup.Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Backup.Sha256) {
    Stop-Maintenance 'BACKUP_CHANGED_BEFORE_RESTORE'
  }
  [void](Invoke-PostgresTool $Config $Cluster.Uri 'pg_restore.exe' @(
      '--clean', '--if-exists', '--no-owner', '--no-privileges', '--exit-on-error',
      '--single-transaction', "--dbname=$($Cluster.Database)", $Backup.Path) 'ISOLATED_RESTORE_FAILED')
}

function Invoke-DisposableMigration([object]$Cluster, [string]$Repo) {
  if ($Cluster.Uri.Host -ne '127.0.0.1' -or $Cluster.Port -eq 5432 -or
      $Cluster.Database -notmatch '^legalhub_runner_') {
    Stop-Maintenance 'MIGRATION_SIMULATION_TARGET_UNSAFE'
  }
  $cli = Join-Path $Repo 'node_modules/prisma/build/index.js'
  if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) {
    Stop-Maintenance 'PRISMA_CLI_MISSING_RUN_NPM_CI'
  }
  $previousDatabase = [Environment]::GetEnvironmentVariable('DATABASE_URL', 'Process')
  $previousDirect = [Environment]::GetEnvironmentVariable('DIRECT_URL', 'Process')
  $oldPreference = $ErrorActionPreference
  try {
    $env:DATABASE_URL = $Cluster.Uri.AbsoluteUri
    $env:DIRECT_URL = $Cluster.Uri.AbsoluteUri
    $ErrorActionPreference = 'Continue'
    $output = @(& node $cli migrate deploy 2>$null)
    if ($LASTEXITCODE -ne 0) { Stop-Maintenance 'ISOLATED_MIGRATION_FAILED' }
  } finally {
    $ErrorActionPreference = $oldPreference
    [Environment]::SetEnvironmentVariable('DATABASE_URL', $previousDatabase, 'Process')
    [Environment]::SetEnvironmentVariable('DIRECT_URL', $previousDirect, 'Process')
  }
}

function Stop-DisposableCluster([object]$Config, [object]$Cluster) {
  if (-not $Cluster) { return }
  $isolatedRoot = Join-Path $Config.privateDirectory 'isolated'
  $root = Assert-ChildPath $isolatedRoot $Cluster.Root
  foreach ($path in @($Config.privateDirectory, $isolatedRoot, $root, $Cluster.Cluster)) {
    Assert-NotReparsePoint $path
  }
  $marker = Join-Path $root 'runner-owned.txt'
  if (-not (Test-Path -LiteralPath $marker -PathType Leaf) -or
      (Get-Content -LiteralPath $marker -Raw).Trim() -ne $Cluster.RunId) {
    Stop-Maintenance 'ISOLATED_CLEANUP_MARKER_MISMATCH'
  }
  $binary = Join-Path $Config.postgresBin 'pg_ctl.exe'
  $output = @(& $binary '-D' $Cluster.Cluster '-m' 'fast' '-w' 'stop' 2>&1)
  if ($LASTEXITCODE -ne 0) { Stop-Maintenance 'ISOLATED_STOP_FAILED' }
  $ready = @(& (Join-Path $Config.postgresBin 'pg_isready.exe') '-h' '127.0.0.1' `
      '-p' ([string]$Cluster.Port) '-q' 2>&1)
  if ($LASTEXITCODE -eq 0) { Stop-Maintenance 'ISOLATED_STILL_RUNNING' }
  $deleted = $false
  for ($attempt = 0; $attempt -lt 8; $attempt++) {
    try { [IO.Directory]::Delete($root, $true); $deleted = $true; break }
    catch [IO.IOException] { Start-Sleep -Milliseconds 500 }
  }
  if (-not $deleted) { Stop-Maintenance 'ISOLATED_CLEANUP_FAILED' }
  if (Test-Path -LiteralPath $root) { Stop-Maintenance 'ISOLATED_CLEANUP_FAILED' }
}
