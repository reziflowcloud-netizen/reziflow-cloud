# Metadata only: never select activity.query, users, client addresses or backend PIDs.
function Get-LockSafetySnapshot([object]$Config, [Uri]$Uri) {
  $sql = @'
SELECT json_build_object(
 'checkedUtc',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'0Z',
 'database',current_database(),'role',current_user,'sessionRole',session_user,
 'backendTls',(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()),
 'databaseOid',(SELECT oid FROM pg_database WHERE datname=current_database()),
 'serverVersion',current_setting('server_version_num'),
 'clusterIdentity',(SELECT system_identifier::text FROM pg_control_system()),
 'statsVisible',(SELECT rolsuper OR pg_has_role(current_user,'pg_read_all_stats'::name,'USAGE') FROM pg_roles WHERE rolname=current_user),
 'waitingRelationLocks',(SELECT count(*) FROM pg_locks l
   WHERE l.database=(SELECT oid FROM pg_database WHERE datname=current_database())
     AND l.relation IS NOT NULL AND NOT l.granted),
 'longTransactions',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()
   AND xact_start IS NOT NULL AND now()-xact_start>interval '30 seconds' AND pid<>pg_backend_pid()),
 'idleTransactions',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()
   AND state='idle in transaction' AND pid<>pg_backend_pid())
)::text
'@
  $json = Invoke-ReadOnlyQuery $Config $Uri $sql 'LOCK_SAFETY_SAMPLE_FAILED'
  try {
    if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) {
      return $json | ConvertFrom-Json -DateKind String
    }
    return $json | ConvertFrom-Json
  } catch { Stop-Maintenance 'LOCK_SAFETY_SAMPLE_INVALID' }
}

function Get-LockSafetyEvidence([object]$Sample) {
  try {
    $time = $Sample.checkedUtc
    if ($time -is [DateTime] -and $time.Kind -eq [DateTimeKind]::Utc) {
      $time = $time.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
    }
    if ($time -isnot [string]) { throw 'Invalid UTC' }
    $utc = [DateTime]::ParseExact($time, 'o', [Globalization.CultureInfo]::InvariantCulture,
      [Globalization.DateTimeStyles]::RoundtripKind)
    if ($utc.Kind -ne [DateTimeKind]::Utc) { throw 'Invalid UTC' }
    $safe = [ordered]@{ checkedUtc = $time }
    foreach ($name in @('waitingRelationLocks', 'longTransactions', 'idleTransactions')) {
      $value = $Sample.$name
      if (($value -isnot [int] -and $value -isnot [long]) -or $value -lt 0) {
        throw 'Unknown counter'
      }
      $safe[$name] = [long]$value
    }
    return [pscustomobject]$safe
  } catch { Stop-Maintenance 'LOCK_SAFETY_SAMPLE_INVALID' }
}

function Assert-LockSafetyBinding([object]$Config, [Uri]$Uri,
    [object]$Expected, [object]$Observed) {
  try {
    foreach ($name in @('database', 'role', 'sessionRole', 'databaseOid',
        'clusterIdentity', 'serverVersion')) {
      if (-not $Expected.PSObject.Properties[$name] -or
          -not $Observed.PSObject.Properties[$name] -or
          [string]::IsNullOrWhiteSpace([string]$Observed.$name) -or
          [string]$Expected.$name -cne [string]$Observed.$name) {
        throw 'Identity mismatch'
      }
    }
    if ($Observed.clusterIdentity -cnotmatch '^[0-9]{10,20}$' -or
        [string]$Observed.databaseOid -cnotmatch '^\d+$' -or
        [string]$Observed.serverVersion -cnotmatch '^\d+$' -or
        $Observed.backendTls -isnot [bool] -or $Expected.backendTls -isnot [bool] -or
        $Observed.backendTls -ne $Expected.backendTls -or
        $Observed.statsVisible -isnot [bool] -or -not $Observed.statsVisible) {
      throw 'TLS or visibility unverified'
    }
    if ($Uri.Host -ne '127.0.0.1' -and -not $Observed.backendTls) {
      throw 'Remote TLS required'
    }
    if (Test-SessionPoolerMode $Config) {
      Assert-SessionIdentity $Observed $Expected $Config.maintenanceRole
      Assert-SessionBackendTls $Observed
    }
  } catch { Stop-Maintenance 'LOCK_SAFETY_IDENTITY_UNVERIFIED' }
}

function Get-LockSafetyFailureEvidence([object]$ErrorRecord) {
  # Revalidate a fixed whitelist; arbitrary exception data must never be printed.
  try {
    if ($ErrorRecord.Exception.Message -cne 'LMR:DDL_LOCK_RISK' -or
        -not $ErrorRecord.Exception.Data.Contains('LockSafetyEvidence')) { return $null }
    return Get-LockSafetyEvidence $ErrorRecord.Exception.Data['LockSafetyEvidence']
  } catch { return $null }
}
