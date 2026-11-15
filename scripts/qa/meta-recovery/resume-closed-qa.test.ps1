$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
# Pure function extraction only: never invoke the resume entry point or OS/DB calls.
$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'resume-closed-qa.ps1'),[ref]$tokens,[ref]$errors);if($errors.Count){throw 'CLOSED_SOURCE_SYNTAX'}
foreach($name in @('Convert-QaClosedResumeUtc','Assert-QaClosedResumeState','Assert-QaClosedQueryOutput','Assert-QaClosedGitResolution')){$fn=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true);if(-not $fn){throw 'CLOSED_TEST_FUNCTION_MISSING'};. ([scriptblock]::Create($fn.Extent.Text))}
$t0='2026-11-10T12:00:00.000Z';$now=[DateTimeOffset]::Parse('2026-11-10T13:00:00.000Z');$checks=0
function New-ClosedFixture{return [pscustomobject]@{runtime=[pscustomobject]@{appId='2523488421395251';approvedMetaAppId='2523488421395251';pageId='1449474971582722';formId='2046130655900851';enabled=$false;workerEnabled=$false;approvedTuples=@();pilotLeadIds=@();cleanupClosedAt=$t0};real=[pscustomobject]@{appId='2523488421395251';pageId='1449474971582722';formId='2046130655900851';release=$false;approvedLeadId=$null;leadCreatedAt=$null;dashboardSample=$null;createAttemptAt=$null;closedAt=$t0;earliestClosedAt=$t0}}}
$f=New-ClosedFixture;$before=$f|ConvertTo-Json -Depth 8 -Compress;$first=Assert-QaClosedResumeState $f.runtime $f.real 0 0 $false $t0 $now;if($first -ne [DateTimeOffset]::Parse($t0) -or ($f|ConvertTo-Json -Depth 8 -Compress) -cne $before){throw 'CLOSED_BASELINE_FAILED'};$checks++
$mutations=@(
 {param($f)$f.runtime.appId='1160353550276176'}, {param($f)$f.runtime.approvedMetaAppId='foreign'}, {param($f)$f.runtime.pageId='foreign'}, {param($f)$f.runtime.formId='foreign'},
 {param($f)$f.real.appId='foreign'}, {param($f)$f.real.pageId='foreign'}, {param($f)$f.real.formId='foreign'},
 {param($f)$f.runtime.enabled=$true}, {param($f)$f.runtime.enabled='false'}, {param($f)$f.runtime.workerEnabled=$true}, {param($f)$f.runtime.workerEnabled=0},
 {param($f)$f.runtime.approvedTuples=@('armed')}, {param($f)$f.runtime.approvedTuples=$null}, {param($f)$f.runtime.pilotLeadIds=@('synthetic-id')},
 {param($f)$f.real.release=$true}, {param($f)$f.real.release='false'}, {param($f)$f.real.approvedLeadId='synthetic-id'}, {param($f)$f.real.leadCreatedAt=$t0},
 {param($f)$f.real.dashboardSample=@{}}, {param($f)$f.real.createAttemptAt=$t0}, {param($f)$f.real.closedAt='bad'},
 {param($f)$f.real.earliestClosedAt='2026-11-09T12:00:00.000Z'}, {param($f)$f.runtime.cleanupClosedAt='2026-11-11T12:00:00.000Z'}
)
foreach($mutate in $mutations){$f=New-ClosedFixture;& $mutate $f;$refused=$false;try{$discard=Assert-QaClosedResumeState $f.runtime $f.real 0 0 $false $t0 $now}catch{$refused=$true};if(-not $refused){throw 'CLOSED_MUTATION_ACCEPTED'};$checks++}
foreach($activity in @(@(1,0,$false),@(0,1,$false),@(0,0,$true),@('0',0,$false),@(0,-1,$false))){$f=New-ClosedFixture;$refused=$false;try{$discard=Assert-QaClosedResumeState $f.runtime $f.real $activity[0] $activity[1] $activity[2] $t0 $now}catch{$refused=$true};if(-not $refused){throw 'CLOSED_ACTIVITY_ACCEPTED'};$checks++}
$f=New-ClosedFixture;$f.real.PSObject.Properties.Remove('createAttemptAt');$discard=Assert-QaClosedResumeState $f.runtime $f.real 0 0 $false $t0 $now;$checks++
Assert-QaClosedQueryOutput @('CLOSED');$checks++
foreach($lines in @(@('BLOCKED'),@('CLOSED','CLOSED'),@(),@('CLOSED','private-fixture'))){$refused=$false;try{Assert-QaClosedQueryOutput $lines}catch{$refused=$true};if(-not $refused){throw 'CLOSED_QUERY_OUTPUT_ACCEPTED'};$checks++}
$official=[pscustomobject]@{Source='C:\Program Files\Git\cmd\git.exe'};$other=[pscustomobject]@{Source='C:\fixture\other\git.exe'}
Assert-QaClosedGitResolution @($official,$other);$checks++
foreach($candidates in @(@($other,$official),@())){$refused=$false;try{Assert-QaClosedGitResolution $candidates}catch{$refused=$true};if(-not $refused){throw 'CLOSED_GIT_PRECEDENCE_ACCEPTED'};$checks++}
[pscustomobject]@{status='PASS';pureChecks=$checks;postgresStarted=$false;privateInputsRead=$false;deletion=$false}|ConvertTo-Json -Compress
