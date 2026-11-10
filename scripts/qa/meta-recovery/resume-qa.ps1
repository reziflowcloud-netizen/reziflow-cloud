param([Parameter(Mandatory=$true)][string]$PointerPath,[Parameter(Mandatory=$true)][string]$PreserveCleanupClosedAt)
$ErrorActionPreference='Stop'
try{
 Set-StrictMode -Version Latest
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $qa=Read-QaGuardedRuntime $PointerPath -AllowStopped;$c=$qa.Runtime;$s=$qa.State
 if([Environment]::ProcessPath -cne $c.qaPwshExecutable -or $c.appId -cne '2523488421395251' -or $c.approvedMetaAppId -cne $c.appId -or $c.pageId -cne '1449474971582722' -or $c.formId -cne '2046130655900851' -or $c.enabled -isnot [bool] -or $c.workerEnabled -isnot [bool] -or $c.approvedTuples -isnot [array] -or $c.pilotLeadIds -isnot [array] -or $c.enabled -ne $false -or $c.workerEnabled -ne $false -or @($c.approvedTuples).Count -ne 0 -or @($c.pilotLeadIds).Count -ne 0){throw 'RESTART_TARGET_REFUSED'}
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 if((Test-Path -LiteralPath (Join-Path $c.privateDirectory 'STOP')) -or @($listeners|Where-Object {$_.LocalPort -in @(43126,43127)}).Count){throw 'RESTART_NOT_CLOSED'}
 # This is a setup-only pause, not rearming a closed real-event cycle.
 $real=Join-Path $c.privateDirectory 'meta-real-private.json';Assert-QaPrivateAcl $real
 if((Get-Item -LiteralPath $real).Length -ne 0){throw 'RESTART_PREFLIGHT_ALREADY_PRESENT'}
 if($PreserveCleanupClosedAt -notmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?Z$'){throw 'CLEANUP_TIME_REFUSED'}
 $closed=[DateTimeOffset]::Parse($PreserveCleanupClosedAt,[Globalization.CultureInfo]::InvariantCulture)
 if($closed -gt [DateTimeOffset]::UtcNow){throw 'CLEANUP_TIME_FUTURE'}
 $existing=$c.PSObject.Properties['cleanupClosedAt']
 if($existing -and $null -ne $existing.Value){
  $value=$existing.Value
  if($value -is [DateTime]){if($value.Kind -eq [DateTimeKind]::Unspecified){throw 'CLEANUP_TIME_ZONE_REQUIRED'};$old=([DateTimeOffset]::new($value)).ToUniversalTime()}
  elseif($value -is [DateTimeOffset]){$old=$value.ToUniversalTime()}
  elseif($value -is [string] -and $value -match '^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$'){$old=[DateTimeOffset]::Parse($value,[Globalization.CultureInfo]::InvariantCulture)}
  else{throw 'CLEANUP_TIME_REFUSED'}
  if($old -gt [DateTimeOffset]::UtcNow){throw 'CLEANUP_TIME_FUTURE'}
  if($old -lt $closed){$closed=$old}
 }
 $c|Add-Member -NotePropertyName cleanupClosedAt -NotePropertyValue $closed.ToUniversalTime().ToString('o') -Force
 [IO.File]::WriteAllText($qa.Pointer.runtimeFile,($c|ConvertTo-Json -Depth 20),[Text.UTF8Encoding]::new($false));Assert-QaPrivateAcl $qa.Pointer.runtimeFile
 if(Test-Path -LiteralPath (Join-Path $s.cluster.Cluster 'postmaster.pid')){Assert-QaRunningPostgres $s.config $s.cluster $c.privateDirectory;Write-Output 'QA_PG_ALREADY_RUNNING_VERIFIED';return}
 $listeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 if(@($listeners|Where-Object {$_.LocalPort -eq [int]$s.cluster.Port}).Count){throw 'RESTART_PORT_BUSY'}
 if($s.config.postgresBin -cne 'C:\Program Files\PostgreSQL\18\bin' -or $s.config.nodeBin -cne 'C:\Program Files\nodejs'){throw 'RESTART_EXECUTABLE_REFUSED'}
 $pgCtl=Join-Path $s.config.postgresBin 'pg_ctl.exe';Assert-QaNoReparse $pgCtl
 if(-not(Test-Path -LiteralPath $pgCtl -PathType Leaf)){throw 'RESTART_EXECUTABLE_REFUSED'}
 $log=Join-Path $s.cluster.Root 'qa-resume.log'
 $controlOut=Join-Path $s.cluster.Root 'qa-resume-control.out';$controlErr=Join-Path $s.cluster.Root 'qa-resume-control.err'
 foreach($path in @($log,$controlOut,$controlErr)){if(Test-Path -LiteralPath $path){Assert-QaPrivateAcl $path}}
 . (Join-Path $qa.Source 'scripts/local-maintenance/core.ps1')
 $exit=Invoke-WithIsolatedEnvironment $s.config $null @{} {
  # Same bounded controller/file-redirection pattern as the preserved factory.
  # A PowerShell native pipeline can wait on inherited daemon pipe handles.
  $control=Start-Process -FilePath $pgCtl -ArgumentList @('-s','-D',('"'+$s.cluster.Cluster+'"'),'-l',('"'+$log+'"'),'-o',('"-p '+[int]$s.cluster.Port+' -h 127.0.0.1"'),'-w','-t','45','start') -PassThru -WindowStyle Hidden -RedirectStandardOutput $controlOut -RedirectStandardError $controlErr
  try{if(-not $control.WaitForExit(50000)){throw 'RESTART_CONTROL_TIMEOUT'};return [int]$control.ExitCode}finally{$control.Dispose()}
 }
 if($exit -ne 0){throw 'RESTART_FAILED'}
 Assert-QaRunningPostgres $s.config $s.cluster $c.privateDirectory
 Write-Output 'QA_PG_RESUMED_VERIFIED: same owned synthetic cluster; loopback only; cleanup T0 preserved; no migration or restore'
}catch{Write-Output 'QA_PG_RESUME_BLOCKED';exit 1}
