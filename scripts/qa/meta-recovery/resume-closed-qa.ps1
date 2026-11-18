param([Parameter(Mandatory=$true)][string]$PointerPath,[Parameter(Mandatory=$true)][string]$ExpectedCleanupClosedAt,[Parameter(Mandatory=$true)][switch]$StageAStopVerified)
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
function Convert-QaClosedResumeUtc([object]$Value){
 if($Value -is [DateTimeOffset]){return $Value.ToUniversalTime()}
 if($Value -is [DateTime]){if($Value.Kind -eq [DateTimeKind]::Unspecified){throw 'CLOSED_TIME_ZONE_REFUSED'};return ([DateTimeOffset]::new($Value)).ToUniversalTime()}
 if($Value -isnot [string] -or $Value -notmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$'){throw 'CLOSED_TIME_REFUSED'}
 return ([DateTimeOffset]::Parse($Value,[Globalization.CultureInfo]::InvariantCulture)).ToUniversalTime()
}
function Assert-QaClosedResumeState([object]$Runtime,[object]$Real,[object]$Listeners,[object]$Processes,[object]$PidPresent,[string]$ExpectedT0,[DateTimeOffset]$Now){
 if($Listeners -isnot [int] -or $Processes -isnot [int] -or $PidPresent -isnot [bool] -or $Listeners -ne 0 -or $Processes -ne 0 -or $PidPresent){throw 'CLOSED_ACTIVITY_REFUSED'}
 if($Runtime.appId -cne '2523488421395251' -or $Runtime.approvedMetaAppId -cne $Runtime.appId -or $Runtime.pageId -cne '1449474971582722' -or $Runtime.formId -cne '2046130655900851' -or $Real.appId -cne $Runtime.appId -or $Real.pageId -cne $Runtime.pageId -or $Real.formId -cne $Runtime.formId){throw 'CLOSED_TARGET_REFUSED'}
 if($Runtime.enabled -isnot [bool] -or $Runtime.workerEnabled -isnot [bool] -or $Runtime.enabled -ne $false -or $Runtime.workerEnabled -ne $false -or $Runtime.approvedTuples -isnot [array] -or $Runtime.pilotLeadIds -isnot [array] -or $Runtime.approvedTuples.Count -ne 0 -or $Runtime.pilotLeadIds.Count -ne 0 -or $Real.release -isnot [bool] -or $Real.release -ne $false){throw 'CLOSED_GATE_REFUSED'}
 foreach($name in @('approvedLeadId','leadCreatedAt','dashboardSample')){if(-not $Real.PSObject.Properties[$name] -or $null -ne $Real.$name){throw 'CLOSED_LEAD_REFUSED'}}
 $attempt=$Real.PSObject.Properties['createAttemptAt'];if($attempt -and $null -ne $attempt.Value){throw 'CLOSED_ATTEMPT_REFUSED'}
 $times=@((Convert-QaClosedResumeUtc $Runtime.cleanupClosedAt),(Convert-QaClosedResumeUtc $Real.closedAt));$earliest=$Real.PSObject.Properties['earliestClosedAt'];if($earliest -and $null -ne $earliest.Value){$times+=Convert-QaClosedResumeUtc $earliest.Value}
 $expected=Convert-QaClosedResumeUtc $ExpectedT0;foreach($time in ($times+@($expected))){if($time -gt $Now){throw 'CLOSED_TIME_FUTURE'}}
 $first=@($times|Sort-Object UtcTicks)[0];if($first.UtcTicks -ne $expected.UtcTicks){throw 'CLOSED_T0_CHANGED'};return $first
}
function Get-QaClosedResumeListeners{
 try{return @(Get-NetTCPConnection -State Listen -ErrorAction Stop)}catch{if($_.CategoryInfo.Category -eq [Management.Automation.ErrorCategory]::ObjectNotFound -and $_.FullyQualifiedErrorId -match '^CmdletizationQuery_NotFound(?:_State)?,Get-NetTCPConnection$'){return @()};throw 'CLOSED_LISTENER_QUERY_REFUSED'}
}
function Get-QaClosedResumeProcesses([string]$Root,[string]$Pointer,[switch]$ExcludePostgres){
 $r=$Root.Replace('\','\\').Replace("'","\'");$p=$Pointer.Replace('\','\\').Replace("'","\'")
 $pg=if($ExcludePostgres){''}else{" OR ((Name='postgres.exe' OR Name='pg_ctl.exe') AND CommandLine LIKE '%$r%')"}
 $filter="(Name='node.exe' AND (CommandLine LIKE '%$r%' OR CommandLine LIKE '%$p%' OR CommandLine LIKE '%meta-recovery%supervisor.mjs%')) OR (Name='ngrok.exe' AND CommandLine LIKE '%$r%') OR (Name='pwsh.exe' AND CommandLine LIKE '%supervisor-process.ps1%' AND CommandLine LIKE '%$p%')$pg"
 return @(Get-CimInstance Win32_Process -Property ProcessId,Name -Filter $filter -ErrorAction Stop)
}
function Assert-QaClosedQueryOutput([object[]]$Lines){$data=@($Lines|Where-Object{$_ -is [string] -and $_.Trim() -and $_ -notmatch '^(BEGIN|ROLLBACK|SET)$'});if($data.Count -ne 1 -or $data[0].Trim() -cne 'CLOSED'){throw 'CLOSED_BINDING_REFUSED'}}
function Assert-QaClosedGitResolution([object[]]$Candidates){if($Candidates.Count -eq 0 -or $Candidates[0].Source -cne 'C:\Program Files\Git\cmd\git.exe'){throw 'CLOSED_GIT_REFUSED'}}
$stage='host';$locks=@();$mutex=$null;$mutexHeld=$false;$mayHaveStarted=$false;$rollback='NOT_NEEDED';$qa=$null
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned' -or -not $StageAStopVerified){throw 'CLOSED_HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $hostPath=[Environment]::ProcessPath;Assert-QaNoReparse $hostPath
 if((Get-FileHash -LiteralPath $hostPath -Algorithm SHA256).Hash -cne '2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233'){throw 'CLOSED_HOST_REFUSED'}
 $git='C:\Program Files\Git\cmd\git.exe';Assert-QaNoReparse $git;Assert-QaClosedGitResolution @(Get-Command git -CommandType Application -ErrorAction Stop)
 $stage='guard';$pointer=[IO.Path]::GetFullPath($PointerPath);$expectedPointer=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../.qa/meta-recovery-final-20261115/private-pointer.json'));if($pointer -cne $expectedPointer){throw 'CLOSED_POINTER_REFUSED'}
 $qa=Read-QaGuardedRuntime $pointer -AllowStopped;$c=$qa.Runtime;$s=$qa.State
 $expectedRoot=$c.privateDirectory;$expectedCluster=$s.cluster.Cluster;$expectedRun=$s.cluster.RunId;$expectedUri=$c.databaseUrl;$expectedPort=[int]$s.cluster.Port
 $mutex=[Threading.Mutex]::new($false,('Local\LegalHubStageAClosedResume-'+$s.cluster.RunId));$mutexHeld=$mutex.WaitOne(0);if(-not $mutexHeld){throw 'CLOSED_CONCURRENT_RESUME_REFUSED'}
 if($hostPath -cne $c.qaPwshExecutable -or $s.config.postgresBin -cne 'C:\Program Files\PostgreSQL\18\bin' -or $s.config.nodeBin -cne 'C:\Program Files\nodejs'){throw 'CLOSED_EXECUTABLE_REFUSED'}
 $stop=Join-Path $c.privateDirectory 'STOP';$realPath=Join-Path $c.privateDirectory 'meta-real-private.json';$paths=@($pointer,$stop,$qa.Pointer.runtimeFile,$qa.Pointer.stateFile,$realPath)
 foreach($path in $paths){Assert-QaPrivateAcl $path;$item=Get-Item -LiteralPath $path -Force;if($item.PSIsContainer -or $item.Length -gt 65536){throw 'CLOSED_METADATA_FILE_REFUSED'}}
 foreach($path in $paths){$locks+=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)}
 if((Get-Item -LiteralPath $stop).Length -ne 6 -or [IO.File]::ReadAllText($stop) -cne 'closed'){throw 'CLOSED_STOP_REFUSED'}
 $before=@{};foreach($path in $paths){$before[$path]=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash}
 $qa=Read-QaGuardedRuntime $pointer -AllowStopped;$c=$qa.Runtime;$s=$qa.State
 if($c.privateDirectory -cne $expectedRoot -or $s.cluster.Cluster -cne $expectedCluster -or $s.cluster.RunId -cne $expectedRun -or $c.databaseUrl -cne $expectedUri -or [int]$s.cluster.Port -ne $expectedPort -or $hostPath -cne $c.qaPwshExecutable -or $s.config.postgresBin -cne 'C:\Program Files\PostgreSQL\18\bin' -or $s.config.nodeBin -cne 'C:\Program Files\nodejs'){throw 'CLOSED_IDENTITY_CHANGED'}
 $real=[IO.File]::ReadAllText($realPath)|ConvertFrom-Json
 $pidFile=Join-Path $s.cluster.Cluster 'postmaster.pid';$ports=@(43126,43127,[int]$s.cluster.Port)
 $stage='closed';$listeners=@(Get-QaClosedResumeListeners|Where-Object{$_.LocalPort -in $ports});$processes=@(Get-QaClosedResumeProcesses $c.privateDirectory $pointer)
 $t0=Assert-QaClosedResumeState $c $real ([int]$listeners.Count) ([int]$processes.Count) ([bool](Test-Path -LiteralPath $pidFile)) $ExpectedCleanupClosedAt ([DateTimeOffset]::UtcNow)
 $version=Join-Path $s.cluster.Cluster 'PG_VERSION';Assert-QaPrivateAcl $version;if([IO.File]::ReadAllText($version).Trim() -cne '18'){throw 'CLOSED_CLUSTER_VERSION_REFUSED'}
 $pgCtl=Join-Path $s.config.postgresBin 'pg_ctl.exe';$psql=Join-Path $s.config.postgresBin 'psql.exe';foreach($file in @($pgCtl,$psql)){Assert-QaNoReparse $file;if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw 'CLOSED_EXECUTABLE_REFUSED'}}
 . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
 $log=Join-Path $s.cluster.Root 'qa-closed-resume.log';$out=Join-Path $s.cluster.Root 'qa-closed-resume-control.out';$err=Join-Path $s.cluster.Root 'qa-closed-resume-control.err';foreach($file in @($log,$out,$err)){if(Test-Path -LiteralPath $file){Assert-QaPrivateAcl $file}}
 $stage='start';$mayHaveStarted=$true
 $exit=Invoke-WithIsolatedEnvironment $s.config $null @{} {
  $control=Start-Process -FilePath $pgCtl -ArgumentList @('-s','-D',('"'+$s.cluster.Cluster+'"'),'-l',('"'+$log+'"'),'-o',('"-p '+[int]$s.cluster.Port+' -h 127.0.0.1"'),'-w','-t','45','start') -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
  try{if(-not $control.WaitForExit(50000)){try{$control.Kill();[void]$control.WaitForExit(5000)}catch{};throw 'CLOSED_CONTROL_TIMEOUT'};$control.Refresh();return [int]$control.ExitCode}finally{$control.Dispose()}
 }
 if($exit -ne 0){throw 'CLOSED_START_REFUSED'}
 $stage='verify';Assert-QaRunningPostgres $s.config $s.cluster $c.privateDirectory
 foreach($path in $paths){if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -cne $before[$path]){throw 'CLOSED_METADATA_CHANGED'}}
 if(@(Get-QaClosedResumeListeners|Where-Object{$_.LocalPort -in @(43126,43127)}).Count -or @(Get-QaClosedResumeProcesses $c.privateDirectory $pointer -ExcludePostgres).Count){throw 'CLOSED_WRITER_APPEARED'}
 if($c.organizationId -notmatch '^[A-Za-z0-9_-]{1,128}$'){throw 'CLOSED_ORGANIZATION_REFUSED'}
 $sql='BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout=''5s''; SET LOCAL lock_timeout=''2s''; SELECT CASE WHEN current_database()='''+$s.cluster.Database+''' AND host(inet_server_addr())=''127.0.0.1'' AND inet_server_port()='+[int]$s.cluster.Port+' AND NOT EXISTS(SELECT 1 FROM public."MetaLeadAdsBinding" WHERE enabled OR mode<>''off'' OR cardinality("pilotLeadIds")>0 OR "appId"<>''2523488421395251'' OR "pageId"<>''1449474971582722'' OR "formId"<>''2046130655900851'' OR "organizationId"<>'''+$c.organizationId+''') AND NOT EXISTS(SELECT 1 FROM public."Lead") AND NOT EXISTS(SELECT 1 FROM public."MetaLeadAdsDelivery") THEN ''CLOSED'' ELSE ''BLOCKED'' END; ROLLBACK;'
 $stage='binding';$lines=@(Invoke-PostgresTool $s.config ([Uri]$c.databaseUrl) 'psql.exe' @('-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',$sql) 'CLOSED_QUERY_REFUSED');Assert-QaClosedQueryOutput $lines
 foreach($path in $paths){if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -cne $before[$path]){throw 'CLOSED_METADATA_CHANGED'}}
 [pscustomobject]@{status='PASS';postgres='RESUMED_SAME_OWNED_CLUSTER';binding='OFF';intake='CLOSED';stopMarker='PRESERVED';cleanupT0EpochSeconds=$t0.ToUnixTimeSeconds();metadataUnchanged=$true;servicesStarted=@('owned_postgresql');migration=$false;restore=$false;deletion=$false}|ConvertTo-Json -Compress
}catch{
 if($mayHaveStarted -and $qa){$rollback='BLOCKED';try{if(Test-Path -LiteralPath (Join-Path $qa.State.cluster.Cluster 'postmaster.pid')){Assert-QaRunningPostgres $qa.State.config $qa.State.cluster $qa.Runtime.privateDirectory -ForStop;$code=Invoke-WithIsolatedEnvironment $qa.State.config $null @{} {$ErrorActionPreference='Continue';$discard=@(& (Join-Path $qa.State.config.postgresBin 'pg_ctl.exe') '-D' $qa.State.cluster.Cluster '-m' 'fast' '-w' '-t' '45' 'stop' 2>$null);return $LASTEXITCODE};if($code -ne 0){throw 'CLOSED_ROLLBACK_REFUSED'}};if((Test-Path -LiteralPath (Join-Path $qa.State.cluster.Cluster 'postmaster.pid')) -or @(Get-QaClosedResumeListeners|Where-Object{$_.LocalPort -eq [int]$qa.State.cluster.Port}).Count){throw 'CLOSED_ROLLBACK_REFUSED'};$rollback='STOPPED'}catch{}}
 if($stage -cnotin @('host','guard','closed','start','verify','binding')){$stage='guard'}
 [pscustomobject]@{status='BLOCKED';code='QA_CLOSED_RESUME_REFUSED';stage=$stage;rollback=$rollback;stopMarker='NOT_REMOVED';intake='NOT_CHANGED';deletion=$false}|ConvertTo-Json -Compress;exit 1
}finally{foreach($handle in $locks){$handle.Dispose()};if($mutexHeld){$mutex.ReleaseMutex()};if($mutex){$mutex.Dispose()}}
