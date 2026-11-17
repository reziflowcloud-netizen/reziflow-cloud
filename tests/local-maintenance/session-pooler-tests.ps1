#requires -Version 7
param([string]$PrivateTestRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
$passed = 0
function Assert-Test([bool]$Value, [string]$Name) {
  if (-not $Value) { throw "SESSION_TEST_FAILED:$Name" }
  $script:passed++
  Write-Output "PASS $Name"
}
function Expect-Block([scriptblock]$Action, [string]$Code) {
  try { & $Action | Out-Null }
  catch {
    if ($_.Exception.Message -ceq ('LMR:'+$Code)) { Assert-Test $true $Code; return }
    throw
  }
  throw "SESSION_TEST_EXPECTED_BLOCK:$Code"
}
function New-Profile {
  return [pscustomobject]@{
    targetKind='production'; preflightConnectionMode='supabase_shared_session_ipv4'
    projectReference='abcdefghijklmnopqrst'; expectedHost='db.abcdefghijklmnopqrst.supabase.co'
    sessionPoolerHost='aws-99-eu-test-1.pooler.supabase.com'
    expectedApplicationHost='aws-99-eu-test-1.pooler.supabase.com'
    maintenanceRole='postgres'; applicationRole='app_role'
    sessionPoolerDashboardVerifiedAt=[DateTime]::UtcNow.ToString('o')
    credentialCleanupDeadlineUtc=[DateTime]::UtcNow.AddHours(1).ToString('o')
    nodeBin='C:\not-used'; postgresBin='C:\not-used'; privateDirectory='C:\not-used'
    environmentFile='C:\not-used\model.env'; backupDirectory='C:\not-used'
    tlsRootCertFile='C:\not-used\root.crt'; resolvedSessionIpv4='8.8.8.8'
  }
}
$profile = New-Profile
# Deliberately fictitious host/password; model tests never perform DNS or connect.
$uri = [Uri]'postgresql://postgres.abcdefghijklmnopqrst:test-only-placeholder@aws-99-eu-test-1.pooler.supabase.com:5432/postgres?sslmode=verify-full'
Assert-SessionPoolerProfile $profile
Assert-SessionPoolerUri $profile $uri 'postgres'
Assert-Test $true 'explicit session profile and maintenance routing login'
Assert-SessionPoolerUri $profile ([Uri]($uri.AbsoluteUri.Replace('postgres.','app_role.'))) 'app_role'
Assert-Test $true 'separate application role session endpoint'
Assert-Test ((Get-MaintenanceConnectionMode ([pscustomobject]@{})) -ceq 'direct') 'legacy Direct default unchanged'
Expect-Block { Get-MaintenanceConnectionMode ([pscustomobject]@{preflightConnectionMode='transaction'}) } 'CONNECTION_MODE_INVALID'
foreach ($case in @(
  @{Field='targetKind';Value='synthetic'},
  @{Field='projectReference';Value='otherprojectabcdefghij'},
  @{Field='expectedHost';Value='db.otherprojectabcdefgh.supabase.co'},
  @{Field='sessionPoolerHost';Value='arbitrary.supabase.com'},
  @{Field='expectedApplicationHost';Value='aws-98-eu-test-1.pooler.supabase.com'},
  @{Field='maintenanceRole';Value="postgres';select"})) {
  $bad=New-Profile; $bad.($case.Field)=$case.Value
  Expect-Block { Assert-SessionPoolerProfile $bad } 'SESSION_PROJECT_BINDING_INVALID'
}
$bad=New-Profile; $bad.PSObject.Properties.Remove('maintenanceRole')
Expect-Block { Assert-SessionPoolerProfile $bad } 'SESSION_PROFILE_INCOMPLETE'
$bad=New-Profile; $bad.sessionPoolerDashboardVerifiedAt=[DateTime]::UtcNow.AddHours(-25).ToString('o')
Expect-Block { Assert-SessionPoolerProfile $bad } 'SESSION_DASHBOARD_ATTESTATION_STALE'
$bad=New-Profile; $bad.credentialCleanupDeadlineUtc=[DateTime]::UtcNow.AddSeconds(-1).ToString('o')
Expect-Block { Assert-SessionPoolerProfile $bad } 'SESSION_CREDENTIAL_WINDOW_CLOSED'
$bad=New-Profile; $bad.credentialCleanupDeadlineUtc=[DateTime]::UtcNow.AddDays(2).ToString('o')
Expect-Block { Assert-SessionPoolerProfile $bad } 'SESSION_CREDENTIAL_WINDOW_CLOSED'
foreach ($changed in @(
  $uri.AbsoluteUri.Replace(':5432/',':6543/'),
  $uri.AbsoluteUri.Replace('postgres.abcdefghijklmnopqrst','postgres'),
  $uri.AbsoluteUri.Replace('abcdefghijklmnopqrst:','otherprojectabcdefgh:'),
  $uri.AbsoluteUri.Replace('aws-99-eu-test-1','aws-98-eu-test-1'),
  $uri.AbsoluteUri.Replace('/postgres?','/other?'),
  $uri.AbsoluteUri.Replace('aws-99-eu-test-1.pooler.supabase.com','127.0.0.1'))) {
  Expect-Block { Assert-SessionPoolerUri $profile ([Uri]$changed) 'postgres' } 'SESSION_ENDPOINT_INVALID'
}
foreach ($query in @('sslmode=require','sslmode=disable','hostaddr=8.8.4.4',
  'options=-c%20role%3Dpostgres','sslmode=verify-full&sslmode=verify-full','schema=private')) {
  Expect-Block { Assert-SessionPoolerUri $profile ([Uri]($uri.GetLeftPart([UriPartial]::Path)+'?'+$query)) 'postgres' } 'SESSION_URL_OPTIONS_UNSAFE'
}
foreach ($ip in @('127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.1.1',
  '100.64.0.1','192.0.2.1','198.51.100.1','203.0.113.1','224.0.0.1','::1','invalid')) {
  Assert-Test (-not (Test-PublicIpv4 $ip)) 'reject nonpublic or non-IPv4 address'
}
Assert-Test (Test-PublicIpv4 '8.8.8.8') 'IPv4 model positive'
$environment = Invoke-WithIsolatedEnvironment $profile $uri @{} {
  return @{host=$env:PGHOST;address=$env:PGHOSTADDR;port=$env:PGPORT;tls=$env:PGSSLMODE;ca=$env:PGSSLROOTCERT}
}
Assert-Test ($environment.host -ceq $profile.sessionPoolerHost -and $environment.address -ceq '8.8.8.8' -and
  $environment.port -ceq '5432' -and $environment.tls -ceq 'verify-full' -and
  $environment.ca -ceq $profile.tlsRootCertFile) 'IPv4 socket keeps verified TLS hostname and CA'
foreach ($extra in @(@{PGSSLMODE='disable'},@{PGHOST='other'},@{PGHOSTADDR='8.8.4.4'},@{PGPORT='6543'},@{PGSERVICE='other'})) {
  Expect-Block { Invoke-WithIsolatedEnvironment $profile $uri $extra {throw 'MUST_NOT_EXECUTE'} } 'SESSION_ENVIRONMENT_OVERRIDE_FORBIDDEN'
}
$direct=[pscustomobject]@{preflightConnectionMode='direct'}
Assert-DirectApplyConnection $direct ([pscustomobject]@{connectionMode='direct'})
Assert-Test $true 'Direct mode Apply guard retained'
Expect-Block { Assert-DirectApplyConnection $profile } 'SESSION_POOLER_APPLY_UNSUPPORTED'
Expect-Block { Assert-DirectApplyConnection $direct ([pscustomobject]@{connectionMode='supabase_shared_session_ipv4'}) } 'PLAN_CONNECTION_MODE_APPLY_FORBIDDEN'
Expect-Block { Assert-DirectApplyConnection $direct ([pscustomobject]@{}) } 'PLAN_CONNECTION_MODE_APPLY_FORBIDDEN'
$expected=[pscustomobject]@{database='postgres';databaseOid='12345';clusterIdentity='1234567890123456789';
  serverVersion='170000';role='postgres';sessionRole='postgres';pid=42;snapshotText='10:20:15';
  readOnly='on';isolation='repeatable read';lockHeld=$true}
Assert-SessionContinuity $expected $expected
Assert-Test $true 'stable exporter identity and transaction'
Assert-SessionBackendTls ([pscustomobject]@{backendTls=$true})
Assert-Test $true 'backend TLS positive (separate from client certificate validation)'
Expect-Block { Assert-SessionBackendTls ([pscustomobject]@{backendTls=$false}) } 'SESSION_BACKEND_TLS_UNVERIFIED'
Expect-Block { Assert-SessionBackendTls ([pscustomobject]@{}) } 'SESSION_BACKEND_TLS_UNVERIFIED'
foreach ($field in @('database','databaseOid','clusterIdentity','serverVersion')) {
  $changed=$expected.PSObject.Copy();$changed.$field='other'
  Expect-Block { Assert-SessionContinuity $expected $changed } 'SESSION_TARGET_CHANGED'
}
foreach ($field in @('role','sessionRole')) {
  $changed=$expected.PSObject.Copy();$changed.$field='other'
  Expect-Block { Assert-SessionContinuity $expected $changed } 'SESSION_DATABASE_ROLE_MISMATCH'
}
foreach ($case in @(@{Field='pid';Value=43},@{Field='snapshotText';Value='20:30:'},
  @{Field='readOnly';Value='off'},@{Field='isolation';Value='read committed'},@{Field='lockHeld';Value=$false})) {
  $changed=$expected.PSObject.Copy();$changed.($case.Field)=$case.Value
  Expect-Block { Assert-SessionContinuity $expected $changed } 'SESSION_CONTINUITY_LOST'
}
Expect-Block { Assert-SessionSnapshotProof ([pscustomobject]@{SessionProof=$expected;Process=[pscustomobject]@{HasExited=$true}}) } 'SESSION_EXPORTER_LOST'

# Exercise each production TLS gate with metadata-only mocks; no DNS/connection.
$savedExporter=(Get-Item Function:\Invoke-ExporterJson).ScriptBlock
$savedQuery=(Get-Item Function:\Invoke-ReadOnlyQuery).ScriptBlock
function New-TlsFixture([string]$Stage) {
  $r=$script:tlsExpected.PSObject.Copy()
  $r|Add-Member -Force -NotePropertyName backendTls -NotePropertyValue $true
  if($script:tlsFaultStage -ceq $Stage){
    if($script:tlsFaultMissing){$r.PSObject.Properties.Remove('backendTls')}else{$r.backendTls=$false}
  }
  return $r
}
try {
  $script:tlsExpected=$expected.PSObject.Copy()
  function Invoke-ExporterJson([object]$Holder,[string]$Sql) {
    if($Sql -match 'SELECT json_build_object\(''acquired'',pg_try_advisory_lock'){
      $script:tlsLockAcquired=$true
      return [pscustomobject]@{acquired=$true}
    }
    $r=New-TlsFixture $(if($script:tlsLockAcquired){'proof'}else{'owner'})
    $r.lockHeld=$script:tlsLockAcquired
    return $r
  }
  function Invoke-ReadOnlyQuery {
    param([object]$Config,[Uri]$Uri,[string]$Query,[string]$FailureCode,[string]$SnapshotId)
    $r=New-TlsFixture $(if($Query -match '^WITH probe'){'other'}else{'import'})
    $r|Add-Member -NotePropertyName acquired -NotePropertyValue $false
    $r|Add-Member -NotePropertyName released -NotePropertyValue $true
    return ($r|ConvertTo-Json -Compress)
  }
  foreach($stage in @('proof','import','other')){
    foreach($missing in @($false,$true)){
      $script:tlsLockAcquired=$false;$script:tlsFaultStage=$stage;$script:tlsFaultMissing=$missing
      $holder=[pscustomobject]@{Id='00000001-00000002-1';StartedUtc=[DateTime]::UtcNow.ToString('o');Process=[pscustomobject]@{HasExited=$false}}
      Expect-Block { Start-SessionSnapshotProof $profile $uri $holder $expected } 'SESSION_BACKEND_TLS_UNVERIFIED'
    }
  }
} finally {
  Set-Item Function:\Invoke-ExporterJson -Value $savedExporter
  Set-Item Function:\Invoke-ReadOnlyQuery -Value $savedQuery
}

if ($PrivateTestRoot) {
  if ((Get-ExecutionPolicy) -ne 'RemoteSigned') { throw 'SESSION_TEST_REMOTESIGNED_REQUIRED' }
  $parent=[IO.Path]::GetFullPath($PrivateTestRoot).TrimEnd('\')
  Assert-PrivateAcl $parent
  if (-not(Test-ExactPrivateAcl (Get-Acl -LiteralPath $parent) $true)) { throw 'SESSION_TEST_PARENT_NOT_EXACT' }
  $id=[Guid]::NewGuid().ToString('N').Substring(0,12)
  $root=Assert-ChildPath $parent (Join-Path $parent ('session-test-'+$id))
  if(Test-Path -LiteralPath $root){throw 'SESSION_TEST_ROOT_EXISTS'}
  [void](New-Item -ItemType Directory -Path $root);Set-PrivateAcl $root
  $marker=Join-Path $root 'session-test-owned.txt'
  [IO.File]::WriteAllText($marker,$id);Set-PrivateAcl $marker
  foreach($name in @('private','backups')){[void](New-Item -ItemType Directory -Path (Join-Path $root $name));Set-PrivateAcl (Join-Path $root $name)}
  $config=[pscustomobject]@{targetKind='synthetic';expectedHost='127.0.0.1';expectedApplicationHost='127.0.0.1';
    environmentFile=(Join-Path $root 'unused.env');privateDirectory=(Join-Path $root 'private');
    backupDirectory=(Join-Path $root 'backups');postgresBin='C:\Program Files\PostgreSQL\18\bin';
    nodeBin='C:\Program Files\nodejs';applicationRole='restore_admin';maintenanceRole='restore_admin'}
  $cluster=$null;$restore=$null;$holder=$null
  try {
    $model=New-Profile
    $model.environmentFile=Join-Path $root 'model.env'
    $model.tlsRootCertFile=Join-Path $root 'model-ca.txt'
    [IO.File]::WriteAllText($model.tlsRootCertFile,'synthetic certificate placeholder; never used for TLS')
    Set-PrivateAcl $model.tlsRootCertFile
    $modelLines=@(
      'DIRECT_URL=postgresql://postgres:test-only-placeholder@db.abcdefghijklmnopqrst.supabase.co:5432/postgres',
      'DATABASE_URL=postgresql://app_role.abcdefghijklmnopqrst:app-only-placeholder@aws-99-eu-test-1.pooler.supabase.com:6543/postgres',
      ('PREFLIGHT_SESSION_URL='+$uri.AbsoluteUri),
      'PREFLIGHT_APPLICATION_SESSION_URL=postgresql://app_role.abcdefghijklmnopqrst:app-only-placeholder@aws-99-eu-test-1.pooler.supabase.com:5432/postgres?sslmode=verify-full')
    [IO.File]::WriteAllLines($model.environmentFile,$modelLines)
    Set-PrivateAcl $model.environmentFile
    $model.privateDirectory=$config.privateDirectory;$model.backupDirectory=$config.backupDirectory
    $model.postgresBin=$config.postgresBin;$model.nodeBin=$config.nodeBin
    $modelConfig=Join-Path $root 'model-config.json'
    [IO.File]::WriteAllText($modelConfig,($model|ConvertTo-Json));Set-PrivateAcl $modelConfig
    $readModel=Read-MaintenanceConfig $modelConfig $false
    Assert-Test ($readModel.sessionPoolerDashboardVerifiedAt -is [string]) 'JSON profile preserves strict ISO attestation text'
    Assert-SessionCredentialBinding $model
    Assert-Test $true 'separate session credentials preserve original Direct and application origins'
    Assert-Test ((Get-PreflightSourceUri $model $false).Port -eq 5432 -and
      (Get-PreflightApplicationUri $model $false).Port -eq 5432) 'neither selected session connection uses transaction port'
    $firstTransport=Get-Sha256Text (Get-SessionTransportAttestation $model|ConvertTo-Json -Compress)
    $model.resolvedSessionIpv4='8.8.4.4'
    Assert-Test ($firstTransport -cne (Get-Sha256Text (Get-SessionTransportAttestation $model|ConvertTo-Json -Compress))) 'transport fingerprint binds IPv4 and verified TLS policy'
    [IO.File]::WriteAllLines($model.environmentFile,($modelLines -replace 'PREFLIGHT_APPLICATION_SESSION_URL=postgresql://app_role.abcdefghijklmnopqrst:app-only-placeholder',
      'PREFLIGHT_APPLICATION_SESSION_URL=postgresql://app_role.abcdefghijklmnopqrst:other-placeholder'))
    Expect-Block { Assert-SessionCredentialBinding $model } 'SESSION_CREDENTIAL_ORIGIN_MISMATCH'
    $cluster=New-DisposableCluster $config ('session'+$id)
    $identity=Get-DatabaseIdentityState $config $cluster.Uri
    $version=Invoke-BoundedSessionTool (Join-Path $config.postgresBin 'psql.exe') @('--version')
    Assert-Test ($version.ExitCode -eq 0 -and $version.Output.Count -ge 1) 'bounded official PostgreSQL entry point'
    Expect-Block {
      Invoke-WithIsolatedEnvironment $config $cluster.Uri @{} {
        Invoke-BoundedSessionTool (Join-Path $config.postgresBin 'psql.exe') @('-w','-X','-q','-c','SELECT pg_sleep(3)') 100
      }
    } 'SESSION_TOOL_DEADLINE_EXCEEDED'
    foreach($table in @('_prisma_migrations','LeadMessage','Lead','Organization','User','NotificationPreference')) {
      [void](Invoke-PostgresTool $config $cluster.Uri 'psql.exe' @('-X','-q','-v','ON_ERROR_STOP=1','-c',('CREATE TABLE public."'+$table+'" (id integer)')) 'SESSION_TEST_FIXTURE_FAILED')
    }
    $holder=Start-ExportedSnapshot $config $cluster.Uri
    $script:realExporterJson=(Get-Item Function:\Invoke-ExporterJson).ScriptBlock
    function Invoke-ExporterJson([object]$Holder,[string]$Sql) {
      $result=& $script:realExporterJson $Holder $Sql
      if($Sql -match 'SELECT json_build_object\(''acquired'',pg_try_advisory_lock') {
        Stop-Maintenance 'SESSION_TEST_ACQUIRE_RESPONSE_LOST'
      }
      return $result
    }
    try {
      Expect-Block { Start-SessionSnapshotProof $config $cluster.Uri $holder $identity } 'SESSION_TEST_ACQUIRE_RESPONSE_LOST'
    } finally { Set-Item Function:\Invoke-ExporterJson -Value $script:realExporterJson }
    Assert-Test ([bool]$holder.PSObject.Properties['SessionProbeKey']) 'uncertain acquire retains exact owned cleanup key'
    Stop-SessionSnapshotProof $holder
    Assert-Test (-not $holder.PSObject.Properties['SessionProbeKey']) 'lost acquire response still releases owned lock'
    Stop-ExportedSnapshot $holder;$holder=$null
    $holder=Start-ExportedSnapshot $config $cluster.Uri
    Start-SessionSnapshotProof $config $cluster.Uri $holder $identity
    Assert-Test $true 'real localhost session lock and cross-connection snapshot import'
    Assert-SessionSnapshotProof $holder
    $backup=New-PrivateBackup $config $cluster.Uri $id $holder.Id
    Assert-SessionSnapshotProof $holder
    Assert-Test ($backup.Bytes -gt 0) 'real pg_dump uses exported snapshot'
    Expect-Block { Invoke-ReadOnlyQuery $config $cluster.Uri 'SELECT 1' 'EXPECTED_SNAPSHOT_IMPORT_FAILED' '00000000-00000000-1' } 'EXPECTED_SNAPSHOT_IMPORT_FAILED'
    $restore=New-DisposableCluster $config ('restore'+$id)
    Restore-DisposableBackup $config $restore $backup
    Assert-Test $true 'snapshot archive restores into isolated PostgreSQL'
    Stop-SessionSnapshotProof $holder
    $holder.Process.Kill();[void]$holder.Process.WaitForExit(10000)
    Expect-Block { Assert-SessionSnapshotProof $holder } 'SESSION_EXPORTER_LOST'
    Stop-ExportedSnapshot $holder;$holder=$null
  } finally {
    try { if($holder){try{Stop-SessionSnapshotProof $holder}finally{Stop-ExportedSnapshot $holder}} }
    finally {
      $cleanupError=$null
      foreach($owned in @($restore,$cluster)) {
        if($owned){try{Stop-DisposableCluster $config $owned}catch{if(-not $cleanupError){$cleanupError=$_}}}
      }
      if($cleanupError){throw $cleanupError}
    }
    # No source/customer data here: only this registered synthetic fixture after verified stop.
    $canonical=Assert-ChildPath $parent $root
    Assert-NotReparsePoint $canonical
    Assert-NotReparsePoint $marker
    if($canonical -cne (Join-Path $parent ('session-test-'+$id)) -or
      [IO.File]::ReadAllText($marker) -cne $id -or
      @((Get-ChildItem -LiteralPath $root -Force -Recurse)|Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -ne 0 -or
      @((Get-ChildItem -LiteralPath (Join-Path $config.privateDirectory 'isolated') -Force -ErrorAction SilentlyContinue)).Count -ne 0) {throw 'SESSION_TEST_CLEANUP_BLOCKED'}
    Remove-Item -LiteralPath $canonical -Recurse -WhatIf
    Remove-Item -LiteralPath $canonical -Recurse
    Assert-Test (-not(Test-Path -LiteralPath $canonical)) 'owned synthetic session fixtures removed'
  }
}
Write-Output "SESSION TESTS PASS: $passed"
