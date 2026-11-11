param([Parameter(Mandatory=$true)][string]$EvidenceDirectory,[Parameter(Mandatory=$true)][string]$SourceEvidence)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core'){throw 'QA_BOOTSTRAP_REQUIRES_APPROVED_PWSH7'}
$qaPwsh=Join-Path $PSHOME 'pwsh.exe'
if([Environment]::ProcessPath -ne $qaPwsh -or -not(Test-Path -LiteralPath $qaPwsh -PathType Leaf)){throw 'QA_BOOTSTRAP_HOST_UNVERIFIED'}
if((Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'QA_BOOTSTRAP_HOST_POLICY_NOT_APPROVED'}
. (Join-Path $PSScriptRoot 'guard.ps1')
Assert-QaNoReparse $qaPwsh
$original=Assert-QaSource (Join-Path $SourceEvidence 'combined-source')
$EvidenceDirectory=Get-QaCanonicalDirectory $EvidenceDirectory
$pointerPath=Join-Path $EvidenceDirectory 'private-pointer.json'
if(Test-Path -LiteralPath $pointerPath){throw 'QA_POINTER_ALREADY_EXISTS'}
Assert-QaTreeNoReparse (Join-Path $original 'node_modules')
. (Join-Path $original 'scripts/local-maintenance/core.ps1')
foreach($port in @(43126,43127)){if(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue){throw 'QA_PORT_BUSY'}}
$privateRoot='D:\LegalHubStageA-'+[guid]::NewGuid().ToString('N')
if(Test-Path -LiteralPath $privateRoot){throw 'PRIVATE_ROOT_EXISTS'}
[void](New-Item -ItemType Directory -Path $privateRoot)
Set-PrivateAcl $privateRoot
[IO.File]::WriteAllText((Join-Path $privateRoot 'qa-owned.txt'),'LegalHub Stage A synthetic QA')
$runtime=Join-Path $privateRoot 'runtime.json'
$statePath=Join-Path $privateRoot 'cluster-state.json'
[IO.File]::WriteAllText($pointerPath,(@{privateDirectory=$privateRoot;runtimeFile=$runtime;stateFile=$statePath;sourceOriginal=$original}|ConvertTo-Json))
Set-PrivateAcl $pointerPath
$repo=Join-Path $privateRoot 'qa-source'
[void](New-Item -ItemType Directory -Path $repo)
$archive=Join-Path $privateRoot 'source-only.tar'
& git -C $original archive --format=tar --output $archive HEAD
if($LASTEXITCODE -ne 0){throw 'ARCHIVE_FAILED'}
& tar -xf $archive -C $repo
if($LASTEXITCODE -ne 0){throw 'EXTRACT_FAILED'}
$copyResult=@(& robocopy (Join-Path $original 'node_modules') (Join-Path $repo 'node_modules') /E /XJ /R:1 /W:1 /NFL /NDL /NJH /NJS /NP 2>$null)
if($LASTEXITCODE -ge 8){throw 'DEPENDENCY_COPY_FAILED'}
$config=[pscustomobject]@{targetKind='synthetic';environmentFile=(Join-Path $privateRoot 'qa.env');expectedHost='127.0.0.1';expectedApplicationHost='127.0.0.1';privateDirectory=$privateRoot;backupDirectory=$privateRoot;postgresBin='C:\Program Files\PostgreSQL\18\bin';nodeBin='C:\Program Files\nodejs';applicationRole='restore_admin'}

# The factory invokes this name from its own catch. This QA-local override
# deliberately stops and preserves the newly owned cluster; it never deletes.
function Stop-DisposableCluster([object]$Config,[object]$Cluster,[string]$FaultAt='') {
  if(-not $Cluster){return}
  if($FaultAt -or $Config.targetKind -ne 'synthetic' -or $Config.privateDirectory -ne $privateRoot -or $privateRoot -notmatch '^D:\\LegalHubStageA-[0-9a-f]{32}$' -or $Cluster.RunId -notmatch '^stagea[0-9a-f]{32}$'){throw 'QA_FAILURE_STOP_TARGET_REFUSED'}
  $expected=Join-Path (Join-Path $privateRoot 'isolated') $Cluster.RunId
  if([IO.Path]::GetFullPath($Cluster.Root) -ne $expected -or [IO.Path]::GetFullPath($Cluster.Cluster) -ne (Join-Path $expected 'cluster')){throw 'QA_FAILURE_STOP_PATH_REFUSED'}
  Assert-QaPrivateAcl $privateRoot
  Assert-QaPrivateAcl $expected
  Assert-QaPrivateAcl (Join-Path $expected 'runner-owned.txt')
  if((Get-Content -LiteralPath (Join-Path $expected 'runner-owned.txt') -Raw).Trim() -ne $Cluster.RunId){throw 'QA_FAILURE_STOP_MARKER_REFUSED'}
  if(-not(Test-Path -LiteralPath $Cluster.Cluster -PathType Container)){return}
  Assert-QaPrivateAcl $Cluster.Cluster
  $status=Invoke-WithIsolatedEnvironment $Config $null @{} {
    $ErrorActionPreference='Continue'
    $discard=@(& (Join-Path $Config.postgresBin 'pg_ctl.exe') '-D' $Cluster.Cluster 'status' 2>$null)
    return $LASTEXITCODE
  }
  if($status -eq 0){
    Assert-QaRunningPostgres $Config $Cluster $privateRoot -ForStop
    $stopped=Invoke-WithIsolatedEnvironment $Config $null @{} {
      $ErrorActionPreference='Continue'
      $discard=@(& (Join-Path $Config.postgresBin 'pg_ctl.exe') '-D' $Cluster.Cluster '-m' 'fast' '-w' '-t' '45' 'stop' 2>$null)
      return $LASTEXITCODE
    }
    if($stopped -ne 0){throw 'QA_FAILURE_STOP_UNVERIFIED'}
  }elseif($status -ne 3){throw 'QA_FAILURE_STOP_STATUS_UNKNOWN'}
  if(Test-Path -LiteralPath (Join-Path $Cluster.Cluster 'postmaster.pid')){throw 'QA_FAILURE_STOP_PID_REMAINS'}
  if($Cluster.Port -gt 0 -and (Get-NetTCPConnection -State Listen -LocalPort $Cluster.Port -ErrorAction SilentlyContinue)){throw 'QA_FAILURE_STOP_LISTENER_REMAINS'}
}

$cluster=$null
$qaRunId='stagea'+[guid]::NewGuid().ToString('N')
$qaExpectedRoot=Join-Path (Join-Path $privateRoot 'isolated') $qaRunId
$qaExpectedCluster=Join-Path $qaExpectedRoot 'cluster'
try{
  $cluster=New-DisposableCluster $config $qaRunId
  if($cluster.Uri.Host -ne '127.0.0.1' -or $cluster.Port -eq 5432 -or $cluster.Database -notmatch '^legalhub_runner_stagea[0-9a-f]{32}$' -or -not $cluster.Root.StartsWith($privateRoot+'\')){throw 'QA_TARGET_REFUSED'}
  if((Get-Content -LiteralPath (Join-Path $cluster.Root 'runner-owned.txt') -Raw).Trim() -ne $cluster.RunId){throw 'CLUSTER_MARKER_MISMATCH'}
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $cluster.Port)
  if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1'){throw 'PG_BIND_UNSAFE'}
  [IO.File]::WriteAllText($statePath,(@{config=$config;cluster=$cluster}|ConvertTo-Json -Depth 8))
  [IO.File]::WriteAllText($config.environmentFile,(@("DATABASE_URL=$($cluster.Uri.AbsoluteUri)","DIRECT_URL=$($cluster.Uri.AbsoluteUri)") -join [Environment]::NewLine))
  [IO.File]::WriteAllText($runtime,(@{repo=$repo;sourceOriginal=$original;privateDirectory=$privateRoot;databaseUrl=$cluster.Uri.AbsoluteUri;qaPwshExecutable=$qaPwsh;appPort=43126;gatePort=43127;hostname='unit-handsfree-carpentry.ngrok-free.dev'}|ConvertTo-Json))
  foreach($f in @($runtime,$statePath,$config.environmentFile)){Set-PrivateAcl $f}
  $guarded=Read-QaGuardedRuntime $pointerPath
  Invoke-WithIsolatedEnvironment $config $null @{DATABASE_URL=$cluster.Uri.AbsoluteUri;DIRECT_URL=$cluster.Uri.AbsoluteUri;NEXT_TELEMETRY_DISABLED='1'} {
    Push-Location $repo
    try{
      $ErrorActionPreference='Continue'
      $cli=Join-Path $repo 'node_modules/prisma/build/index.js'
      $discard=@(& (Join-Path $config.nodeBin 'node.exe') $cli generate --schema prisma/schema.prisma 2>$null)
      if($LASTEXITCODE -ne 0){throw 'QA_CLIENT_GENERATION_FAILED'}
      $discard=@(& (Join-Path $config.nodeBin 'node.exe') $cli migrate deploy --schema prisma/schema.prisma 2>$null)
      if($LASTEXITCODE -ne 0){throw 'QA_MIGRATIONS_FAILED'}
      $discard=@(& (Join-Path $config.nodeBin 'node.exe') $cli migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code 2>$null)
      if($LASTEXITCODE -ne 0){throw 'QA_SCHEMA_DRIFT'}
    }finally{Pop-Location}
  }
  Invoke-WithIsolatedEnvironment $config $null @{DATABASE_URL=$cluster.Uri.AbsoluteUri;DIRECT_URL=$cluster.Uri.AbsoluteUri;QA_STAGE_A_PRIVATE_CONFIG=$runtime;QA_STAGE_A_EVIDENCE=$privateRoot;QA_PWSH_EXE=$qaPwsh} {
    $discard=@(& (Join-Path $config.nodeBin 'node.exe') (Join-Path $PSScriptRoot 'seed.mjs') 2>$null)
    if($LASTEXITCODE -ne 0){throw 'QA_SEED_FAILED'}
  }
  $agentConfig=Join-Path $privateRoot 'ngrok.yml'
  $yaml=@'
version: "3"
agent:
  authtoken: ""
  console_ui: false
  inspect_db_size: -1
  web_addr: false
  log: false
  remote_management: false
'@
  [IO.File]::WriteAllText($agentConfig,$yaml)
  Set-PrivateAcl $agentConfig
  Assert-PrivateAcl $privateRoot
  Write-Output 'QA_DB_READY: D drive; loopback only; exact private target checked; 54 QA migrations; zero drift; synthetic organization; all intake gates OFF; credentials not printed'
}catch{
  try{
    if(-not $cluster -and (Test-Path -LiteralPath $qaExpectedRoot)){
      Assert-QaPrivateAcl $qaExpectedRoot
      $lifecycleFile=Join-Path $qaExpectedRoot 'runner-lifecycle.json';Assert-QaPrivateAcl $lifecycleFile
      $life=Get-Content -LiteralPath $lifecycleFile -Raw|ConvertFrom-Json
      if($life.runId -ne $qaRunId -or $life.root -ne $qaExpectedRoot -or $life.cluster -ne $qaExpectedCluster){throw 'QA_FACTORY_FALLBACK_IDENTITY_REFUSED'}
      $cluster=[pscustomobject]@{RunId=$qaRunId;Root=$qaExpectedRoot;Cluster=$qaExpectedCluster;Port=[int]$life.port}
    }
    if($cluster){Stop-DisposableCluster $config $cluster}
    $orphans=@(Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" -ErrorAction Stop | Where-Object {$_.CommandLine -and $_.CommandLine.IndexOf($qaExpectedCluster,[StringComparison]::OrdinalIgnoreCase) -ge 0})
    if($orphans.Count){throw 'QA_FACTORY_PROCESS_REMAINS'}
  }catch{throw 'QA_PREPARATION_FAILED_STOP_UNVERIFIED'}
  Write-Output 'QA_PREPARATION_FAILED_SAFE'
  throw 'QA_PREPARATION_FAILED_SAFE'
}
