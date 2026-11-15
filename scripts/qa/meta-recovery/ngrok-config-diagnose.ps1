param([Parameter(Mandatory=$true)][string]$PointerPath)
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
try{
 . (Join-Path $PSScriptRoot 'guard.ps1');$qa=Read-QaGuardedRuntime $PointerPath
 if([Environment]::ProcessPath -cne $qa.Runtime.qaPwshExecutable -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 $path=Join-Path $qa.Runtime.privateDirectory 'ngrok.yml';Assert-QaPrivateAcl $path
 if((Get-Item -LiteralPath $path).Length -gt 8192){throw 'CONFIG_SIZE_REFUSED'}
 $text=[IO.File]::ReadAllText($path).Replace("`r",'').Trim();$lines=@($text.Split("`n"))
 $quoted=$false;$bare=$false;$fixed=$false
 if($lines.Count -eq 8){
  $quoted=$lines[2] -cmatch '^  authtoken: "[A-Za-z0-9_-]{20,512}"$'
  $bare=$lines[2] -cmatch '^\s*authtoken:\s*[A-Za-z0-9_-]{20,512}\s*$'
  $fixed=($lines[3..7] -join "`n") -ceq (@('  console_ui: false','  inspect_db_size: -1','  web_addr: false','  log: false','  remote_management: false') -join "`n")
 }
 [pscustomobject]@{status='READ_ONLY_COMPLETE';lineCount=[Math]::Min($lines.Count,100);versionCorrect=($lines[0] -ceq 'version: "3"');agentCorrect=($lines.Count -gt 1 -and $lines[1] -ceq 'agent:');credentialQuotedFormat=$quoted;credentialBareFormat=$bare;fixedFlagsCorrect=$fixed;credentialsPrinted=$false;ngrokCalls=0}|ConvertTo-Json -Compress
}catch{Write-Output 'QA_CONFIG_METADATA_BLOCKED';exit 1}
