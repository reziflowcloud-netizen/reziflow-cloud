param([Parameter(Mandatory=$true)][string]$PointerPath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$job=$null;$stage='guard';$childCode=$null
function Get-QaVersionChildEnvironmentPairs([string]$Scratch){
 if($Scratch -notmatch '^[A-Za-z]:\\' -or $Scratch -match "[`r`n`0]" -or [IO.Path]::GetFullPath($Scratch) -cne $Scratch){throw 'VERSION_ENV_SCRATCH_REFUSED'}
 $expected=[ordered]@{APPDATA=$Scratch;LOCALAPPDATA=$Scratch;PATH='C:\Windows\System32;C:\Program Files\nodejs';SystemRoot='C:\Windows';TEMP=$Scratch;TMP=$Scratch;USERPROFILE=$Scratch;WINDIR='C:\Windows'}
 $entries=[Collections.Generic.List[string]]::new()
 foreach($entry in $expected.GetEnumerator()){$entries.Add(($entry.Key+'='+$entry.Value))}
 [string[]]$pairs=$entries.ToArray();[Array]::Sort($pairs,[StringComparer]::OrdinalIgnoreCase)
 if($pairs.Count -ne 8){throw 'VERSION_ENV_COUNT_REFUSED'}
 $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
 foreach($pair in $pairs){$split=$pair.IndexOf('=');if($split -le 0){throw 'VERSION_ENV_ENTRY_REFUSED'};$name=$pair.Substring(0,$split);$value=$pair.Substring($split+1);if(-not $expected.Contains($name) -or -not $seen.Add($name) -or $value -cne $expected[$name]){throw 'VERSION_ENV_BINDING_REFUSED'}}
 if($seen.Count -ne 8){throw 'VERSION_ENV_NAMES_REFUSED'}
 return ,$pairs
}
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $qa=Read-QaGuardedRuntime $PointerPath;$c=$qa.Runtime
 if([Environment]::ProcessPath -ne $c.qaPwshExecutable){throw 'HOST_REFUSED'}
 $exe='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe'
 $stage='executable';Assert-QaNoReparse $exe
 if((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne '6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16'){throw 'HASH_REFUSED'}
 # The local-only version subcommand receives no config path or credential.
 # Refuse potential default config locations rather than read their contents.
 $stage='default_config_absence'
 foreach($leaf in @('ngrok\ngrok.yml','.ngrok2\ngrok.yml','.config\ngrok\ngrok.yml')){if(Test-Path -LiteralPath (Join-Path $c.privateDirectory $leaf)){throw 'DEFAULT_CONFIG_PRESENT'}}
 $source=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'supervisor-process.ps1') -Raw
 $match=[regex]::Match($source,"(?s)Add-Type -WarningAction SilentlyContinue -TypeDefinition @'\r?\n(?<code>.*?)\r?\n'@")
 if(-not $match.Success){throw 'SOURCE_REFUSED'}
 $stage='compile';Add-Type -TypeDefinition $match.Groups['code'].Value -WarningAction SilentlyContinue
 $pairs=Get-QaVersionChildEnvironmentPairs $c.privateDirectory
 $stage='job';$job=[QaOwnedJob]::new($PID,[Environment]::ProcessPath)
 $stage='dummy_child';$discard=$job.Launch('app','C:\Program Files\nodejs\node.exe',[string[]]@((Join-Path $PSScriptRoot 'supervisor-fake-child.mjs'),'--descendant'),$c.repo,$pairs)
 $stage='launch';$discard=$job.Launch('tunnel',$exe,[string[]]@('version'),$c.repo,$pairs)
 $stage='exit'
 for($attempt=0;$attempt -lt 100 -and $job.ChildAlive('tunnel');$attempt++){Start-Sleep -Milliseconds 100}
 if($job.ChildAlive('tunnel')){throw 'VERSION_TIMEOUT'}
 $childCode=$job.ChildExitCode('tunnel')
 if($childCode -ne 0){throw 'VERSION_FAILED'}
 $stage='stop';if(-not $job.StopAll()){throw 'STOP_UNVERIFIED'}
 Write-Output '{"status":"PASS","stage":"ngrok_version_job","childExitCode":0,"existingDummyJobChild":true,"tunnelStarted":false,"credentialFilesOpened":false,"credentialEnvironmentPassed":false}'
}catch{
 $safe=[ordered]@{status='BLOCKED';stage=$stage;tunnelStarted=$false}
 if($null -ne ('QaOwnedJob' -as [type])){if([QaOwnedJob]::LastOperation -in @('configuration','query_time','query_image','open_parent','create_job','job_limits','exit_code','open_nul','attributes_init','attributes_update','create_process','assign_job','resume_thread')){$safe.nativeOperation=[QaOwnedJob]::LastOperation;$safe.nativeCode=[QaOwnedJob]::LastNativeCode}}
 if($null -ne $childCode){$safe.childExitCode=$childCode}
 $safe|ConvertTo-Json -Compress
 exit 1
}finally{if($job){try{[void]$job.StopAll()}finally{$job.Dispose()}}}
