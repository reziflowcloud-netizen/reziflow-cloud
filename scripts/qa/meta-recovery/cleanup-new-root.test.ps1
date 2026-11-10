$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$stage='parse'
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'TEST_HOST_REFUSED'}
 $tokens=$null;$errors=$null
 $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'cleanup-new-root.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'TEST_SYNTAX_REFUSED'}
 foreach($name in @('Assert-QaCleanupScope','Get-QaCleanupHash','Convert-QaCleanupTime','Get-QaCleanupExemptPids','Get-QaCleanupQuiet')){$fn=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(-not $fn){throw 'TEST_FUNCTION_MISSING'};. ([scriptblock]::Create($fn.Extent.Text))}
 $stage='scope';$target='D:\LegalHubStageA-'+('0'*32);$source='C:\QA-CLEANUP-FIXTURE\combined-source'
 $stage='scope-valid';Assert-QaCleanupScope $target $target $source
 $checks=1
 $scopeCases=@(@{Expected='D:\';Actual=$target;Source=$source},@{Expected=$target;Actual=($target+'-different');Source=$source},@{Expected=$target;Actual=$target;Source=$target},@{Expected=$target;Actual=$target;Source=($target+'\combined-source')},@{Expected=($target+'\..');Actual=$target;Source=$source})
 foreach($case in $scopeCases){$stage='scope-negative-'+$checks;$blocked=$false;try{Assert-QaCleanupScope $case.Expected $case.Actual $case.Source}catch{$blocked=$true};if(-not $blocked){throw 'TEST_SCOPE_ACCEPTED'};$checks++}
 $stage='hash';$rows=@([pscustomobject]@{relativePath='fixture.txt';directory=$false;length=10;creationTicks=1;writeTicks=2;attributes=32})
 $hash=Get-QaCleanupHash $rows;if($hash -notmatch '^[a-f0-9]{64}$' -or $hash -ne (Get-QaCleanupHash $rows)){throw 'TEST_HASH_UNSTABLE'}
 $rows[0].length=11;if($hash -eq (Get-QaCleanupHash $rows)){throw 'TEST_METADATA_CHANGE_MISSED'};$checks+=2
 $stage='time';$time=Convert-QaCleanupTime '2026-11-10T15:00:00+01:00';if($time.ToUnixTimeSeconds() -ne ([DateTimeOffset]::Parse('2026-11-10T14:00:00Z')).ToUnixTimeSeconds()){throw 'TEST_TIME_SHIFTED'};$checks++
 $blocked=$false;try{$discard=Convert-QaCleanupTime ([DateTime]::SpecifyKind([DateTime]::Now,[DateTimeKind]::Unspecified))}catch{$blocked=$true};if(-not $blocked){throw 'TEST_TIME_AMBIGUOUS'};$checks++
 $stage='caller-proof';$exe='C:\QA-CLEANUP-FIXTURE\pwsh.exe';$helper='C:\QA-CLEANUP-FIXTURE\cleanup-new-root.ps1';$pointer='C:\QA-CLEANUP-FIXTURE\private-pointer.json'
 $selfMeta=[pscustomobject]@{ProcessId=42;ParentProcessId=43;ExecutablePath=$exe;OwnerSid='fixture-owner';CreationDate=[DateTimeOffset]::Parse('2026-11-10T14:00:00Z')}
 $parentMeta=[pscustomobject]@{ProcessId=43;ExecutablePath=$exe;OwnerSid='fixture-owner';CreationDate=[DateTimeOffset]::Parse('2026-11-10T13:59:00Z');CommandLine=($helper+' '+$target+' '+$pointer)}
 $allowed=@(Get-QaCleanupExemptPids $selfMeta $parentMeta $exe 'fixture-owner' $helper $target $pointer 42)
 if($allowed.Count -ne 2 -or 42 -notin $allowed -or 43 -notin $allowed -or 44 -in $allowed){throw 'TEST_CALLER_EXCEPTION_SCOPE'};$checks++
 foreach($delta in @(@{Key='ProcessId';Value=44},@{Key='OwnerSid';Value='other-owner'},@{Key='ExecutablePath';Value='C:\other\pwsh.exe'},@{Key='CreationDate';Value=[DateTimeOffset]::Parse('2026-11-10T14:01:00Z')},@{Key='CommandLine';Value='unrelated cleanup-new-root.ps1'})){$p=$parentMeta.PSObject.Copy();$p.($delta.Key)=$delta.Value;$allowed=@(Get-QaCleanupExemptPids $selfMeta $p $exe 'fixture-owner' $helper $target $pointer 42);if($allowed.Count -ne 1 -or $allowed[0] -ne 42){throw 'TEST_FOREIGN_CALLER_EXEMPTED'};$checks++}
 # Pure provider substitutes: these tests never call a process/port provider.
 $stage='providers';$script:portFailure=$false;$script:fakePorts=@([pscustomobject]@{LocalPort=135});$script:fakeProcesses=@();$script:fakePid=$false
 function Get-NetTCPConnection{param($State,$ErrorAction)if($script:portFailure){throw 'PLANTED_PROVIDER_DENIAL'};return $script:fakePorts}
 $script:fakeSelf=[pscustomobject]@{ProcessId=$PID;ParentProcessId=900000;ExecutablePath=[Environment]::ProcessPath;CreationDate=[DateTimeOffset]::Parse('2026-11-10T14:00:00Z')}
 function Get-CimInstance{param($ClassName,$Property,$Filter,$ErrorAction)if($Filter -eq ('ProcessId='+$PID)){return $script:fakeSelf};if($Filter -eq 'ProcessId=900000'){return $null};return $script:fakeProcesses}
 function Invoke-CimMethod{param($InputObject,$MethodName,$ErrorAction,$WhatIf)if($WhatIf -ne $false -or $MethodName -ne 'GetOwnerSid'){throw 'TEST_READ_ONLY_OWNER_QUERY_CHANGED'};return [pscustomobject]@{ReturnValue=0;Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value}}
 function Test-Path{param($LiteralPath,$ErrorAction)return $script:fakePid}
 $qa=[pscustomobject]@{Runtime=[pscustomobject]@{privateDirectory=$target;qaPwshExecutable=[Environment]::ProcessPath};State=[pscustomobject]@{cluster=[pscustomobject]@{Port=55123;Cluster=$target+'\isolated\fixture\cluster'}}}
 $stage='providers-baseline';Get-QaCleanupQuiet $qa 'C:\QA-CLEANUP-FIXTURE\private-pointer.json' $helper;$checks++
 foreach($port in @(43126,43127,55123)){$script:fakePorts=@([pscustomobject]@{LocalPort=$port});$blocked=$false;try{Get-QaCleanupQuiet $qa 'C:\QA-CLEANUP-FIXTURE\private-pointer.json' $helper}catch{$blocked=$true};if(-not $blocked){throw 'TEST_OPEN_PORT_ACCEPTED'};$checks++}
 $script:fakePorts=@();$script:portFailure=$true;$blocked=$false;try{Get-QaCleanupQuiet $qa 'C:\QA-CLEANUP-FIXTURE\private-pointer.json' $helper}catch{$blocked=$true};if(-not $blocked){throw 'TEST_QUERY_DENIAL_BECAME_EMPTY'};$checks++
 $script:portFailure=$false;$script:fakeProcesses=@([pscustomobject]@{ProcessId=42;Name='node.exe'});$blocked=$false;try{Get-QaCleanupQuiet $qa 'C:\QA-CLEANUP-FIXTURE\private-pointer.json' $helper}catch{$blocked=$true};if(-not $blocked){throw 'TEST_PROCESS_ACCEPTED'};$checks++
 $script:fakeProcesses=@();$script:fakePid=$true;$blocked=$false;try{Get-QaCleanupQuiet $qa 'C:\QA-CLEANUP-FIXTURE\private-pointer.json' $helper}catch{$blocked=$true};if(-not $blocked){throw 'TEST_PID_FILE_ACCEPTED'};$checks++
 $stage='delete-scope';$deletes=$ast.FindAll({param($n)$n -is [Management.Automation.Language.CommandAst] -and $n.GetCommandName() -eq 'Remove-Item'},$true)
 if($deletes.Count -ne 2){throw 'TEST_DELETE_COUNT_CHANGED'}
 foreach($delete in $deletes){if($delete.Extent.Text -notmatch '^Remove-Item -LiteralPath \$ExpectedPrivateRoot -Recurse -Force ' -or $delete.Extent.Text -match 'Wildcard|\*|\$manifest|\$Pointer'){throw 'TEST_DELETE_SCOPE_CHANGED'}}
 if($deletes[0].Extent.Text -notmatch '-WhatIf$' -or $deletes[1].Extent.Text -notmatch '-ErrorAction Stop$'){throw 'TEST_DELETE_MODES_CHANGED'};$checks++
 Write-Output ('QA_NEW_ROOT_CLEANUP_UNIT_PASS: '+$checks+' pure checks; no target inventory, private input, provider query or deletion executed')
}catch{Write-Output ('QA_NEW_ROOT_CLEANUP_UNIT_BLOCKED: '+$stage);exit 1}
