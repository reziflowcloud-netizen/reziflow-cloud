param(
  [Parameter(Mandatory=$true)][string]$PointerPath,
  [Parameter(Mandatory=$true)][ValidateSet('2523488421395251')][string]$ApprovedMetaAppId
)
$ErrorActionPreference='Stop'
try{
  Set-StrictMode -Version Latest
  if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'QA_INPUT_HOST_REFUSED'}
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $qa=Read-QaGuardedRuntime $PointerPath
  $c=$qa.Runtime
  $root=$c.privateDirectory
  if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $c.pageId -ne '1449474971582722' -or $c.formId -ne '2046130655900851'){throw 'QA_INPUT_TARGET_REFUSED'}
  if(($null -ne $c.appId -and $c.appId -ne $ApprovedMetaAppId) -or $c.enabled -ne $false -or $c.workerEnabled -ne $false -or @($c.approvedTuples).Count -ne 0 -or @($c.pilotLeadIds).Count -ne 0){throw 'QA_INPUT_GATES_REFUSED'}
  $approved=$c.PSObject.Properties['approvedMetaAppId']
  if($approved -and $approved.Value -ne $ApprovedMetaAppId){throw 'QA_INPUT_APPROVAL_REFUSED'}
  Assert-QaPrivateAcl (Join-Path $root 'ngrok.yml')
  $userFile=Join-Path $root 'meta-user-token.txt'
  $secretFile=Join-Path $root 'meta-app-secret.txt'
  $pageFile=Join-Path $root 'meta-page-token.txt'
  $graphFile=Join-Path $root 'meta-real-private.json'
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
  foreach($file in @($userFile,$secretFile,$pageFile,$graphFile)){
    if(Test-Path -LiteralPath $file){
      if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw 'QA_INPUT_FILE_TYPE_REFUSED'}
      Assert-QaPrivateAcl $file
      continue
    }
    # CreateNew never replaces an existing file. The parent already has private ACLs.
    $stream=[IO.FileStream]::new($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    $stream.Dispose()
    $acl=[Security.AccessControl.FileSecurity]::new()
    $acl.SetAccessRuleProtection($true,$false)
    $acl.SetOwner($identity)
    foreach($sid in @($identity.Value,'S-1-5-18','S-1-5-32-544')){
      $rule=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow)
      $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $file -AclObject $acl
    Assert-QaPrivateAcl $file
    if((Get-Item -LiteralPath $file).Length -ne 0){throw 'QA_INPUT_NEW_FILE_NOT_EMPTY'}
  }
  $c.appId=$ApprovedMetaAppId
  if($approved){$approved.Value=$ApprovedMetaAppId}else{$c|Add-Member -NotePropertyName approvedMetaAppId -NotePropertyValue $ApprovedMetaAppId}
  [IO.File]::WriteAllText($qa.Pointer.runtimeFile,($c|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
  Assert-QaPrivateAcl $qa.Pointer.runtimeFile
  [pscustomobject]@{Ready=$true;MetaUserTokenFile=$userFile;MetaAppSecretFile=$secretFile;MetaPageTokenFile=$pageFile;MetaRealPrivateFile=$graphFile}|ConvertTo-Json -Compress
}catch{
  Write-Output 'QA_INPUT_PREPARATION_BLOCKED'
  exit 1
}
