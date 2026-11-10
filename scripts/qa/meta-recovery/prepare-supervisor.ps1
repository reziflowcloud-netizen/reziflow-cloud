param([Parameter(Mandatory=$true)][string]$PointerPath,[Parameter(Mandatory=$true)][switch]$FreeAccountAndCaptureChecked,[switch]$RearmClosedLaunch)
$ErrorActionPreference='Stop'
function Test-QaSupervisorNgrokConfig([string]$Text){
 if($null -eq $Text -or $Text.Length -gt 8192 -or $Text.IndexOf([char]0) -ge 0){return $false}
 return $Text.Replace("`r",'').Trim() -cmatch '\Aversion: "3"\nagent:\n  authtoken: "[A-Za-z0-9_-]{20,512}"\n  console_ui: false\n  inspect_db_size: -1\n  web_addr: false\n  log: false\n  remote_management: false\z'
}
function Assert-QaClosedRearm([object]$Runtime,[object]$Real,[int]$HttpListeners,[int]$OwnedProcesses,[int]$OpenBindings){
 if($Runtime.enabled -isnot [bool] -or $Runtime.workerEnabled -isnot [bool] -or $Runtime.approvedTuples -isnot [array] -or $Runtime.pilotLeadIds -isnot [array] -or $Real.release -isnot [bool]){throw 'REARM_GATE_TYPE_REFUSED'}
 if($HttpListeners -ne 0 -or $OwnedProcesses -ne 0 -or $OpenBindings -ne 0 -or $Runtime.appId -ne '2523488421395251' -or $Runtime.approvedMetaAppId -ne $Runtime.appId -or $Runtime.pageId -ne '1449474971582722' -or $Runtime.formId -ne '2046130655900851' -or $Runtime.enabled -ne $false -or $Runtime.workerEnabled -ne $false -or @($Runtime.approvedTuples).Count -ne 0 -or @($Runtime.pilotLeadIds).Count -ne 0){throw 'REARM_RUNTIME_REFUSED'}
 if($Real.appId -ne $Runtime.appId -or $Real.pageId -ne $Runtime.pageId -or $Real.formId -ne $Runtime.formId -or $Real.release -ne $false -or $null -ne $Real.approvedLeadId -or $null -ne $Real.leadCreatedAt -or $null -ne $Real.dashboardSample){throw 'REARM_LEAD_GATE_REFUSED'}
 foreach($name in @('closedAt','earliestClosedAt')){
  $property=$Real.PSObject.Properties[$name]
  if(-not $property -or $null -eq $property.Value){if($name -eq 'closedAt'){throw 'REARM_T0_MISSING'};continue}
  $value=$property.Value
  if($value -is [DateTime]){if($value.Kind -eq [DateTimeKind]::Unspecified){throw 'REARM_T0_REFUSED'};$time=[DateTimeOffset]::new($value)}
  elseif($value -is [DateTimeOffset]){$time=$value}
  elseif($value -is [string] -and $value -match '^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$'){$time=[DateTimeOffset]::Parse($value,[Globalization.CultureInfo]::InvariantCulture)}
  else{throw 'REARM_T0_REFUSED'}
  if($time -gt [DateTimeOffset]::UtcNow){throw 'REARM_T0_FUTURE'}
 }
}
function Get-QaOwnedLaunchProcesses([string]$Root,[string]$Pointer){
 $escapedRoot=$Root.Replace('\','\\').Replace("'","\'")
 $escapedPointer=([IO.Path]::GetFullPath($Pointer)).Replace('\','\\').Replace("'","\'")
 # A matching QA launcher with relative arguments is ambiguous, so block too.
 # Project only PID/name; do not copy other processes' command-line contents.
 $filter="(Name='node.exe' AND (CommandLine LIKE '%$escapedRoot%' OR CommandLine LIKE '%meta-recovery%supervisor.mjs%')) OR (Name='ngrok.exe' AND CommandLine LIKE '%$escapedRoot%') OR (Name='pwsh.exe' AND CommandLine LIKE '%supervisor-process.ps1%' AND CommandLine LIKE '%$escapedPointer%')"
 return @(Get-CimInstance Win32_Process -Property ProcessId,Name -Filter $filter -ErrorAction Stop)
}
try{
  if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned' -or -not $FreeAccountAndCaptureChecked){throw 'APPROVAL_REFUSED'}
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $qa=Read-QaGuardedRuntime $PointerPath
  $c=$qa.Runtime
  if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $c.appId -ne '2523488421395251' -or $c.approvedMetaAppId -ne $c.appId -or $c.pageId -ne '1449474971582722' -or $c.formId -ne '2046130655900851' -or $c.hostname -ne 'unit-handsfree-carpentry.ngrok-free.dev' -or $c.enabled -ne $false -or $c.workerEnabled -ne $false){throw 'TARGET_REFUSED'}
  $stopPath=Join-Path $c.privateDirectory 'STOP'
  $hasStop=Test-Path -LiteralPath $stopPath
  if($hasStop -and -not $RearmClosedLaunch){throw 'CLOSED_CYCLE_REFUSED'}
  if($RearmClosedLaunch -and -not $hasStop){throw 'REARM_MARKER_MISSING'}
  foreach($port in @(43126,43127)){if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue){throw 'PORT_BUSY'}}
  $ngrok='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe'
  Assert-QaNoReparse $ngrok
  $hash=(Get-FileHash -LiteralPath $ngrok -Algorithm SHA256).Hash.ToLowerInvariant()
  if($hash -ne '6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16'){throw 'EXECUTABLE_CHANGED'}
  . (Join-Path $PSScriptRoot 'ngrok-store-alias.ps1')
  $null=Get-QaVerifiedNgrokStoreAlias $ngrok $hash $c.qaPwshExecutable
  foreach($leaf in @('ngrok.yml','meta-app-secret.txt','meta-page-token.txt','meta-real-private.json')){Assert-QaPrivateAcl (Join-Path $c.privateDirectory $leaf)}
  . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
  if($RearmClosedLaunch){
    if([IO.Path]::GetFullPath($stopPath) -ne (Join-Path $c.privateDirectory 'STOP')){throw 'REARM_MARKER_PATH_REFUSED'}
    Assert-QaPrivateAcl $stopPath
    $marker=Get-Item -LiteralPath $stopPath -Force
    if($marker.PSIsContainer -or $marker.LinkType -or $marker.Length -ne 6 -or [IO.File]::ReadAllText($stopPath) -cne 'closed'){throw 'REARM_MARKER_REFUSED'}
    $markerLength=$marker.Length;$markerWrite=$marker.LastWriteTimeUtc
    $real=Get-Content -LiteralPath (Join-Path $c.privateDirectory 'meta-real-private.json') -Raw|ConvertFrom-Json
    $sql='BEGIN TRANSACTION READ ONLY; SELECT count(*)::int FROM public."MetaLeadAdsBinding" WHERE enabled OR mode<>''off'' OR cardinality("pilotLeadIds")>0; ROLLBACK;'
    $lines=@(Invoke-PostgresTool $qa.State.config ([Uri]$c.databaseUrl) 'psql.exe' @('-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',$sql) 'REARM_BINDING_QUERY_REFUSED')
    $counts=@($lines|Where-Object{$_ -is [string] -and $_.Trim() -match '^\d+$'})
    if($counts.Count -ne 1){throw 'REARM_BINDING_OUTPUT_REFUSED'}
    $http=@(Get-NetTCPConnection -State Listen -LocalPort 43126,43127 -ErrorAction SilentlyContinue)
    $owned=@(Get-QaOwnedLaunchProcesses $c.privateDirectory $PointerPath)
    Assert-QaClosedRearm $c $real $http.Count $owned.Count ([int]$counts[0].Trim())
  }
  if(-not(Test-QaSupervisorNgrokConfig ([IO.File]::ReadAllText((Join-Path $c.privateDirectory 'ngrok.yml'))))){throw 'CONFIG_REFUSED'}
  $now=[DateTimeOffset]::UtcNow
  $approval=[pscustomobject]@{appId=$c.appId;pageId=$c.pageId;formId=$c.formId;approvedPwshExecutable=$c.qaPwshExecutable;approvedAt=$now.ToString('o');deadlineAt=$now.AddMinutes(30).ToString('o');allowEnable=$true;allowTunnel=$true;hostname=$c.hostname;ngrokExe=$ngrok;ngrokSha256=$hash;freePlanVerified=$true;fullCaptureDisabled=$true;hostnameVerified=$true;ngrokVerifiedAt=$now.ToString('o')}
  $c|Add-Member -NotePropertyName graphVersion -NotePropertyValue 'v27.0' -Force
  $c|Add-Member -NotePropertyName ngrokExe -NotePropertyValue $ngrok -Force
  $c|Add-Member -NotePropertyName supervisorApproval -NotePropertyValue $approval -Force
  [IO.File]::WriteAllText($qa.Pointer.runtimeFile,($c|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false))
  Assert-QaPrivateAcl $qa.Pointer.runtimeFile
  if($RearmClosedLaunch){
    if(@(Get-NetTCPConnection -State Listen -LocalPort 43126,43127 -ErrorAction SilentlyContinue).Count -or @(Get-QaOwnedLaunchProcesses $c.privateDirectory $PointerPath).Count){throw 'REARM_WRITER_REAPPEARED'}
    Assert-QaPrivateAcl $stopPath;$again=Get-Item -LiteralPath $stopPath -Force
    if($again.PSIsContainer -or $again.LinkType -or $again.Length -ne $markerLength -or $again.LastWriteTimeUtc -ne $markerWrite -or [IO.File]::ReadAllText($stopPath) -cne 'closed'){throw 'REARM_MARKER_CHANGED'}
    Remove-Item -LiteralPath $stopPath -Force -ErrorAction Stop
    if(Test-Path -LiteralPath $stopPath){throw 'REARM_MARKER_REMAINS'}
  }
  Write-Output 'QA_SUPERVISOR_METADATA_READY: exact QA resources; verified Store alias; minimal config validated locally; 30-minute deadline; no service started'
}catch{Write-Output 'QA_SUPERVISOR_PREPARATION_BLOCKED';exit 1}
