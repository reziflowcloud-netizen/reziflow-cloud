#requires -Version 7
param([switch]$WithPostgres, [string]$PrivateTestRoot, [string]$PostgresBin)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../scripts/local-maintenance/core.ps1')
$passed = 0
function Check([bool]$Value, [string]$Name) {
  if (-not $Value) { throw "LOCK_TEST_FAILED:$Name" }; $script:passed++
}
function Reject([scriptblock]$Action, [string]$Code) {
  try { & $Action | Out-Null }
  catch {
    if ($_.Exception.Message -cne ('LMR:' + $Code)) { throw }
    $script:passed++; return
  }
  throw "LOCK_TEST_EXPECTED_BLOCK:$Code"
}
function New-Sample {
  return [pscustomobject]@{ checkedUtc = [DateTime]::UtcNow.ToString('o')
    database = 'legalhub_runner_locktest'; role = 'restore_admin'; sessionRole = 'restore_admin'
    databaseOid = 12345; clusterIdentity = '1234567890123456789'; serverVersion = '180000'
    backendTls = $false; statsVisible = $true
    waitingRelationLocks = 0; longTransactions = 0; idleTransactions = 0 }
}
$config = [pscustomobject]@{ targetKind = 'synthetic' }
$uri = [Uri]'postgresql://restore_admin:synthetic_only@127.0.0.1:64321/legalhub_runner_locktest'
$originalSampler = (Get-Command Get-LockSafetySnapshot).ScriptBlock
$originalSize = (Get-Command Get-RelationSize).ScriptBlock
$script:sample = New-Sample
$script:sampleCalls = 0; $script:fault = $false; $script:largeIndex = $false
$script:arriveDuringSizeCheck = $false
function Get-LockSafetySnapshot([object]$Config, [Uri]$Uri) {
  $script:sampleCalls++
  if ($script:fault) { Stop-Maintenance 'LOCK_SAFETY_SAMPLE_FAILED' }
  return $script:sample
}
function Get-RelationSize([object]$Config, [Uri]$Uri, [string]$Table) {
  if ($script:arriveDuringSizeCheck) { $script:sample.idleTransactions = 1 }
  if ($script:largeIndex) { return 67108865 }; return 0
}
try {
  $old = New-Sample; $old.idleTransactions = 1
  Assert-LockSafety $config $uri $old @()
  Check ($script:sampleCalls -eq 1) 'one current sample replaces stale positive'
  foreach ($name in @('waitingRelationLocks', 'longTransactions', 'idleTransactions')) {
    $script:sample = New-Sample; $script:sample.$name = 1
    $before = $script:sampleCalls
    Reject { Assert-LockSafety $config $uri (New-Sample) @() } 'DDL_LOCK_RISK'
    Check ($script:sampleCalls -eq ($before + 1)) 'no retry until quiet'
  }
  $script:sample = New-Sample; $script:arriveDuringSizeCheck = $true
  Reject { Assert-LockSafety $config $uri (New-Sample) @('Synthetic') } 'DDL_LOCK_RISK'
  $script:arriveDuringSizeCheck = $false
  $script:sample = New-Sample; $script:largeIndex = $true
  $before = $script:sampleCalls
  Reject { Assert-LockSafety $config $uri (New-Sample) @('Synthetic') } 'DDL_INDEX_TABLE_TOO_LARGE'
  Check ($script:sampleCalls -eq $before) 'large index guard retained'
  $script:largeIndex = $false
  foreach ($name in @('waitingRelationLocks', 'longTransactions', 'idleTransactions')) {
    foreach ($invalid in @($null, '0', $false, 0.0, -1)) {
      $script:sample = New-Sample; $script:sample.$name = $invalid
      Reject { Assert-LockSafety $config $uri (New-Sample) @() } 'LOCK_SAFETY_SAMPLE_INVALID'
    }
    $script:sample = New-Sample; $script:sample.PSObject.Properties.Remove($name)
    Reject { Assert-LockSafety $config $uri (New-Sample) @() } 'LOCK_SAFETY_SAMPLE_INVALID'
  }
  foreach ($name in @('database','role','sessionRole','databaseOid','clusterIdentity','serverVersion')) {
    $script:sample = New-Sample; $script:sample.$name = 'unbound'
    Reject { Assert-LockSafety $config $uri (New-Sample) @() } 'LOCK_SAFETY_IDENTITY_UNVERIFIED'
    $script:sample = New-Sample; $script:sample.PSObject.Properties.Remove($name)
    Reject { Assert-LockSafety $config $uri (New-Sample) @() } 'LOCK_SAFETY_IDENTITY_UNVERIFIED'
  }
  foreach ($invalid in @($null, $false, 'true')) {
    $script:sample = New-Sample; $script:sample.statsVisible = $invalid
    Reject { Assert-LockSafety $config $uri (New-Sample) @() } 'LOCK_SAFETY_IDENTITY_UNVERIFIED'
  }
  $script:sample = New-Sample
  Reject { Assert-LockSafety $config ([Uri]'postgresql://postgres:x@unbound.example:5432/postgres') (New-Sample) @() } 'LOCK_SAFETY_IDENTITY_UNVERIFIED'
  foreach ($time in @($null, '', '2026-11-16', '2026-11-16T12:00:00.0000000+01:00')) {
    $script:sample = New-Sample; $script:sample.checkedUtc = $time
    Reject { Assert-LockSafety $config $uri (New-Sample) @() } 'LOCK_SAFETY_SAMPLE_INVALID'
  }
  $script:fault = $true
  Reject { Assert-LockSafety $config $uri (New-Sample) @() } 'LOCK_SAFETY_SAMPLE_FAILED'
  $script:fault = $false
  $script:sample = New-Sample; $script:sample.idleTransactions = [long]::MaxValue
  $markerCreated = $false; $commandStarted = $false
  try { Assert-LockSafety $config $uri (New-Sample) @(); $markerCreated = $true; $commandStarted = $true }
  catch {
    $evidence = Get-LockSafetyFailureEvidence $_
    Check ($null -ne $evidence -and $evidence.idleTransactions -eq [long]::MaxValue) 'exact typed failure evidence'
    Check (($evidence.PSObject.Properties.Name -join ',') -ceq 'checkedUtc,waitingRelationLocks,longTransactions,idleTransactions') 'diagnostic field whitelist'
  }
  Check (-not $markerCreated -and -not $commandStarted) 'risk blocks marker and command'
  $poison = New-Sample
  $poison | Add-Member query 'DO_NOT_PRINT'
  $ex = [InvalidOperationException]::new('LMR:DDL_LOCK_RISK')
  $ex.Data['LockSafetyEvidence'] = $poison
  $record = [Management.Automation.ErrorRecord]::new($ex,'synthetic',[Management.Automation.ErrorCategory]::InvalidOperation,$null)
  Check ((Get-LockSafetyFailureEvidence $record | ConvertTo-Json -Compress) -notmatch 'DO_NOT_PRINT|query|database|clusterIdentity') 'no identifiers or SQL in failure output'
  $poison.idleTransactions = 'DO_NOT_PRINT'
  Check ($null -eq (Get-LockSafetyFailureEvidence $record)) 'invalid exception data not printed'
} finally {
  Set-Item Function:Get-LockSafetySnapshot $originalSampler
  Set-Item Function:Get-RelationSize $originalSize
}
Write-Output "LOCK SAFETY MODEL PASS ($passed checks); no database connections"

if ($WithPostgres) {
  . (Join-Path $PSScriptRoot 'lock-safety-postgres.ps1')
}
