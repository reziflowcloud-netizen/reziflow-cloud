$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'TEST_HOST_REFUSED'}
 $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'bootstrap.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'TEST_PARSE_REFUSED'}
 $fn=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Assert-QaEvidenceScope'},$true)
 if(-not $fn){throw 'TEST_FUNCTION_MISSING'};. ([scriptblock]::Create($fn.Extent.Text))
 $checkout='C:\QA-EVIDENCE-FIXTURE\checkout';$checks=0
 foreach($leaf in @('meta-recovery-20261110','meta-recovery-alias-e2e-20261110','meta-recovery-20261115','meta-recovery-final-20261115')){Assert-QaEvidenceScope (Join-Path (Join-Path $checkout '.qa') $leaf) $checkout 'fixture-owner' 'fixture-owner';$checks++}
 foreach($case in @(@{path='C:\';owner='fixture-owner'},@{path=(Join-Path $checkout 'meta-recovery-20261115');owner='fixture-owner'},@{path=(Join-Path (Join-Path $checkout '.qa') 'other');owner='fixture-owner'},@{path=(Join-Path (Join-Path $checkout '.qa') 'meta-recovery-20261115');owner='foreign-owner'})){
  $refused=$false;try{Assert-QaEvidenceScope $case.path $checkout $case.owner 'fixture-owner'}catch{$refused=$true};if(-not $refused){throw 'TEST_FOREIGN_SCOPE_ACCEPTED'};$checks++
 }
 $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'bootstrap.ps1'))
 if($source.IndexOf('Assert-QaEvidenceScope $EvidenceDirectory') -ge $source.IndexOf('Set-PrivateAcl $EvidenceDirectory')){throw 'TEST_MUTATION_ORDER_REFUSED'};$checks++
 Write-Output ('QA_BOOTSTRAP_EVIDENCE_PASS: '+$checks+' pure checks; no ACL mutation, private input, database or services')
}catch{Write-Output 'QA_BOOTSTRAP_EVIDENCE_BLOCKED';exit 1}
