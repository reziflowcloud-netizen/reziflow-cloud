$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'supervisor-input.ps1')
Add-Type -WarningAction SilentlyContinue -TypeDefinition @'
using System;using System.IO;using System.Threading;
public sealed class QaInputFixture : TextReader {
 public readonly ManualResetEventSlim Entered=new ManualResetEventSlim(false);readonly ManualResetEventSlim released=new ManualResetEventSlim(false);string value;
 public override string ReadLine(){Entered.Set();if(!released.Wait(1500))throw new TimeoutException("PUBLIC_FIXTURE_TIMEOUT");return value;}
 public void ReleaseStop(){value="STOP";released.Set();}public void ReleaseEof(){value=null;released.Set();}
}
'@
$checks=0
foreach($value in @('STOP',$null)){
 $fixture=[QaInputFixture]::new();$reader=[IO.TextReader]::Synchronized($fixture)
 try{$task=[QaAsyncConsoleInput]::ReadLine($reader);if(-not $fixture.Entered.Wait(1000) -or $task.IsCompleted){throw 'INPUT_NOT_ASYNC'};$checks++;if($null -eq $value){$fixture.ReleaseEof()}else{$fixture.ReleaseStop()};if(-not $task.Wait(1000) -or $task.Result -cne $value){throw 'INPUT_COMPLETION_FAILED'};$checks++}finally{$fixture.ReleaseEof()}
}
[pscustomobject]@{status='PASS';managedFixtureChecks=$checks;ngrokCalls=0;nativeJobs=0;standardInputRead=$false}|ConvertTo-Json -Compress
