$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'prepare-supervisor.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'CONFIG_SOURCE_SYNTAX'}
$function=$ast.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-QaSupervisorNgrokConfig'},$true)
. ([scriptblock]::Create($function.Extent.Text))
$valid=@('version: "3"','agent:','  authtoken: "PLANTED_PUBLIC_FIXTURE_ONLY_123456789"','  console_ui: false','  inspect_db_size: -1','  web_addr: false','  log: false','  remote_management: false') -join "`n"
$checks=0
foreach($text in @($valid,$valid.Replace("`n","`r`n"))){if(-not(Test-QaSupervisorNgrokConfig $text)){throw 'CONFIG_VALID_REFUSED'};$checks++}
foreach($bad in @('',$valid.Replace('console_ui: false','console_ui: true'),$valid.Replace('inspect_db_size: -1','inspect_db_size: 100'),$valid.Replace('log: false','log: stdout'),$valid.Replace('remote_management: false','remote_management: true'),($valid+"`nother: planted"),$valid.Replace('PLANTED_PUBLIC_FIXTURE_ONLY_123456789',''),($valid+[char]0))){
 if(Test-QaSupervisorNgrokConfig $bad){throw 'CONFIG_INVALID_ACCEPTED'};$checks++
}
[pscustomobject]@{status='PASS';configChecks=$checks;nativeCalls=0;credentialsRead=$false}|ConvertTo-Json -Compress
