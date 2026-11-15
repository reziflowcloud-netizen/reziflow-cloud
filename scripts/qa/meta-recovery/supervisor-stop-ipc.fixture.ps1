param([Parameter(Mandatory=$true)][int]$ParentPid)
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$job=$null
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 $expected=Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::UserProfile)) '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
 if([Environment]::ProcessPath -cne $expected -or (Get-FileHash -LiteralPath $expected -Algorithm SHA256).Hash -cne '2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233'){throw 'HOST_REFUSED'}
 $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'supervisor-process.ps1'))
 $literal=[regex]::Match($source,"(?s)Add-Type -WarningAction SilentlyContinue -TypeDefinition @'\r?\n(?<code>.*?)\r?\n'@")
 if(-not $literal.Success){throw 'SOURCE_REFUSED'}
 Add-Type -TypeDefinition $literal.Groups['code'].Value -WarningAction SilentlyContinue
 . (Join-Path $PSScriptRoot 'supervisor-input.ps1')
 $node='C:\Program Files\nodejs\node.exe'
 $job=[QaOwnedJob]::new($ParentPid,$node)
 $null=$job.Launch('app',$node,[string[]]@((Join-Path $PSScriptRoot 'supervisor-fake-child.mjs')),$PSScriptRoot,[string[]]@('SystemRoot=C:\Windows','WINDIR=C:\Windows'))
 [Console]::Out.WriteLine('{"status":"READY"}')
 $deadline=[DateTimeOffset]::UtcNow.AddSeconds(20);$read=[QaAsyncConsoleInput]::ReadLine();$stop=$false
 while($job.ParentAlive() -and [DateTimeOffset]::UtcNow -lt $deadline){
  if(-not $read.Wait(100)){continue}
  $line=$read.Result
  if($null -eq $line -or $line.Length -gt 4096){break}
  $command=$line|ConvertFrom-Json -DateKind String
  if(@($command.PSObject.Properties).Count -ne 1 -or $command.command -cne 'stop'){throw 'COMMAND_REFUSED'}
  $stop=$true;break
 }
 if(-not $job.StopAll()){throw 'STOP_REFUSED'}
 $job.Dispose();$job=$null
 if(-not $stop){throw 'STOP_NOT_REQUESTED'}
 [Console]::Out.WriteLine('{"status":"STOPPED"}');[Console]::Out.Flush()
}catch{[Console]::Out.WriteLine('{"status":"BLOCKED","stage":"stop"}');exit 1}
finally{if($job){try{$null=$job.StopAll()}finally{$job.Dispose()}}}
