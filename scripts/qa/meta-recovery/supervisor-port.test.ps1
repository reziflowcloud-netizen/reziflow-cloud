$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'TEST_HOST_REFUSED'}
 # Exercise the actual ownership function against synthetic snapshots only.
 # Do not import the guardian entrypoint or call Get-NetTCPConnection.
 $tokens=$null;$errors=$null
 $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'supervisor-process.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'TEST_SYNTAX_REFUSED'}
 $owner=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Assert-QaHttpOwner'},$true)
 if(-not $owner){throw 'TEST_FUNCTION_MISSING'}
 . ([scriptblock]::Create($owner.Extent.Text))
 function Get-QaHttpListeners([int]$Port){return $script:fakeListeners}
 $script:fakeListeners=@()
 if((Assert-QaHttpOwner 43126 42 -AllowAbsent) -ne $false){throw 'ABSENT_NOT_WAITING'}
 $cases=@(
  @(),
  @([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=43}),
  @([pscustomobject]@{LocalAddress='0.0.0.0';OwningProcess=42}),
  @([pscustomobject]@{LocalAddress='::1';OwningProcess=42}),
  @([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=42},[pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=42})
 )
 foreach($case in $cases){$script:fakeListeners=$case;$refused=$false;try{[void](Assert-QaHttpOwner 43126 42)}catch{$refused=$true};if(-not $refused){throw 'FOREIGN_HTTP_ACCEPTED'}}
 $script:fakeListeners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=42})
 if((Assert-QaHttpOwner 43126 42) -ne $true){throw 'OWNED_HTTP_REFUSED'}
 Write-Output 'QA_HTTP_OWNER_TEST_PASS: exact loopback/PID accepted; absent waits; required absent, foreign PID, wildcard, IPv6 and multiple listeners refused; no network or service'
}catch{
 Write-Output 'QA_HTTP_OWNER_TEST_BLOCKED'
 exit 1
}
