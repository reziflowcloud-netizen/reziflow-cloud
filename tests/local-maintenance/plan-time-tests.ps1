#requires -Version 7
param([string]$PrivateTestRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
. (Join-Path $repo 'scripts/local-maintenance/plan.ps1')
$passed = 0
function Assert-Test([bool]$Value, [string]$Name) {
  if (-not $Value) { throw "PLAN_TIME_TEST_FAILED:$Name" }
  $script:passed++
}
function Expect-Block([scriptblock]$Action, [string]$Code) {
  try { & $Action | Out-Null }
  catch {
    if ($_.Exception.Message -ceq ('LMR:' + $Code)) { $script:passed++; return }
    throw
  }
  throw "PLAN_TIME_TEST_EXPECTED_BLOCK:$Code"
}
if (-not $PrivateTestRoot) {
  $PrivateTestRoot = Join-Path $env:LOCALAPPDATA 'LegalHubMaintenancePlanTimeTests'
}
$base = [IO.Path]::GetFullPath($PrivateTestRoot)
if (-not (Test-Path -LiteralPath $base)) {
  [void](New-Item -ItemType Directory -Path $base); Set-PrivateAcl $base
}
Assert-PrivateAcl $base
$id = [Guid]::NewGuid().ToString('N').Substring(0, 12)
$root = Assert-ChildPath $base (Join-Path $base $id)
if (Test-Path -LiteralPath $root) { Stop-Maintenance 'PLAN_TEST_ROOT_EXISTS' }
[void](New-Item -ItemType Directory -Path $root); Set-PrivateAcl $root
$marker = Join-Path $root 'plan-time-test-owned.txt'
[IO.File]::WriteAllText($marker, $id); Set-PrivateAcl $marker
$config = [pscustomobject]@{ privateDirectory = $root }
$oldCulture = [Globalization.CultureInfo]::CurrentCulture
$now = [DateTime]::UtcNow
function New-TestPlan([object]$Created) {
  return [ordered]@{
    version = 1; runId = [Guid]::NewGuid().ToString('N').Substring(0, 12)
    createdUtc = $Created; approvedCommit = ('a' * 40)
    targetFingerprint = ('b' * 64); synthetic = $true
  }
}
try {
  foreach ($culture in @('pl-PL', 'en-US', 'uk-UA')) {
    [Globalization.CultureInfo]::CurrentCulture = [Globalization.CultureInfo]::GetCultureInfo($culture)
    foreach ($value in @($now.ToString('o'), $now, $now.AddMinutes(1).ToString('o'), $now.AddHours(-3).ToString('o'))) {
      Assert-PlanFresh ([pscustomobject]@{ createdUtc = $value })
      Assert-Test $true 'fresh UTC representations and existing clock tolerance'
    }
    $json = @{ createdUtc = $now.ToString('o') } | ConvertTo-Json -Compress
    $roundtrip = $json | ConvertFrom-Json
    Assert-Test ($roundtrip.createdUtc -is [DateTime] -and $roundtrip.createdUtc.Kind -eq [DateTimeKind]::Utc) 'actual PowerShell7 JSON UTC type'
    Assert-PlanFresh $roundtrip
    Assert-Test $true 'default JSON roundtrip is culture independent'
    foreach ($value in @($now.AddHours(-5), $now.AddHours(-5).ToString('o'), $now.AddMinutes(3), $now.AddMinutes(3).ToString('o'))) {
      Expect-Block { Assert-PlanFresh ([pscustomobject]@{ createdUtc = $value }) } 'PLAN_EXPIRED_RERUN_PREFLIGHT'
    }
    foreach ($value in @($null, 12345, '', 'not-a-date', '2026-13-99T25:70:90.0000000Z',
        $now.ToString('yyyy-MM-ddTHH:mm:ssZ'), (' ' + $now.ToString('o')), $now.ToString('o').Replace('Z', '+00:00'),
        [DateTime]::SpecifyKind($now, [DateTimeKind]::Unspecified), [DateTime]::SpecifyKind($now, [DateTimeKind]::Local),
        [DateTimeOffset]::new($now))) {
      Expect-Block { Assert-PlanFresh ([pscustomobject]@{ createdUtc = $value }) } 'PLAN_TIME_INVALID'
    }
    $plan = New-TestPlan $now.ToString('o')
    $path = Save-SealedPlan $config $plan
    $originalHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    $read = Read-SealedPlan $config $path
    Assert-PlanFresh $read
    Assert-Test ($read.createdUtc -ceq $plan.createdUtc -and $read.approvedCommit -ceq $plan.approvedCommit -and
      $read.targetFingerprint -ceq $plan.targetFingerprint) 'signed JSON roundtrip preserves timestamp SHA and target'
    if ((Get-Command ConvertFrom-Json).Parameters.ContainsKey('DateKind')) {
      Assert-Test ($read.createdUtc -is [string]) 'signed raw timestamp preserved on DateKind runtime'
    }
    # Malformed authenticated fixtures exercise parsing after a valid MAC;
    # attacker fixtures below deliberately retain the old MAC without re-signing.
    foreach ($value in @('not-a-date', $now.AddHours(-5).ToString('o'), $now.AddMinutes(3).ToString('o'),
        $now.ToString('o').Replace('Z', '+00:00'), $now.ToString('yyyy-MM-ddTHH:mm:ssZ'))) {
      $bad = New-TestPlan $value
      $badPath = Save-SealedPlan $config $bad
      $expected = if ($value -in @($now.AddHours(-5).ToString('o'), $now.AddMinutes(3).ToString('o'))) {
        'PLAN_EXPIRED_RERUN_PREFLIGHT'
      } else { 'PLAN_TIME_INVALID' }
      Expect-Block { Assert-PlanFresh (Read-SealedPlan $config $badPath) } $expected
    }
    $wrapper = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    $payloadText = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($wrapper.payload))
    foreach ($mutation in @(
        @{ old = $plan.createdUtc; new = $now.AddHours(1).ToString('o') },
        @{ old = $plan.approvedCommit; new = ('c' * 40) },
        @{ old = $plan.targetFingerprint; new = ('d' * 64) })) {
      $changed = $payloadText.Replace($mutation.old, $mutation.new)
      Assert-Test ($changed -cne $payloadText) 'tamper fixture changes exact signed bytes'
      $copy = [ordered]@{ version = $wrapper.version; payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($changed)); mac = $wrapper.mac }
      $tampered = Join-Path (Get-PlanDirectory $config) ([Guid]::NewGuid().ToString('N') + '.sealed.json')
      [IO.File]::WriteAllText($tampered, ($copy | ConvertTo-Json -Compress)); Set-PrivateAcl $tampered
      Expect-Block { Read-SealedPlan $config $tampered } 'PLAN_SEAL_MISMATCH'
    }
    $wrapper.mac = '0' * 64
    $tampered = Join-Path (Get-PlanDirectory $config) ([Guid]::NewGuid().ToString('N') + '.sealed.json')
    [IO.File]::WriteAllText($tampered, ($wrapper | ConvertTo-Json -Compress)); Set-PrivateAcl $tampered
    Expect-Block { Read-SealedPlan $config $tampered } 'PLAN_SEAL_MISMATCH'
    Assert-Test ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ceq $originalHash) 'original sealed plan never changed'
  }
} finally {
  [Globalization.CultureInfo]::CurrentCulture = $oldCulture
  [void](Assert-ChildPath $base $root); Assert-NotReparsePoint $root
  if ((Get-Content -LiteralPath $marker -Raw) -cne $id) { Stop-Maintenance 'PLAN_TEST_CLEANUP_MARKER_MISMATCH' }
  if (@(Get-ChildItem -LiteralPath $root -Recurse -Force -Attributes ReparsePoint).Count) { Stop-Maintenance 'PLAN_TEST_CLEANUP_REPARSE' }
  [IO.Directory]::Delete($root, $true)
  if (Test-Path -LiteralPath $root) { Stop-Maintenance 'PLAN_TEST_CLEANUP_FAILED' }
}
Write-Output "PLAN TIME TESTS PASS: $passed; cultures=3; databaseConnections=0; synthetic key/root cleanup=VERIFIED"
