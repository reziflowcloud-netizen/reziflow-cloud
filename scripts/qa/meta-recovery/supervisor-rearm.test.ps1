$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 $tokens=$null;$errors=$null
 $ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'prepare-supervisor.ps1'),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'SYNTAX_REFUSED'}
 $function=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Assert-QaClosedRearm'},$true)
 if(-not $function){throw 'FUNCTION_MISSING'}
 . ([scriptblock]::Create($function.Extent.Text))
 $runtime=[pscustomobject]@{appId='2523488421395251';approvedMetaAppId='2523488421395251';pageId='1449474971582722';formId='2046130655900851';enabled=$false;workerEnabled=$false;approvedTuples=@();pilotLeadIds=@()}
 $real=[pscustomobject]@{appId=$runtime.appId;pageId=$runtime.pageId;formId=$runtime.formId;release=$false;approvedLeadId=$null;leadCreatedAt=$null;dashboardSample=$null;closedAt=[DateTimeOffset]::UtcNow.AddMinutes(-5).ToString('o');earliestClosedAt=[DateTimeOffset]::UtcNow.AddMinutes(-10).UtcDateTime}
 Assert-QaClosedRearm $runtime $real 0 0 0
 $mutations=@(@{Target='counts';Value=@(1,0,0)},@{Target='counts';Value=@(0,1,0)},@{Target='counts';Value=@(0,0,1)},@{Target='runtime';Key='enabled';Value=$true},@{Target='runtime';Key='workerEnabled';Value='false'},@{Target='runtime';Key='approvedTuples';Value=@('tuple')},@{Target='runtime';Key='appId';Value='1160353550276176'},@{Target='real';Key='release';Value='false'},@{Target='real';Key='approvedLeadId';Value='900000000000001'},@{Target='real';Key='dashboardSample';Value=@{}},@{Target='real';Key='closedAt';Value=$null},@{Target='real';Key='closedAt';Value=[DateTimeOffset]::UtcNow.AddMinutes(5).ToString('o')})
 foreach($mutation in $mutations){$c=$runtime.PSObject.Copy();$r=$real.PSObject.Copy();$counts=@(0,0,0);if($mutation.Target -eq 'counts'){$counts=$mutation.Value}elseif($mutation.Target -eq 'runtime'){$c.($mutation.Key)=$mutation.Value}else{$r.($mutation.Key)=$mutation.Value};$refused=$false;try{Assert-QaClosedRearm $c $r $counts[0] $counts[1] $counts[2]}catch{$refused=$true};if(-not $refused){throw 'UNSAFE_REARM_ACCEPTED'}}
 $deletes=$ast.FindAll({param($n)$n -is [System.Management.Automation.Language.CommandAst] -and $n.GetCommandName() -eq 'Remove-Item'},$true)
 if($deletes.Count -ne 1 -or $deletes[0].Extent.Text -notmatch '^-?Remove-Item -LiteralPath \$stopPath -Force -ErrorAction Stop$' -or $deletes[0].Extent.Text -match 'Recurse|\*'){throw 'DELETE_SCOPE_CHANGED'}
 $processFunction=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-QaOwnedLaunchProcesses'},$true)
 . ([scriptblock]::Create($processFunction.Extent.Text))
 if(@(Get-QaOwnedLaunchProcesses 'D:\LegalHubStageA-00000000000000000000000000000000' 'C:\QA-REARM-FIXTURE\private-pointer.json').Count){throw 'PROCESS_FIXTURE_NOT_EMPTY'}
 Write-Output 'QA_REARM_TEST_PASS: only closed exact QA evidence accepted; 12 unsafe cases refused; deletion statically limited to sole STOP marker; no deletion or services executed'
}catch{Write-Output 'QA_REARM_TEST_BLOCKED';exit 1}
