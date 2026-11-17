#requires -Version 7
param([string]$PrivateTestRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../../scripts/local-maintenance/core.ps1')
. (Join-Path $PSScriptRoot '../../scripts/local-maintenance/plan.ps1')
. (Join-Path $PSScriptRoot '../../scripts/local-maintenance/migration-diagnostics.ps1')
. (Join-Path $PSScriptRoot 'report-functions.ps1')
$passed = 0
function Check([bool]$Value, [string]$Name) {
  if (-not $Value) { throw "REPORT_TEST_FAILED:$Name" }
  $script:passed++
}
function Reject([scriptblock]$Action, [string]$Code = '') {
  try { & $Action | Out-Null }
  catch {
    if ($Code -and $_.Exception.Message -cne "LMR:$Code") { throw }
    $script:passed++; return
  }
  throw 'REPORT_TEST_EXPECTED_FAILURE'
}
if (-not $PrivateTestRoot) {
  $PrivateTestRoot = Join-Path $env:LOCALAPPDATA 'LegalHubReportWriteTests'
}
$base = [IO.Path]::GetFullPath($PrivateTestRoot)
if (-not (Test-Path -LiteralPath $base)) {
  [void](New-Item -ItemType Directory -Path $base); Set-PrivateAcl $base
}
Assert-PrivateAcl $base
$id = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$root = Assert-ChildPath $base (Join-Path $base $id)
[void](New-Item -ItemType Directory -Path $root); Set-PrivateAcl $root
$marker = Join-Path $root 'report-test-owned.txt'
[IO.File]::WriteAllText($marker, $id); Set-PrivateAcl $marker
$config = [pscustomobject]@{ privateDirectory = $root }
$plan = [pscustomobject]@{ runId = $id; approvedCommit = ('a' * 40)
  pending = @('synthetic_only'); restore = 'PASS'; localMigration = 'PASS'
  structure = 'PASS'; sequencePermissions = 'PASS'; oldAppNewDb = 'PASS' }
try {
  $path = Write-Report $config $plan 'PREFLIGHT_ONLY'
  $initial = [IO.File]::ReadAllBytes($path)
  $acl = (Get-Acl -LiteralPath $path).Sddl
  Check ((Get-Content $path -Raw | ConvertFrom-Json).result -ceq 'PREFLIGHT_ONLY') 'first real write'
  Assert-PrivateAcl $path
  Check (Test-ExactPrivateAcl (Get-Acl $path) $false) 'exact private ACL'
  Mark-PlanAttempted $config $plan
  $attempt = Join-Path (Get-PlanDirectory $config) "$id.attempted"
  $attemptHash = (Get-FileHash $attempt).Hash
  Reject { Assert-PlanNotAttempted $config $plan } 'PLAN_ALREADY_ATTEMPTED'
  [void](Write-Report $config $plan 'ATTEMPTED_UNVERIFIED' 'AWAITING_GUARDED_COMMAND')
  Check ((Get-Content $path -Raw | ConvertFrom-Json).result -ceq 'ATTEMPTED_UNVERIFIED') 'real atomic overwrite after marker'
  Check ((Get-Acl $path).Sddl -ceq $acl) 'ACL survives replacement'
  $diagnostic = Read-GuardedMigrationDiagnostic @('GUARDED_MIGRATION_DIAGNOSTIC {"version":1,"exitCode":1,"category":"TLS","prismaCodes":["P1011"],"sqlstates":[],"processError":null,"outputLimited":false}') 1
  [void](Write-Report $config $plan 'APPLY_ERROR' 'GUARDED_COMMAND_FAILED' -CommandDiagnostic $diagnostic)
  $observed = Get-Content $path -Raw | ConvertFrom-Json
  Check ($observed.commandDiagnostic.category -ceq 'TLS' -and $observed.commandDiagnostic.prismaCodes[0] -ceq 'P1011') 'safe command evidence survives atomic publication'
  Check ((Get-FileHash $attempt).Hash -ceq $attemptHash) 'diagnostic publication preserves consumed marker'
  $diagnostic | Add-Member -NotePropertyName secret -NotePropertyValue 'synthetic-private-secret'
  [void](Write-Report $config $plan 'APPLY_ERROR' 'GUARDED_COMMAND_FAILED' -CommandDiagnostic $diagnostic)
  Check ((Get-Content $path -Raw) -notmatch 'synthetic-private-secret') 'unknown diagnostic text never reaches report'
  Check ((Get-Content $path -Raw | ConvertFrom-Json).commandDiagnostic.category -ceq 'DIAGNOSTIC_UNAVAILABLE') 'invalid evidence is explicit without hiding failed command'
  $checkpointHash = (Get-FileHash $path).Hash
  $temporary = Join-Path (Get-ReportDirectory $config) "$id.new"
  $held = [IO.File]::Open($path, 'Open', 'Read', 'Read')
  try { Reject { Write-Report $config $plan 'APPLIED' } }
  finally { $held.Dispose() }
  Check ((Get-FileHash $path).Hash -ceq $checkpointHash) 'sharing I/O failure preserves checkpoint'
  Check (@(Get-ChildItem (Get-ReportDirectory $config) -Filter '*.new' -Force).Count -eq 0) 'I/O failure cleans only own temporary'
  [IO.File]::SetAttributes($path, [IO.FileAttributes]::ReadOnly)
  try { Reject { Write-Report $config $plan 'APPLIED' } }
  finally { [IO.File]::SetAttributes($path, [IO.FileAttributes]::Normal) }
  Check ((Get-FileHash $path).Hash -ceq $checkpointHash) 'access failure preserves checkpoint'
  Check (@(Get-ChildItem (Get-ReportDirectory $config) -Filter '*.new' -Force).Count -eq 0) 'access failure cleans own temporary'
  # Existing interrupted evidence is never overwritten or deleted.
  [IO.File]::WriteAllText($temporary, 'synthetic interrupted evidence'); Set-PrivateAcl $temporary
  $evidenceHash = (Get-FileHash $temporary).Hash
  Reject { Write-Report $config $plan 'APPLIED' }
  Check ((Get-FileHash $temporary).Hash -ceq $evidenceHash) 'pre-existing staging evidence preserved'
  [IO.File]::Delete($temporary)
  # Real filesystem argument behavior, using synthetic bytes only.
  $source = Join-Path $root 'null-source.txt'; $destination = Join-Path $root 'null-destination.txt'
  [IO.File]::WriteAllText($source, 'new'); Set-PrivateAcl $source
  [IO.File]::WriteAllText($destination, 'old'); Set-PrivateAcl $destination
  Reject { [IO.File]::Replace($source, $destination, $null) }
  Reject { [IO.File]::Replace($source, $destination, '') }
  Check ([IO.File]::ReadAllText($destination) -ceq 'old') 'invalid backup paths do not replace'
  [IO.File]::Replace($source, $destination, [NullString]::Value)
  Check ([IO.File]::ReadAllText($destination) -ceq 'new') 'genuine null replacement works'
  # Publication failure must not make a consumed plan retryable.
  Check ((Get-FileHash $attempt).Hash -ceq $attemptHash) 'marker unchanged after failures'
  Reject { Assert-PlanNotAttempted $config $plan } 'PLAN_ALREADY_ATTEMPTED'
  Reject { Mark-PlanAttempted $config $plan }
  [void](Write-Report $config $plan 'APPLIED')
  Check ((Get-Content $path -Raw | ConvertFrom-Json).outcome -ceq 'VERIFIED_APPLIED') 'synthetic lifecycle final report'
  Reject { Assert-PlanNotAttempted $config $plan } 'PLAN_ALREADY_ATTEMPTED'
  Check ((Get-Acl $path).Sddl -ceq $acl) 'final ACL unchanged'
  Check (@(Get-ChildItem (Get-ReportDirectory $config) -File).Count -eq 1) 'no backup or staging leftovers'
  # Unsafe destination is refused before creating a staging file.
  $unsafe = Get-Acl $path
  $unsafe.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
    [Security.Principal.SecurityIdentifier]'S-1-1-0', 'Read', 'Allow'))
  Write-PrivateDacl (Get-Item $path) $unsafe
  Reject { Write-Report $config $plan 'APPLIED' } 'PRIVATE_ACL_TOO_BROAD'
  Check (-not (Test-Path $temporary)) 'unsafe destination refused before staging'
  Set-PrivateAcl $path
  # Deterministically overlap another writer immediately after publication.
  # Override only the test's ACL observer; the real guard still runs every time.
  $script:originalAssert = (Get-Command Assert-PrivateAcl).ScriptBlock
  $script:publishedChecks = 0
  $script:overlapPath = $path
  $script:foreignStage = Join-Path (Get-ReportDirectory $config) "$id.otherwriter.new"
  function Assert-PrivateAcl([string]$Path) {
    & $script:originalAssert $Path
    if ($Path -ceq $script:overlapPath) {
      $script:publishedChecks++
      if ($script:publishedChecks -eq 2) {
        [IO.File]::WriteAllText($script:foreignStage, 'other synthetic writer evidence')
        Set-PrivateAcl $script:foreignStage
      }
    }
  }
  try { [void](Write-Report $config $plan 'APPLIED') }
  finally { Set-Item Function:Assert-PrivateAcl $script:originalAssert }
  Check (Test-Path $script:foreignStage) 'post-publication cleanup preserves another writer staging'
  Reject { Write-Report $config $plan 'APPLIED' } 'REPORT_STAGING_EXISTS'
  [IO.File]::Delete($script:foreignStage)
  Write-Output "REPORT WRITE TESTS PASS ($passed checks); synthetic files only; no Production"
} finally {
  Assert-ChildPath $base $root | Out-Null
  Assert-NotReparsePoint $root
  if ((Get-Content $marker -Raw) -cne $id -or
      @(Get-ChildItem $root -Recurse -Force -Attributes ReparsePoint).Count) {
    throw 'REPORT_TEST_CLEANUP_OWNERSHIP_FAILED'
  }
  [IO.Directory]::Delete($root, $true)
}
