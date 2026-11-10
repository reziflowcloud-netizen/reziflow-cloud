param(
  [Parameter(Mandatory=$true)][string]$PointerPath,
  [Parameter(Mandatory=$true)][ValidateSet('configure','verify','restore')][string]$Action
)
$ErrorActionPreference='Stop'
try {
  if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $qa=Read-QaGuardedRuntime $PointerPath
  $c=$qa.Runtime
  if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $c.appId -ne '2523488421395251' -or $c.approvedMetaAppId -ne $c.appId -or $c.pageId -ne '1449474971582722' -or $c.formId -ne '2046130655900851'){throw 'APP_REFUSED'}
  $qaMetaOpsArgs=@($Action)
  $gitExe=(Get-Command git.exe -ErrorAction Stop).Source
  Assert-QaNoReparse $gitExe
  . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
  Invoke-WithIsolatedEnvironment $qa.State.config $null @{QA_STAGE_A_PRIVATE_CONFIG=$qa.Pointer.runtimeFile;QA_PWSH_EXE=$c.qaPwshExecutable;QA_GIT_EXE=$gitExe;QA_RESULT_DIRECTORY=([IO.Path]::GetDirectoryName($PointerPath))} {
    & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'run-meta-ops.mjs') @qaMetaOpsArgs
    if($LASTEXITCODE -ne 0){throw 'META_OPS_BLOCKED'}
  }
} catch {Write-Output 'QA_META_OPS_BLOCKED';exit 1}
