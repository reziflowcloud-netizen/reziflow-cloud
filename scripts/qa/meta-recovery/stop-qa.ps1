param([Parameter(Mandatory=$true)][string]$PointerPath)
$ErrorActionPreference='Stop'
try{
  Set-StrictMode -Version Latest
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $qa=Read-QaGuardedRuntime $PointerPath -AllowStopped
  $c=$qa.Runtime;$s=$qa.State
  if(Get-NetTCPConnection -State Listen -LocalPort 43126,43127 -ErrorAction SilentlyContinue){throw 'QA_HTTP_STAGE_MUST_STOP_FIRST'}
  if(Test-Path -LiteralPath (Join-Path $s.cluster.Cluster 'postmaster.pid')){
    Assert-QaRunningPostgres $s.config $s.cluster $c.privateDirectory -ForStop
    . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
    $exit=Invoke-WithIsolatedEnvironment $s.config $null @{} {
      $ErrorActionPreference='Continue'
      $discard=@(& (Join-Path $s.config.postgresBin 'pg_ctl.exe') '-D' $s.cluster.Cluster '-m' 'fast' '-w' '-t' '45' 'stop' 2>$null)
      return $LASTEXITCODE
    }
    if($exit -ne 0){throw 'QA_PG_STOP_FAILED'}
  }
  if(-not(Test-Path -LiteralPath (Join-Path $s.cluster.Cluster 'PG_VERSION')) -or (Test-Path -LiteralPath (Join-Path $s.cluster.Cluster 'postmaster.pid')) -or (Get-NetTCPConnection -State Listen -LocalPort $s.cluster.Port -ErrorAction SilentlyContinue)){throw 'QA_PG_STOP_UNVERIFIED'}
  Write-Output 'QA_PG_STOPPED_DATA_PRESERVED'
}catch{
  Write-Output 'QA_PG_STOP_BLOCKED'
  exit 1
}
