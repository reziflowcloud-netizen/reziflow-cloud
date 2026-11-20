# Explicit, preflight-only Supabase shared SESSION transport. No Direct fallback.
function Get-MaintenanceConnectionMode([object]$Config) {
  if (-not $Config.PSObject.Properties['preflightConnectionMode']) { return 'direct' }
  $mode = [string]$Config.preflightConnectionMode
  if ($mode -cnotin @('direct', 'supabase_shared_session_ipv4')) {
    Stop-Maintenance 'CONNECTION_MODE_INVALID'
  }
  return $mode
}

function Test-SessionPoolerMode([object]$Config) {
  return (Get-MaintenanceConnectionMode $Config) -eq 'supabase_shared_session_ipv4'
}

function Assert-SessionPoolerProfile([object]$Config, [bool]$RequireFresh = $true) {
  if (-not (Test-SessionPoolerMode $Config)) { Stop-Maintenance 'SESSION_MODE_REQUIRED' }
  foreach ($name in @('projectReference', 'sessionPoolerHost', 'maintenanceRole',
      'sessionPoolerDashboardVerifiedAt', 'credentialCleanupDeadlineUtc')) {
    if (-not $Config.PSObject.Properties[$name] -or -not $Config.$name) {
      Stop-Maintenance 'SESSION_PROFILE_INCOMPLETE'
    }
  }
  if ($Config.targetKind -cne 'production' -or
      $Config.projectReference -cnotmatch '^[a-z0-9]{20}$' -or
      $Config.expectedHost -cne ('db.' + $Config.projectReference + '.supabase.co') -or
      $Config.sessionPoolerHost -cnotmatch '^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$' -or
      $Config.maintenanceRole -cnotmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or
      $Config.applicationRole -cnotmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or
      $Config.expectedApplicationHost -cnotin @($Config.expectedHost, $Config.sessionPoolerHost)) {
    Stop-Maintenance 'SESSION_PROJECT_BINDING_INVALID'
  }
  $stamp = [string]$Config.sessionPoolerDashboardVerifiedAt
  if ($stamp -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?Z$') {
    Stop-Maintenance 'SESSION_DASHBOARD_ATTESTATION_INVALID'
  }
  try { $at = [DateTime]::Parse($stamp).ToUniversalTime() }
  catch { Stop-Maintenance 'SESSION_DASHBOARD_ATTESTATION_INVALID' }
  if ($RequireFresh -and ($at -gt [DateTime]::UtcNow.AddMinutes(2) -or $at -lt [DateTime]::UtcNow.AddHours(-24))) {
    Stop-Maintenance 'SESSION_DASHBOARD_ATTESTATION_STALE'
  }
  $deadlineText = [string]$Config.credentialCleanupDeadlineUtc
  if ($deadlineText -cnotmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?Z$') {
    Stop-Maintenance 'SESSION_CLEANUP_DEADLINE_INVALID'
  }
  try { $deadline = [DateTime]::Parse($deadlineText).ToUniversalTime() }
  catch { Stop-Maintenance 'SESSION_CLEANUP_DEADLINE_INVALID' }
  if ($deadline -gt $at.AddHours(24) -or ($RequireFresh -and $deadline -le [DateTime]::UtcNow)) {
    Stop-Maintenance 'SESSION_CREDENTIAL_WINDOW_CLOSED'
  }
}

function Assert-SessionPoolerUri([object]$Config, [Uri]$Uri, [string]$Role) {
  Assert-SessionPoolerProfile $Config
  $login = $Role + '.' + $Config.projectReference
  if ($Role -cnotin @($Config.maintenanceRole, $Config.applicationRole) -or
      $Uri.Scheme -notin @('postgres', 'postgresql') -or
      $Uri.HostNameType -ne [UriHostNameType]::Dns -or
      $Uri.Host -cne $Config.sessionPoolerHost -or $Uri.Port -ne 5432 -or
      $Uri.AbsolutePath -cne '/postgres' -or $Uri.Fragment -or
      $Uri.UserInfo.Split(':', 2).Count -ne 2 -or
      [Uri]::UnescapeDataString($Uri.UserInfo.Split(':', 2)[0]) -cne $login -or
      -not $Uri.UserInfo.Split(':', 2)[1]) {
    Stop-Maintenance 'SESSION_ENDPOINT_INVALID'
  }
  $seen = @{}
  foreach ($pair in @($Uri.Query.TrimStart('?').Split('&') | Where-Object { $_ })) {
    $parts = $pair.Split('=',2)
    if ($parts.Count -ne 2) { Stop-Maintenance 'SESSION_URL_OPTIONS_UNSAFE' }
    $name = [Uri]::UnescapeDataString($parts[0])
    $value = [Uri]::UnescapeDataString($parts[1])
    if ($seen.ContainsKey($name) -or
        -not (($name -ceq 'schema' -and $value -ceq 'public') -or
          ($name -ceq 'sslmode' -and $value -ceq 'verify-full'))) {
      Stop-Maintenance 'SESSION_URL_OPTIONS_UNSAFE'
    }
    $seen[$name] = $true
  }
}

function Test-PublicIpv4([string]$Address) {
  $ip = $null
  if (-not [Net.IPAddress]::TryParse($Address,[ref]$ip) -or
      $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { return $false }
  $b = $ip.GetAddressBytes()
  return -not ($b[0] -in @(0,10,127) -or $b[0] -ge 224 -or
    ($b[0] -eq 169 -and $b[1] -eq 254) -or
    ($b[0] -eq 172 -and $b[1] -ge 16 -and $b[1] -le 31) -or
    ($b[0] -eq 192 -and $b[1] -eq 168) -or
    ($b[0] -eq 192 -and $b[1] -eq 0 -and $b[2] -in @(0,2)) -or
    ($b[0] -eq 192 -and $b[1] -eq 88 -and $b[2] -eq 99) -or
    ($b[0] -eq 100 -and $b[1] -ge 64 -and $b[1] -le 127) -or
    ($b[0] -eq 198 -and $b[1] -in @(18,19)) -or
    ($b[0] -eq 198 -and $b[1] -eq 51 -and $b[2] -eq 100) -or
    ($b[0] -eq 203 -and $b[1] -eq 0 -and $b[2] -eq 113))
}

function Invoke-BoundedSessionTool([string]$Binary, [string[]]$Arguments,
    [ValidateRange(50,150000)][int]$DeadlineMs = 150000,
    [string]$FailureCode = 'SESSION_TOOL_FAILED') {
  return Invoke-DiagnosticPostgresProcess $Binary $Arguments 'Session' $FailureCode $DeadlineMs
}

function Resolve-SessionPoolerIpv4([object]$Config) {
  Assert-SessionPoolerProfile $Config
  try {
    $ips = @([Net.Dns]::GetHostAddresses($Config.sessionPoolerHost) |
      Where-Object { $_.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork } |
      ForEach-Object ToString | Sort-Object -Unique)
  } catch { Stop-Maintenance 'SESSION_IPV4_UNAVAILABLE' }
  if ($ips.Count -eq 0 -or @($ips | Where-Object { -not (Test-PublicIpv4 $_) }).Count) {
    Stop-Maintenance 'SESSION_IPV4_UNAVAILABLE'
  }
  $Config | Add-Member -Force -NotePropertyName resolvedSessionIpv4 -NotePropertyValue $ips[0]
}

function Get-PreflightSourceUri([object]$Config, [bool]$Synthetic) {
  $key = if (Test-SessionPoolerMode $Config) { 'PREFLIGHT_SESSION_URL' } else { 'DIRECT_URL' }
  return Get-PrivateDatabaseUri $Config $key $Synthetic
}

function Get-PreflightApplicationUri([object]$Config, [bool]$Synthetic) {
  $key = if (Test-SessionPoolerMode $Config) { 'PREFLIGHT_APPLICATION_SESSION_URL' } else { 'DATABASE_URL' }
  return Get-PrivateDatabaseUri $Config $key $Synthetic
}

function Assert-SessionCredentialBinding([object]$Config) {
  $originalDirect = Get-PrivateDatabaseUri $Config 'DIRECT_URL' $false
  $originalApp = Get-PrivateDatabaseUri $Config 'DATABASE_URL' $false
  $maintenance = Get-PreflightSourceUri $Config $false
  $application = Get-PreflightApplicationUri $Config $false
  if ([Uri]::UnescapeDataString($originalDirect.UserInfo.Split(':',2)[0]) -cne $Config.maintenanceRole) {
    Stop-Maintenance 'SESSION_ORIGINAL_ROLE_MISMATCH'
  }
  $appLogin = if ($originalApp.Host -ceq $Config.expectedHost) { $Config.applicationRole }
    else { $Config.applicationRole + '.' + $Config.projectReference }
  if ([Uri]::UnescapeDataString($originalApp.UserInfo.Split(':',2)[0]) -cne $appLogin -or
      [Uri]::UnescapeDataString($maintenance.UserInfo.Split(':',2)[1]) -cne
        [Uri]::UnescapeDataString($originalDirect.UserInfo.Split(':',2)[1]) -or
      [Uri]::UnescapeDataString($application.UserInfo.Split(':',2)[1]) -cne
        [Uri]::UnescapeDataString($originalApp.UserInfo.Split(':',2)[1])) {
    Stop-Maintenance 'SESSION_CREDENTIAL_ORIGIN_MISMATCH'
  }
}

function Get-SessionTransportAttestation([object]$Config) {
  Assert-SessionPoolerProfile $Config
  if (-not $Config.PSObject.Properties['resolvedSessionIpv4'] -or
      -not (Test-PublicIpv4 $Config.resolvedSessionIpv4)) { Stop-Maintenance 'SESSION_IPV4_UNVERIFIED' }
  Assert-PrivateAcl $Config.tlsRootCertFile
  return [ordered]@{
    mode = 'supabase_shared_session_ipv4'; host = $Config.sessionPoolerHost; port = 5432
    projectReference = $Config.projectReference; database = 'postgres'
    maintenanceLogin = ($Config.maintenanceRole + '.' + $Config.projectReference)
    maintenanceRole = $Config.maintenanceRole
    applicationLogin = ($Config.applicationRole + '.' + $Config.projectReference)
    applicationRole = $Config.applicationRole; ipv4 = $Config.resolvedSessionIpv4
    tlsMode = 'verify-full'; backendTlsRequired = $true
    tlsRootSha256 = (Get-FileHash -LiteralPath $Config.tlsRootCertFile -Algorithm SHA256).Hash.ToLowerInvariant()
    dashboardVerifiedAt = [string]$Config.sessionPoolerDashboardVerifiedAt
    credentialCleanupDeadlineUtc = [string]$Config.credentialCleanupDeadlineUtc
  }
}

function Assert-DirectApplyConnection([object]$Config, [object]$Plan = $null) {
  if ((Get-MaintenanceConnectionMode $Config) -ne 'direct') {
    Stop-Maintenance 'SESSION_POOLER_APPLY_UNSUPPORTED'
  }
  if ($Plan -and (-not $Plan.PSObject.Properties['connectionMode'] -or
      $Plan.connectionMode -cne 'direct')) { Stop-Maintenance 'PLAN_CONNECTION_MODE_APPLY_FORBIDDEN' }
}

function Invoke-ExporterJson([object]$Holder, [string]$Sql) {
  if ($Holder.Process.HasExited) { Stop-Maintenance 'SESSION_EXPORTER_LOST' }
  try {
    $Holder.Process.StandardInput.WriteLine($Sql)
    $Holder.Process.StandardInput.Flush()
    $line = $Holder.Process.StandardOutput.ReadLineAsync()
    if (-not $line.Wait(10000)) { Stop-Maintenance 'SESSION_PROOF_TIMEOUT' }
    if ($Holder.Process.HasExited -or -not $line.Result) { Stop-Maintenance 'SESSION_EXPORTER_LOST' }
    return ([string]$line.Result | ConvertFrom-Json)
  } catch {
    if ($_.Exception.Message -like 'LMR:*') { throw }
    Stop-Maintenance 'SESSION_PROOF_INVALID'
  }
}

function Get-SessionIdentitySql {
  return "'database',current_database(),'role',current_user,'sessionRole',session_user," +
    "'backendTls',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid())," +
    "'databaseOid',(SELECT oid FROM pg_database WHERE datname=current_database())," +
    "'clusterIdentity',(SELECT system_identifier::text FROM pg_control_system())," +
    "'serverVersion',current_setting('server_version_num')"
}

function Assert-SessionBackendTls([object]$State) {
  if (-not $State.PSObject.Properties['backendTls'] -or
      $State.backendTls -isnot [bool] -or $State.backendTls -ne $true) {
    Stop-Maintenance 'SESSION_BACKEND_TLS_UNVERIFIED'
  }
}

function Assert-SessionIdentity([object]$Observed, [object]$Expected, [string]$Role) {
  if (-not $Observed -or -not $Expected) { Stop-Maintenance 'SESSION_PROOF_INVALID' }
  foreach ($name in @('database','databaseOid','clusterIdentity','serverVersion')) {
    if (-not $Observed.PSObject.Properties[$name] -or -not $Expected.PSObject.Properties[$name] -or
        [string]$Observed.$name -cne [string]$Expected.$name) { Stop-Maintenance 'SESSION_TARGET_CHANGED' }
  }
  if (-not $Observed.PSObject.Properties['role'] -or -not $Observed.PSObject.Properties['sessionRole'] -or
      $Observed.role -cne $Role -or $Observed.sessionRole -cne $Role) {
    Stop-Maintenance 'SESSION_DATABASE_ROLE_MISMATCH'
  }
}

function Get-SessionProofSql([int]$Key) {
  if ($Key -lt 1) { Stop-Maintenance 'SESSION_PROBE_KEY_INVALID' }
  return 'SELECT json_build_object(' + (Get-SessionIdentitySql) +
    ",'pid',pg_backend_pid(),'snapshotText',txid_current_snapshot()::text," +
    "'readOnly',current_setting('transaction_read_only')," +
    "'isolation',current_setting('transaction_isolation'),'lockHeld',EXISTS(" +
    "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted " +
    "AND classid=20261115 AND objid=$Key AND objsubid=2))::text;"
}

function Assert-SessionContinuity([object]$Expected, [object]$Observed) {
  Assert-SessionIdentity $Observed $Expected $Expected.role
  foreach ($name in @('pid','snapshotText','readOnly','isolation','lockHeld')) {
    if (-not $Observed.PSObject.Properties[$name] -or -not $Expected.PSObject.Properties[$name]) {
      Stop-Maintenance 'SESSION_PROOF_INVALID'
    }
  }
  if ($Expected.PSObject.Properties['backendTls'] -and
      (-not $Observed.PSObject.Properties['backendTls'] -or
        $Observed.backendTls -isnot [bool] -or $Observed.backendTls -ne $Expected.backendTls)) {
    Stop-Maintenance 'SESSION_CONTINUITY_LOST'
  }
  if ([string]$Observed.pid -notmatch '^[1-9][0-9]*$' -or
      $Observed.snapshotText -cnotmatch '^[0-9]+:[0-9]+:([0-9]+(,[0-9]+)*)?$' -or
      $Observed.lockHeld -isnot [bool] -or
      $Observed.pid -ne $Expected.pid -or $Observed.snapshotText -cne $Expected.snapshotText -or
      $Observed.readOnly -cne 'on' -or $Observed.isolation -cne 'repeatable read' -or
      $Observed.lockHeld -ne $true) { Stop-Maintenance 'SESSION_CONTINUITY_LOST' }
}

function Start-SessionSnapshotProof([object]$Config, [Uri]$Uri, [object]$Holder,
    [object]$Expected) {
  $key = [BitConverter]::ToInt32([Guid]::NewGuid().ToByteArray(),0) -band 0x7fffffff
  if ($key -eq 0) { $key = 1 }
  $owner = Invoke-ExporterJson $Holder (Get-SessionProofSql $key)
  Assert-SessionIdentity $owner $Expected $Config.maintenanceRole
  if (Test-SessionPoolerMode $Config) { Assert-SessionBackendTls $owner }
  if ($owner.lockHeld -isnot [bool] -or $owner.lockHeld -ne $false -or
      [string]$owner.pid -notmatch '^[1-9][0-9]*$' -or
      $owner.readOnly -cne 'on' -or $owner.isolation -cne 'repeatable read') {
    Stop-Maintenance 'SESSION_INITIAL_STATE_INVALID'
  }
  $Holder | Add-Member -NotePropertyName SessionProbeOwner -NotePropertyValue $owner
  # Record before dispatch: a lost acquire response still requires owned-key cleanup.
  $Holder | Add-Member -NotePropertyName SessionProbeKey -NotePropertyValue $key
  $acquired = Invoke-ExporterJson $Holder "SELECT json_build_object('acquired',pg_try_advisory_lock(20261115,$key))::text;"
  if ($acquired.acquired -isnot [bool] -or $acquired.acquired -ne $true) { Stop-Maintenance 'SESSION_PROBE_LOCK_UNAVAILABLE' }
  $proof = Invoke-ExporterJson $Holder (Get-SessionProofSql $key)
  Assert-SessionIdentity $proof $Expected $Config.maintenanceRole
  if (Test-SessionPoolerMode $Config) { Assert-SessionBackendTls $proof }
  Assert-SessionContinuity $proof $proof
  if ($proof.pid -ne $owner.pid -or $proof.snapshotText -cne $owner.snapshotText) {
    Stop-Maintenance 'SESSION_CONTINUITY_LOST'
  }
  $Holder | Add-Member -NotePropertyName SessionProof -NotePropertyValue $proof
  $importSql = 'SELECT json_build_object(' + (Get-SessionIdentitySql) + ')::text'
  $imported = Invoke-ReadOnlyQuery $Config $Uri $importSql 'SESSION_SNAPSHOT_IMPORT_FAILED' $Holder.Id | ConvertFrom-Json
  Assert-SessionIdentity $imported $proof $Config.maintenanceRole
  if (Test-SessionPoolerMode $Config) { Assert-SessionBackendTls $imported }
  $lockSql = "WITH probe AS MATERIALIZED (SELECT pg_try_advisory_lock(20261115,$key) acquired) " +
    'SELECT json_build_object(' + (Get-SessionIdentitySql) +
    ",'acquired',acquired,'released',CASE WHEN acquired THEN pg_advisory_unlock(20261115,$key) ELSE true END)::text FROM probe"
  $other = Invoke-ReadOnlyQuery $Config $Uri $lockSql 'SESSION_LOCK_PROBE_FAILED' | ConvertFrom-Json
  Assert-SessionIdentity $other $proof $Config.maintenanceRole
  if (Test-SessionPoolerMode $Config) { Assert-SessionBackendTls $other }
  if ($other.acquired -isnot [bool] -or $other.released -isnot [bool] -or
      $other.acquired -ne $false -or $other.released -ne $true) { Stop-Maintenance 'SESSION_LOCK_ISOLATION_FAILED' }
  Assert-SessionSnapshotProof $Holder
}

function Assert-SessionSnapshotProof([object]$Holder) {
  if (-not $Holder.PSObject.Properties['SessionProof']) { Stop-Maintenance 'SESSION_PROOF_MISSING' }
  if ($Holder.Process.HasExited) { Stop-Maintenance 'SESSION_EXPORTER_LOST' }
  if (([DateTime]::UtcNow-[DateTime]::Parse($Holder.StartedUtc).ToUniversalTime()).TotalSeconds -gt 180) {
    Stop-Maintenance 'SESSION_SNAPSHOT_BUDGET_EXCEEDED'
  }
  $observed = Invoke-ExporterJson $Holder (Get-SessionProofSql $Holder.SessionProbeKey)
  Assert-SessionContinuity $Holder.SessionProof $observed
}

function Stop-SessionSnapshotProof([object]$Holder) {
  if (-not $Holder -or -not $Holder.PSObject.Properties['SessionProbeKey']) { return }
  $key = [int]$Holder.SessionProbeKey
  # Clear an aborted transaction, then verify the original backend before unlocking.
  $current = Invoke-ExporterJson $Holder ('ROLLBACK; ' + (Get-SessionProofSql $key))
  Assert-SessionIdentity $current $Holder.SessionProbeOwner $Holder.SessionProbeOwner.role
  if ($current.pid -ne $Holder.SessionProbeOwner.pid -or $current.lockHeld -isnot [bool]) {
    Stop-Maintenance 'SESSION_PROBE_LOCK_RELEASE_UNVERIFIED'
  }
  if ($current.lockHeld) {
    $released = Invoke-ExporterJson $Holder "SELECT json_build_object('released',pg_advisory_unlock(20261115,$key))::text;"
    if ($released.released -isnot [bool] -or $released.released -ne $true) { Stop-Maintenance 'SESSION_PROBE_LOCK_RELEASE_UNVERIFIED' }
  } elseif ($Holder.PSObject.Properties['SessionProof']) {
    Stop-Maintenance 'SESSION_PROBE_LOCK_RELEASE_UNVERIFIED'
  }
  $Holder.PSObject.Properties.Remove('SessionProbeKey')
}
