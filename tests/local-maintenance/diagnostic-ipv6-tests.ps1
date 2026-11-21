#requires -Version 7
param([Parameter(Mandatory)][string]$PostgresBin)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $repo 'scripts/local-maintenance/diagnostic-only-lib.ps1')
$passed=0
function Check([bool]$ok,[string]$name){if(-not $ok){throw ('IPV6_TEST_FAILED:'+$name)};$script:passed++;Write-Output ('PASS '+$name)}
function Block([scriptblock]$action,[string]$code){$hit=$false;try{& $action|Out-Null}catch{$hit=$_.Exception.Message -ceq ('LHD:'+$code)};Check $hit ('closed gate '+$code)}
$model=@{database='legalhub_runner_synthetic_model';maintenanceRole='restore_admin';applicationRole='restore_admin';databaseOid='1';systemIdentifier='12345';serverVersionNum='170012';ipv4='127.0.0.1'}
Check ((Get-Sha256Text (Get-DiagnosticSql $model $true).script) -ceq '51450915afbe3fece0551992c6b64eb2816ab69e74e2642d4273a10b590890fc') 'v1 synthetic SQL bytes unchanged from reviewed1700f46'
Check ((Get-Sha256Text (Get-DiagnosticSql $model $false).script) -ceq '473266507026300ac8a43fc452813fc2d60fc5e4e2b3bc8ce8b0da8399fa3ccf') 'v1 Production SQL bytes unchanged from reviewed1700f46'
$v2=$model.Clone();$v2.Remove('ipv4');$v2.addressFamily='IPv6';$v2.address='::1'
foreach($bad in @('','localhost','::1,127.0.0.1','::1,::2','[::1]','fe80::1%3','::ffff:127.0.0.1','::ffff:7f00:1','2001:0db8::1','2600:ABCD::1',' ::1','::1 ')){
  $p=$v2.Clone();$p.address=$bad;Block {Get-DiagnosticAddress $p 2} 'EXPECTED_IP_PIN_REQUIRED'
}
$p=$model.Clone();$p.ipv4='::1';Block {Get-DiagnosticAddress $p 1} 'EXPECTED_IP_PIN_REQUIRED'
$p=$model.Clone();$p.addressFamily='IPv6';$p.address='::1';Block {Get-DiagnosticAddress $p 1} 'EXPECTED_IP_PIN_REQUIRED'
$p=$v2.Clone();$p.addressFamily='IPv4';Block {Get-DiagnosticAddress $p 2} 'EXPECTED_IP_PIN_REQUIRED'
foreach($bad in @('::','::1','fe80::1','ff02::1','fc00::1','fd00::1','64:ff9b::1','100::1','2001::1','2001:db8::1','2002::1','2620:4f:8000::1','3fff::1','5f00::1')){
  $p=$v2.Clone();$p.address=$bad;Block {Assert-DiagnosticExternalAddress (Get-DiagnosticAddress $p 2)} 'PRODUCTION_IPV6_DESTINATION_FORBIDDEN'
}
$p=$v2.Clone();$p.address='2600:1::abcd';Assert-DiagnosticExternalAddress (Get-DiagnosticAddress $p 2);Check $true 'native global-unicast syntax is not an attestation'
$first=Get-DiagnosticSql $v2 $true 2 $true;$p=$v2.Clone();$p.address='::2';$second=Get-DiagnosticSql $p $true 2 $true
Check ((Get-Sha256Text $first.script) -cne (Get-Sha256Text $second.script) -and $first.proofSha256 -ceq $second.proofSha256 -and $first.identitySha256 -ceq $second.identitySha256) 'address changes script binding without changing SELECT payloads'
# Availability check is a LOCAL disposable listen socket, never a remote/TCP5432 probe.
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::IPv6Loopback,0)
try{$listener.Start();Check $true 'local IPv6 loopback socket available'}finally{$listener.Stop()}
$root=Join-Path $env:LOCALAPPDATA ('LegalHubDiagnosticIPv6Tests-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root);Set-PrivateAcl $root
$private=Join-Path $root 'private with spaces';[void][IO.Directory]::CreateDirectory($private);Set-PrivateAcl $private
$dossier=Join-Path $private 'synthetic-provider-record.json'
$ref='https://github.com/reziflowcloud-netizen/reziflow-cloud/pull/24#issuecomment-1'
$statement=@{version=1;addressFamily='IPv6';address='2600:1::abcd';hostname='db.synthetic.supabase.co';providerReference='https://provider.invalid/synthetic-record';reviewReference=$ref}
Write-DiagnosticNewFile $dossier ($statement|ConvertTo-Json)
$attestation=@{addressAttestationFile=$dossier;addressAttestationSha256=(Get-DiagnosticHash $dossier);trustReviewReference=$ref}
$address=@{family='IPv6';address='2600:1::abcd'}
Assert-DiagnosticAddressAttestation $attestation $address 'db.synthetic.supabase.co';Check $true 'synthetic dossier binding does not claim provider authenticity'
Block {Assert-DiagnosticAddressAttestation @{addressAttestationFile='';addressAttestationSha256=''} $address 'db.synthetic.supabase.co'} 'ADDRESS_ATTESTATION_BINDING_REQUIRED'
Block {Assert-DiagnosticAddressAttestation $attestation $address 'db.other.supabase.co'} 'ADDRESS_ATTESTATION_BINDING_REQUIRED'
[IO.File]::AppendAllText($dossier,' ')
Block {Assert-DiagnosticAddressAttestation $attestation $address 'db.synthetic.supabase.co'} 'ADDRESS_ATTESTATION_BINDING_REQUIRED'
$source=[pscustomobject]@{targetKind='synthetic';connectionMode='direct';environmentFile=(Join-Path $root 'source.env');privateDirectory=$private;
  postgresBin=$PostgresBin;nodeBin=(Split-Path (Get-Command node.exe).Source);expectedHost='127.0.0.1';expectedApplicationHost='127.0.0.1';applicationRole='restore_admin'}
$cluster=$null;$ca=$null;$rootKey=$null;$serverKey=$null
$specPath=Join-Path $root 'spec.json';$configPath=Join-Path $root 'config.json';$canary='SYNTHETIC_IPV6_SECRET_15c8'
$pathBefore=$env:PATH;$policyBefore=Get-ExecutionPolicy -List|ConvertTo-Json -Compress
function Replace-Private([string]$path,[string]$value){if(Test-Path -LiteralPath $path){Assert-PrivateAcl $path;[IO.File]::WriteAllText($path,$value)}else{Write-DiagnosticNewFile $path $value}}
function Save-Spec {Replace-Private $specPath ($spec|ConvertTo-Json -Depth 8)}
function Control([string]$command,[string]$listen='::1'){
  # A server-start utility leaves a long-lived descendant. As in the reviewed
  # disposable-cluster helper, use private files instead of inherited drain pipes.
  # The bounded psql capture and its DRAIN refusal are unchanged.
  $controlArguments=@('-D',('"'+$cluster.Cluster+'"'),'-w','-t','30')
  if($command -ceq 'start'){$controlArguments+=@('-l',('"'+(Join-Path $cluster.Root 'postgres.log')+'"'),'-o',('"-h '+$listen+' -p '+$cluster.Port+'"'),'start')}else{$controlArguments+=@('-m','fast','stop')}
  Invoke-WithIsolatedEnvironment $source $null @{} {
    $id=[guid]::NewGuid().ToString('N')
    $control=Start-Process -FilePath (Join-Path $PostgresBin 'pg_ctl.exe') -ArgumentList $controlArguments -PassThru -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $cluster.Root ($id+'.out')) -RedirectStandardError (Join-Path $cluster.Root ($id+'.err'))
    try{if(-not $control.WaitForExit(45000)){$control.Kill($true);throw 'IPV6_FIXTURE_CONTROL_TIMEOUT'};if($control.ExitCode -ne 0){throw 'IPV6_FIXTURE_CONTROL_FAILED'}}finally{$control.Dispose()}
  }
}
function Write-ServerConfig([string]$certificate){
  Replace-Private (Join-Path $cluster.Cluster 'postgresql.auto.conf') ("ssl=on`nssl_cert_file='$certificate'`nssl_key_file='server.key'`nlog_connections=on`nlog_statement='all'`nlc_messages='C'`nlog_line_prefix='%a|%p| '`n")
}
function New-Envelope { $e=Join-Path $private ([guid]::NewGuid().ToString('N')+'.json');New-DiagnosticEnvelope $specPath $e;return $e }
function Trace([string]$envelope,[int]$statements,[int]$proofs,[int]$connections=1){
  $id=(Read-DiagnosticJson $envelope).runId
  $fs=[IO.File]::Open((Join-Path $cluster.Root 'postgres.log'),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
  $reader=[IO.StreamReader]::new($fs);try{$lines=@($reader.ReadToEnd() -split '\r?\n')}finally{$reader.Dispose()}
  $tagged=@($lines|Where-Object {$_ -match ('^lhd-'+$id+'\|')});$sent=@($tagged|Where-Object {$_ -cmatch 'statement:'})
  $pids=@($tagged|ForEach-Object {if($_ -match '^lhd-[a-f0-9]+\|([0-9]+)\|'){$Matches[1]}}|Select-Object -Unique)
  $authorized=@($lines|Where-Object {$_ -match ('connection authorized:.*application_name=lhd-'+$id+'(?:\s|$)')})
  Check ($authorized.Count -eq $connections) 'exact authorized connection count'
  Check ($sent.Count -eq $statements) 'exact bounded statement count'
  Check (@($sent|Where-Object {$_ -match 'statement: WITH RECURSIVE roots'}).Count -eq $proofs) 'conditional original proof count'
  Check (@($sent|Where-Object {$_ -match 'statement: (SELECT|WITH RECURSIVE)'}).Count -le 2) 'at most two SELECT statements'
  if($connections){Check ($pids.Count -eq 1) 'exactly one backend PID';Check (@($lines|Where-Object {$_ -match ('\|'+$pids[0]+'\|.*connection received: host=::1(?:\s|$)')}).Count -eq 1) 'actual IPv6 peer recorded by owned server'}
  Write-Output ('IPV6_TRACE connections='+$authorized.Count+' statements='+$sent.Count+' proofs='+$proofs)
}
try{
  $cluster=New-DisposableCluster $source ('synthetic_ipv6'+[guid]::NewGuid().ToString('N').Substring(0,12))
  $identity=Get-DatabaseIdentityState $source $cluster.Uri
  $setup=Join-Path $private 'setup.sql';Write-DiagnosticNewFile $setup "CREATE ROLE denied_identity LOGIN PASSWORD '$canary'; REVOKE EXECUTE ON FUNCTION pg_control_system() FROM PUBLIC; CREATE TABLE public.synthetic_ipv6_canary(id integer);"
  [void](Invoke-PostgresTool $source $cluster.Uri 'psql.exe' @('-X','-q','-v','ON_ERROR_STOP=1','-f',$setup) 'IPV6_FIXTURE_FAILED');[IO.File]::Delete($setup)
  $rootKey=[Security.Cryptography.RSA]::Create(2048);$serverKey=[Security.Cryptography.RSA]::Create(2048)
  $request=[Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=LegalHub disposable IPv6 CA',$rootKey,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true))
  $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign,$true))
  $ca=$request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-10),[DateTimeOffset]::UtcNow.AddDays(2))
  $caFile=Join-Path $private 'synthetic-ca.pem';Write-DiagnosticNewFile $caFile $ca.ExportCertificatePem()
  foreach($pair in @(@('localhost','server.crt'),@('wrong.invalid','wrong.crt'))){
    $request=[Security.Cryptography.X509Certificates.CertificateRequest]::new(('CN='+$pair[0]),$serverKey,[Security.Cryptography.HashAlgorithmName]::SHA256,[Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $san=[Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new();$san.AddDnsName($pair[0]);$request.CertificateExtensions.Add($san.Build())
    $eku=[Security.Cryptography.OidCollection]::new();[void]$eku.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
    $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku,$true))
    $serial=[guid]::NewGuid().ToByteArray();$serial[0]=$serial[0] -band 0x7f
    $cert=$request.Create($ca,[DateTimeOffset]::UtcNow.AddMinutes(-5),[DateTimeOffset]::UtcNow.AddDays(1),$serial)
    try{Write-DiagnosticNewFile (Join-Path $cluster.Cluster $pair[1]) $cert.ExportCertificatePem()}finally{$cert.Dispose()}
  }
  Write-DiagnosticNewFile (Join-Path $cluster.Cluster 'server.key') $serverKey.ExportPkcs8PrivateKeyPem()
  Control 'stop';Write-ServerConfig 'server.crt';Control 'start'
  Write-DiagnosticNewFile (Join-Path $cluster.Root 'diagnostic-ipv6-fixture.json') (@{version=1;runId=$cluster.RunId;port=$cluster.Port;database=$cluster.Database}|ConvertTo-Json)
  $b=[UriBuilder]::new($cluster.Uri);$b.Host='localhost';$normalUri=$b.Uri.AbsoluteUri
  $config=@{targetKind='synthetic';connectionMode='direct';environmentFile=(Join-Path $root 'ipv6.env');privateDirectory=$private;
    postgresBin=$PostgresBin;expectedHost='localhost';expectedApplicationHost='localhost';applicationRole='restore_admin';
    diagnosticIpv6Fixture=$cluster.Root;tlsRootCertFile=$caFile;tlsPolicy='verify-full';backendTlsRequired=$true}
  Write-DiagnosticNewFile $config.environmentFile ('DIRECT_URL='+$normalUri);Write-DiagnosticNewFile $configPath ($config|ConvertTo-Json)
  $spec=@{version=2;configPath=$configPath;pwshPath=[Environment]::ProcessPath;caSha256=(Get-DiagnosticHash $caFile);
    pins=@{database=$cluster.Database;maintenanceRole='restore_admin';applicationRole='restore_admin';databaseOid=[string]$identity.databaseOid;
      systemIdentifier=[string]$identity.clusterIdentity;serverVersionNum=[string]$identity.serverVersion;addressFamily='IPv6';address='::1'}}
  Save-Spec
  $x=Get-DiagnosticContext $specPath;$envs=New-DiagnosticChildEnvironment $x 'inspect-only'
  Check ($envs.PGHOSTADDR -ceq '::1' -and $envs.PGHOST -ceq 'localhost' -and $envs.PGSSLMODE -ceq 'verify-full' -and $envs.PGSSLROOTCERT -ceq $caFile) 'numeric IPv6 and DNS TLS hostname remain distinct'
  Check ($envs.PGCONNECT_TIMEOUT -ceq '5' -and $envs.PGOPTIONS -ceq '-c lock_timeout=5s -c statement_timeout=30s') 'original fixed timeouts retained';$envs.Clear()
  $e=Join-Path $private 'public-envelope.json'
  $out=@(& ([Environment]::ProcessPath) -NoProfile -File (Join-Path $repo 'scripts/local-maintenance/diagnostic-only.ps1') -Mode Prepare -Specification $specPath -Envelope $e)
  Check ($LASTEXITCODE -eq 0 -and ($out|ConvertFrom-Json).status -ceq 'PREPARED_OFFLINE') 'actual public v2 Prepare'
  $out=@(& ([Environment]::ProcessPath) -NoProfile -File (Join-Path $repo 'scripts/local-maintenance/diagnostic-only.ps1') -Mode Execute -Specification $specPath -Envelope $e)
  Check ($LASTEXITCODE -eq 0 -and $out.Count -eq 1) 'actual public IPv6 Execute exit0 closed output'
  $d=$out[0]|ConvertFrom-Json;Check ($d.status -ceq 'QUERY_COMPLETED' -and $d.verifiedIdentity -and $d.nativeExitCode -eq 0 -and $d.durationMs -gt 0) 'real IPv6 TLS identity and original proof completed'
  Trace $e 6 1
  $envelope=Read-DiagnosticJson $e;Check ($envelope.version -eq 2 -and $envelope.bindings.transportSha256 -ceq (Get-Sha256Text 'IPv6|::1')) 'v2 envelope explicitly binds family and address'
  $spent=$false;try{Invoke-DiagnosticEnvelope $specPath $e ''|Out-Null}catch{$spent=$true};Check $spent 'one-shot v2 envelope spent'
  $oid=$spec.pins.databaseOid;$spec.pins.databaseOid='999999999';Save-Spec;$e=New-Envelope;$d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.reason -ceq 'IDENTITY_MISMATCH' -and -not $d.verifiedIdentity -and $d.nativeExitCode -eq 0) 'IPv6 identity mismatch closed';Trace $e 5 0
  $spec.pins.databaseOid=$oid;$spec.pins.maintenanceRole='denied_identity';$b.UserName='denied_identity';$b.Password=$canary
  Replace-Private $config.environmentFile ('DIRECT_URL='+$b.Uri.AbsoluteUri);Save-Spec;$e=New-Envelope;$d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.stage -ceq 'IDENTITY' -and $d.sqlState -ceq '42501' -and $d.nativeExitCode -eq 3 -and $d.durationMs -gt 0 -and -not $d.verifiedIdentity) 'real first-query SQLSTATE native exit duration';Trace $e 4 0
  Replace-Private $config.environmentFile ('DIRECT_URL='+$normalUri);$spec.pins.maintenanceRole='restore_admin';Save-Spec
  $e=New-Envelope;$j=Read-DiagnosticJson $e;$j.version=1;Replace-Private $e ($j|ConvertTo-Json -Depth 8)
  Block {Invoke-DiagnosticEnvelope $specPath $e ''} 'ENVELOPE_INVALID_OR_EXPIRED'
  $e=New-Envelope;$j=Read-DiagnosticJson $e;$j.bindings.transportSha256='0'*64;Replace-Private $e ($j|ConvertTo-Json -Depth 8)
  Block {Invoke-DiagnosticEnvelope $specPath $e ''} 'ENVELOPE_BINDING_MISMATCH'
  $e=New-Envelope;$rawSpec=[IO.File]::ReadAllText($specPath);[IO.File]::AppendAllText($specPath,' ')
  Block {Invoke-DiagnosticEnvelope $specPath $e ''} 'ENVELOPE_BINDING_MISMATCH';Replace-Private $specPath $rawSpec
  Check (-not(Test-Path (Join-Path $private ('diagnostic-'+(Read-DiagnosticJson $e).runId+'.attempted')))) 'specification drift stops before connection attempt'
  $e=New-Envelope;$spec.pins.addressFamily='IPv4';Save-Spec;Block {Invoke-DiagnosticEnvelope $specPath $e ''} 'EXPECTED_IP_PIN_REQUIRED';$spec.pins.addressFamily='IPv6';Save-Spec
  Control 'stop';Write-ServerConfig 'wrong.crt';Control 'start';$e=New-Envelope;$d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.status -ceq 'FAILED' -and $d.nativeExitCode -eq 2 -and $null -eq $d.sqlState -and -not $d.verifiedIdentity) 'wrong hostname certificate rejected without weakening CA or verify-full';Trace $e 0 0 0
  Control 'stop';Write-ServerConfig 'server.crt';Control 'start' '127.0.0.1'
  Check ((Invoke-ReadOnlyQuery $source $cluster.Uri 'SELECT 1' 'IPV4_CONTROL_FAILED') -ceq '1') 'IPv4 backend available for no-fallback negative control'
  $e=New-Envelope;$d=Invoke-DiagnosticEnvelope $specPath $e ''
  Check ($d.status -ceq 'FAILED' -and $d.nativeExitCode -eq 2 -and -not $d.verifiedIdentity) 'unavailable IPv6 never falls back to available IPv4';Trace $e 0 0 0
  $reports=@(Get-ChildItem $private -Filter '*.report.json'|ForEach-Object {[IO.File]::ReadAllText($_.FullName)}) -join "`n"
  Check ($reports -notmatch ($canary+'|postgresql://|localhost|::1|WITH RECURSIVE|system_identifier|denied_identity|synthetic_ipv6_canary')) 'closed reports contain no secrets addresses catalog or native responses'
  Check (@(Get-ChildItem $private -Filter 'diagnostic-*.sql').Count -eq 0) 'owned query scratch cleanup verified'
}finally{
  if($cluster){Stop-DisposableCluster $source $cluster}
  if($ca){$ca.Dispose()};if($rootKey){$rootKey.Dispose()};if($serverKey){$serverKey.Dispose()}
}
Check ($env:PATH -ceq $pathBefore) 'operator PATH unchanged'
Check ((Get-ExecutionPolicy -List|ConvertTo-Json -Compress) -ceq $policyBefore) 'Execution Policy unchanged'
Write-Output ('DIAGNOSTIC_IPV6_PASS count='+$passed+' actualIPv6=True tlsVerifyFull=True productionConnections=0')
