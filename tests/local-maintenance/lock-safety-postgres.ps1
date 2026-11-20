# Invoked only by lock-safety-tests.ps1 -WithPostgres. Synthetic localhost only.
if (-not $PrivateTestRoot) { $PrivateTestRoot = Join-Path $env:LOCALAPPDATA 'LegalHubLockSafetyTests' }
$base = [IO.Path]::GetFullPath($PrivateTestRoot)
if (-not (Test-Path -LiteralPath $base)) {
  [void](New-Item -ItemType Directory -Path $base); Set-PrivateAcl $base
}
Assert-PrivateAcl $base
$id = [Guid]::NewGuid().ToString('N').Substring(0,12)
$root = Assert-ChildPath $base (Join-Path $base $id)
[void](New-Item -ItemType Directory -Path $root); Set-PrivateAcl $root
$marker = Join-Path $root 'lock-test-owned.txt'
[IO.File]::WriteAllText($marker, $id); Set-PrivateAcl $marker
$pg = if ($PostgresBin) { $PostgresBin } else { 'C:\Program Files\PostgreSQL\18\bin' }
if (-not $PostgresBin -and -not (Test-Path -LiteralPath (Join-Path $pg 'initdb.exe'))) {
  $pg = 'C:\Program Files\PostgreSQL\17\bin'
}
$config = [pscustomobject]@{ targetKind = 'synthetic'; privateDirectory = $root
  postgresBin = $pg; nodeBin = 'C:\Program Files\nodejs' }
$cluster = $null
$sessions = [Collections.Generic.List[object]]::new()
function Start-LockTestSession([string]$Sql) {
  if ($cluster.Uri.Host -cne '127.0.0.1' -or $cluster.Uri.Port -eq 5432 -or
      $cluster.Database -notmatch '^legalhub_runner_') { throw 'LOCK_TEST_TARGET_NOT_LOCAL' }
  $process = Invoke-WithIsolatedEnvironment $config $cluster.Uri @{} {
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = Join-Path $config.postgresBin 'psql.exe'
    $psi.Arguments = '-w -X -q -A -t -v ON_ERROR_STOP=1'
    $psi.WorkingDirectory = $root; $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    return [Diagnostics.Process]::Start($psi)
  }
  $session = [pscustomobject]@{ process = $process; stderr = $process.StandardError.ReadToEndAsync(); stopped = $false }
  $sessions.Add($session)
  $process.StandardInput.WriteLine($Sql); $process.StandardInput.Flush()
  $ready = $process.StandardOutput.ReadLineAsync()
  if (-not $ready.Wait(10000) -or $ready.Result -cne 'READY') { throw 'LOCK_TEST_SESSION_NOT_READY' }
  return $session
}
function Stop-LockTestSession([object]$Session) {
  if ($Session.stopped) { return }
  try {
    if (-not $Session.process.HasExited) {
      $Session.process.StandardInput.WriteLine("ROLLBACK;`n\q")
      $Session.process.StandardInput.Flush(); $Session.process.StandardInput.Close()
      if (-not $Session.process.WaitForExit(10000)) { $Session.process.Kill(); [void]$Session.process.WaitForExit(5000) }
    }
  } finally { $Session.process.Dispose(); $Session.stopped = $true }
}
try {
  $cluster = New-DisposableCluster $config ('locks' + $id)
  $expected = Get-LockSafetySnapshot $config $cluster.Uri
  Assert-LockSafety $config $cluster.Uri $expected @()
  Check $true 'real empty-cluster current metadata and identity'
  [void](Invoke-PostgresTool $config $cluster.Uri 'psql.exe' @('-X','-q','-v','ON_ERROR_STOP=1','-c',
    'CREATE TABLE public."LockFixture"(id integer PRIMARY KEY);') 'LOCK_TEST_FIXTURE_FAILED')
  $idle = Start-LockTestSession "BEGIN; SELECT 'READY';"
  $sample = Get-LockSafetySnapshot $config $cluster.Uri
  Check ($sample.idleTransactions -eq 1) 'real external idle transaction counted'
  Reject { Assert-LockSafety $config $cluster.Uri $expected @() } 'DDL_LOCK_RISK'
  Stop-LockTestSession $idle
  # Deliberately pass an old positive sample after the owned fixture has ended.
  Assert-LockSafety $config $cluster.Uri $sample @()
  Check $true 'real stale-positive sample cannot cause a false refusal'
  $holder = Start-LockTestSession "BEGIN; LOCK TABLE public.`"LockFixture`" IN ACCESS EXCLUSIVE MODE; SELECT 'READY'; SELECT pg_sleep(8);"
  $waiter = Start-LockTestSession "SELECT 'READY'; SELECT count(*) FROM public.`"LockFixture`";"
  $sample = $null
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    $sample = Get-LockSafetySnapshot $config $cluster.Uri
    if ($sample.waitingRelationLocks -gt 0) { break }
    Start-Sleep -Milliseconds 100
  }
  Check ($sample.waitingRelationLocks -gt 0) 'real waiting relation lock counted'
  Reject { Assert-LockSafety $config $cluster.Uri $expected @() } 'DDL_LOCK_RISK'
  Stop-LockTestSession $holder; Stop-LockTestSession $waiter
  $long = Start-LockTestSession "BEGIN; SELECT 'READY'; SELECT pg_sleep(36);"
  Start-Sleep -Seconds 31
  $sample = Get-LockSafetySnapshot $config $cluster.Uri
  Check ($sample.longTransactions -eq 1 -and $sample.idleTransactions -eq 0) 'real active transaction over unchanged 30-second threshold'
  Reject { Assert-LockSafety $config $cluster.Uri $expected @() } 'DDL_LOCK_RISK'
  Stop-LockTestSession $long
  Assert-LockSafety $config $cluster.Uri $expected @()
  Check $true 'real guard returns safe only after owned transactions finish'
  Write-Output 'LOCK SAFETY POSTGRES PASS; real idle/wait/long failures; localhost only; no Production'
} finally {
  foreach ($session in $sessions) { Stop-LockTestSession $session }
  if ($cluster) { Stop-DisposableCluster $config $cluster }
  Assert-NoUnverifiedDisposableClusters $config
  Assert-NotReparsePoint $root
  if ((Get-Content -LiteralPath $marker -Raw) -cne $id -or
      @(Get-ChildItem -LiteralPath $root -Recurse -Force -Attributes ReparsePoint).Count) {
    throw 'LOCK_TEST_CLEANUP_OWNERSHIP_UNVERIFIED'
  }
  [IO.Directory]::Delete($root, $true)
}
