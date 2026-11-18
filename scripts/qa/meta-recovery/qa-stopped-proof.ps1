param([Parameter(Mandatory=$true)][string]$PointerPath,[switch]$IncludeTargetedEvents)
$ErrorActionPreference='Stop'
function Convert-QaProofUtc([object]$Value){
 if($Value -is [DateTimeOffset]){return $Value.ToUniversalTime()}
 if($Value -is [DateTime]){if($Value.Kind -eq [DateTimeKind]::Unspecified){throw 'TIME_ZONE_REQUIRED'};return ([DateTimeOffset]::new($Value)).ToUniversalTime()}
 if($Value -isnot [string] -or $Value -notmatch '^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$'){throw 'TIME_REFUSED'}
 return ([DateTimeOffset]::Parse($Value,[Globalization.CultureInfo]::InvariantCulture)).ToUniversalTime()
}
function Select-QaEventMetadata([object]$Event,[string]$Category){
 if($Category -notin @('Defender','AppLocker','CodeIntegrity') -or $Event.Id -isnot [int] -or $Event.Id -notin @(1116,1117,1121,1123,8003,8004,3033,3076,3077)){throw 'EVENT_REFUSED'}
 return [pscustomobject]@{category=$Category;eventID=$Event.Id;timeEpochSeconds=(Convert-QaProofUtc $Event.TimeCreated).ToUnixTimeSeconds()}
}
function Get-QaProofListeners{
 try{return @(Get-NetTCPConnection -State Listen -ErrorAction Stop)}
 catch{
  if($_.CategoryInfo.Category -eq [System.Management.Automation.ErrorCategory]::ObjectNotFound -and $_.FullyQualifiedErrorId -match '^CmdletizationQuery_NotFound(?:_State)?,Get-NetTCPConnection$'){return @()}
  throw 'LISTENER_QUERY_UNKNOWN'
 }
}
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $qa=Read-QaGuardedRuntime $PointerPath -AllowStopped;$c=$qa.Runtime;$root=$c.privateDirectory
 if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $c.appId -ne '2523488421395251' -or $c.approvedMetaAppId -ne $c.appId -or $c.pageId -ne '1449474971582722' -or $c.formId -ne '2046130655900851'){throw 'TARGET_REFUSED'}
 $realPath=Join-Path $root 'meta-real-private.json';Assert-QaPrivateAcl $realPath
 if((Get-Item -LiteralPath $realPath).Length -gt 65536){throw 'METADATA_SIZE_REFUSED'}
 $real=Get-Content -LiteralPath $realPath -Raw|ConvertFrom-Json
 $times=@();foreach($pair in @(@($real,'closedAt'),@($real,'earliestClosedAt'),@($c,'cleanupClosedAt'))){$property=$pair[0].PSObject.Properties[$pair[1]];if($property -and $null -ne $property.Value){$times+=Convert-QaProofUtc $property.Value}}
 if($times.Count -eq 0){throw 'CLEANUP_T0_UNKNOWN'}
 $t0=@($times|Sort-Object UtcTicks)[0];$now=[DateTimeOffset]::UtcNow;if($t0 -gt $now){throw 'CLEANUP_T0_FUTURE'}
 $listeners=@(Get-QaProofListeners)
 $http=@($listeners|Where-Object{$_.LocalPort -in @(43126,43127)})
 $pg=@($listeners|Where-Object{$_.LocalPort -eq $qa.State.cluster.Port})
 $escaped=$root.Replace('\','\\').Replace("'","\'");$pointer=([IO.Path]::GetFullPath($PointerPath)).Replace('\','\\').Replace("'","\'")
 $filter="(CommandLine LIKE '%$escaped%' AND (Name='node.exe' OR Name='ngrok.exe' OR Name='pwsh.exe' OR Name='postgres.exe')) OR (Name='node.exe' AND CommandLine LIKE '%meta-recovery%supervisor.mjs%') OR (Name='pwsh.exe' AND CommandLine LIKE '%supervisor-process.ps1%' AND CommandLine LIKE '%$pointer%')"
 $processes=@(Get-CimInstance Win32_Process -Property ProcessId,Name -Filter $filter -ErrorAction Stop)
 $pidFile=Test-Path -LiteralPath (Join-Path $qa.State.cluster.Cluster 'postmaster.pid')
 $stack=[Collections.Generic.Stack[string]]::new();$stack.Push($root);[long]$files=0;[long]$bytes=0;[long]$links=0
 while($stack.Count){foreach($item in Get-ChildItem -LiteralPath $stack.Pop() -Force -ErrorAction Stop){if($item.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)){$links++;continue};if($item.PSIsContainer){$stack.Push($item.FullName)}else{$files++;$bytes+=$item.Length}}}
 $closed=$c.enabled -is [bool] -and $c.enabled -eq $false -and $c.workerEnabled -is [bool] -and $c.workerEnabled -eq $false -and @($c.approvedTuples).Count -eq 0 -and @($c.pilotLeadIds).Count -eq 0 -and $real.release -is [bool] -and $real.release -eq $false
 $safe=$closed -and $http.Count -eq 0 -and $pg.Count -eq 0 -and $processes.Count -eq 0 -and -not $pidFile -and $links -eq 0
 $proof=[ordered]@{status=if($safe){'PASS'}else{'BLOCKED'};qaRoot=$root;files=$files;bytes=$bytes;reparsePoints=$links;httpListeners=$http.Count;postgresListeners=$pg.Count;rootScopedProcesses=$processes.Count;postmasterPidFilePresent=$pidFile;runtimeGatesClosed=$closed;databaseBindingState='NOT_QUERIED';cleanupT0EpochSeconds=$t0.ToUnixTimeSeconds();credentialsDeadlineEpochSeconds=$t0.AddHours(24).ToUnixTimeSeconds();qaArtifactsDeadlineEpochSeconds=$t0.AddDays(7).ToUnixTimeSeconds();resultDeadlineEpochSeconds=$t0.AddDays(30).ToUnixTimeSeconds();credentialSecondsRemaining=($t0.AddHours(24).ToUnixTimeSeconds()-$now.ToUnixTimeSeconds());externalCopies='NOT_VERIFIED';databaseConnected=$false;deletionPerformed=$false}
 if($IncludeTargetedEvents){
  $exe='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe'
  $start=$now.AddMinutes(-10).ToString('o');$end=$now.ToString('o');$summaries=@()
  $channels=@(@{category='Defender';log='Microsoft-Windows-Windows Defender/Operational';ids=@(1116,1117,1121,1123)},@{category='AppLocker';log='Microsoft-Windows-AppLocker/EXE and DLL';ids=@(8003,8004)},@{category='CodeIntegrity';log='Microsoft-Windows-CodeIntegrity/Operational';ids=@(3033,3076,3077)})
  foreach($channel in $channels){
   $idTest=($channel.ids|ForEach-Object{'EventID='+$_}) -join ' or '
   $xpath="*[System[($idTest) and TimeCreated[@SystemTime>='$start' and @SystemTime<='$end']] and (EventData[Data='$exe'] or UserData/*[*='$exe'])]"
   try{$records=@(Get-WinEvent -LogName $channel.log -FilterXPath $xpath -MaxEvents 20 -ErrorAction Stop);$events=@();foreach($record in $records){$events+=Select-QaEventMetadata $record $channel.category};$summaries+=[pscustomobject]@{category=$channel.category;status=if($events.Count){'MATCH'}else{'UNKNOWN'};events=$events}}
   catch{$summaries+=[pscustomobject]@{category=$channel.category;status='UNKNOWN';events=@()}}
  }
  $proof.targetedEventLogs=$summaries
 }
 $proof|ConvertTo-Json -Depth 6 -Compress
 if(-not $safe){exit 1}
}catch{Write-Output '{"status":"BLOCKED","code":"QA_STOPPED_METADATA_PROOF_REFUSED","databaseConnected":false,"deletionPerformed":false}';exit 1}
