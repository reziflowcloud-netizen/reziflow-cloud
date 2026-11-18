$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
try{
 $tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'qa-stopped-proof.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'SYNTAX_REFUSED'}
 foreach($name in @('Convert-QaProofUtc','Select-QaEventMetadata','Get-QaProofListeners')){$function=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);. ([scriptblock]::Create($function.Extent.Text))}
 $event=[pscustomobject]@{Id=8004;TimeCreated=[DateTime]::Parse('2026-11-10T14:30:00Z',$null,[Globalization.DateTimeStyles]::RoundtripKind)}
 $event|Add-Member -MemberType ScriptProperty -Name Message -Value {throw 'RAW_MESSAGE_MUST_NOT_BE_READ'}
 $event|Add-Member -MemberType ScriptProperty -Name Properties -Value {throw 'RAW_PROPERTIES_MUST_NOT_BE_READ'}
 $summary=Select-QaEventMetadata $event 'AppLocker'
 if(($summary.PSObject.Properties.Name|Sort-Object) -join ',' -ne 'category,eventID,timeEpochSeconds' -or $summary.eventID -ne 8004 -or $summary.timeEpochSeconds -ne 1794321000){throw 'METADATA_CHANGED'}
 $event.Id=9999;$refused=$false;try{$discard=Select-QaEventMetadata $event 'AppLocker'}catch{$refused=$true};if(-not $refused){throw 'UNKNOWN_EVENT_ACCEPTED'}
 function Get-NetTCPConnection{
  [CmdletBinding()]param([string]$State)
  if($script:queryMode -eq 'no_match'){$PSCmdlet.ThrowTerminatingError([System.Management.Automation.ErrorRecord]::new([Exception]::new('PLANTED_PROVIDER_TEXT'),'CmdletizationQuery_NotFound',[System.Management.Automation.ErrorCategory]::ObjectNotFound,$null))}
  if($script:queryMode -eq 'denied'){$PSCmdlet.ThrowTerminatingError([System.Management.Automation.ErrorRecord]::new([Exception]::new('PLANTED_PROVIDER_TEXT'),'CimAccessDenied',[System.Management.Automation.ErrorCategory]::PermissionDenied,$null))}
  if($script:queryMode -eq 'failure'){$PSCmdlet.ThrowTerminatingError([System.Management.Automation.ErrorRecord]::new([Exception]::new('PLANTED_PROVIDER_TEXT'),'CimQueryFailed',[System.Management.Automation.ErrorCategory]::NotSpecified,$null))}
  if($script:queryMode -eq 'other_not_found'){$PSCmdlet.ThrowTerminatingError([System.Management.Automation.ErrorRecord]::new([Exception]::new('PLANTED_PROVIDER_TEXT'),'ProviderMissing',[System.Management.Automation.ErrorCategory]::ObjectNotFound,$null))}
  return [pscustomobject]@{LocalPort=43126}
 }
 $script:queryMode='no_match';if(@(Get-QaProofListeners).Count -ne 0){throw 'LEGITIMATE_NO_MATCH_REFUSED'}
 foreach($mode in @('denied','failure','other_not_found')){$script:queryMode=$mode;$blocked=$false;try{$discard=Get-QaProofListeners}catch{$blocked=$true};if(-not $blocked){throw 'FAILED_QUERY_TREATED_AS_ABSENCE'}}
 $script:queryMode='success';if(@(Get-QaProofListeners).Count -ne 1){throw 'LISTENER_LOST'}
 Write-Output 'QA_STOPPED_METADATA_UNIT_PASS: UTC/event privacy; exact no-match empty; permission/provider/unknown failures BLOCKED; no real private, inventory, network, process or log query executed'
}catch{Write-Output 'QA_STOPPED_METADATA_UNIT_BLOCKED';exit 1}
