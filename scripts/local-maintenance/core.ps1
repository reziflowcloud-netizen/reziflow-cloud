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
      'privateDirectory', 'postgresBin', 'nodeBin', 'applicationRole',
      'expectedApplicationHost')) {
    if (-not $config.PSObject.Properties[$name] -or -not $config.$name) {
      Stop-Maintenance "CONFIG_MISSING_$name"
    }
  }
  if ($Synthetic) {
    if ($config.targetKind -ne 'synthetic' -or $config.expectedHost -ne '127.0.0.1' -or
        $config.expectedApplicationHost -ne '127.0.0.1') {
      Stop-Maintenance 'SYNTHETIC_TARGET_INVALID'
    }
  } elseif ($config.targetKind -ne 'production' -or
      $config.expectedHost -notmatch '(^|\.)supabase\.(co|com)$' -or
      $config.expectedApplicationHost -notmatch '(^|\.)supabase\.(co|com)$') {
    Stop-Maintenance 'PRODUCTION_TARGET_INVALID'
  }
  if ($config.applicationRole -notmatch '^[A-Za-z_][A-Za-z0-9_.-]*$') {
    Stop-Maintenance 'APPLICATION_ROLE_INVALID'
  }
  foreach ($name in @('environmentFile', 'backupDirectory', 'privateDirectory', 'postgresBin', 'nodeBin')) {
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
  foreach ($tool in @('node.exe', 'npm.cmd')) {
    if (-not (Test-Path -LiteralPath (Join-Path $config.nodeBin $tool) -PathType Leaf)) {
      Stop-Maintenance "NODE_TOOL_MISSING_$tool"
    }
  }
  if (-not $Synthetic) {
    if (-not $config.PSObject.Properties['tlsRootCertFile'] -or
        [string]$config.tlsRootCertFile -notmatch '^[A-Za-z]:\\' -or
        -not (Test-Path -LiteralPath $config.tlsRootCertFile -PathType Leaf)) {
      Stop-Maintenance 'TLS_ROOT_CERT_REQUIRED'
    }
    Assert-NotReparsePoint $config.tlsRootCertFile
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
  $expectedHost = if ($Key -eq 'DATABASE_URL') { $Config.expectedApplicationHost } else { $Config.expectedHost }
  if ($uri.Scheme -notin @('postgres', 'postgresql') -or $uri.Host -ne $expectedHost -or
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
  foreach ($pair in @($uri.Query.TrimStart('?').Split('&') | Where-Object { $_ })) {
    $parts = $pair.Split('=', 2)
    $name = [Uri]::UnescapeDataString($parts[0]).ToLowerInvariant()
    $value = if ($parts.Count -eq 2) { [Uri]::UnescapeDataString($parts[1]) } else { '' }
    if (($name -eq 'schema' -and $value -eq 'public') -or
        ($name -eq 'sslmode' -and $value -in @('require', 'verify-full'))) { continue }
    Stop-Maintenance 'DATABASE_URL_QUERY_UNSAFE'
  }
  return $uri
}

function Get-PinnedPrismaUri([object]$Config, [Uri]$Uri, [bool]$BoundedDdl) {
  $query = 'schema=public&connect_timeout=5'
  if ($Uri.Host -eq '127.0.0.1') { $query += '&sslmode=disable' }
  else {
    $query += '&sslmode=require&sslaccept=strict&sslrootcert=' +
      [Uri]::EscapeDataString([string]$Config.tlsRootCertFile)
  }
  if ($BoundedDdl) {
    $options = '-c lock_timeout=5s -c statement_timeout=120s'
    $query += '&options=' + [Uri]::EscapeDataString($options)
  }
  return [Uri]::new($Uri.GetLeftPart([UriPartial]::Path) + '?' + $query)
}

function Invoke-WithIsolatedEnvironment([object]$Config, [Uri]$Uri,
    [hashtable]$Extra, [scriptblock]$Action) {
  $previous = @{}
  foreach ($key in [Environment]::GetEnvironmentVariables('Process').Keys) {
    $previous[[string]$key] = [Environment]::GetEnvironmentVariable([string]$key, 'Process')
  }
  $systemRoot = $previous['SystemRoot']
  if (-not $systemRoot -or -not (Test-Path -LiteralPath $systemRoot -PathType Container)) {
    Stop-Maintenance 'SYSTEM_ROOT_INVALID'
  }
  $safe = @{
    SystemRoot = $systemRoot; WINDIR = $systemRoot
    ComSpec = (Join-Path $systemRoot 'System32/cmd.exe')
    PATH = ((Join-Path $systemRoot 'System32'), $systemRoot,
      $Config.nodeBin, $Config.postgresBin) -join ';'
    TEMP = $Config.privateDirectory; TMP = $Config.privateDirectory
    USERPROFILE = $Config.privateDirectory; HOME = $Config.privateDirectory
    APPDATA = $Config.privateDirectory; LOCALAPPDATA = $Config.privateDirectory
    npm_config_cache = (Join-Path $Config.privateDirectory 'npm-cache')
    npm_config_update_notifier = 'false'
    PGPORT = '5432'
  }
  if ($Uri) {
    $parts = $Uri.UserInfo.Split(':', 2)
    $safe.PGHOST = $Uri.Host
    $safe.PGPORT = [string]$Uri.Port
    $safe.PGUSER = [Uri]::UnescapeDataString($parts[0])
    $safe.PGPASSWORD = [Uri]::UnescapeDataString($parts[1])
    $safe.PGDATABASE = $Uri.AbsolutePath.TrimStart('/')
    $safe.PGCONNECT_TIMEOUT = '5'
    $safe.PGOPTIONS = '-c lock_timeout=5s -c statement_timeout=120s'
    $safe.PGGSSENCMODE = 'disable'
    if ($Uri.Host -eq '127.0.0.1') { $safe.PGSSLMODE = 'disable' }
    else {
      $safe.PGSSLMODE = 'verify-full'
      $safe.PGSSLROOTCERT = $Config.tlsRootCertFile
    }
  }
  foreach ($key in $Extra.Keys) {
    if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { Stop-Maintenance 'CHILD_ENV_KEY_INVALID' }
    $safe[$key] = [string]$Extra[$key]
  }
  try {
    foreach ($key in @($previous.Keys)) { Remove-Item -LiteralPath ("Env:$key") -ErrorAction Stop }
    foreach ($key in $safe.Keys) { [Environment]::SetEnvironmentVariable($key, $safe[$key], 'Process') }
    return & $Action
  } finally {
    foreach ($key in @([Environment]::GetEnvironmentVariables('Process').Keys)) {
      Remove-Item -LiteralPath ("Env:$key") -ErrorAction Stop
    }
    foreach ($key in $previous.Keys) {
      [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process')
    }
  }
}

function Invoke-PostgresTool([object]$Config, [Uri]$Uri, [string]$Tool,
    [string[]]$Arguments, [string]$FailureCode) {
  if (-not $Uri) { Stop-Maintenance 'DATABASE_URI_REQUIRED' }
  $binary = Join-Path $Config.postgresBin $Tool
  if ($Tool -eq 'psql.exe') { $Arguments = @('-w') + $Arguments }
  $result = Invoke-WithIsolatedEnvironment $Config $Uri @{} {
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
    [string]$FailureCode, [string]$SnapshotId = '') {
  if (-not $Uri) { Stop-Maintenance 'READ_ONLY_URI_REQUIRED' }
  $snapshotSql = ''
  if ($SnapshotId) {
    if ($SnapshotId -notmatch '^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9A-Fa-f]+$') {
      Stop-Maintenance 'EXPORTED_SNAPSHOT_INVALID'
    }
    $snapshotSql = "SET TRANSACTION SNAPSHOT '$SnapshotId'; "
  }
  $sql = "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; " +
    $snapshotSql + "SET LOCAL statement_timeout = '30s'; " +
    "SET LOCAL search_path = pg_catalog, public; " +
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

function Start-ExportedSnapshot([object]$Config, [Uri]$Uri) {
  $process = Invoke-WithIsolatedEnvironment $Config $Uri @{} {
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = Join-Path $Config.postgresBin 'psql.exe'
    $psi.Arguments = '-w -X -q -A -t -v ON_ERROR_STOP=1'
    $psi.WorkingDirectory = $Config.privateDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    return [Diagnostics.Process]::Start($psi)
  }
  try {
    $errorDrain = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.WriteLine("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; " +
      "SET LOCAL idle_in_transaction_session_timeout = '180s'; " +
      "SET LOCAL statement_timeout = '30s'; SELECT pg_export_snapshot();")
    $process.StandardInput.Flush()
    $lineTask = $process.StandardOutput.ReadLineAsync()
    if (-not $lineTask.Wait(15000)) { Stop-Maintenance 'SNAPSHOT_EXPORT_TIMEOUT' }
    $snapshotId = [string]$lineTask.Result
    if ($snapshotId -notmatch '^[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9A-Fa-f]+$' -or
        $process.HasExited) { Stop-Maintenance 'SNAPSHOT_EXPORT_FAILED' }
    return [pscustomobject]@{ Process = $process; Id = $snapshotId;
      StartedUtc = [DateTime]::UtcNow.ToString('o'); ErrorDrain = $errorDrain }
  } catch {
    if (-not $process.HasExited) { $process.Kill() }
    $process.Dispose()
    if ($_.Exception.Message -like 'LMR:*') { throw }
    Stop-Maintenance 'SNAPSHOT_EXPORT_FAILED'
  }
}

function Stop-ExportedSnapshot([object]$Holder) {
  if (-not $Holder) { return }
  $process = $Holder.Process
  try {
    if (-not $process.HasExited) {
      $process.StandardInput.WriteLine('ROLLBACK;')
      $process.StandardInput.WriteLine('\q')
      $process.StandardInput.Flush()
      $process.StandardInput.Close()
      if (-not $process.WaitForExit(10000)) { $process.Kill() }
    }
  } finally { $process.Dispose() }
}

function Start-DatabaseApplyLock([object]$Config, [Uri]$Uri) {
  $process = Invoke-WithIsolatedEnvironment $Config $Uri @{} {
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = Join-Path $Config.postgresBin 'psql.exe'
    $psi.Arguments = '-w -X -q -A -t -v ON_ERROR_STOP=1'
    $psi.WorkingDirectory = $Config.privateDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    return [Diagnostics.Process]::Start($psi)
  }
  try {
    $errorDrain = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.WriteLine('SELECT pg_try_advisory_lock(20261025, 6);')
    $process.StandardInput.Flush()
    $lineTask = $process.StandardOutput.ReadLineAsync()
    if (-not $lineTask.Wait(15000)) { Stop-Maintenance 'TARGET_DATABASE_LOCK_TIMEOUT' }
    if ($lineTask.Result -ne 't' -or $process.HasExited) {
      Stop-Maintenance 'TARGET_DATABASE_APPLY_ALREADY_RUNNING'
    }
    return [pscustomobject]@{ Process = $process; ErrorDrain = $errorDrain }
  } catch {
    if (-not $process.HasExited) { $process.Kill() }
    $process.Dispose()
    if ($_.Exception.Message -like 'LMR:*') { throw }
    Stop-Maintenance 'TARGET_DATABASE_LOCK_FAILED'
  }
}

function Stop-DatabaseApplyLock([object]$Holder) {
  if (-not $Holder) { return }
  $process = $Holder.Process
  try {
    if (-not $process.HasExited) {
      $process.StandardInput.WriteLine('\q')
      $process.StandardInput.Flush()
      $process.StandardInput.Close()
      if (-not $process.WaitForExit(10000)) { $process.Kill() }
    }
  } finally { $process.Dispose() }
}

function Get-GitCheckpoint([string]$Repo, [string]$ApprovedCommit, [bool]$Synthetic) {
  Assert-NotReparsePoint $Repo
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

function Assert-PinnedPrismaSchema([string]$Repo) {
  $prisma = Join-Path $Repo 'prisma'
  $schema = Join-Path $prisma 'schema.prisma'
  $migrations = Join-Path $prisma 'migrations'
  foreach ($path in @($Repo, $prisma, $schema, $migrations)) { Assert-NotReparsePoint $path }
  foreach ($name in @('prisma.config.ts', 'prisma.config.js', 'prisma.config.mjs')) {
    if (Test-Path -LiteralPath (Join-Path $Repo $name)) {
      Stop-Maintenance 'PRISMA_CONFIG_OVERRIDE_FORBIDDEN'
    }
  }
  $source = Get-Content -LiteralPath $schema -Raw -Encoding UTF8
  $datasources = @([regex]::Matches($source, '(?m)^\s*datasource\s+\w+\s*\{'))
  if ($datasources.Count -ne 1 -or
      $source -notmatch '(?s)datasource\s+db\s*\{\s*provider\s*=\s*"postgresql"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}' -or
      $source -match '(?i)shadowDatabaseUrl|directUrl') {
    Stop-Maintenance 'PRISMA_SCHEMA_DATASOURCE_UNSAFE'
  }
  return $schema
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

function Get-Sha256Bytes([byte[]]$Bytes) {
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($hasher.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant() }
  finally { $hasher.Dispose() }
}

function Get-ApprovedMigrationBytes([string]$Repo, [string]$Name) {
  if ($Name -notmatch '^[0-9]{14}_[a-z0-9_]+$') { Stop-Maintenance 'MIGRATION_NAME_INVALID' }
  $processInfo = [Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = 'git.exe'
  $processInfo.Arguments = "cat-file blob HEAD:prisma/migrations/$Name/migration.sql"
  $processInfo.WorkingDirectory = $Repo
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($processInfo)
  $output = [IO.MemoryStream]::new()
  try {
    $errorDrain = $process.StandardError.ReadToEndAsync()
    $process.StandardOutput.BaseStream.CopyTo($output)
    $process.WaitForExit()
    [void]$errorDrain.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) { Stop-Maintenance 'APPROVED_MIGRATION_BLOB_MISSING' }
    return ,$output.ToArray()
  } finally { $output.Dispose(); $process.Dispose() }
}

function Get-MigrationUtf8([byte[]]$Bytes) {
  if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 239 -and $Bytes[1] -eq 187 -and
      $Bytes[2] -eq 191) { Stop-Maintenance 'MIGRATION_BOM_FORBIDDEN' }
  try { $text = [Text.UTF8Encoding]::new($false, $true).GetString($Bytes) }
  catch { Stop-Maintenance 'MIGRATION_INVALID_UTF8' }
  if ($text.Contains([char]0)) { Stop-Maintenance 'MIGRATION_NUL_BYTE' }
  return $text
}

function Get-MigrationEolStyle([string]$Text) {
  if ([regex]::IsMatch($Text, "`r(?!`n)")) { return 'MIXED' }
  $crlf = $Text.Contains("`r`n")
  $lf = [regex]::IsMatch($Text, "(?<!`r)`n")
  if ($crlf -and $lf) { return 'MIXED' }
  if ($crlf) { return 'CRLF' }
  if ($lf) { return 'LF' }
  return 'NONE'
}

function Test-MigrationEolConversionSafe([string]$Text) {
  # A newline inside a SQL string, quoted identifier, or dollar body can be data.
  # Refuse cross-platform checksum variants in that case, even if the bytes differ
  # only by line endings. This check does not parse or approve migration SQL.
  if ($Text -match '(?i)\bCOPY\b' -or $Text -match '(?m)^\s*\\') { return $false }
  $state = 'normal'; $depth = 0; $tag = ''
  for ($i = 0; $i -lt $Text.Length; $i++) {
    $c = $Text[$i]
    $next = if ($i + 1 -lt $Text.Length) { $Text[$i + 1] } else { [char]0 }
    if ($state -eq 'line') {
      if ($c -eq "`n") { $state = 'normal' }
      continue
    }
    if ($state -eq 'block') {
      if ($c -eq '/' -and $next -eq '*') { $depth++; $i++ }
      elseif ($c -eq '*' -and $next -eq '/') {
        $depth--; $i++
        if ($depth -eq 0) { $state = 'normal' }
      }
      continue
    }
    if ($state -in @('single', 'double', 'dollar')) {
      if ($c -eq "`r" -or $c -eq "`n" -or $c -eq '\') { return $false }
      if ($state -eq 'dollar') {
        if ($i + $tag.Length -le $Text.Length -and
            $Text.Substring($i, $tag.Length) -ceq $tag) {
          $i += $tag.Length - 1; $state = 'normal'
        }
        continue
      }
      $quote = if ($state -eq 'single') { "'" } else { '"' }
      if ($c -eq $quote) {
        if ($next -eq $quote) { $i++ } else { $state = 'normal' }
      }
      continue
    }
    if ($c -eq '-' -and $next -eq '-') { $state = 'line'; $i++; continue }
    if ($c -eq '/' -and $next -eq '*') { $state = 'block'; $depth = 1; $i++; continue }
    if ($c -eq "'") { $state = 'single'; continue }
    if ($c -eq '"') { $state = 'double'; continue }
    if ($c -eq '$') {
      $match = [regex]::Match($Text.Substring($i), '^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$')
      if ($match.Success) {
        $tag = $match.Value; $state = 'dollar'; $i += $tag.Length - 1
      }
    }
  }
  return $state -in @('normal', 'line')
}

function Get-MigrationFiles([string]$Repo) {
  $root = Join-Path $Repo 'prisma/migrations'
  if (-not (Test-Path -LiteralPath $root -PathType Container)) { Stop-Maintenance 'MIGRATIONS_MISSING' }
  Assert-NotReparsePoint $root
  $result = @()
  foreach ($directory in @(Get-ChildItem -LiteralPath $root -Directory | Sort-Object Name)) {
    $file = Join-Path $directory.FullName 'migration.sql'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
    Assert-NotReparsePoint $directory.FullName
    Assert-NotReparsePoint $file
    if ($directory.Name -notmatch '^[0-9]{14}_[a-z0-9_]+$') {
      Stop-Maintenance 'MIGRATION_NAME_INVALID'
    }
    $approvedBytes = Get-ApprovedMigrationBytes $Repo $directory.Name
    $approvedText = Get-MigrationUtf8 $approvedBytes
    $workingBytes = [IO.File]::ReadAllBytes($file)
    [void](Get-MigrationUtf8 $workingBytes)
    $approvedHash = Get-Sha256Bytes $approvedBytes
    $workingHash = Get-Sha256Bytes $workingBytes
    $checkoutHashes = @($approvedHash)
    $appliedHashes = @($approvedHash)
    $safeConversion = Test-MigrationEolConversionSafe $approvedText
    $style = Get-MigrationEolStyle $approvedText
    if ($style -in @('LF', 'CRLF')) {
      $otherText = if ($style -eq 'LF') { $approvedText.Replace("`n", "`r`n") }
        else { $approvedText.Replace("`r`n", "`n") }
      $otherHash = Get-Sha256Bytes ([Text.Encoding]::UTF8.GetBytes($otherText))
      $checkoutHashes += $otherHash
      if ($safeConversion) { $appliedHashes += $otherHash }
    }
    if ($workingHash -notin $checkoutHashes) {
      Stop-Maintenance 'MIGRATION_CHECKOUT_BYTES_MISMATCH'
    }
    if ($directory.Name -eq '20261011180000_document_checklist_v2') {
      if ($approvedHash -ne '61a95d4365feb4f40967158653bb5ed63803ebd7eb669bcd47f47d6b3185cfa3' -or
          $style -ne 'LF' -or -not $approvedText.EndsWith("`n") -or
          -not $safeConversion) {
        Stop-Maintenance 'HISTORICAL_MIGRATION_PROVENANCE_CHANGED'
      }
      $mixedText = $approvedText.Substring(0, $approvedText.Length - 1).Replace("`n", "`r`n") + "`n"
      $mixedHash = Get-Sha256Bytes ([Text.Encoding]::UTF8.GetBytes($mixedText))
      if ($mixedHash -ne '95254cd60c62e2013b2f92696a012ab6698bfd0452b272f6d22049bcbdcbbe0b') {
        Stop-Maintenance 'HISTORICAL_MIGRATION_PROVENANCE_CHANGED'
      }
      $appliedHashes += $mixedHash
    }
    $result += [pscustomobject]@{
      Name = $directory.Name
      Path = $file
      Sha256 = $workingHash
      ApprovedSha256 = $approvedHash
      AllowedAppliedSha256 = @($appliedHashes | Select-Object -Unique)
      PendingExecutableSafe = ($workingHash -eq $approvedHash -or $safeConversion)
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
    if (-not $files[$row.name].PSObject.Properties['AllowedAppliedSha256'] -or
        [string]$row.checksum -notmatch '^[0-9a-fA-F]{64}$' -or
        [string]$row.checksum -notin @($files[$row.name].AllowedAppliedSha256)) {
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
  foreach ($name in $pending) {
    if (-not $files[$name].PendingExecutableSafe) {
      Stop-Maintenance 'PENDING_SQL_EOL_UNSAFE'
    }
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
  try {
    $snapshot = Invoke-ReadOnlyQuery $Config $Uri $sql 'TARGET_SNAPSHOT_FAILED' | ConvertFrom-Json
    $identity = Get-DatabaseIdentityState $Config $Uri
    if ($snapshot.database -ne $identity.database -or
        [string]$snapshot.databaseOid -ne [string]$identity.databaseOid -or
        $snapshot.role -ne $identity.role) { Stop-Maintenance 'TARGET_IDENTITY_CHANGED' }
    $snapshot | Add-Member -NotePropertyName clusterIdentity -NotePropertyValue $identity.clusterIdentity
    return $snapshot
  }
  catch { if ($_.Exception.Message -like 'LMR:*') { throw }; Stop-Maintenance 'TARGET_SNAPSHOT_INVALID' }
}

function Get-DatabaseIdentityState([object]$Config, [Uri]$Uri) {
  $sql = "SELECT json_build_object('database',current_database(),'role',current_user," +
    "'databaseOid',(SELECT oid FROM pg_database WHERE datname=current_database())," +
    "'clusterIdentity',(SELECT system_identifier::text FROM pg_control_system()))::text"
  try {
    $state = Invoke-ReadOnlyQuery $Config $Uri $sql 'CLUSTER_IDENTITY_UNAVAILABLE' | ConvertFrom-Json
    if ($state.clusterIdentity -notmatch '^[0-9]{10,20}$' -or
        $state.databaseOid -notmatch '^\d+$') { Stop-Maintenance 'CLUSTER_IDENTITY_UNVERIFIABLE' }
    return $state
  } catch {
    if ($_.Exception.Message -like 'LMR:*') { throw }
    Stop-Maintenance 'CLUSTER_IDENTITY_UNVERIFIABLE'
  }
}

function Get-TargetFingerprint([Uri]$Uri, [object]$Snapshot) {
  return Get-Sha256Text ("$($Uri.Host.ToLowerInvariant())|$($Uri.Port)|$($Snapshot.database)|" +
    "$($Snapshot.role)|$($Snapshot.databaseOid)|$($Snapshot.clusterIdentity)|$($Snapshot.serverVersion)")
}

function Get-ApplicationRoleState([object]$Config, [Uri]$ApplicationUri,
    [object]$DirectSnapshot) {
  if (-not $DirectSnapshot.PSObject.Properties['clusterIdentity'] -or
      $DirectSnapshot.clusterIdentity -notmatch '^[0-9]{10,20}$') {
    Stop-Maintenance 'DIRECT_CLUSTER_IDENTITY_UNVERIFIABLE'
  }
  $state = Get-DatabaseIdentityState $Config $ApplicationUri
  if ($state.database -ne $DirectSnapshot.database -or
      [string]$state.databaseOid -ne [string]$DirectSnapshot.databaseOid -or
      $state.clusterIdentity -ne $DirectSnapshot.clusterIdentity -or
      $state.role -ne $Config.applicationRole) {
    Stop-Maintenance 'APPLICATION_ROLE_TARGET_MISMATCH'
  }
  return $state
}

function Get-ApplicableSequenceDefaultAclCount([object]$Config, [Uri]$SourceUri) {
  if (-not $SourceUri) { Stop-Maintenance 'SEQUENCE_PRIVILEGE_SOURCE_UNKNOWN' }
  $sql = "SELECT count(*) FROM pg_default_acl d WHERE d.defaclrole=" +
    "(SELECT oid FROM pg_roles WHERE rolname=current_user) AND d.defaclobjtype='S' " +
    "AND (d.defaclnamespace=0 OR d.defaclnamespace='public'::regnamespace)"
  $count = Invoke-ReadOnlyQuery $Config $SourceUri $sql 'SEQUENCE_DEFAULT_ACL_UNKNOWN'
  if ($count -notmatch '^\d+$') { Stop-Maintenance 'SEQUENCE_DEFAULT_ACL_UNKNOWN' }
  return [int]$count
}

function Assert-SequencePermissionAssumptions([object]$Config, [Uri]$SourceUri,
    [object[]]$Audits, [string]$MigrationRole, [string]$ApplicationRole) {
  $sequences = @($Audits | ForEach-Object { $_.audit.CreatedSequences })
  if ($sequences.Count -eq 0) { return }
  if (-not $MigrationRole -or -not $ApplicationRole -or
      $ApplicationRole -ne $MigrationRole) {
    Stop-Maintenance 'SEQUENCE_PERMISSION_UNPROVEN_DIFFERENT_ROLE'
  }
  if (-not $SourceUri -or ($SourceUri.Host -eq '127.0.0.1' -and
      $Config.targetKind -ne 'synthetic')) {
    Stop-Maintenance 'SEQUENCE_PRIVILEGE_SOURCE_UNKNOWN'
  }
  $sourceRole = Invoke-ReadOnlyQuery $Config $SourceUri 'SELECT current_user' `
    'SEQUENCE_PRIVILEGE_SOURCE_UNKNOWN'
  if ($sourceRole -ne $MigrationRole) { Stop-Maintenance 'SEQUENCE_PRIVILEGE_SOURCE_UNKNOWN' }
  if ((Get-ApplicableSequenceDefaultAclCount $Config $SourceUri) -ne 0) {
    Stop-Maintenance 'SEQUENCE_DEFAULT_ACL_UNMODELED'
  }
}

function Assert-NonSuperuserSequenceAccess([object]$Config, [Uri]$ProbeUri,
    [string]$Sequence, [string]$ExpectedRole) {
  if ($Sequence -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or
      $ExpectedRole -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
    Stop-Maintenance 'SEQUENCE_PROBE_IDENTITY_INVALID'
  }
  $identity = Invoke-ReadOnlyQuery $Config $ProbeUri `
    "SELECT current_user||'|'||rolsuper::text FROM pg_roles WHERE rolname=current_user" `
    'SEQUENCE_PROBE_ROLE_UNKNOWN'
  if ($identity -ne "$ExpectedRole|false") { Stop-Maintenance 'SEQUENCE_PROBE_NOT_APP_EQUIVALENT' }
  $qualified = 'public."' + $Sequence + '"'
  $hasUsage = Invoke-ReadOnlyQuery $Config $ProbeUri `
    "SELECT has_sequence_privilege(current_user, '$qualified', 'USAGE')" `
    'SEQUENCE_PRIVILEGE_CHECK_FAILED'
  if ($hasUsage -ne 't') { Stop-Maintenance 'SEQUENCE_PERMISSION_MISSING' }
  $sqlPath = Join-Path $Config.privateDirectory ('sequence-nextval-' + [Guid]::NewGuid().ToString('N') + '.sql')
  [IO.File]::WriteAllText($sqlPath,
    'SELECT nextval(''' + $qualified + '''::regclass);', [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $sqlPath
  try {
    [void](Invoke-PostgresTool $Config $ProbeUri 'psql.exe' @(
        '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-f', $sqlPath) 'SEQUENCE_NEXTVAL_FAILED')
  } finally { [IO.File]::Delete($sqlPath) }
}

function Assert-SequenceRolePermissions([object]$Config, [Uri]$SourceUri,
    [object]$Cluster, [object[]]$Audits, [string]$MigrationRole,
    [string]$ApplicationRole) {
  $sequences = @($Audits | ForEach-Object { $_.audit.CreatedSequences })
  if ($sequences.Count -eq 0) { return }
  Assert-SequencePermissionAssumptions $Config $SourceUri $Audits `
    $MigrationRole $ApplicationRole
  if ($Cluster.Uri.Host -ne '127.0.0.1' -or $Cluster.Database -notmatch '^legalhub_runner_') {
    Stop-Maintenance 'SEQUENCE_PROBE_TARGET_UNSAFE'
  }
  foreach ($sequence in $sequences) {
    if ($sequence -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { Stop-Maintenance 'SEQUENCE_NAME_UNSAFE' }
    $exists = Invoke-ReadOnlyQuery $Config $Cluster.Uri `
      "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='$sequence' AND c.relkind='S'" `
      'SEQUENCE_PROBE_TARGET_UNKNOWN'
    if ($exists -ne '1') { Stop-Maintenance 'SEQUENCE_PROBE_TARGET_MISSING' }
  }
  $probeRole = 'runner_probe_' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
  $passwordBytes = [byte[]]::new(32)
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($passwordBytes) } finally { $rng.Dispose() }
  $password = [Convert]::ToBase64String($passwordBytes)
  $setupPath = Join-Path $Config.privateDirectory ('sequence-role-' + [Guid]::NewGuid().ToString('N') + '.sql')
  [IO.File]::WriteAllText($setupPath,
    "CREATE ROLE `"$probeRole`" LOGIN PASSWORD '$password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;" +
    " GRANT USAGE, CREATE ON SCHEMA public TO `"$probeRole`";", [Text.UTF8Encoding]::new($false))
  Set-PrivateAcl $setupPath
  try {
    [void](Invoke-PostgresTool $Config $Cluster.Uri 'psql.exe' @(
        '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $setupPath) 'SEQUENCE_PROBE_ROLE_CREATE_FAILED')
  } finally { [IO.File]::Delete($setupPath) }
  $probeUri = [Uri]::new("postgresql://${probeRole}:$([Uri]::EscapeDataString($password))@127.0.0.1:$($Cluster.Port)/$($Cluster.Database)?schema=public")
  try {
    foreach ($sequence in $sequences) {
      if ($sequence -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { Stop-Maintenance 'SEQUENCE_NAME_UNSAFE' }
      $probeSequence = 'RunnerProbe_' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
      $sqlPath = Join-Path $Config.privateDirectory ('sequence-create-' + [Guid]::NewGuid().ToString('N') + '.sql')
      [IO.File]::WriteAllText($sqlPath, "CREATE SEQUENCE public.`"$probeSequence`";",
        [Text.UTF8Encoding]::new($false))
      Set-PrivateAcl $sqlPath
      try {
        [void](Invoke-PostgresTool $Config $probeUri 'psql.exe' @(
            '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $sqlPath) 'SEQUENCE_PROBE_CREATE_FAILED')
      } finally { [IO.File]::Delete($sqlPath) }
      Assert-NonSuperuserSequenceAccess $Config $probeUri $probeSequence $probeRole
    }
  } finally {
    $cleanupPath = Join-Path $Config.privateDirectory ('sequence-cleanup-' + [Guid]::NewGuid().ToString('N') + '.sql')
    [IO.File]::WriteAllText($cleanupPath,
      "DROP OWNED BY `"$probeRole`"; DROP ROLE `"$probeRole`";", [Text.UTF8Encoding]::new($false))
    Set-PrivateAcl $cleanupPath
    try {
      [void](Invoke-PostgresTool $Config $Cluster.Uri 'psql.exe' @(
          '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', $cleanupPath) 'SEQUENCE_PROBE_CLEANUP_FAILED')
    } finally { [IO.File]::Delete($cleanupPath) }
  }
}

function Assert-FinalSequencePermissions([object]$Config, [Uri]$SourceUri,
    [object]$State) {
  Assert-SequencePermissionAssumptions $Config $SourceUri $State.audits `
    $State.snapshot.role $State.applicationRole
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
    [hashtable]$ExcludedColumns = @{}, [string]$SnapshotId = '') {
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
    try { $result[$table] = Invoke-ReadOnlyQuery $Config $Uri $sql 'DATA_FINGERPRINT_FAILED' $SnapshotId | ConvertFrom-Json }
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

function Get-StructureFingerprint([object]$Config, [Uri]$Uri,
    [string]$SnapshotId = '') {
  $sql = @'
WITH objects AS (
  SELECT 'table' AS kind, n.nspname||'.'||c.relname AS name,
    c.relkind::text AS definition
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m')
  UNION ALL
  SELECT 'column', n.nspname||'.'||c.relname||'.'||a.attname,
    format_type(a.atttypid,a.atttypmod)||'|'||a.attnotnull::text||'|'||
      COALESCE(pg_get_expr(d.adbin,d.adrelid),'')
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'constraint', n.nspname||'.'||c.relname||'.'||x.conname,
    pg_get_constraintdef(x.oid)
  FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
  UNION ALL
  SELECT 'index', n.nspname||'.'||c.relname, pg_get_indexdef(c.oid)
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='i'
  UNION ALL
  SELECT 'extension', e.extname, e.extversion
  FROM pg_extension e
)
SELECT json_build_object('count',count(*),
  'digest',md5(COALESCE(string_agg(kind||'|'||name||'|'||definition,E'\n'
    ORDER BY kind,name,definition),'')))::text FROM objects
'@
  try { return Invoke-ReadOnlyQuery $Config $Uri $sql 'STRUCTURE_INVENTORY_FAILED' $SnapshotId | ConvertFrom-Json }
  catch { if ($_.Exception.Message -like 'LMR:*') { throw }; Stop-Maintenance 'STRUCTURE_INVENTORY_INVALID' }
}

function Assert-StructureEqual([object]$Before, [object]$After) {
  if ([long]$Before.count -ne [long]$After.count -or
      [string]$Before.digest -ne [string]$After.digest) {
    Stop-Maintenance 'RESTORED_STRUCTURE_MISMATCH'
  }
}

function Assert-CreatedObjects([object]$Config, [Uri]$Uri, [object[]]$Audits) {
  foreach ($audit in $Audits) {
    foreach ($index in @($audit.audit.CreatedIndexes)) {
      if ($index -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { Stop-Maintenance 'INDEX_NAME_UNSAFE' }
      $value = Invoke-ReadOnlyQuery $Config $Uri "SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='$index' AND i.indisvalid AND i.indisready" 'CREATED_INDEX_CHECK_FAILED'
      if ($value -ne '1') { Stop-Maintenance 'CREATED_INDEX_MISSING' }
    }
    foreach ($constraint in @($audit.audit.CreatedConstraints)) {
      if ($constraint -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { Stop-Maintenance 'CONSTRAINT_NAME_UNSAFE' }
      $value = Invoke-ReadOnlyQuery $Config $Uri "SELECT count(*) FROM pg_constraint x JOIN pg_namespace n ON n.oid=x.connamespace WHERE n.nspname='public' AND x.conname='$constraint' AND x.convalidated" 'CREATED_CONSTRAINT_CHECK_FAILED'
      if ($value -ne '1') { Stop-Maintenance 'CREATED_CONSTRAINT_MISSING' }
    }
    foreach ($sequence in @($audit.audit.CreatedSequences)) {
      if ($sequence -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { Stop-Maintenance 'SEQUENCE_NAME_UNSAFE' }
      $value = Invoke-ReadOnlyQuery $Config $Uri "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='$sequence' AND c.relkind='S'" 'CREATED_SEQUENCE_CHECK_FAILED'
      if ($value -ne '1') { Stop-Maintenance 'CREATED_SEQUENCE_MISSING' }
    }
  }
}

function New-PrivateBackup([object]$Config, [Uri]$SourceUri, [string]$RunId,
    [string]$SnapshotId = '') {
  Assert-PrivateAcl $Config.backupDirectory
  $name = 'legalhub-maintenance-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $RunId + '.dump'
  $path = Join-Path $Config.backupDirectory $name
  if (Test-Path -LiteralPath $path) { Stop-Maintenance 'BACKUP_COLLISION' }
  $arguments = @('--format=custom', '--schema=public', '--no-owner', '--no-privileges')
  if ($SnapshotId) { $arguments += "--snapshot=$SnapshotId" }
  $arguments += "--file=$path"
  [void](Invoke-PostgresTool $Config $SourceUri 'pg_dump.exe' $arguments 'BACKUP_FAILED')
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Stop-Maintenance 'BACKUP_MISSING' }
  Set-PrivateAcl $path
  $tocResult = Invoke-WithIsolatedEnvironment $Config $null @{} {
    $oldPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $lines = @(& (Join-Path $Config.postgresBin 'pg_restore.exe') --list $path 2>$null)
      return [pscustomobject]@{ Lines = $lines; ExitCode = $LASTEXITCODE }
    } finally { $ErrorActionPreference = $oldPreference }
  }
  if ($tocResult.ExitCode -ne 0) { Stop-Maintenance 'BACKUP_TOC_INVALID' }
  $toc = @($tocResult.Lines)
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

function Save-DisposableClusterLifecycle([object]$State, [string]$Phase) {
  $path = Join-Path $State.Root 'runner-lifecycle.json'
  $existing = Test-Path -LiteralPath $path -PathType Leaf
  if ($existing) { Assert-PrivateAcl $path }
  $record = [ordered]@{
    runId = $State.RunId; root = $State.Root; cluster = $State.Cluster
    port = $State.Port; database = $State.Database; phase = $Phase
  }
  [IO.File]::WriteAllText($path, (ConvertTo-Json -InputObject $record -Compress),
    [Text.UTF8Encoding]::new($false))
  if (-not $existing) { Set-PrivateAcl $path }
}

function Assert-NoUnverifiedDisposableClusters([object]$Config) {
  $isolatedRoot = Join-Path $Config.privateDirectory 'isolated'
  if (-not (Test-Path -LiteralPath $isolatedRoot)) { return }
  Assert-NotReparsePoint $isolatedRoot
  if (@(Get-ChildItem -LiteralPath $isolatedRoot -Force).Count -ne 0) {
    Stop-Maintenance 'TEST_PARTIAL_CLUSTER_UNVERIFIED'
  }
}

function New-DisposableCluster([object]$Config, [string]$RunId,
    [string]$FaultAt = '') {
  if ($FaultAt -and $Config.targetKind -ne 'synthetic') {
    Stop-Maintenance 'TEST_FAULT_UNAVAILABLE'
  }
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
  $state = [pscustomobject]@{ RunId = $RunId; Root = $root; Cluster = $cluster;
    Port = 0; Database = ''; Uri = $null }
  Save-DisposableClusterLifecycle $state 'OWNED'
  try {
    if ($FaultAt -eq 'BeforeInitdb') { Stop-Maintenance 'TEST_INJECTED_BEFORE_INITDB' }
    $passwordFile = Join-Path $root 'initdb-password.tmp'
    $bytes = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $password = [Convert]::ToBase64String($bytes)
    [IO.File]::WriteAllText($passwordFile, $password + [Environment]::NewLine,
      [Text.UTF8Encoding]::new($false))
    Set-PrivateAcl $passwordFile
    try {
      Invoke-WithIsolatedEnvironment $Config $null @{} {
        $binary = Join-Path $Config.postgresBin 'initdb.exe'
        $oldPreference = $ErrorActionPreference
        try {
          $ErrorActionPreference = 'Continue'
          $output = @(& $binary '-D' $cluster '-U' 'restore_admin' '--encoding=UTF8' `
              '--auth-host=scram-sha-256' '--auth-local=scram-sha-256' `
              "--pwfile=$passwordFile" '--no-instructions' 2>$null)
          if ($LASTEXITCODE -ne 0) { Stop-Maintenance 'ISOLATED_INITDB_FAILED' }
        } finally { $ErrorActionPreference = $oldPreference }
      }
    } finally {
      if (Test-Path -LiteralPath $passwordFile -PathType Leaf) { [IO.File]::Delete($passwordFile) }
    }
    Save-DisposableClusterLifecycle $state 'INITIALIZED'
    if ($FaultAt -eq 'AfterInitdb') { Stop-Maintenance 'TEST_INJECTED_AFTER_INITDB' }
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    try { $listener.Start(); $state.Port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port }
    finally { $listener.Stop() }
    if ($state.Port -eq 5432) { Stop-Maintenance 'ISOLATED_PORT_UNSAFE' }
    Save-DisposableClusterLifecycle $state 'STARTING'
    $log = Join-Path $root 'postgres.log'
    Invoke-WithIsolatedEnvironment $Config $null @{} {
      $binary = Join-Path $Config.postgresBin 'pg_ctl.exe'
      $control = Start-Process -FilePath $binary -ArgumentList @(
        '-s', '-D', "`"$cluster`"", '-l', "`"$log`"", '-o',
        "`"-h 127.0.0.1 -p $($state.Port)`"", '-w', '-t', '45', 'start') -PassThru `
        -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'control.out') `
        -RedirectStandardError (Join-Path $root 'control.err')
      try {
        if (-not $control.WaitForExit(50000)) { Stop-Maintenance 'LOCAL_POSTGRES_CONTROL_TIMEOUT' }
        # pg_ctl can report a nonzero control exit even when the isolated server
        # is accepting connections; the bounded pg_isready probe below is authoritative.
      } finally { $control.Dispose() }
    }
    Save-DisposableClusterLifecycle $state 'STARTED_UNKNOWN'
    if ($FaultAt -eq 'AfterStartStopFailure') {
      Stop-Maintenance 'TEST_INJECTED_AFTER_START'
    }
    if ($FaultAt -eq 'AfterStart') { Stop-Maintenance 'TEST_INJECTED_AFTER_START' }
    $ready = Invoke-WithIsolatedEnvironment $Config $null @{} {
      $oldPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $output = @(& (Join-Path $Config.postgresBin 'pg_isready.exe') '-h' '127.0.0.1' `
            '-p' ([string]$state.Port) '-U' 'restore_admin' '-d' 'postgres' '-q' 2>$null)
        return $LASTEXITCODE
      } finally { $ErrorActionPreference = $oldPreference }
    }
    if ($ready -ne 0) { Stop-Maintenance 'ISOLATED_NOT_READY' }
    Save-DisposableClusterLifecycle $state 'RUNNING'
    if ($FaultAt -eq 'AfterReady') { Stop-Maintenance 'TEST_INJECTED_AFTER_READY' }
    $state.Database = 'legalhub_runner_' + $RunId.Replace('-', '_')
    $encoded = [Uri]::EscapeDataString($password)
    $adminUri = [Uri]::new("postgresql://restore_admin:$encoded@127.0.0.1:$($state.Port)/postgres")
    [void](Invoke-PostgresTool $Config $adminUri 'createdb.exe' @(
        '-T', 'template0', $state.Database) 'ISOLATED_CREATE_DB_FAILED')
    Save-DisposableClusterLifecycle $state 'DATABASE_CREATED'
    if ($FaultAt -eq 'AfterCreatedb') { Stop-Maintenance 'TEST_INJECTED_AFTER_CREATEDB' }
    $state.Uri = [Uri]::new("postgresql://restore_admin:$encoded@127.0.0.1:$($state.Port)/$($state.Database)?schema=public")
    return $state
  } catch {
    $failure = $_
    try {
      $stopFault = if ($FaultAt -eq 'AfterStartStopFailure') { 'BeforeStatus' } else { '' }
      Stop-DisposableCluster $Config $state $stopFault
    } catch {
      Save-DisposableClusterLifecycle $state 'STOP_UNVERIFIED'
      throw
    }
    throw $failure
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

function Invoke-DisposableMigration([object]$Config, [object]$Cluster, [string]$Repo) {
  if ($Cluster.Uri.Host -ne '127.0.0.1' -or $Cluster.Port -eq 5432 -or
      $Cluster.Database -notmatch '^legalhub_runner_') {
    Stop-Maintenance 'MIGRATION_SIMULATION_TARGET_UNSAFE'
  }
  $cli = Join-Path $Repo 'node_modules/prisma/build/index.js'
  if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) {
    Stop-Maintenance 'PRISMA_CLI_MISSING_RUN_NPM_CI'
  }
  Assert-NotReparsePoint $cli
  $schema = Assert-PinnedPrismaSchema $Repo
  $url = (Get-PinnedPrismaUri $Config $Cluster.Uri $true).AbsoluteUri
  Invoke-WithIsolatedEnvironment $Config $null @{ DATABASE_URL = $url; DIRECT_URL = $url } {
    $oldPreference = $ErrorActionPreference
    Push-Location $Repo
    try {
      $ErrorActionPreference = 'Continue'
      $output = @(& (Join-Path $Config.nodeBin 'node.exe') $cli migrate deploy --schema $schema 2>$null)
      if ($LASTEXITCODE -ne 0) { Stop-Maintenance 'ISOLATED_MIGRATION_FAILED' }
    } finally {
      $ErrorActionPreference = $oldPreference
      Pop-Location
    }
  }
}

function Stop-DisposableCluster([object]$Config, [object]$Cluster,
    [string]$FaultAt = '') {
  if (-not $Cluster) { return }
  if ($FaultAt -and $Config.targetKind -ne 'synthetic') {
    Stop-Maintenance 'TEST_FAULT_UNAVAILABLE'
  }
  $isolatedRoot = Join-Path $Config.privateDirectory 'isolated'
  $root = Assert-ChildPath $isolatedRoot $Cluster.Root
  foreach ($path in @($Config.privateDirectory, $isolatedRoot, $root)) {
    Assert-NotReparsePoint $path
  }
  if (Test-Path -LiteralPath $Cluster.Cluster) { Assert-NotReparsePoint $Cluster.Cluster }
  $marker = Join-Path $root 'runner-owned.txt'
  if (-not (Test-Path -LiteralPath $marker -PathType Leaf) -or
      (Get-Content -LiteralPath $marker -Raw).Trim() -ne $Cluster.RunId) {
    Stop-Maintenance 'ISOLATED_CLEANUP_MARKER_MISMATCH'
  }
  if ($FaultAt -eq 'BeforeStatus') { Stop-Maintenance 'TEST_INJECTED_STOP_FAILED' }
  if (Test-Path -LiteralPath $Cluster.Cluster -PathType Container) {
    $status = Invoke-WithIsolatedEnvironment $Config $null @{} {
      $oldPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $output = @(& (Join-Path $Config.postgresBin 'pg_ctl.exe') '-D' $Cluster.Cluster `
            'status' 2>$null)
        return $LASTEXITCODE
      } finally { $ErrorActionPreference = $oldPreference }
    }
    if ($status -eq 0) {
      $stopped = Invoke-WithIsolatedEnvironment $Config $null @{} {
        $oldPreference = $ErrorActionPreference
        try {
          $ErrorActionPreference = 'Continue'
          $output = @(& (Join-Path $Config.postgresBin 'pg_ctl.exe') '-D' $Cluster.Cluster `
              '-m' 'fast' '-w' '-t' '45' 'stop' 2>$null)
          return $LASTEXITCODE
        } finally { $ErrorActionPreference = $oldPreference }
      }
      if ($stopped -ne 0) { Stop-Maintenance 'ISOLATED_STOP_FAILED' }
    } elseif ($status -in @(1, 3, 4) -and
        -not (Test-Path -LiteralPath (Join-Path $Cluster.Cluster 'postmaster.pid'))) {
      # pg_ctl returns different non-running codes for an initialized cluster.
    } else { Stop-Maintenance 'ISOLATED_STATUS_UNVERIFIED' }
  }
  if ($Cluster.Port -gt 0) {
    $ready = Invoke-WithIsolatedEnvironment $Config $null @{} {
      $oldPreference = $ErrorActionPreference
      try {
        $ErrorActionPreference = 'Continue'
        $output = @(& (Join-Path $Config.postgresBin 'pg_isready.exe') '-h' '127.0.0.1' `
            '-p' ([string]$Cluster.Port) '-q' 2>$null)
        return $LASTEXITCODE
      } finally { $ErrorActionPreference = $oldPreference }
    }
    if ($ready -eq 0) { Stop-Maintenance 'ISOLATED_STILL_RUNNING' }
  }
  $deleted = $false
  for ($attempt = 0; $attempt -lt 8; $attempt++) {
    try { [IO.Directory]::Delete($root, $true); $deleted = $true; break }
    catch [IO.IOException] { Start-Sleep -Milliseconds 500 }
  }
  if (-not $deleted) { Stop-Maintenance 'ISOLATED_CLEANUP_FAILED' }
  if (Test-Path -LiteralPath $root) { Stop-Maintenance 'ISOLATED_CLEANUP_FAILED' }
}
