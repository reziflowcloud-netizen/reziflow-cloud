$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
try{
 $tokens=$null;$errors=$null
 $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'ngrok-os-diagnostics.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'SYNTAX_REFUSED'}
 $function=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-QaIncidentEventSummary'},$true)
 . ([scriptblock]::Create($function.Extent.Text))
 $planted='PLANTED_PRIVATE_TEXT_MUST_NOT_ESCAPE'
 $system='<System><TimeCreated SystemTime="2026-11-10T14:53:15Z" /></System>'
 $event=[pscustomobject]@{Id=8022;RecordId=[long]7;xml=('<Event>'+$system+'<EventData><Data Name="FilePath">\Device\Volume\ngrok.exe</Data><Data Name="CommandLine">ngrok.exe PLANTED_PRIVATE_TEXT_MUST_NOT_ESCAPE</Data><Data Name="RuleId">{11111111-2222-3333-4444-555555555555}</Data><Data Name="RuleName">PLANTED_PRIVATE_TEXT_MUST_NOT_ESCAPE</Data><Data Name="Status">0x80070005</Data><Data Name="Action">PLANTED_PRIVATE_TEXT_MUST_NOT_ESCAPE</Data></EventData></Event>')}
 $event|Add-Member -MemberType ScriptMethod -Name ToXml -Value {return $this.xml}
 $event|Add-Member -MemberType ScriptProperty -Name Message -Value {throw 'RAW_MESSAGE_REFUSED'}
 $event|Add-Member -MemberType ScriptProperty -Name Properties -Value {throw 'RAW_PROPERTIES_REFUSED'}
 $event|Add-Member -MemberType ScriptProperty -Name TimeCreated -Value {throw 'LOCALIZED_TIMESTAMP_REFUSED'}
 $result=Get-QaIncidentEventSummary $event 'AppLockerPackaged'
 $json=$result|ConvertTo-Json -Depth 6 -Compress
 if($json.Contains($planted) -or $json.Contains('FilePath') -or $json.Contains('CommandLine') -or $result.eventId -ne 8022 -or $result.timeUtc -ne '2026-11-10T14:53:15.0000000+00:00' -or $result.facts.RuleId -ne '{11111111-2222-3333-4444-555555555555}' -or $result.facts.Status -ne '0x80070005' -or $result.facts.Contains('Action')){throw 'REDACTION_REFUSED'}
 $event.xml='<Event>'+$system+'<EventData><Data Name="FilePath">unrelated.exe</Data></EventData></Event>'
 if($null -ne (Get-QaIncidentEventSummary $event 'Defender')){throw 'UNRELATED_EVENT_EXPOSED'}
 $event.xml='<Event>'+$system+'<UserData><Activation><PackageFamilyName>ngrok.ngrok_1g87z0zv29zzc</PackageFamilyName><ErrorCode>0x80070005</ErrorCode><PrivateText>PLANTED_PRIVATE_TEXT_MUST_NOT_ESCAPE</PrivateText></Activation></UserData></Event>'
 $packaged=Get-QaIncidentEventSummary $event 'AppModel'
 if($null -eq $packaged -or $packaged.facts.ErrorCode -ne '0x80070005' -or ($packaged|ConvertTo-Json -Depth 6 -Compress).Contains($planted)){throw 'PACKAGED_EVENT_MISSED'}
 $event.xml=$event.xml.Replace('2026-11-10T14:53:15Z','2026-11-10T13:53:15Z')
 if($null -ne (Get-QaIncidentEventSummary $event 'AppModel')){throw 'WRONG_UTC_WINDOW_ACCEPTED'}
 Write-Output 'NGROK_OS_DIAGNOSTICS_UNIT_PASS: exact incident target; device/package paths; no raw event/command/contact text; no OS query or process launch'
}catch{Write-Output 'NGROK_OS_DIAGNOSTICS_UNIT_BLOCKED';exit 1}
