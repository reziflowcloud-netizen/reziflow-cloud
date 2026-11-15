$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'TEST_HOST_REFUSED'}
 $tokens=$null;$errors=$null
 $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'supervisor-process.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'TEST_SYNTAX_REFUSED'}
 $parse=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -ceq '$command'},$true))
 $pairLoop=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.ForEachStatementAst] -and $n.Condition.Extent.Text -ceq '$command.env.PSObject.Properties'},$true))
 if($parse.Count -ne 1 -or $pairLoop.Count -ne 1){throw 'TEST_SOURCE_REFUSED'}
 $iso='2026-11-10T19:00:00.123Z'
 $line='{"command":"launch","enabled":true,"env":{"META_LEAD_ADS_ACTIVATED_AT":"'+$iso+'","META_LEAD_ADS_ENABLED":"true","META_LEAD_ADS_WORKER_ENABLED":"true"}}'
 $legacy=$line|ConvertFrom-Json
 if($legacy.env.META_LEAD_ADS_ACTIVATED_AT -isnot [DateTime] -or [string]$legacy.env.META_LEAD_ADS_ACTIVATED_AT -ceq $iso){throw 'TEST_LEGACY_DEFECT_NOT_REPRODUCED'}
 . ([scriptblock]::Create($parse[0].Extent.Text))
 if($command.enabled -isnot [bool] -or $command.env.META_LEAD_ADS_ACTIVATED_AT -isnot [string] -or $command.env.META_LEAD_ADS_ACTIVATED_AT -cne $iso){throw 'TEST_ISO_CHANGED'}
 $allowed=@('META_LEAD_ADS_ACTIVATED_AT','META_LEAD_ADS_ENABLED','META_LEAD_ADS_WORKER_ENABLED')
 $pairs=[Collections.Generic.List[string]]::new()
 . ([scriptblock]::Create($pairLoop[0].Extent.Text))
 if($pairs.Count -ne 3 -or ('META_LEAD_ADS_ACTIVATED_AT='+$iso) -cnotin $pairs -or 'META_LEAD_ADS_ENABLED=true' -cnotin $pairs){throw 'TEST_PAIR_CHANGED'}
 $checks=3
 foreach($value in @($true,42,$null)){
  $command.env.META_LEAD_ADS_ENABLED=$value;$pairs=[Collections.Generic.List[string]]::new();$blocked=$false
  try{. ([scriptblock]::Create($pairLoop[0].Extent.Text))}catch{$blocked=$true}
  if(-not $blocked){throw 'TEST_NON_STRING_ACCEPTED'};$checks++
 }
 Write-Output ('QA_COMMAND_JSON_PASS: '+$checks+' pure checks; exact ISO and string env preserved; no credentials, processes or services')
}catch{Write-Output 'QA_COMMAND_JSON_BLOCKED';exit 1}
