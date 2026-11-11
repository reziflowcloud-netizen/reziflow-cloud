param([string]$OutputPath,[switch]$AuthorizedPairWindow)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Set-StrictMode -Version Latest
# Read-only, fixed incident window. Never launches ngrok, reads a credential
# file, renders an event Message, or changes policy/ACL/service configuration.
function Get-QaIncidentEventSummary([object]$Event,[string]$Category,[switch]$AuthorizedPairWindow){
 $xml=[xml]$Event.ToXml()
 $stamp=$xml.SelectSingleNode('/*[local-name()="Event"]/*[local-name()="System"]/*[local-name()="TimeCreated"]/@SystemTime')
 if($null -eq $stamp -or $stamp.Value -notmatch '^2026-11-10T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$'){return $null}
 $utc=[DateTimeOffset]::Parse($stamp.Value,[Globalization.CultureInfo]::InvariantCulture)
 $start=if($AuthorizedPairWindow){'2026-11-10T17:44:20Z'}else{'2026-11-10T14:48:00Z'}
 $end=if($AuthorizedPairWindow){'2026-11-10T17:44:45Z'}else{'2026-11-10T14:58:00Z'}
 if($utc -lt [DateTimeOffset]::Parse($start) -or $utc -gt [DateTimeOffset]::Parse($end)){return $null}
 $values=@($xml.SelectNodes('//*[local-name()="EventData"]/*[local-name()="Data"] | //*[local-name()="UserData"]//*[not(*)]') | ForEach-Object {$_.InnerText})
 if(-not @($values|Where-Object{$_ -match '(?i)ngrok(?:\.exe|\.ngrok|_1g87z0zv29zzc)|6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16'}).Count){return $null}
 $facts=[ordered]@{}
 foreach($node in $xml.SelectNodes('//*[local-name()="EventData"]/*[local-name()="Data"] | //*[local-name()="UserData"]//*[not(*)]')){
  $name=if($node.LocalName -eq 'Data'){$node.GetAttribute('Name')}else{$node.LocalName};$value=$node.InnerText
  if($name -match '^(RuleId|RuleID|PolicyId|PolicyID|Status|StatusCode|ErrorCode|HResult|HRESULT|Result|ResultCode|ReasonCode|ProcessId|ProcessID|Action|ActionID|EnforcementMode)$' -and $value -match '^(?:\{?[0-9A-Fa-f-]{36}\}?|0x[0-9A-Fa-f]{1,16}|\d{1,12}|Enabled|Disabled|AuditOnly|Enforced|Allow|Deny|Block)$'){$facts[$name]=$value}
 }
 return [pscustomobject]@{category=$Category;eventId=[int]$Event.Id;timeUtc=$utc.ToUniversalTime().ToString('o');recordId=[long]$Event.RecordId;facts=$facts}
}
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 $channels=@(
  @{category='Defender';log='Microsoft-Windows-Windows Defender/Operational';ids=@(1116,1117,1121,1122,1123,1124)},
  @{category='AppLockerExe';log='Microsoft-Windows-AppLocker/EXE and DLL';ids=@(8002,8003,8004,8028,8029,8036)},
  @{category='AppLockerPackaged';log='Microsoft-Windows-AppLocker/Packaged app-Execution';ids=@(8020,8021,8022,8027)},
  @{category='CodeIntegrity';log='Microsoft-Windows-CodeIntegrity/Operational';ids=@(3033,3034,3076,3077,3089)},
  @{category='AppModel';log='Microsoft-Windows-AppModel-Runtime/Admin';ids=@()},
  @{category='Security';log='Security';ids=@(4656,4688,4689,5038,6281)}
 )
 $logs=@()
 $windowStart=if($AuthorizedPairWindow){'2026-11-10T17:44:20Z'}else{'2026-11-10T14:48:00Z'}
 $windowEnd=if($AuthorizedPairWindow){'2026-11-10T17:44:45Z'}else{'2026-11-10T14:58:00Z'}
 foreach($channel in $channels){
  $idTest=if($channel.ids.Count){' and ('+(($channel.ids|ForEach-Object{'EventID='+$_}) -join ' or ')+')'}else{''}
  $xpath="*[System[TimeCreated[@SystemTime>='$windowStart' and @SystemTime<='$windowEnd']$idTest]]"
  try{
   $events=@(Get-WinEvent -LogName $channel.log -FilterXPath $xpath -MaxEvents 512 -ErrorAction Stop)
   $matches=@();foreach($event in $events){$safe=Get-QaIncidentEventSummary $event $channel.category -AuthorizedPairWindow:$AuthorizedPairWindow;if($null -ne $safe){$matches+=$safe}}
   $logs+=[pscustomobject]@{category=$channel.category;query='READ';recordsExamined=$events.Count;limitReached=($events.Count -eq 512);matched=$matches}
  }catch{
   $state=if($_.FullyQualifiedErrorId -match '^NoMatchingEventsFound,'){ 'NO_MATCHING_EVENTS' }elseif($_.Exception -is [UnauthorizedAccessException] -or $_.CategoryInfo.Category -eq [Management.Automation.ErrorCategory]::PermissionDenied){'ACCESS_DENIED'}else{'UNAVAILABLE'}
   $logs+=[pscustomobject]@{category=$channel.category;query=$state;errorCategory=[string]$_.CategoryInfo.Category;errorHResult=[int]$_.Exception.HResult;recordsExamined=0;limitReached=$false;matched=@()}
  }
 }
 $policies=@()
 foreach($kind in @('Exe','Dll','Appx')){
  $key='HKLM:\SOFTWARE\Policies\Microsoft\Windows\SrpV2\'+$kind
  try{
   if(Test-Path -LiteralPath $key -ErrorAction Stop){$mode=(Get-ItemProperty -LiteralPath $key -Name EnforcementMode -ErrorAction Stop).EnforcementMode;$rules=@(Get-ChildItem -LiteralPath $key -ErrorAction Stop);$policies+=[pscustomobject]@{kind=$kind;registry='PRESENT';enforcementMode=[int]$mode;ruleCount=$rules.Count}}
   else{$policies+=[pscustomobject]@{kind=$kind;registry='ABSENT'}}
  }catch{$policies+=[pscustomobject]@{kind=$kind;registry='UNKNOWN'}}
 }
 $dg=$null
 try{$state=Get-CimInstance -Namespace root\Microsoft\Windows\DeviceGuard -ClassName Win32_DeviceGuard -ErrorAction Stop;$dg=[pscustomobject]@{codeIntegrityEnforcement=[int]$state.CodeIntegrityPolicyEnforcementStatus;userModeCodeIntegrityEnforcement=[int]$state.UsermodeCodeIntegrityPolicyEnforcementStatus}}catch{}
 $ifeo=[ordered]@{status='UNKNOWN'}
 try{$key='HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\ngrok.exe';if(Test-Path -LiteralPath $key){$names=@((Get-Item -LiteralPath $key -ErrorAction Stop).Property);$ifeo=@{status='PRESENT';debuggerPresent=('Debugger' -in $names);mitigationOptionsPresent=('MitigationOptions' -in $names)}}else{$ifeo=@{status='ABSENT'}}}catch{}
 $report=[ordered]@{status='READ_ONLY_COMPLETE';incidentWindowUtc=@($windowStart,$windowEnd);hostMajor=$PSVersionTable.PSVersion.Major;effectiveExecutionPolicy=[string](Get-ExecutionPolicy);groupPolicy=@(Get-ExecutionPolicy -List|Where-Object{$_.Scope -in @('MachinePolicy','UserPolicy')}|Select-Object @{n='scope';e={[string]$_.Scope}},@{n='policy';e={[string]$_.ExecutionPolicy}});logs=$logs;appLockerRegistryMetadata=$policies;deviceGuard=$dg;imageExecutionOptions=$ifeo;ngrokStarted=$false;credentialsOpened=$false;policyChanged=$false}
 $json=$report|ConvertTo-Json -Depth 10 -Compress
 if($OutputPath){
  $leaf=if($AuthorizedPairWindow){'ngrok-version-pair-os-diagnostics-utc.json'}else{'ngrok-os-diagnostics-utc.json'}
  $expected=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot ('../../../.qa/meta-recovery-20261110/'+$leaf)))
  if([IO.Path]::GetFullPath($OutputPath) -cne $expected -or (Test-Path -LiteralPath $expected)){throw 'OUTPUT_REFUSED'}
  . (Join-Path $PSScriptRoot 'guard.ps1');Assert-QaNoReparse ([IO.Path]::GetDirectoryName($expected))
  $stream=[IO.FileStream]::new($expected,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$bytes=[Text.UTF8Encoding]::new($false).GetBytes($json);$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 }
 Write-Output $json
}catch{Write-Output '{"status":"BLOCKED","code":"NGROK_OS_METADATA_REFUSED","ngrokStarted":false,"credentialsOpened":false,"policyChanged":false}';exit 1}
