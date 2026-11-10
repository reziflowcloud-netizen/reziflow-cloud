param([Parameter(Mandatory=$true)][string]$PointerPath,[Parameter(Mandatory=$true)][switch]$FreeAccountAndCaptureChecked)
$ErrorActionPreference='Stop'
try{
  if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned' -or -not $FreeAccountAndCaptureChecked){throw 'APPROVAL_REFUSED'}
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $qa=Read-QaGuardedRuntime $PointerPath
  $c=$qa.Runtime
  if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $c.appId -ne '2523488421395251' -or $c.approvedMetaAppId -ne $c.appId -or $c.pageId -ne '1449474971582722' -or $c.formId -ne '2046130655900851' -or $c.hostname -ne 'unit-handsfree-carpentry.ngrok-free.dev' -or $c.enabled -ne $false -or $c.workerEnabled -ne $false){throw 'TARGET_REFUSED'}
  if(Test-Path -LiteralPath (Join-Path $c.privateDirectory 'STOP')){throw 'CLOSED_CYCLE_REFUSED'}
  foreach($port in @(43126,43127)){if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue){throw 'PORT_BUSY'}}
  $ngrok='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe'
  Assert-QaNoReparse $ngrok
  $hash=(Get-FileHash -LiteralPath $ngrok -Algorithm SHA256).Hash.ToLowerInvariant()
  if($hash -ne '6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16'){throw 'EXECUTABLE_CHANGED'}
  foreach($leaf in @('ngrok.yml','meta-app-secret.txt','meta-page-token.txt','meta-real-private.json')){Assert-QaPrivateAcl (Join-Path $c.privateDirectory $leaf)}
  . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
  $exit=Invoke-WithIsolatedEnvironment $qa.State.config $null @{} {
    $ErrorActionPreference='Continue'
    $discard=@(& $ngrok config check --config (Join-Path $c.privateDirectory 'ngrok.yml') 2>&1)
    return $LASTEXITCODE
  }
  if($exit -ne 0){throw 'CONFIG_REFUSED'}
  $now=[DateTimeOffset]::UtcNow
  $approval=[pscustomobject]@{appId=$c.appId;pageId=$c.pageId;formId=$c.formId;approvedPwshExecutable=$c.qaPwshExecutable;approvedAt=$now.ToString('o');deadlineAt=$now.AddMinutes(30).ToString('o');allowEnable=$true;allowTunnel=$true;hostname=$c.hostname;ngrokExe=$ngrok;ngrokSha256=$hash;freePlanVerified=$true;fullCaptureDisabled=$true;hostnameVerified=$true;ngrokVerifiedAt=$now.ToString('o')}
  $c|Add-Member -NotePropertyName graphVersion -NotePropertyValue 'v27.0' -Force
  $c|Add-Member -NotePropertyName ngrokExe -NotePropertyValue $ngrok -Force
  $c|Add-Member -NotePropertyName supervisorApproval -NotePropertyValue $approval -Force
  [IO.File]::WriteAllText($qa.Pointer.runtimeFile,($c|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
  Assert-QaPrivateAcl $qa.Pointer.runtimeFile
  Write-Output 'QA_SUPERVISOR_METADATA_READY: exact QA resources; native ngrok config accepted; 30-minute deadline; no service started'
}catch{Write-Output 'QA_SUPERVISOR_PREPARATION_BLOCKED';exit 1}
