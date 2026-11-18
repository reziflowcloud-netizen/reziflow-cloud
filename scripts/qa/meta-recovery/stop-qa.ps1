param([Parameter(Mandatory=$true)][string]$PointerPath)
$ErrorActionPreference='Stop'
$stage='guard'
try{
  Set-StrictMode -Version Latest
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $qa=Read-QaGuardedRuntime $PointerPath -AllowStopped
  $c=$qa.Runtime;$s=$qa.State
  if(Get-NetTCPConnection -State Listen -LocalPort 43126,43127 -ErrorAction SilentlyContinue){throw 'QA_HTTP_STAGE_MUST_STOP_FIRST'}
  $stage='ownership'
  if(Test-Path -LiteralPath (Join-Path $s.cluster.Cluster 'postmaster.pid')){
    Assert-QaRunningPostgres $s.config $s.cluster $c.privateDirectory -ForStop
    . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
    $stage='stop'
    $exit=Invoke-WithIsolatedEnvironment $s.config $null @{} {
      $ErrorActionPreference='Continue'
      $discard=@(& (Join-Path $s.config.postgresBin 'pg_ctl.exe') '-D' $s.cluster.Cluster '-m' 'fast' '-w' '-t' '45' 'stop' 2>$null)
      return $LASTEXITCODE
    }
    if($exit -ne 0){throw 'QA_PG_STOP_FAILED'}
  }
  $stage='verify'
  if(-not(Test-Path -LiteralPath (Join-Path $s.cluster.Cluster 'PG_VERSION')) -or (Test-Path -LiteralPath (Join-Path $s.cluster.Cluster 'postmaster.pid')) -or (Get-NetTCPConnection -State Listen -LocalPort $s.cluster.Port -ErrorAction SilentlyContinue)){throw 'QA_PG_STOP_UNVERIFIED'}
  Write-Output 'QA_PG_STOPPED_DATA_PRESERVED'
}catch{
  $reason='UNKNOWN'
  foreach($known in @('QA_SERVER_TARGET_REFUSED','QA_SERVER_PATH_REFUSED','QA_SERVER_MARKER_REFUSED','QA_SERVER_PIDFILE_REFUSED','QA_SERVER_PROCESS_MISSING','QA_SERVER_OWNER_UNKNOWN','QA_SERVER_PROCESS_REFUSED','QA_SERVER_START_TIME_REFUSED','QA_SERVER_COMMAND_REFUSED','QA_SERVER_LISTENER_OWNER_REFUSED','QA_SERVER_CHANGED_DURING_CHECK')){if($_.Exception.Message -ceq $known){$reason=$known}}
  if($stage -cnotin @('guard','ownership','stop','verify')){$stage='guard'}
  Write-Output ('QA_PG_STOP_BLOCKED: '+$stage+' / '+$reason)
  exit 1
}
