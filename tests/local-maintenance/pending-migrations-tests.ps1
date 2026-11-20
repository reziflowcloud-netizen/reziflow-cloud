#requires -Version 7
# Real Runner functions and assignment, without dispatching Apply or connecting.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
. (Join-Path $repo 'scripts/local-maintenance/plan.ps1')
. (Join-Path $PSScriptRoot 'report-functions.ps1')
$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repo 'scripts/local-maintenance/runner.ps1'),[ref]$null,[ref]$errors)
if($errors.Count){throw 'PENDING_TEST_PARSE_FAILED'}
foreach($name in @('Get-Expected','Assert-StateEqualsPlan')){
  $definition=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$false))
  if($definition.Count -ne 1){throw 'PENDING_TEST_FUNCTION_AMBIGUOUS'}
  . ([scriptblock]::Create($definition[0].Extent.Text))
}
$assignment=@($ast.FindAll({param($node)
  $node -is [Management.Automation.Language.AssignmentStatementAst] -and
  $node.Extent.Text -match '\$expected\s*=\s*.*Get-Expected'
},$true))
if($assignment.Count -ne 1){throw 'PENDING_TEST_ASSIGNMENT_AMBIGUOUS'}
$passed=0
function Assert-Test([bool]$Value,[string]$Name){
  if(-not $Value){throw "PENDING_TEST_FAILED:$Name"}
  $script:passed++;Write-Output "PASS $Name"
}
function Expect-Block([scriptblock]$Action,[string]$Code){
  try{& $Action|Out-Null}catch{
    if($_.Exception.Message -cne ('LMR:'+$Code)){throw}
    Assert-Test $true ("blocked "+$Code);return
  }
  throw "PENDING_EXPECTED_BLOCK:$Code"
}
$names=[string[]]@('20261119170000_stripe_billing_test_mvp','20261119190000_stripe_billing_operations','20261120120000_stripe_billing_scheduled_cancel','20261120121000_stripe_billing_cancel_boundary')
$hash='a'*64
$files=@('20260101000000_baseline')+@($names)|ForEach-Object {
  [pscustomobject]@{Name=$_;AllowedAppliedSha256=@($hash);PendingExecutableSafe=$true}
}
function New-Ledger([string[]]$Pending){
  return @($files|Where-Object Name -notin $Pending|ForEach-Object {
    [pscustomobject]@{name=$_.Name;checksum=$hash;applied=$true;failed=$false}
  })
}
$base=Join-Path $env:LOCALAPPDATA 'LegalHubPendingMigrationTests'
if(-not(Test-Path $base)){[void](New-Item -ItemType Directory -Path $base);Set-PrivateAcl $base}
Assert-PrivateAcl $base;Assert-NotReparsePoint $base
$id=[guid]::NewGuid().ToString('N').Substring(0,12)
$root=Assert-ChildPath $base (Join-Path $base $id)
[void](New-Item -ItemType Directory -Path $root);Set-PrivateAcl $root
$marker=Join-Path $root 'pending-test-owned.txt';[IO.File]::WriteAllText($marker,$id);Set-PrivateAcl $marker
$config=[pscustomobject]@{privateDirectory=$root}
try{
  [void](Compare-MigrationLedger $files (New-Ledger @()) @())
  Assert-Test $true 'zero pending exact ledger (NoMigration path is covered by full-preflight)'
  Expect-Block {Get-Expected @()} 'EXPECTED_MIGRATIONS_REQUIRED'
  foreach($count in @(1,2,4)){
    $ExpectedMigrations=[string[]]@($names|Select-Object -First $count)
    # Execute the exact typed assignment from Invoke-Preflight, not a copied fix.
    . ([scriptblock]::Create($assignment[0].Extent.Text))
    Assert-Test ($expected -is [string[]] -and $expected.Count -eq $count -and
      @($expected|Where-Object {$_ -isnot [string]}).Count -eq 0) "actual Runner assignment has $count scalar strings"
    $state=Compare-MigrationLedger $files (New-Ledger $ExpectedMigrations) $expected
    Assert-Test (($state.Pending -join '|') -ceq ($ExpectedMigrations -join '|')) "exact $count pending preserved"
  }
  Expect-Block {Get-Expected @($names[0],$names[0])} 'EXPECTED_MIGRATIONS_DUPLICATE_OR_EMPTY'
  Expect-Block {Get-Expected @($names[0],'')} 'EXPECTED_MIGRATIONS_DUPLICATE_OR_EMPTY'
  Expect-Block {Get-Expected @('not_a_migration')} 'EXPECTED_MIGRATION_NAME_INVALID'
  Expect-Block {Get-Expected @($names[1],$names[0])} 'EXPECTED_MIGRATIONS_ORDER_INVALID'
  Expect-Block {Compare-MigrationLedger $files (New-Ledger $names) @($names|Select-Object -First 3)} 'PENDING_SET_MISMATCH'
  Expect-Block {Compare-MigrationLedger $files (New-Ledger @($names|Select-Object -First 3)) $names} 'PENDING_SET_MISMATCH'
  $bad=New-Ledger $names;$bad[0].checksum='b'*64
  Expect-Block {Compare-MigrationLedger $files $bad $names} 'APPLIED_CHECKSUM_MISMATCH'
  $bad=New-Ledger $names;$bad[0].failed=$true
  Expect-Block {Compare-MigrationLedger $files $bad $names} 'FAILED_MIGRATION'
  $bad=New-Ledger $names;$bad[0].applied=$false
  Expect-Block {Compare-MigrationLedger $files $bad $names} 'UNFINISHED_MIGRATION'
  $bad=New-Ledger $names
  Expect-Block {Compare-MigrationLedger $files @($bad[0],$bad[0]) $names} 'DUPLICATE_LEDGER_ROW'
  $plan=[ordered]@{version=1;runId=$id;createdUtc=[DateTime]::UtcNow.ToString('o');
    approvedCommit=('1'*40);pending=$names;appliedCount=1;targetFingerprint='synthetic';applicationRole='synthetic';
    migrations=@($names|ForEach-Object {[ordered]@{name=$_;sha256=$hash}});
    restore='PASS';localMigration='PASS';structure='PASS';sequencePermissions='PASS';oldAppNewDb='PASS_SCHEMA_ONLY'}
  $path=Save-SealedPlan $config $plan
  $read=Read-SealedPlan $config $path
  Assert-Test (@($read.pending).Count -eq 4 -and (@($read.pending)-join '|') -ceq ($names -join '|') -and
    @($read.pending|Where-Object {$_ -isnot [string]}).Count -eq 0) 'sealed plan preserves four distinct approved names'
  $reportPath=Write-Report $config $read 'PREFLIGHT_ONLY'
  $report=Get-Content -LiteralPath $reportPath -Raw|ConvertFrom-Json
  Assert-Test (@($report.plannedPending).Count -eq 4 -and ($report.plannedPending -join '|') -ceq ($names -join '|')) 'report preserves exact four pending names'
  function New-State {
    return [pscustomobject]@{fingerprint='synthetic';applicationRole='synthetic';
      ledger=[pscustomobject]@{AppliedCount=1;Pending=$names};
      audits=@($names|ForEach-Object {[pscustomobject]@{name=$_;sha256=$hash}})}
  }
  Assert-StateEqualsPlan (New-State) $read
  Assert-Test $true 'unchanged state passes real final Apply recheck helper without invoking Apply'
  $state=New-State;$state.ledger.Pending=@($names|Select-Object -First 3)
  Expect-Block {Assert-StateEqualsPlan $state $read} 'STATE_CHANGED_SINCE_PREFLIGHT'
  $state=New-State;$state.ledger.Pending=@($names)+@('20261121120000_unexpected')
  Expect-Block {Assert-StateEqualsPlan $state $read} 'STATE_CHANGED_SINCE_PREFLIGHT'
  $state=New-State;$state.fingerprint='different target'
  Expect-Block {Assert-StateEqualsPlan $state $read} 'STATE_CHANGED_SINCE_PREFLIGHT'
  $state=New-State;$state.audits[0].sha256='b'*64
  Expect-Block {Assert-StateEqualsPlan $state $read} 'SQL_CHANGED_SINCE_PREFLIGHT'
  $wrapper=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
  $bytes=[Convert]::FromBase64String($wrapper.payload);$bytes[0]=$bytes[0] -bxor 1
  $wrapper.payload=[Convert]::ToBase64String($bytes)
  [IO.File]::WriteAllText($path,($wrapper|ConvertTo-Json -Compress));Assert-PrivateAcl $path
  Expect-Block {Read-SealedPlan $config $path} 'PLAN_SEAL_MISMATCH'
  Write-Output "PENDING_MIGRATION_TEST_PASS count=$passed"
}finally{
  [void](Assert-ChildPath $base $root);Assert-NotReparsePoint $root
  if([IO.File]::ReadAllText($marker) -cne $id){throw 'PENDING_CLEANUP_MARKER_MISMATCH'}
  foreach($file in Get-ChildItem -LiteralPath $root -Recurse -Force){Assert-NotReparsePoint $file.FullName}
  Remove-Item -LiteralPath $root -Recurse -Force
}
