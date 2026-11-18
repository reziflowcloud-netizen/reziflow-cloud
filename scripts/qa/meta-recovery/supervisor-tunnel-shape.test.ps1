param([Parameter(Mandatory=$true)][string]$PointerPath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$stage='guard';$script:nativeBoundaryReached=$false
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $qa=Read-QaGuardedRuntime $PointerPath;$c=$qa.Runtime;$approval=$c.supervisorApproval
 if([Environment]::ProcessPath -ne $c.qaPwshExecutable){throw 'HOST_REFUSED'}
 $tokens=$null;$errors=$null
 $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'supervisor-process.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'SOURCE_REFUSED'}
 $switch=$ast.Find({param($n)$n -is [System.Management.Automation.Language.SwitchStatementAst] -and $n.Clauses.Where({$_.Item1.Value -eq 'launch'}).Count -gt 0},$true)
 $clause=@($switch.Clauses|Where-Object{$_.Item1.Value -eq 'launch'})
 if($clause.Count -ne 1){throw 'SOURCE_REFUSED'}
 $body=$clause[0].Item2.Extent.Text
 $body=$body.Substring(1,$body.Length-2)
 # Test-only synthetic owner snapshot. This helper never establishes real
 # listener ownership and cannot launch: the fake Job throws at native boundary.
 function Assert-QaHttpOwner([int]$Port,[int]$ExpectedPid){return $true}
 $ParentPid=1
 $environment=[ordered]@{SystemRoot='C:\Windows';WINDIR='C:\Windows';PATH='C:\Windows\System32;C:\Program Files\nodejs';TEMP=$c.privateDirectory;TMP=$c.privateDirectory;USERPROFILE=$c.privateDirectory;APPDATA=$c.privateDirectory;LOCALAPPDATA=$c.privateDirectory}
 $command=[pscustomobject]@{command='launch';kind='tunnel';enabled=$false;exe=$c.ngrokExe;args=@('http',('http://127.0.0.1:'+$c.gatePort),'--url',('https://'+$c.hostname),'--inspect=false','--config',(Join-Path $c.privateDirectory 'ngrok.yml'));env=$environment}|ConvertTo-Json -Depth 10|ConvertFrom-Json
 $job=[pscustomobject]@{}
 $job|Add-Member -MemberType ScriptMethod -Name Launch -Value {$script:nativeBoundaryReached=$true;throw 'TEST_NATIVE_BOUNDARY_ONLY'}
 try{. ([scriptblock]::Create($body))}catch{if(-not $script:nativeBoundaryReached){throw 'VALIDATION_REFUSED'}}
 if(-not $script:nativeBoundaryReached){throw 'BOUNDARY_NOT_REACHED'}
 Write-Output '{"status":"PASS","stage":"tunnel_shape_only","nativeLaunch":false,"ownerEvaluated":false,"tunnelStarted":false}'
}catch{
 $allowed=@('guard','health','tunnel_owner','tunnel_executable','tunnel_config','tunnel_env','tunnel_args','tunnel_native')
 $safeStage=if($stage -in $allowed){$stage}else{'shape_probe'}
 [pscustomobject]@{status='BLOCKED';stage=$safeStage;nativeLaunch=$false;ownerEvaluated=$false;tunnelStarted=$false}|ConvertTo-Json -Compress
 exit 1
}
