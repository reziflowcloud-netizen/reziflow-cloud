$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$job=$null
$stage='host'
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'NATIVE_TEST_HOST_REFUSED'}
 # Extract a constant C# literal; never evaluate PowerShell source or load runtime.
 $source=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'supervisor-process.ps1') -Raw
 $match=[regex]::Match($source,"(?s)Add-Type -WarningAction SilentlyContinue -TypeDefinition @'\r?\n(?<code>.*?)\r?\n'@")
 if(-not $match.Success){throw 'NATIVE_TEST_SOURCE_REFUSED'}
 $stage='compile';Add-Type -TypeDefinition $match.Groups['code'].Value -WarningAction SilentlyContinue
 $node='C:\Program Files\nodejs\node.exe'
 $fixture=Join-Path $PSScriptRoot 'supervisor-fake-child.mjs'
 $stage='job';$job=[QaOwnedJob]::new($PID,[Environment]::ProcessPath)
 if(-not $job.ParentAlive()){throw 'NATIVE_PARENT_NOT_ALIVE'}
 $stage='launch';$child=$job.Launch('app',$node,[string[]]@($fixture),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows','WINDIR=C:\Windows'))
 if(-not $job.ChildAlive('app')){throw 'NATIVE_CHILD_NOT_ALIVE'}
 $stage='descendant';$descendants=@()
 for($attempt=0;$attempt -lt 30;$attempt++){
  $descendants=@(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$child) -ErrorAction Stop | Where-Object {$_.ExecutablePath -eq $node})
  if($descendants.Count -eq 1){break}
  Start-Sleep -Milliseconds 100
 }
 if($descendants.Count -ne 1 -or $descendants[0].ExecutablePath -ne $node){$stage=if($job.ChildAlive('app')){'descendant_parent_alive'}else{'descendant_parent_exited'};throw 'NATIVE_DESCENDANT_NOT_FOUND'}
 $stage='duplicate';$duplicateRefused=$false
 try{[void]$job.Launch('app',$node,[string[]]@($fixture),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows'))}catch{$duplicateRefused=$true}
 if(-not $duplicateRefused){throw 'NATIVE_DUPLICATE_ACCEPTED'}
 $stage='peer_jobs';$discard=$job.Launch('tunnel',$node,[string[]]@($fixture,'--descendant'),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows','WINDIR=C:\Windows'))
 if(-not $job.ChildAlive('tunnel') -or $job.ActiveCount() -lt 3){throw 'NATIVE_PEER_JOB_NOT_ALIVE'}
 $stage='restart_drain';$job.StopChild('app')
 if($job.ChildAlive('app') -or -not $job.ChildAlive('tunnel') -or $job.ActiveCount() -lt 1){throw 'NATIVE_RESTART_CROSSED_JOBS'}
 $stage='restart_new_job';$discard=$job.Launch('app',$node,[string[]]@($fixture,'--descendant'),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows','WINDIR=C:\Windows'))
 if(-not $job.ChildAlive('app') -or $job.ActiveCount() -lt 2){throw 'NATIVE_RESTART_NOT_ALIVE'}
 $stage='stop';if(-not $job.StopAll() -or $job.ChildAlive('app') -or $job.ChildAlive('tunnel') -or $job.ActiveCount() -ne 0){$stage='stop_active_'+$job.ActiveCount();throw 'NATIVE_STOP_UNVERIFIED'}
 $stage='descendant_absence'
 $remaining=@(Get-CimInstance Win32_Process -Filter ('ProcessId='+$descendants[0].ProcessId) -ErrorAction SilentlyContinue)
 if($remaining.Count){throw 'NATIVE_DESCENDANT_REMAINS'}
 $job.Dispose();$job=$null
 # A second job demonstrates kernel kill-on-close, even without StopAll().
 $stage='close';$job=[QaOwnedJob]::new($PID,[Environment]::ProcessPath)
 $child=$job.Launch('app',$node,[string[]]@($fixture,'--descendant'),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows','WINDIR=C:\Windows'))
 $relay=$job.Launch('tunnel',$node,[string[]]@($fixture,'--descendant'),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows','WINDIR=C:\Windows'))
 $job.Dispose();$job=$null
 for($attempt=0;$attempt -lt 30;$attempt++){
  $remaining=@(Get-CimInstance Win32_Process -Property ProcessId,Name -Filter ('ProcessId='+$child+' OR ProcessId='+$relay) -ErrorAction SilentlyContinue)
  if(-not $remaining.Count){break}
  Start-Sleep -Milliseconds 100
 }
 if($remaining.Count){throw 'NATIVE_KILL_ON_CLOSE_UNVERIFIED'}
 # Test-copy injection only, after suspended CreateProcess and before assign.
 # Production C# contains no fault flag or bypass. Both owned cleanup paths run.
 $stage='negative_compile'
 $needle='if(!AssignProcessToJobObject(childJob,pi.process))throw NativeRefused("assign_job");'
 if(([regex]::Matches($match.Groups['code'].Value,[regex]::Escape($needle))).Count -ne 1){throw 'NEGATIVE_BOUNDARY_CHANGED'}
 $fault=[regex]::Replace($match.Groups['code'].Value,'\bQaOwnedJob\b','QaOwnedJobFaultFixture').Replace($needle,('if(kind=="tunnel")throw Refused();'+$needle))
 Add-Type -TypeDefinition $fault -WarningAction SilentlyContinue
 $job=[QaOwnedJobFaultFixture]::new($PID,[Environment]::ProcessPath)
 $child=$job.Launch('app',$node,[string[]]@($fixture,'--descendant'),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows','WINDIR=C:\Windows'))
 $stage='negative_second_launch';$refused=$false
 try{$discard=$job.Launch('tunnel',$node,[string[]]@($fixture,'--descendant'),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows','WINDIR=C:\Windows'))}catch{$refused=$true}
 $registry=$job.GetType().GetField('children',[Reflection.BindingFlags]'NonPublic,Instance').GetValue($job)
 if(-not $refused -or -not $job.ChildAlive('app') -or $job.ChildAlive('tunnel') -or $job.ActiveCount() -lt 1 -or $registry.Count -ne 1){throw 'NEGATIVE_LAUNCH_STATE_UNVERIFIED'}
 $children=@(Get-CimInstance Win32_Process -Property ProcessId,Name -Filter ("Name='node.exe' AND ParentProcessId="+$PID) -ErrorAction Stop)
 if($children.Count -ne 1 -or $children[0].ProcessId -ne $child){throw 'NEGATIVE_PROCESS_REMAINS'}
 if(-not $job.StopAll() -or $job.ActiveCount() -ne 0){throw 'NEGATIVE_STOP_UNVERIFIED'}
 $job.Dispose();$job=$null
 Write-Output 'QA_NATIVE_JOB_TEST_PASS: separate empty Jobs; suspended ownership; descendants; app-only restart; STOP both zero; both kill-on-close; failed second launch cleaned; no DB/Next/ngrok/Meta'
}catch{
 Write-Output ('QA_NATIVE_JOB_TEST_BLOCKED: '+$stage)
 exit 1
}finally{
 if($job){try{[void]$job.StopAll()}finally{$job.Dispose()}}
}
