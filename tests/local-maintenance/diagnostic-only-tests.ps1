#requires -Version 7
param([Parameter(Mandatory)][string]$PostgresBin)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $repo 'scripts/local-maintenance/diagnostic-only-lib.ps1')
$passed=0
function Check([bool]$ok,[string]$name) { if(-not $ok){throw ('LHD_TEST_FAILED:'+$name)};$script:passed++;Write-Output ('PASS '+$name) }
function Block([scriptblock]$action,[string]$name) { $blocked=$false;try { & $action | Out-Null } catch {$blocked=$true};Check $blocked $name }
function Expect-Code([scriptblock]$action,[string]$code) {
  $matched=$false;try {& $action | Out-Null} catch {$matched=$_.Exception.Message -ceq ('LHD:'+$code)}
  Check $matched ('specific fail-closed gate '+$code)
}
$root=Join-Path $env:LOCALAPPDATA ('LegalHubDiagnosticOnlyTests-'+[Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root);Set-PrivateAcl $root
$private=Join-Path $root 'private with spaces';[void][IO.Directory]::CreateDirectory($private);Set-PrivateAcl $private
$config=[pscustomobject]@{targetKind='synthetic';connectionMode='direct';environmentFile=(Join-Path $root 'test.env');
  privateDirectory=$private;postgresBin=$PostgresBin;nodeBin=(Split-Path (Get-Command node.exe).Source);
  expectedHost='127.0.0.1';expectedApplicationHost='127.0.0.1';applicationRole='restore_admin'}
$configPath=Join-Path $root 'config.json';Write-DiagnosticNewFile $configPath ($config|ConvertTo-Json)
$specPath=Join-Path $root 'spec.json';$cluster=$null;$holder=$null
$canary='SYNTHETIC_ONLY_SECRET_9e5c'
$pathBefore=$env:PATH;$policiesBefore=Get-ExecutionPolicy -List | ConvertTo-Json -Compress
function Save-Spec($s) { if(Test-Path $specPath){[IO.File]::Delete($specPath)};Write-DiagnosticNewFile $specPath ($s|ConvertTo-Json -Depth 8) }
function New-CaseEnvelope { $e=Join-Path $private ([Guid]::NewGuid().ToString('N')+'.json');New-DiagnosticEnvelope $specPath $e;return $e }
function Trace-Case([string]$e,[int]$Statements,[int]$Proofs) {
  $id=(Read-DiagnosticJson $e).runId
  $stream=[IO.File]::Open((Join-Path $cluster.Root 'postgres.log'),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
  $reader=[IO.StreamReader]::new($stream)
  try {$text=$reader.ReadToEnd()} finally {$reader.Dispose()}
  $allLines=@($text -split '\r?\n')
  $lines=@($allLines | Where-Object {$_ -match ('^lhd-'+$id+'\|')})
  # Error logging also emits uppercase STATEMENT: context; it is not a second execution.
  $sent=@($lines | Where-Object {$_ -cmatch 'statement:'})
  $pids=@($lines | ForEach-Object {if($_ -match '^lhd-[a-f0-9]+\|([0-9]+)\|'){$Matches[1]}} | Select-Object -Unique)
  Check ($pids.Count -eq 1) 'exactly one backend PID'
  $auth=@($allLines | Where-Object {$_ -match ('\|'+$pids[0]+'\|.*connection authorized:')})
  Write-Output ('TRACE_DIAGNOSTIC backends='+$pids.Count+' sqlStatements='+$sent.Count+' structureSelects='+@($sent|Where-Object {$_ -match 'statement: WITH RECURSIVE roots'}).Count)
  Check ($auth.Count -eq 1) 'exactly one authorized backend'
  Check ($sent.Count -eq $Statements) 'bounded total SQL statements'
  Check (@($sent | Where-Object {$_ -match 'statement: WITH RECURSIVE roots'}).Count -eq $Proofs) 'conditional original proof count'
  Check (@($sent | Where-Object {$_ -match 'statement: (SELECT|WITH RECURSIVE)'}).Count -le 2) 'at most two SELECT statements'
  Check (@($sent | Where-Object {$_ -match 'statement: (CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|COPY)|_prisma_migrations'}).Count -eq 0) 'no DDL data writes backup or ledger operations'
}
function Probe([string]$query,[string]$State,[string]$Category) {
  # Test-only fault SQL, never accepted by the public entrypoint/specification.
  $x=Get-DiagnosticContext $specPath;$sql=Get-DiagnosticSql $spec.pins $true
  $proof=(Get-StructureProofSql $spec.pins.applicationRole).Replace("`r`n","`n")
  $script=$sql.script.Replace($proof,$query)
  $file=Join-Path $private ([Guid]::NewGuid().ToString('N')+'.sql')
  Write-DiagnosticNewFile $file $script
  $capture=$null;$safe=New-DiagnosticChildEnvironment $x ([guid]::NewGuid().ToString('N'))
  try {
    $capture=[LegalHubMaintenanceDiagnostics.ProcessCapture]::RunIsolated((Join-Path $PostgresBin 'psql.exe'),
      [string[]]@('-w','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never','-f',$file),150000,$safe,$private)
    $d=Convert-DiagnosticCapture $capture $file
    Check ($d.status -ceq 'FAILED' -and $d.nativeExitCode -eq 3 -and $d.sqlState -ceq $State -and $d.errorCategory -ceq $Category) ('native diagnostic '+$State)
    Check ($d.verifiedIdentity -and $d.durationMs -ge 0 -and -not $d.cleanupFailed) 'identity duration exit and cleanup retained'
    if($State -ceq '57014'){Check ($d.durationMs -ge 29000 -and $d.durationMs -lt 150000) 'controlled statement cancellation occurs after fixed 30s budget'}
    if($State -ceq '55P03'){Check ($d.durationMs -ge 4900 -and $d.durationMs -lt 30000) 'controlled lock cancellation occurs after fixed 5s budget'}
    Check (($d|ConvertTo-Json -Compress) -notmatch $canary) 'native canary never leaves process capture'
  } finally {if($capture){$capture.Errors='';$capture.Output=''};$safe.Clear();[IO.File]::Delete($file)}
}
try {
  $cluster=New-DisposableCluster $config ('synthetic_diag'+[guid]::NewGuid().ToString('N').Substring(0,10))
  Write-DiagnosticNewFile $config.environmentFile ('DIRECT_URL='+$cluster.Uri.AbsoluteUri)
  $id=Get-DatabaseIdentityState $config $cluster.Uri
  $spec=@{version=1;configPath=$configPath;pwshPath=[Environment]::ProcessPath;
    pins=@{database=$cluster.Database;maintenanceRole='restore_admin';applicationRole='restore_admin';
      databaseOid=[string]$id.databaseOid;systemIdentifier=[string]$id.clusterIdentity;serverVersionNum=[string]$id.serverVersion;ipv4='127.0.0.1'}}
  Save-Spec $spec
  $savedPins=$spec.pins.Clone();$spec.pins.systemIdentifier=$null;Save-Spec $spec
  Expect-Code {Get-DiagnosticContext $specPath} 'EXPECTED_PINS_INCOMPLETE'
  $spec.pins=$savedPins;Save-Spec $spec
  $untrusted=Join-Path $private 'not-a-trusted-tool.exe';Write-DiagnosticNewFile $untrusted 'synthetic only'
  $rejected=$false
  try {Assert-DiagnosticProtectedTool $untrusted} catch {$rejected=$_.Exception.Message -cin @('LHD:TOOLCHAIN_OWNER_UNTRUSTED','LHD:TOOLCHAIN_WRITABLE')}
  Check $rejected 'operator-owned or writable installation rejected'
  [IO.File]::Delete($untrusted)
  Expect-Code {Assert-DiagnosticLocalPath '\\synthetic-invalid\not-accessed\test'} 'LOCAL_ABSOLUTE_PATH_REQUIRED'
  $desktop=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
  $oldOutput=@(& $desktop -NoProfile -File (Join-Path $repo 'scripts/local-maintenance/diagnostic-only.ps1') -Mode Prepare -Specification $specPath -Envelope (Join-Path $private 'not-created.json') 2>&1)
  $policyRefusal=($oldOutput -join '') -match 'PSSecurityException|about_Execution_Policies'
  $runtimeRefusal=$LASTEXITCODE -eq 2 -and ($oldOutput -join '') -match 'LHD:POWERSHELL_7_WINDOWS_REQUIRED'
  Check (($LASTEXITCODE -ne 0) -and ($runtimeRefusal -or $policyRefusal)) 'actual PS5.1 file launch safely refused without changing policy'
  if($policyRefusal){Write-Output 'PS5_FILE_POLICY_REFUSAL_RUNTIME_FENCE_NOT_EXECUTED'}else{Write-Output 'PS5_RUNTIME_FENCE_EXECUTED'}
  Check (-not(Test-Path (Join-Path $private 'not-created.json'))) 'PS5.1 creates no envelope'
  [IO.File]::AppendAllText((Join-Path $cluster.Cluster 'postgresql.auto.conf'),"`nlog_connections=on`nlog_statement='all'`nlc_messages='C'`nlog_line_prefix='%a|%p| '`n")
  [void](Invoke-WithIsolatedEnvironment $config $null @{} {& (Join-Path $PostgresBin 'pg_ctl.exe') -D $cluster.Cluster reload 2>$null})
  # Wait for reload via a bounded local control query, outside the tool's envelope.
  for($i=0;$i -lt 20;$i++) {if((Invoke-ReadOnlyQuery $config $cluster.Uri "SELECT current_setting('log_statement')" 'TEST_FAILED') -ceq 'all'){break};Start-Sleep -Milliseconds 100}
  Check ($i -lt 20) 'owned synthetic logging enabled'
  $e=Join-Path $private ([guid]::NewGuid().ToString('N')+'.json')
  $prepare=@(& ([Environment]::ProcessPath) -NoProfile -File (Join-Path $repo 'scripts/local-maintenance/diagnostic-only.ps1') -Mode Prepare -Specification $specPath -Envelope $e)
  Check ($LASTEXITCODE -eq 0 -and ($prepare|ConvertFrom-Json).status -ceq 'PREPARED_OFFLINE') 'actual public offline Prepare fixes envelope before connection'
  # Invoke the ACTUAL public entrypoint in a fresh PS7 child.
  $output=@(& ([Environment]::ProcessPath) -NoProfile -File (Join-Path $repo 'scripts/local-maintenance/diagnostic-only.ps1') -Mode Execute -Specification $specPath -Envelope $e)
  Check ($LASTEXITCODE -eq 0 -and $output.Count -eq 1) 'public CLI successful exit and closed output'
  $d=$output[0] | ConvertFrom-Json
  Check ($d.status -ceq 'QUERY_COMPLETED' -and $d.verifiedIdentity -and $d.nativeExitCode -eq 0) 'fixed original SQL works with pinned identity'
  Trace-Case $e 6 1
  Block {Invoke-DiagnosticEnvelope $specPath $e ''} 'one-shot envelope cannot retry'
  $copy=Join-Path $private ([guid]::NewGuid().ToString('N')+'.json');Write-DiagnosticNewFile $copy ([IO.File]::ReadAllText($e))
  Block {Invoke-DiagnosticEnvelope $specPath $copy ''} 'renamed envelope cannot reuse run ID'
  Check (-not(Test-Path (Join-Path $private ('diagnostic-'+(Read-DiagnosticJson $e).runId+'.sql')))) 'query scratch file deleted'
  $payload=Get-DiagnosticSql $spec.pins $true
  Check ($payload.proofSha256 -ceq (Get-Sha256Text ((Get-StructureProofSql 'restore_admin').Replace("`r`n","`n")))) 'reviewed role substitution and proof SHA match'
  Check ($payload.script.Contains("statement_timeout='30s'") -and $payload.script.Contains("READ ONLY")) 'fixed read-only and 30s SQL'
  $originalOid=$spec.pins.databaseOid;$spec.pins.databaseOid='999999999';Save-Spec $spec
  $e=New-CaseEnvelope;$d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.reason -ceq 'IDENTITY_MISMATCH' -and -not $d.verifiedIdentity -and $d.nativeExitCode -eq 0) 'identity mismatch blocks proof even native exit0'
  Trace-Case $e 5 0
  $spec.pins.databaseOid=$originalOid;Save-Spec $spec
  $e=New-CaseEnvelope;$spec.pins.ipv4='127.0.0.2';Save-Spec $spec
  Block {Invoke-DiagnosticEnvelope $specPath $e ''} 'unexpected synthetic address blocked before client'
  $spec.pins.ipv4='127.0.0.1';Save-Spec $spec
  $e=New-CaseEnvelope;$raw=[IO.File]::ReadAllText($specPath);[IO.File]::AppendAllText($specPath,' ')
  Block {Invoke-DiagnosticEnvelope $specPath $e ''} 'modified specification blocked before client'
  Check (-not(Test-Path (Join-Path $private ('diagnostic-'+(Read-DiagnosticJson $e).runId+'.attempted')))) 'binding rejection never starts attempt'
  [IO.File]::WriteAllText($specPath,$raw)
  Probe ('SELECT '+$canary+' FROM') '42601' 'SQL_COMPATIBILITY'
  Probe ('SELECT * FROM '+$canary) '42P01' 'SQL_COMPATIBILITY'
  $setup=Join-Path $private 'setup.sql'
  Write-DiagnosticNewFile $setup "CREATE TABLE public.canary_private(id int); CREATE ROLE diag_reader LOGIN PASSWORD '$canary'; CREATE ROLE diag_identity_denied LOGIN PASSWORD '$canary'; REVOKE EXECUTE ON FUNCTION pg_control_system() FROM PUBLIC; GRANT EXECUTE ON FUNCTION pg_control_system() TO diag_reader;"
  [void](Invoke-PostgresTool $config $cluster.Uri 'psql.exe' @('-w','-X','-q','-v','ON_ERROR_STOP=1','-f',$setup) 'TEST_FIXTURE_FAILED')
  [IO.File]::Delete($setup)
  $originalEnv=[IO.File]::ReadAllText($config.environmentFile)
  $b=[UriBuilder]::new($cluster.Uri);$b.UserName='diag_identity_denied';$b.Password=$canary
  [IO.File]::WriteAllText($config.environmentFile,('DIRECT_URL='+$b.Uri.AbsoluteUri))
  $spec.pins.maintenanceRole='diag_identity_denied';Save-Spec $spec
  $e=New-CaseEnvelope;$d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.stage -ceq 'IDENTITY' -and -not $d.verifiedIdentity -and $d.sqlState -ceq '42501' -and $d.nativeExitCode -eq 3) 'identity query permission error stops before proof'
  Trace-Case $e 4 0
  $b=[UriBuilder]::new($cluster.Uri);$b.UserName='diag_reader';$b.Password=$canary
  [IO.File]::WriteAllText($config.environmentFile,('DIRECT_URL='+$b.Uri.AbsoluteUri))
  $spec.pins.maintenanceRole='diag_reader';Save-Spec $spec
  Probe 'SELECT * FROM public.canary_private' '42501' 'PERMISSION'
  [IO.File]::WriteAllText($config.environmentFile,$originalEnv)
  $spec.pins.maintenanceRole='restore_admin';Save-Spec $spec
  $e=New-CaseEnvelope;$d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.status -ceq 'QUERY_COMPLETED') 'original proof catalog response discarded with synthetic secret objects present'
  Trace-Case $e 6 1
  Probe 'SELECT pg_sleep(40)' '57014' 'QUERY_CANCELED'
  # Hold an exclusive lock only inside this owned disposable cluster.
  $x=Get-DiagnosticContext $specPath;$safe=New-DiagnosticChildEnvironment $x 'test-lock-holder'
  $psi=[Diagnostics.ProcessStartInfo]::new((Join-Path $PostgresBin 'psql.exe'))
  $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardInput=$true
  $psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
  foreach($arg in @('-w','-X','-q','-A','-t','-v','ON_ERROR_STOP=1')){$psi.ArgumentList.Add($arg)}
  $psi.Environment.Clear();foreach($key in $safe.Keys){$psi.Environment[$key]=$safe[$key]};$safe.Clear()
  $process=[Diagnostics.Process]::Start($psi);$holder=@{Process=$process}
  $drain=$process.StandardError.ReadToEndAsync()
  $process.StandardInput.WriteLine("BEGIN; LOCK TABLE public.canary_private IN ACCESS EXCLUSIVE MODE;")
  $process.StandardInput.WriteLine('\echo LOCK_HELD');$process.StandardInput.Flush()
  $ready=$process.StandardOutput.ReadLineAsync();Check ($ready.Wait(10000) -and $ready.Result -ceq 'LOCK_HELD') 'synthetic exclusive lock acquired'
  Probe 'SELECT * FROM public.canary_private' '55P03' 'LOCK_UNAVAILABLE'
  Stop-DatabaseApplyLock $holder;$holder=$null
  # Broken authentication: client fails during startup, identity/proof never run.
  $b=[UriBuilder]::new($cluster.Uri);$b.Password=$canary
  [IO.File]::WriteAllText($config.environmentFile,('DIRECT_URL='+$b.Uri.AbsoluteUri))
  $e=New-CaseEnvelope;$d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.status -ceq 'FAILED' -and -not $d.verifiedIdentity -and $d.nativeExitCode -eq 2 -and $null -eq $d.sqlState) 'authentication startup failure retains conservative SQLSTATE unknown'
  Check (($d|ConvertTo-Json -Compress) -notmatch $canary) 'authentication secret not emitted'
  [IO.File]::WriteAllText($config.environmentFile,$originalEnv)
  # Pure capture negatives ensure unknown output cannot become a PASS.
  foreach($text in @($canary,"LHD_IDENTITY_OK`nLHD_STRUCTURE_OK`nLHD_ROLLBACK_OK`n`n",'LHD_STRUCTURE_OK')) {
    $c=[LegalHubMaintenanceDiagnostics.Result]::new();$c.ExitCode=0;$c.Output=$text
    $d=Convert-DiagnosticCapture $c 'unused.sql'
    Check ($d.status -ceq 'BLOCKED' -and ($d|ConvertTo-Json -Compress) -notmatch $canary) 'malformed native output discarded fail-closed'
  }
  $c=[LegalHubMaintenanceDiagnostics.Result]::new();$c.ExitCode=0;$c.Output="LHD_IDENTITY_OK`nLHD_STRUCTURE_OK`nLHD_ROLLBACK_OK`n";$c.CleanupFailed=$true
  Check ((Convert-DiagnosticCapture $c 'unused.sql').status -ceq 'FAILED') 'unverified cleanup never succeeds'
  # Enforced bounded process kill on owned sleeping child, not a PostgreSQL retry.
  $sleep=Join-Path $private 'sleep.ps1';Write-DiagnosticNewFile $sleep 'Start-Sleep -Seconds 20'
  $x=Get-DiagnosticContext $specPath;$safe=New-DiagnosticChildEnvironment $x 'deadline-test'
  $capture=[LegalHubMaintenanceDiagnostics.ProcessCapture]::RunIsolated([Environment]::ProcessPath,[string[]]@('-NoProfile','-File',$sleep),100,$safe,$private)
  $safe.Clear();Check ($capture.Failure -ceq 'DEADLINE' -and -not $capture.CleanupFailed -and $null -ne $capture.ExitCode) 'owned child deadline terminates and reaps process'
  [IO.File]::Delete($sleep)
  $e=New-CaseEnvelope
  [void](Invoke-WithIsolatedEnvironment $config $null @{} {& (Join-Path $PostgresBin 'pg_ctl.exe') -D $cluster.Cluster -m fast -w -t 45 stop 2>$null})
  $d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.status -ceq 'FAILED' -and $d.nativeExitCode -eq 2 -and -not $d.verifiedIdentity -and $d.durationMs -lt 150000) 'stopped local server fails without retry'
  $allReports=@(Get-ChildItem $private -Filter '*.report.json' | ForEach-Object {[IO.File]::ReadAllText($_.FullName)}) -join "`n"
  Check ($allReports -notmatch ($canary+'|postgresql://|restore_admin|canary_private|system_identifier|WITH RECURSIVE')) 'reports contain no SQL catalog credentials or native responses'
  Check (@(Get-ChildItem $private -Filter 'diagnostic-*.sql').Count -eq 0) 'all owned query scratch files removed'
} finally {
  if($holder){Stop-DatabaseApplyLock $holder}
  if($cluster){Stop-DisposableCluster $config $cluster}
}
Check ($env:PATH -ceq $pathBefore) 'operator PATH unchanged'
Check ((Get-ExecutionPolicy -List | ConvertTo-Json -Compress) -ceq $policiesBefore) 'Execution Policy unchanged'
Write-Output ('DIAGNOSTIC_ONLY_PASS count='+$passed)
