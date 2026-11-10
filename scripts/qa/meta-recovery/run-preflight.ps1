param([Parameter(Mandatory=$true)][string]$PointerPath,[Parameter(Mandatory=$true)][ValidateSet('2523488421395251')][string]$UiConfirmedAppId,[Parameter(Mandatory=$true)][switch]$OwnerConfirmedProfile)
$ErrorActionPreference='Stop'
try{
  if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned' -or -not $OwnerConfirmedProfile){throw 'HOST_OR_OWNER_REFUSED'}
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $qa=Read-QaGuardedRuntime $PointerPath
  $c=$qa.Runtime
  if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $c.appId -ne $UiConfirmedAppId -or $c.approvedMetaAppId -ne $UiConfirmedAppId){throw 'APP_REFUSED'}
  $gitExe=(Get-Command git.exe -ErrorAction Stop).Source
  Assert-QaNoReparse $gitExe
  . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
  Invoke-WithIsolatedEnvironment $qa.State.config $null @{QA_STAGE_A_PRIVATE_CONFIG=$qa.Pointer.runtimeFile;QA_PWSH_EXE=$c.qaPwshExecutable;QA_UI_APP=$UiConfirmedAppId;QA_UI_OWNER='confirmed';QA_GIT_EXE=$gitExe;QA_RESULT_DIRECTORY=([IO.Path]::GetDirectoryName($PointerPath))} {
    & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'run-preflight.mjs')
    if($LASTEXITCODE -ne 0){throw 'PREFLIGHT_BLOCKED'}
  }
}catch{Write-Output 'QA_GRAPH_PREFLIGHT_BLOCKED';exit 1}
