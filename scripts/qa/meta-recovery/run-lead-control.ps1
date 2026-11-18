param(
  [Parameter(Mandatory=$true)][string]$PointerPath,
  [Parameter(Mandatory=$true)][ValidateSet('old-test-check','delete-confirmed-old','mark-create-attempt','capture-created-lead')][string]$Action,
  [switch]$DeleteOwnSyntheticConfirmed
)
$ErrorActionPreference='Stop'
try {
  if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
  if($DeleteOwnSyntheticConfirmed -and $Action -ne 'delete-confirmed-old'){throw 'ACTION_REFUSED'}
  $qaArgs=@($Action);if($DeleteOwnSyntheticConfirmed){$qaArgs+='--delete-own-synthetic-confirmed'}
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $qa=Read-QaGuardedRuntime $PointerPath
  $c=$qa.Runtime
  if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $c.appId -ne '2523488421395251' -or $c.approvedMetaAppId -ne $c.appId -or $c.pageId -ne '1449474971582722' -or $c.formId -ne '2046130655900851'){throw 'APP_REFUSED'}
  $gitExe=(Get-Command git.exe -ErrorAction Stop).Source
  Assert-QaNoReparse $gitExe
  . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
  Invoke-WithIsolatedEnvironment $qa.State.config $null @{QA_STAGE_A_PRIVATE_CONFIG=$qa.Pointer.runtimeFile;QA_PWSH_EXE=$c.qaPwshExecutable;QA_GIT_EXE=$gitExe;QA_RESULT_DIRECTORY=([IO.Path]::GetDirectoryName($PointerPath))} {
    & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'run-lead-control.mjs') @qaArgs
    if($LASTEXITCODE -ne 0){throw 'LEAD_CONTROL_BLOCKED'}
  }
} catch {Write-Output 'QA_LEAD_CONTROL_BLOCKED';exit 1}
