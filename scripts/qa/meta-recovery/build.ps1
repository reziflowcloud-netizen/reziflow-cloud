param([Parameter(Mandatory=$true)][string]$PointerPath)
$ErrorActionPreference='Stop'
try{
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'guard.ps1')
$qa=Read-QaGuardedRuntime $PointerPath
$c=$qa.Runtime;$s=$qa.State
. (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
Assert-QaNoReparse (Join-Path $c.repo 'node_modules/next/dist/bin/next')
Invoke-WithIsolatedEnvironment $s.config $null @{DATABASE_URL=$c.databaseUrl;DIRECT_URL=$c.databaseUrl;NEXT_TELEMETRY_DISABLED='1';NODE_ENV='production';META_LEAD_ADS_ENABLED='false';META_LEAD_ADS_WORKER_ENABLED='false';WEB_PUSH_ENABLED='false'} {
 Push-Location $c.repo
 try {
  $ErrorActionPreference='Continue'
  & 'C:\Program Files\nodejs\node.exe' (Join-Path $c.repo 'node_modules/next/dist/bin/next') build *> $null
  if($LASTEXITCODE -ne 0){throw 'QA_BUILD_FAILED'}
 }finally{Pop-Location}
}
Write-Output 'QA_BUILD_PASS: isolated environment; no Production variables; no migration command'
}catch{
 Write-Output 'QA_BUILD_FAILED_SAFE'
 exit 1
}
