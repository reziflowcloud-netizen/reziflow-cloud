$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'guard.ps1')
$checks=0
function Expect-QaRejected([scriptblock]$Action){
  $blocked=$false
  try{& $Action}catch{$blocked=$true}
  if(-not $blocked){throw 'QA_GUARD_REJECTION_TEST_FAILED'}
  $script:checks++
}

$run='stagea'+'a'*32;$db='legalhub_runner_'+$run
$good='postgresql://fixture:fixture@127.0.0.1:55123/'+$db+'?schema=public'
$cluster=[pscustomobject]@{Port=55123;RunId=$run;Database=$db;Uri=$good}
Assert-QaDatabaseTarget ([Uri]$good) $cluster $good;$checks++
foreach($bad in @($good.Replace(':55123/',':5432/'),$good.Replace(':55123/','/'),$good.Replace('127.0.0.1','remote.invalid'),$good.Replace($db,'postgres'),$good.Replace('postgresql:','https:'))){
  $candidate=$bad;Expect-QaRejected {Assert-QaDatabaseTarget ([Uri]$candidate) $cluster $candidate}
}

$root='D:\LegalHubStageA-'+('b'*32)
$data=Join-Path (Join-Path (Join-Path $root 'isolated') $run) 'cluster'
$born=[DateTimeOffset]::Parse('2026-11-10T10:00:00Z')
$start=$born.AddSeconds(20)
$baseline=@{PidfilePid=12345;ProcessId=12345;PidfilePort=55123;ExpectedPort=55123;PidfileDataPath=$data;ExpectedClusterPath=$data;PidfileListenAddress='127.0.0.1';PidfileStatus='ready';ExecutablePath='C:\Program Files\PostgreSQL\18\bin\postgres.exe';ExpectedExecutablePath='C:\Program Files\PostgreSQL\18\bin\postgres.exe';ProcessOwnerSid='fixture-owner';CurrentOwnerSid='fixture-owner';ProcessCreatedUtc=$start;RootCreatedUtc=$born;PidfileStartUnix=$start.ToUnixTimeSeconds();CommandLine=('"C:\Program Files\PostgreSQL\18\bin\postgres.exe" "-D" "'+$data+'"');Listeners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=12345})}
Assert-QaRunningEvidence ([pscustomobject]$baseline);$checks++
$mutations=@(
  @{ProcessId=12346},@{PidfilePort=5432},@{PidfileListenAddress='0.0.0.0'},@{PidfileStatus='starting'},
  @{PidfileDataPath='C:\unrelated'},@{ExecutablePath='C:\unrelated\postgres.exe'},@{ProcessOwnerSid='different-owner'},
  @{ProcessCreatedUtc=$born.AddMinutes(-1)},@{PidfileStartUnix=$start.AddMinutes(-1).ToUnixTimeSeconds()},
  @{CommandLine='postgres.exe -D C:\unrelated'},
  @{Listeners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=54321})},
  @{Listeners=@([pscustomobject]@{LocalAddress='0.0.0.0';OwningProcess=12345})},@{Listeners=@()}
)
foreach($mutation in $mutations){$fixture=$baseline.Clone();foreach($key in $mutation.Keys){$fixture[$key]=$mutation[$key]};Expect-QaRejected {Assert-QaRunningEvidence ([pscustomobject]$fixture)}}
$forStop=$baseline.Clone();$forStop.PidfileStatus='starting';$forStop.Listeners=@()
Assert-QaRunningEvidence ([pscustomobject]$forStop) -ForStop;$checks++

# Preserve source wrappers; inject only a failing fake guard into test copies.
# Child scripts use -File so host execution policy is enforced, never bypassed.
# Fixtures contain only synthetic canaries and are retained for owner review.
$canary='CANARY_PRIVATE_INPUT_'+[Guid]::NewGuid().ToString('N')
$jsonFailure=@"
'{"private":"$canary", BROKEN' | ConvertFrom-Json -ErrorAction Stop
"@
$uriFailure="[Uri]::new('postgresql://$canary@[broken')"
$shell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$importLine=". (Join-Path `$PSScriptRoot 'guard.ps1')"
$testRoot=Join-Path ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))) ('artifacts/qa-guard-unit-'+[Guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $testRoot)
$fixtureIndex=0
foreach($entry in @(
  @{File='build.ps1';Function='Read-QaGuardedRuntime';Parameter='PointerPath';Expected='QA_BUILD_FAILED_SAFE'},
  @{File='verify-running.ps1';Function='Assert-QaPrivateAcl';Parameter='RuntimeFile';Expected='QA_SERVER_OWNERSHIP_BLOCKED'},
  @{File='stop-qa.ps1';Function='Read-QaGuardedRuntime';Parameter='PointerPath';Expected='QA_PG_STOP_BLOCKED'}
)){
  $source=Get-Content -LiteralPath (Join-Path $PSScriptRoot $entry.File) -Raw
  if(([regex]::Matches($source,[regex]::Escape($importLine))).Count -ne 1){throw 'QA_TEST_IMPORT_BOUNDARY_CHANGED'}
  foreach($failure in @($jsonFailure,$uriFailure)){
    $stub='function '+$entry.Function+' { '+$failure+' }'
    $body=$source.Replace($importLine,$stub)
    $fixtureIndex++
    $fixtureFile=Join-Path $testRoot ('entry-'+$fixtureIndex+'.ps1')
    [IO.File]::WriteAllText($fixtureFile,$body,[Text.UTF8Encoding]::new($false))
    $savedPreference=$ErrorActionPreference
    try{
      $ErrorActionPreference='Continue'
      $capture=@(& $shell -NoProfile -NonInteractive -File $fixtureFile ('-'+$entry.Parameter) 'C:\QA_CATCH_TEST_ONLY' 2>&1)
      $code=$LASTEXITCODE
    }finally{$ErrorActionPreference=$savedPreference}
    $text=$capture -join "`n"
    if($code -eq 0 -or -not $text.Contains($entry.Expected) -or $text.Contains($canary)){throw 'QA_PRIVATE_INPUT_SANITIZATION_FAILED'}
    $checks++
  }
}

$tokens=$null;$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'bootstrap.ps1'),[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'QA_BOOTSTRAP_PARSE_FAILED'}
$stop=$ast.Find({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Stop-DisposableCluster'},$true)
if(-not $stop -or $stop.Extent.Text -match 'Remove-Item|\[IO\.File\]::Delete|\[IO\.Directory\]::Delete'){throw 'QA_FAILURE_PRESERVATION_STATIC_FAILED'}
$factory=$ast.FindAll({param($n) $n -is [System.Management.Automation.Language.CommandAst] -and $n.GetCommandName() -eq 'New-DisposableCluster'},$true)
if($factory.Count -ne 1 -or $factory[0].Extent.StartOffset -lt $stop.Extent.EndOffset){throw 'QA_STOP_OVERRIDE_ORDER_FAILED'}
$checks++
Write-Output ('QA_OFFLINE_GUARD_TESTS_PASS: '+$checks+' checks; no real credentials, network, DB or process control')
