$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'TEST_HOST_REFUSED'}
 $tokens=$null;$errors=$null
 $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'supervisor-ngrok-version.test.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'TEST_SOURCE_SYNTAX_REFUSED'}
 $function=$ast.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-QaVersionChildEnvironmentPairs'},$true)
 if(-not $function){throw 'TEST_FUNCTION_MISSING'}
 . ([scriptblock]::Create($function.Extent.Text))
 $scratch='C:\QA-ENV-FIXTURE'
 # Reproduce the original expression only as strings: never use it to launch.
 $legacy=[string[]]@('APPDATA='+$scratch,'LOCALAPPDATA='+$scratch,'PATH=C:\Windows\System32;C:\Program Files\nodejs','SystemRoot=C:\Windows','TEMP='+$scratch,'TMP='+$scratch,'USERPROFILE='+$scratch,'WINDIR=C:\Windows')
 if($legacy.Count -ne 1 -or [regex]::Matches($legacy[0],'=').Count -ne 8){throw 'TEST_LEGACY_BUG_NOT_REPRODUCED'}
 $pairs=Get-QaVersionChildEnvironmentPairs $scratch
 if($pairs -isnot [string[]] -or $pairs.Count -ne 8){throw 'TEST_FIXED_COUNT_REFUSED'}
 $expected=[ordered]@{APPDATA=$scratch;LOCALAPPDATA=$scratch;PATH='C:\Windows\System32;C:\Program Files\nodejs';SystemRoot='C:\Windows';TEMP=$scratch;TMP=$scratch;USERPROFILE=$scratch;WINDIR='C:\Windows'}
 $seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
 foreach($pair in $pairs){$split=$pair.IndexOf('=');if($split -le 0){throw 'TEST_ENTRY_MALFORMED'};$name=$pair.Substring(0,$split);if(-not $seen.Add($name) -or -not $expected.Contains($name) -or $pair.Substring($split+1) -cne $expected[$name]){throw 'TEST_BINDING_WRONG'}}
 if($seen.Count -ne 8 -or $seen.Contains('NODE_OPTIONS') -or $seen.Contains('HTTP_PROXY')){throw 'TEST_NAMES_WRONG'}
 [string[]]$sorted=$pairs.Clone();[Array]::Sort($sorted,[StringComparer]::OrdinalIgnoreCase)
 if(($pairs -join "`0") -cne ($sorted -join "`0")){throw 'TEST_SORT_WRONG'}
 foreach($bad in @('', 'relative', "C:\QA`nBAD", 'C:\QA\..\ENV')){$refused=$false;try{$discard=Get-QaVersionChildEnvironmentPairs $bad}catch{$refused=$true};if(-not $refused){throw 'TEST_UNSAFE_SCRATCH_ACCEPTED'}}
 Write-Output 'QA_VERSION_ENV_UNIT_PASS: legacy one-entry bug reproduced; fixed string[8], exact unique names/bindings and sort verified; no OS queries, private inputs or process launch'
}catch{Write-Output 'QA_VERSION_ENV_UNIT_BLOCKED';exit 1}
