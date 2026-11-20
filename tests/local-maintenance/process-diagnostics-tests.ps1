#requires -Version 7
param([switch]$WithPostgres,[string]$PostgresBin='C:\Program Files\PostgreSQL\18\bin')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
. (Join-Path $PSScriptRoot 'report-functions.ps1')
$passed=0
function Assert-Test([bool]$Value,[string]$Name){if(-not $Value){throw ('DIAGNOSTIC_TEST_FAILED:'+$Name)};$script:passed++;Write-Output ('PASS '+$Name)}
function Capture-Failure([scriptblock]$Action,[string]$Code){
  try{& $Action|Out-Null}catch{if($_.Exception.Message -cne ('LMR:'+$Code)){if($_.Exception.Message -cmatch '^LMR:([A-Z0-9_]+)$'){throw ('DIAGNOSTIC_WRONG_FAILURE_CODE:'+$Matches[1])}else{throw ('DIAGNOSTIC_WRONG_FAILURE_TYPE:'+$_.Exception.GetType().Name)}};return $_}
  throw 'DIAGNOSTIC_FAILURE_EXPECTED'
}
$canary='SYNTHETIC_SECRET_CUSTOMER_7e2c'
$file='C:\synthetic\'+$canary+'.sql'
foreach($state in @('42601','42501','42P01','57014','55P03')){
  $c=[pscustomobject]@{ExitCode=3;DurationMs=[long]7;Errors=('psql:'+$file+':1: ERROR:  '+$state+"`n");ErrorTruncated=$false;Failure='';CleanupFailed=$false}
  $d=New-SafePostgresDiagnostic $c 'Direct' 'STRUCTURE_PROOF' 'STRUCTURE_PROOF_QUERY_FAILED' $file
  Assert-Test ($d.sqlState -ceq $state -and ($d|ConvertTo-Json -Compress) -notmatch $canary) 'complete structured SQLSTATE only'
  if($state -in @('57014','55P03')){Assert-Test ($d.timeoutCategory -ceq 'UNKNOWN') 'SQLSTATE alone does not prove timeout cause'}
}
foreach($bad in @('42501',('ERROR: 42501 '+$canary),('psql:other.sql:1: ERROR:  42501'+"`n"),('psql:'+$file+':1: ERROR:  42501'+"`n"+$canary),('psql:'+$file+':1: ОШИБКА:  42501 '+$canary+"`n"),('psql:'+$file+':1: ERROR:  ZZZZZ'+"`n"))){
  $c.Errors=$bad
  $d=New-SafePostgresDiagnostic $c 'Direct' 'STRUCTURE_PROOF' 'STRUCTURE_PROOF_QUERY_FAILED' $file
  Assert-Test ($null -eq $d.sqlState -and $d.errorCategory -ceq 'UNKNOWN') 'malformed/localized/foreign state stays unknown'
}
$c.Errors='psql:'+$file+':1: ERROR:  42501'+"`n";$c.ExitCode=1
$d=New-SafePostgresDiagnostic $c 'Direct' 'STRUCTURE_PROOF' 'STRUCTURE_PROOF_QUERY_FAILED' $file
Assert-Test ($null -eq $d.sqlState -and $d.errorCategory -ceq 'UNKNOWN') 'generic exit1 is not a SQL diagnosis'
$c.ExitCode=3;$c.ErrorTruncated=$true
Assert-Test ($null -eq (New-SafePostgresDiagnostic $c 'Direct' 'STRUCTURE_PROOF' 'STRUCTURE_PROOF_QUERY_FAILED' $file).sqlState) 'truncation prevents parsing'
$base=Join-Path $env:LOCALAPPDATA 'LegalHubSafeDiagnosticTests'
if(-not(Test-Path $base)){[void](New-Item -ItemType Directory -Path $base);Set-PrivateAcl $base}
Assert-PrivateAcl $base;Assert-NotReparsePoint $base
$id=[guid]::NewGuid().ToString('N').Substring(0,12);$root=Assert-ChildPath $base (Join-Path $base $id)
[void](New-Item -ItemType Directory -Path $root);Set-PrivateAcl $root
[IO.File]::WriteAllText((Join-Path $root 'diagnostic-test-owned.txt'),$id)
foreach($dir in @('private','backups')){[void](New-Item -ItemType Directory -Path (Join-Path $root $dir));Set-PrivateAcl (Join-Path $root $dir)}
$config=[pscustomobject]@{targetKind='synthetic';environmentFile=(Join-Path $root 'synthetic.env');expectedHost='127.0.0.1';expectedApplicationHost='127.0.0.1';privateDirectory=(Join-Path $root 'private');backupDirectory=(Join-Path $root 'backups');postgresBin=$PostgresBin;nodeBin=(Split-Path (Get-Command node.exe).Source);applicationRole='restore_admin'}
$cluster=$null
try{
  $badChild=Join-Path $root 'stderr-canary.cjs'
  [IO.File]::WriteAllText($badChild,('process.stderr.write("'+$canary+'".repeat(2000));process.exit(1)'))
  $e=Capture-Failure {$r=Invoke-DiagnosticPostgresProcess (Join-Path $config.nodeBin 'node.exe') @($badChild) 'Direct' 'STRUCTURE_PROOF_QUERY_FAILED';if($r.ExitCode -ne 0){Throw-PostgresDiagnostic 'STRUCTURE_PROOF_QUERY_FAILED' $r.Diagnostic}} 'STRUCTURE_PROOF_QUERY_FAILED'
  $d=Get-SafePostgresDiagnostic $e
  Assert-Test ($d.nativeExitCode -eq 1 -and $null -eq $d.sqlState -and $d.durationMs -ge 0) 'bounded drain records exact native exit'
  Assert-Test (($d|ConvertTo-Json -Compress) -notmatch $canary) 'oversized secret stderr never enters diagnostic'

  $exit2=Join-Path $root 'exit2.cjs';[IO.File]::WriteAllText($exit2,'process.exit(2)')
  $r=Invoke-DiagnosticPostgresProcess (Join-Path $config.nodeBin 'node.exe') @($exit2) 'Session' 'STRUCTURE_PROOF_QUERY_FAILED'
  Assert-Test ($r.ExitCode -eq 2 -and $r.Diagnostic.errorCategory -ceq 'UNKNOWN') 'non-psql exit2 has no borrowed psql meaning'
  $overflow=Join-Path $root 'overflow.cjs';[IO.File]::WriteAllText($overflow,'process.stdout.write("x".repeat(5*1024*1024))')
  $overflowError=Capture-Failure {Invoke-DiagnosticPostgresProcess (Join-Path $config.nodeBin 'node.exe') @($overflow) 'Direct' 'STRUCTURE_PROOF_QUERY_FAILED'} 'PSQL_TOOL_OUTPUT_TOO_LARGE'
  Assert-Test ((Get-SafePostgresDiagnostic $overflowError).runnerFailureCode -ceq 'PSQL_TOOL_OUTPUT_TOO_LARGE') 'stdout retention ceiling stays fail-closed'
  $e.Exception.Data['QueryFileCleanupFailed']=$true
  Assert-Test ((Get-SafePostgresDiagnostic $e).cleanupFailed -and $e.Exception.Message -ceq 'LMR:STRUCTURE_PROOF_QUERY_FAILED') 'cleanup cannot mask primary failure'
  $other=[Management.Automation.ErrorRecord]::new([Exception]::new('LMR:UNRELATED'),'x',[Management.Automation.ErrorCategory]::NotSpecified,$null)
  Assert-Test ($null -eq (Get-SafePostgresDiagnostic $other)) 'unrelated failure has no stale diagnostic'
  $invalid=[Management.Automation.ErrorRecord]::new([Exception]::new('LMR:STRUCTURE_PROOF_QUERY_FAILED'),'x',[Management.Automation.ErrorCategory]::NotSpecified,$null)
  $invalid.Exception.Data['SafePostgresDiagnostic']=[pscustomobject]@{raw=$canary}
  Assert-Test ($null -eq (Get-SafePostgresDiagnostic $invalid)) 'malformed diagnostic object is discarded without serialization'

  $slow=Join-Path $root 'slow.cjs';[IO.File]::WriteAllText($slow,'setTimeout(()=>{},3000)')
  foreach($mode in @('Direct','Session')){
    $code=if($mode -ceq 'Direct'){'PSQL_TOOL_DEADLINE_EXCEEDED'}else{'SESSION_TOOL_DEADLINE_EXCEEDED'}
    $e=Capture-Failure {Invoke-DiagnosticPostgresProcess (Join-Path $config.nodeBin 'node.exe') @($slow) $mode 'STRUCTURE_PROOF_QUERY_FAILED' 100} $code
    $d=Get-SafePostgresDiagnostic $e
    Assert-Test ($d.timeoutCategory -ceq 'PROCESS_DEADLINE' -and $d.durationMs -ge 50 -and $d.connectionMode -ceq $mode) 'actual bounded process deadline'
  }
  if($WithPostgres){
    $cluster=New-DisposableCluster $config ('diag'+$id)
    $path=Join-Path $root 'setup.sql'
    [IO.File]::WriteAllText($path,'CREATE TABLE public.diag_private(id integer); CREATE ROLE diag_reader LOGIN PASSWORD ''synthetic_only''; REVOKE ALL ON public.diag_private FROM PUBLIC;')
    [void](Invoke-PostgresTool $config $cluster.Uri 'psql.exe' @('-X','-q','-v','ON_ERROR_STOP=1','-f',$path) 'DIAGNOSTIC_FIXTURE_FAILED')
    [IO.File]::Delete($path)
    $b=[UriBuilder]::new($cluster.Uri);$b.UserName='diag_reader';$b.Password='synthetic_only';$reader=$b.Uri
    function Read-Test([string]$Mode,[Uri]$Uri,[string]$Query){
      if($Mode -ceq 'Direct'){return Invoke-ReadOnlyQuery $config $Uri $Query 'STRUCTURE_PROOF_QUERY_FAILED'}
      $path=Join-Path $root ('q-'+$canary+'.sql')
      [IO.File]::WriteAllText($path,('BEGIN READ ONLY; SET LOCAL statement_timeout=''30s''; '+$Query+'; ROLLBACK;'),[Text.UTF8Encoding]::new($false))
      try{
        $r=Invoke-WithIsolatedEnvironment $config $Uri @{} {Invoke-BoundedSessionTool (Join-Path $config.postgresBin 'psql.exe') @('-w','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate','-v','SHOW_CONTEXT=never','-f',$path) -FailureCode 'STRUCTURE_PROOF_QUERY_FAILED'}
        if($r.ExitCode -ne 0){Throw-PostgresDiagnostic 'STRUCTURE_PROOF_QUERY_FAILED' $r.Diagnostic}
        return @($r.Output|Where-Object {$_ -notmatch '^(BEGIN|SET|ROLLBACK)$'})
      }finally{[IO.File]::Delete($path)}
    }
    foreach($mode in @('Direct','Session')){
      $cases=@(@('syntax',('SELEC '+$canary),'42601',$cluster.Uri),@('permission','SELECT * FROM public.diag_private','42501',$reader),@('missing',('SELECT * FROM public."'+$canary+'"'),'42P01',$cluster.Uri),@('statement','SET LOCAL statement_timeout=''100ms''; SELECT pg_sleep(2)','57014',$cluster.Uri))
      foreach($case in $cases){
        $e=Capture-Failure {Read-Test $mode $case[3] $case[1]} 'STRUCTURE_PROOF_QUERY_FAILED';$d=Get-SafePostgresDiagnostic $e
        Assert-Test ($d.nativeExitCode -eq 3 -and $d.sqlState -ceq $case[2] -and $d.connectionMode -ceq $mode -and $d.durationMs -ge 0) ('actual PostgreSQL '+$mode+' '+$case[0])
        Assert-Test (($d|ConvertTo-Json -Compress) -notmatch $canary) 'SQL diagnostic excludes canary query/object/path'
        $saved=Save-SafeReport $config ([ordered]@{runId=([guid]::NewGuid().ToString('N').Substring(0,12));postgresDiagnostic=$d})
        Assert-Test ([IO.File]::ReadAllText($saved) -notmatch $canary) 'private report has no canary';Assert-PrivateAcl $saved
      }
      $lock=Invoke-WithIsolatedEnvironment $config $cluster.Uri @{} {
        $psi=[Diagnostics.ProcessStartInfo]::new((Join-Path $config.postgresBin 'psql.exe'))
        foreach($arg in @('-w','-X','-q','-A','-t')){[void]$psi.ArgumentList.Add($arg)}
        $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
        [Diagnostics.Process]::Start($psi)
      }
      try{
        $lock.StandardInput.WriteLine('BEGIN; LOCK TABLE public.diag_private IN ACCESS EXCLUSIVE MODE; SELECT 7;');$lock.StandardInput.Flush()
        $ready=$lock.StandardOutput.ReadLineAsync();if(-not $ready.Wait(5000) -or $ready.Result -cne '7'){throw 'SYNTHETIC_LOCK_NOT_READY'}
        $e=Capture-Failure {Read-Test $mode $cluster.Uri 'SET LOCAL lock_timeout=''100ms''; SELECT * FROM public.diag_private'} 'STRUCTURE_PROOF_QUERY_FAILED';$d=Get-SafePostgresDiagnostic $e
        Assert-Test ($d.nativeExitCode -eq 3 -and $d.sqlState -ceq '55P03' -and $d.errorCategory -ceq 'LOCK_UNAVAILABLE' -and $d.timeoutCategory -ceq 'UNKNOWN') 'lock timeout captured without confusing NOWAIT'
      }finally{$lock.StandardInput.WriteLine('\q');$lock.StandardInput.Flush();$lock.StandardInput.Close();if(-not $lock.WaitForExit(10000)){throw 'SYNTHETIC_LOCK_CLEANUP_FAILED'};$lock.Dispose()}
      $b=[UriBuilder]::new($cluster.Uri);$b.Password='wrong_synthetic_only'
      $e=Capture-Failure {Read-Test $mode $b.Uri 'SELECT 1'} 'STRUCTURE_PROOF_QUERY_FAILED';$d=Get-SafePostgresDiagnostic $e
      Assert-Test ($d.nativeExitCode -eq 2 -and $null -eq $d.sqlState -and $d.errorCategory -ceq 'CONNECTION') 'authentication refusal without guessed SQLSTATE'
      Assert-Test ((Read-Test $mode $cluster.Uri 'SELECT 7') -contains '7') 'successful query after failures'
      $success=Invoke-WithIsolatedEnvironment $config $cluster.Uri @{} {Invoke-BoundedSessionTool (Join-Path $config.postgresBin 'psql.exe') @('--version')}
      Assert-Test ($success.ExitCode -eq 0 -and $null -eq $success.Diagnostic) 'success clears native failure diagnostic'

    }

    & {
      function Test-Path {
        param([string]$LiteralPath,[string]$Path,[string]$PathType)
        if($LiteralPath -match 'query-[0-9a-f]{32}\.sql$' -and $PathType -eq 'Leaf'){throw 'SYNTHETIC_QUERY_FILE_CLEANUP_FAILURE'}
        Microsoft.PowerShell.Management\Test-Path @PSBoundParameters
      }
      $e=Capture-Failure {Invoke-ReadOnlyQuery $config $reader 'SELECT * FROM public.diag_private' 'STRUCTURE_PROOF_QUERY_FAILED'} 'STRUCTURE_PROOF_QUERY_FAILED'
      $d=Get-SafePostgresDiagnostic $e
      Assert-Test ($d.sqlState -ceq '42501' -and $d.cleanupFailed) 'actual query-file cleanup fault preserves native primary error'
    }
    # Actual Invoke-Preflight control flow, test-only initial-query injection.
    # It executes a real permission failure on our own table, without modifying
    # production query text or system catalog privileges.
    $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repo 'scripts/local-maintenance/runner.ps1'),[ref]$null,[ref]$null)
    foreach($name in @('Get-Expected','Invoke-Preflight','Get-CheckedState','Get-SafeErrorCode')){
      $def=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $name},$false))[0]
      . ([scriptblock]::Create($def.Extent.Text))
    }
    $ApprovedCommit=(& git -C $repo rev-parse HEAD).Trim();$Synthetic=$true;$NoMigration=$false;$ExpectedMigrations=[string[]]@('20261027120000_meta_lead_ads_multitenant')
    $script:diagnosticFixtureConfig=$config
    function Get-Config {return $script:diagnosticFixtureConfig}
    function Get-PreflightSourceUri {return $reader}
    function Get-StructureProof {Invoke-ReadOnlyQuery $script:diagnosticFixtureConfig $reader 'SELECT * FROM public.diag_private' 'STRUCTURE_PROOF_QUERY_FAILED'}
    $e=Capture-Failure {Invoke-Preflight $repo} 'STRUCTURE_PROOF_QUERY_FAILED'
    Assert-Test (@(Get-ChildItem $config.backupDirectory -File).Count -eq 0 -and -not(Test-Path (Join-Path $config.privateDirectory 'plans'))) 'initial structure failure creates no backup or seal'
    $records=@(Get-ChildItem (Join-Path $config.privateDirectory 'reports') -File|ForEach-Object {Get-Content $_.FullName -Raw|ConvertFrom-Json})
    $blocked=@($records|Where-Object {$_.PSObject.Properties['result'] -and $_.result -ceq 'PREFLIGHT_BLOCKED'})
    Assert-Test ($blocked.Count -eq 1 -and $blocked[0].postgresDiagnostic.sqlState -ceq '42501' -and $blocked[0].postgresDiagnostic.nativeExitCode -eq 3) 'real initial failure report captures native diagnostic'
    Assert-Test ($blocked[0].nextAction -ceq 'INDEPENDENT_DIAGNOSIS_AND_NEW_OWNER_AUTHORIZATION') 'no automatic retry recommendation'
    $uri=$cluster.Uri;Stop-DisposableCluster $config $cluster;$cluster=$null
    foreach($mode in @('Direct','Session')){
      $e=Capture-Failure {Read-Test $mode $uri 'SELECT 1'} 'STRUCTURE_PROOF_QUERY_FAILED';$d=Get-SafePostgresDiagnostic $e
      Assert-Test ($d.nativeExitCode -eq 2 -and $null -eq $d.sqlState -and $d.errorCategory -ceq 'CONNECTION') 'stopped-server failure remains blocked'
    }
  }
  Write-Output ('SAFE_POSTGRES_DIAGNOSTICS_PASS count='+$passed)
}finally{
  if($cluster){Stop-DisposableCluster $config $cluster}
  Assert-NoUnverifiedDisposableClusters $config
  Write-Output 'DIAGNOSTIC_OWNED_CLUSTERS_STOPPED; synthetic ACL reports retained locally'
}
