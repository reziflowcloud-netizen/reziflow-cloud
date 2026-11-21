# Internal functions; public entrypoint accepts no SQL, query file, timeout or fault switches.
. (Join-Path $PSScriptRoot 'core.ps1')
function Stop-Diagnostic([string]$Code) { throw ('LHD:'+$Code) }
function Get-DiagnosticHash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Read-DiagnosticJson([string]$Path) {
  Assert-DiagnosticLocalPath $Path
  Assert-DiagnosticOutsideGit $Path
  Assert-PrivateAcl $Path
  return [IO.File]::ReadAllText($Path) | ConvertFrom-Json -AsHashtable
}
function Assert-DiagnosticOutsideGit([string]$Path) {
  $current=[IO.Path]::GetDirectoryName($Path)
  while($current) {
    if(Test-Path -LiteralPath (Join-Path $current '.git')) { Stop-Diagnostic 'PRIVATE_PATH_INSIDE_GIT' }
    $parent=[IO.Path]::GetDirectoryName($current.TrimEnd('\','/'))
    if(-not $parent -or $parent -eq $current){break};$current=$parent
  }
}
function Assert-DiagnosticLocalPath([string]$Path) {
  if ($Path -cnotmatch '^[A-Za-z]:[\\/]' -or $Path.Substring(2).Contains(':')) { Stop-Diagnostic 'LOCAL_ABSOLUTE_PATH_REQUIRED' }
  $drive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($Path))
  if ($drive.DriveType -ne [IO.DriveType]::Fixed) { Stop-Diagnostic 'LOCAL_FIXED_DRIVE_REQUIRED' }
  Assert-NotReparsePoint $Path
}
function Assert-DiagnosticProtectedTool([string]$Path) {
  Assert-DiagnosticLocalPath $Path
  $trusted=@('S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')
  $mask=[int][Security.AccessControl.FileSystemRights]::WriteData -bor
    [int][Security.AccessControl.FileSystemRights]::AppendData -bor
    [int][Security.AccessControl.FileSystemRights]::WriteAttributes -bor
    [int][Security.AccessControl.FileSystemRights]::WriteExtendedAttributes -bor
    [int][Security.AccessControl.FileSystemRights]::Delete -bor
    [int][Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
    [int][Security.AccessControl.FileSystemRights]::ChangePermissions -bor
    [int][Security.AccessControl.FileSystemRights]::TakeOwnership
  $replacementMask=[int][Security.AccessControl.FileSystemRights]::Delete -bor
    [int][Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
    [int][Security.AccessControl.FileSystemRights]::ChangePermissions -bor
    [int][Security.AccessControl.FileSystemRights]::TakeOwnership
  $current=$Path;$depth=0
  while ($current) {
    $acl=Get-Acl -LiteralPath $current
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cnotin $trusted) { Stop-Diagnostic 'TOOLCHAIN_OWNER_UNTRUSTED' }
    $raw=[Security.AccessControl.RawSecurityDescriptor]::new($acl.GetSecurityDescriptorBinaryForm(),0)
    if ($null -eq $raw.DiscretionaryAcl) { Stop-Diagnostic 'TOOLCHAIN_ACL_UNTRUSTED' }
    foreach($ace in $raw.DiscretionaryAcl) {
      if ($ace -isnot [Security.AccessControl.CommonAce] -or $ace.IsCallback) { Stop-Diagnostic 'TOOLCHAIN_ACL_UNSUPPORTED' }
      if (($ace.AceFlags -band [Security.AccessControl.AceFlags]::InheritOnly) -ne 0) { continue }
      $effectiveMask=if($depth -le 1){$mask}else{$replacementMask}
      if ($ace.AceType -eq [Security.AccessControl.AceType]::AccessAllowed -and
          ($ace.AccessMask -band $effectiveMask) -ne 0 -and $ace.SecurityIdentifier.Value -cnotin $trusted) {
        Stop-Diagnostic 'TOOLCHAIN_WRITABLE'
      }
    }
    $parent=[IO.Path]::GetDirectoryName($current.TrimEnd('\','/'))
    if (-not $parent -or $parent -eq $current) { break }; $current=$parent;$depth++
  }
}
function Write-DiagnosticNewFile([string]$Path,[string]$Text) {
  Assert-DiagnosticOutsideGit $Path
  Assert-PrivateAcl (Split-Path -Parent $Path)
  $stream=[IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $bytes=[Text.UTF8Encoding]::new($false).GetBytes($Text); $stream.Write($bytes,0,$bytes.Length) }
  finally { $stream.Dispose() }
  Set-PrivateAcl $Path
}
function Get-DiagnosticSourceBinding {
  $binding=[ordered]@{}
  # Include every transitively imported local source, not just the entrypoint.
  foreach($name in @('diagnostic-only.ps1','diagnostic-only-lib.ps1','core.ps1',
      'diagnostic-process.cs','process-diagnostics.ps1','session-pooler.ps1',
      'structure-proof.ps1','lock-safety.ps1')) {
    $binding[$name]=Get-DiagnosticHash (Join-Path $PSScriptRoot $name)
  }
  return Get-Sha256Text ($binding | ConvertTo-Json -Compress)
}
function Get-DiagnosticAddress($p,[int]$Version=1) {
  $ip=$null
  if ($Version -eq 1) {
    if (@($p.Keys | Where-Object {$_ -cin @('addressFamily','address','ipv6')}).Count -or
        -not [Net.IPAddress]::TryParse([string]$p.ipv4,[ref]$ip) -or
        $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or
        $ip.ToString() -cne $p.ipv4) { Stop-Diagnostic 'EXPECTED_IP_PIN_REQUIRED' }
    return @{family='IPv4';address=[string]$p.ipv4}
  }
  if ($Version -ne 2 -or @($p.Keys | Where-Object {$_ -cin @('ipv4','ipv6')}).Count -or
      $p.addressFamily -cnotin @('IPv4','IPv6') -or $p.address -isnot [string] -or
      $p.address -cmatch '[^0-9a-f:.]' -or
      -not [Net.IPAddress]::TryParse($p.address,[ref]$ip) -or $ip.ToString() -cne $p.address) {
    Stop-Diagnostic 'EXPECTED_IP_PIN_REQUIRED'
  }
  $family=if($ip.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork){'IPv4'}else{'IPv6'}
  if ($family -cne $p.addressFamily -or ($family -ceq 'IPv6' -and
      ($ip.IsIPv4MappedToIPv6 -or $ip.ScopeId -ne 0))) { Stop-Diagnostic 'EXPECTED_IP_PIN_REQUIRED' }
  return @{family=$family;address=$p.address}
}
function Assert-DiagnosticExternalAddress($address) {
  if ($address.family -ceq 'IPv4') {
    # Preserve the reviewed v1 IPv4 semantics; this patch does not widen it.
    if ($address.address -like '127.*') { Stop-Diagnostic 'PRODUCTION_TLS_BINDING' }
    return
  }
  $b=([Net.IPAddress]::Parse($address.address)).GetAddressBytes()
  # Conservative native global-unicast policy. No special-purpose services,
  # transitions, documentation, local/multicast/mapped/scoped destinations.
  # IANA IPv6 Special-Purpose Registry (snapshot 2025-10-09); not ownership proof.
  if (($b[0] -band 0xe0) -ne 0x20 -or
      ($b[0] -eq 0x20 -and $b[1] -eq 0x01 -and $b[2] -lt 2) -or
      ($b[0] -eq 0x20 -and $b[1] -eq 0x01 -and $b[2] -eq 0x0d -and $b[3] -eq 0xb8) -or
      ($b[0] -eq 0x20 -and $b[1] -eq 0x02) -or
      ($b[0] -eq 0x26 -and $b[1] -eq 0x20 -and $b[2] -eq 0 -and $b[3] -eq 0x4f -and $b[4] -eq 0x80 -and $b[5] -eq 0) -or
      ($b[0] -eq 0x3f -and $b[1] -eq 0xff -and ($b[2] -band 0xf0) -eq 0)) {
    Stop-Diagnostic 'PRODUCTION_IPV6_DESTINATION_FORBIDDEN'
  }
}
function Assert-DiagnosticAddressAttestation($s,$address,[string]$Hostname) {
  if (@(@('addressAttestationFile','addressAttestationSha256','trustReviewReference') | Where-Object {$_ -cnotin $s.Keys}).Count -or
      $s.addressAttestationFile -isnot [string] -or -not $s.addressAttestationFile -or
      $s.addressAttestationSha256 -cnotmatch '^[a-f0-9]{64}$') { Stop-Diagnostic 'ADDRESS_ATTESTATION_BINDING_REQUIRED' }
  $a=Read-DiagnosticJson $s.addressAttestationFile
  if ((Get-DiagnosticHash $s.addressAttestationFile) -cne $s.addressAttestationSha256 -or
      $a.version -ne 1 -or $a.addressFamily -cne $address.family -or $a.address -cne $address.address -or
      $a.hostname -cne $Hostname -or $a.providerReference -cnotmatch '^https://' -or
      $a.reviewReference -cne $s.trustReviewReference) { Stop-Diagnostic 'ADDRESS_ATTESTATION_BINDING_REQUIRED' }
  # A matching private dossier is not authentication; independent source/freshness review is mandatory.
}
function Assert-DiagnosticPins($p,[int]$Version=1) {
  foreach($key in @('database','maintenanceRole','applicationRole')) {
    if ($p[$key] -isnot [string] -or $p[$key] -cnotmatch '^[A-Za-z_][A-Za-z0-9_.-]{0,100}$') {
      Stop-Diagnostic 'EXPECTED_PINS_INCOMPLETE'
    }
  }
  foreach($key in @('databaseOid','systemIdentifier','serverVersionNum')) {
    if ([string]$p[$key] -cnotmatch '^[1-9][0-9]{0,19}$') { Stop-Diagnostic 'EXPECTED_PINS_INCOMPLETE' }
  }
  if ([string]$p.serverVersionNum -cnotmatch '^(17|18)[0-9]{4}$') { Stop-Diagnostic 'SERVER_VERSION_UNREVIEWED' }
  [void](Get-DiagnosticAddress $p $Version)
}
function Get-DiagnosticSql($p,[bool]$Synthetic,[int]$Version=1,[bool]$SyntheticTls=$false) {
  Assert-DiagnosticPins $p $Version
  $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'structure-proof.ps1')).Replace("`r`n","`n")
  if ((Get-Sha256Text $source) -cne '0532f81930ead043012c1d88d65719577084a46980ce047c0c1c72062e844085') {
    Stop-Diagnostic 'REVIEWED_STRUCTURE_SOURCE_CHANGED'
  }
  $proof=(Get-StructureProofSql $p.applicationRole).Replace("`r`n","`n")
  $tls=if($Synthetic -and -not $SyntheticTls){'false'}else{'true'}
  # Input alphabet excludes SQL quoting/metacommands. All expected values are offline pins.
  $identity=@"
SELECT COALESCE((current_database()='$($p.database)' AND current_user='$($p.maintenanceRole)'
 AND session_user='$($p.maintenanceRole)'
 AND (SELECT oid::text FROM pg_database WHERE datname=current_database())='$($p.databaseOid)'
 AND (SELECT system_identifier::text FROM pg_control_system())='$($p.systemIdentifier)'
 AND current_setting('server_version_num')='$($p.serverVersionNum)'
 AND (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid())=$tls
 AND current_setting('transaction_read_only')='on'
 AND current_setting('transaction_isolation')='repeatable read'
 AND current_setting('statement_timeout')='30s'
 AND current_setting('lock_timeout')='5s'),false) AS ok
"@
  $identity=$identity.Replace("`r`n","`n").TrimEnd()
  # No semicolon before \gset/\g: each buffer is sent exactly ONCE.
  # Six SQL statements, two SELECT statements; psql conditionals are client-only.
  $script=@"
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog,public;
$identity
\gset lhd_
\if :lhd_ok
\echo LHD_IDENTITY_OK
$proof
\g NUL
\echo LHD_STRUCTURE_OK
\else
\echo LHD_IDENTITY_MISMATCH
\endif
ROLLBACK;
\echo LHD_ROLLBACK_OK
"@
  $script=$script.Replace("`r`n","`n")+"`n"
  if ($Version -eq 2) {
    $address=Get-DiagnosticAddress $p $Version
    $script='-- LHD transport '+$address.family+' '+$address.address+"`n"+$script
  }
  return @{script=$script;proofSha256=(Get-Sha256Text $proof);
    identitySha256=(Get-Sha256Text $identity)}
}
function Get-DiagnosticIpv6FixtureUri($c) {
  # Test-only ::1 exception requires a private, owned, running disposable cluster.
  # No general loopback exemption is added to the Production branch or core Runner.
  $root=$c.diagnosticIpv6Fixture
  Assert-DiagnosticLocalPath $root; Assert-PrivateAcl $root
  [void](Assert-ChildPath (Join-Path $c.privateDirectory 'isolated') $root)
  $marker=Join-Path $root 'runner-owned.txt'; Assert-PrivateAcl $marker
  $run=[IO.File]::ReadAllText($marker).Trim()
  if ($run -cnotmatch '^synthetic_[a-z0-9]{8,60}$' -or (Split-Path $root -Leaf) -cne $run) { Stop-Diagnostic 'SYNTHETIC_IPV6_FIXTURE_INVALID' }
  $fixture=Read-DiagnosticJson (Join-Path $root 'diagnostic-ipv6-fixture.json')
  $pidFile=Join-Path $root 'cluster/postmaster.pid';Assert-PrivateAcl $pidFile
  $pidLines=[IO.File]::ReadAllLines($pidFile)
  if ($fixture.version -ne 1 -or $fixture.runId -cne $run -or $fixture.port -eq 5432 -or
      $fixture.port -lt 1 -or $fixture.port -gt 65535 -or
      $pidLines.Count -lt 4 -or $pidLines[0] -cnotmatch '^[1-9][0-9]*$' -or
      [IO.Path]::GetFullPath($pidLines[1]) -cne [IO.Path]::GetFullPath((Join-Path $root 'cluster')) -or
      $pidLines[3] -cne [string]$fixture.port -or $c.expectedHost -cne 'localhost' -or
      $c.expectedApplicationHost -cne 'localhost' -or $c.tlsPolicy -cne 'verify-full' -or
      $c.backendTlsRequired -ne $true) { Stop-Diagnostic 'SYNTHETIC_IPV6_FIXTURE_INVALID' }
  $lines=@(Get-Content -LiteralPath $c.environmentFile -Encoding UTF8 | Where-Object {$_ -cmatch '^DIRECT_URL='})
  if ($lines.Count -ne 1) { Stop-Diagnostic 'SYNTHETIC_IPV6_FIXTURE_INVALID' }
  try {$uri=[Uri]::new($lines[0].Substring(11).Trim().Trim('"').Trim("'"))}catch{Stop-Diagnostic 'SYNTHETIC_IPV6_FIXTURE_INVALID'}
  if ($uri.Scheme -cnotin @('postgres','postgresql') -or $uri.Host -cne 'localhost' -or
      $uri.Port -ne $fixture.port -or $uri.UserInfo.Split(':',2).Count -ne 2 -or
      $uri.AbsolutePath.TrimStart('/') -cne $fixture.database -or
      $fixture.database -cnotmatch '^legalhub_runner_synthetic_[a-z0-9_]+$' -or
      $uri.Query -cnotin @('','?schema=public') -or $uri.Fragment) { Stop-Diagnostic 'SYNTHETIC_IPV6_FIXTURE_INVALID' }
  return $uri
}
function Get-DiagnosticContext([string]$Specification) {
  $s=Read-DiagnosticJson $Specification
  if ($s.version -notin @(1,2) -or @($s.Keys | Where-Object {$_ -cnotin @('version','configPath','pwshPath','pins',
      'caSha256','trustReviewReference','toolReferences','gitPath','candidateCommit','addressAttestationFile','addressAttestationSha256')}).Count) { Stop-Diagnostic 'SPECIFICATION_VERSION_OR_FIELDS' }
  $c=Read-DiagnosticJson $s.configPath
  if ($c.connectionMode -cne 'direct' -or $c.targetKind -cnotin @('synthetic','production')) {
    Stop-Diagnostic 'DIRECT_TARGET_REQUIRED'
  }
  $synthetic=$c.targetKind -ceq 'synthetic'
  foreach($path in @($c.privateDirectory,$c.environmentFile)) { Assert-DiagnosticLocalPath $path; Assert-DiagnosticOutsideGit $path; Assert-PrivateAcl $path }
  foreach($path in @($c.postgresBin,$s.pwshPath)) { Assert-DiagnosticLocalPath $path }
  if ([IO.Path]::GetFullPath($s.pwshPath) -cne [Environment]::ProcessPath) {
    Stop-Diagnostic 'POWERSHELL_PATH_MISMATCH'
  }
  Assert-DiagnosticPins $s.pins $s.version
  $address=Get-DiagnosticAddress $s.pins $s.version
  $syntheticTls=$synthetic -and $s.version -eq 2 -and $address.family -ceq 'IPv6'
  if ($syntheticTls) {
    if ($address.address -cne '::1') { Stop-Diagnostic 'SYNTHETIC_ISOLATION' }
    $uri=Get-DiagnosticIpv6FixtureUri $c
  } else {$uri=Get-PrivateDatabaseUri ([pscustomobject]$c) 'DIRECT_URL' $synthetic}
  if ($uri.Port -lt 1 -or $uri.Port -gt 65535 -or $uri.Fragment) { Stop-Diagnostic 'EXPLICIT_PORT_AND_NO_FRAGMENT_REQUIRED' }
  if (-not [Uri]::UnescapeDataString($uri.UserInfo.Split(':',2)[1])) { Stop-Diagnostic 'PASSWORD_REQUIRED_NO_PASSFILE_FALLBACK' }
  if ($c.applicationRole -cne $s.pins.applicationRole -or
      [Uri]::UnescapeDataString($uri.UserInfo.Split(':',2)[0]) -cne $s.pins.maintenanceRole -or
      $uri.AbsolutePath.TrimStart('/') -cne $s.pins.database) { Stop-Diagnostic 'PROFILE_PIN_MISMATCH' }
  if ($synthetic) {
    if ($uri.Port -eq 5432 -or (-not $syntheticTls -and $address.address -cne '127.0.0.1')) { Stop-Diagnostic 'SYNTHETIC_ISOLATION' }
  } else {
    if ($c.expectedHost -notmatch '(^|\.)supabase\.(co|com)$' -or
        $c.expectedApplicationHost -notmatch '(^|\.)supabase\.(co|com)$') { Stop-Diagnostic 'PRODUCTION_PROFILE_INVALID' }
    # Production execution cannot be enabled by a self-asserted boolean in config.
    # An independently reviewed, hash-approved private envelope is mandatory below.
    Assert-DiagnosticExternalAddress $address
    if ($c.backendTlsRequired -ne $true -or $c.tlsPolicy -cne 'verify-full') {
      Stop-Diagnostic 'PRODUCTION_TLS_BINDING'
    }
    if ($s.version -eq 2) {
      Assert-DiagnosticAddressAttestation $s $address $uri.Host
    }
    Assert-DiagnosticLocalPath $c.tlsRootCertFile
    Assert-DiagnosticOutsideGit $c.tlsRootCertFile
    Assert-PrivateAcl $c.tlsRootCertFile
    if ((Get-DiagnosticHash $c.tlsRootCertFile) -cne $s.caSha256) { Stop-Diagnostic 'CA_PIN_MISMATCH' }
    # Reference provenance and installation ACLs require independent human review.
    # Current missing references/pins MUST stay missing; never generate trusted hashes from current binaries.
    if ($s.trustReviewReference -cnotmatch '^https://github\.com/reziflowcloud-netizen/reziflow-cloud/pull/[0-9]+#issuecomment-[0-9]+$' -or
        $s.toolReferences.Count -lt 4) { Stop-Diagnostic 'TRUST_PREREQUISITES_MISSING' }
    foreach($entry in $s.toolReferences) {
      Assert-DiagnosticProtectedTool $entry.path
      if ($entry.sha256 -cnotmatch '^[0-9a-f]{64}$' -or
          $entry.independentSource -notmatch '^https://' -or
          (Get-DiagnosticHash $entry.path) -cne $entry.sha256) { Stop-Diagnostic 'TRUST_REFERENCE_MISMATCH' }
    }
    if ($s.candidateCommit -cnotmatch '^[0-9a-f]{40}$') { Stop-Diagnostic 'EXACT_COMMIT_REQUIRED' }
    $requiredFiles=@($s.pwshPath,$s.gitPath,(Join-Path $c.postgresBin 'psql.exe')) +
      @(Get-ChildItem -LiteralPath $c.postgresBin -Filter '*.dll' -File | ForEach-Object FullName) +
      @(Get-ChildItem -LiteralPath (Split-Path $s.pwshPath) -Filter '*.dll' -File | ForEach-Object FullName)
    foreach($required in $requiredFiles) {
      if (@($s.toolReferences | Where-Object {$_.path -ceq $required}).Count -ne 1) {
        Stop-Diagnostic 'TRUST_REFERENCE_INCOMPLETE'
      }
    }
    Assert-DiagnosticGitCheckpoint $s
  }
  if ($syntheticTls) {
    Assert-DiagnosticLocalPath $c.tlsRootCertFile;Assert-DiagnosticOutsideGit $c.tlsRootCertFile;Assert-PrivateAcl $c.tlsRootCertFile
    if ((Get-DiagnosticHash $c.tlsRootCertFile) -cne $s.caSha256) { Stop-Diagnostic 'CA_PIN_MISMATCH' }
  }
  $sql=Get-DiagnosticSql $s.pins $synthetic $s.version $syntheticTls
  return @{spec=$s;config=$c;uri=$uri;synthetic=$synthetic;syntheticTls=$syntheticTls;address=$address;sql=$sql}
}
function Assert-DiagnosticGitCheckpoint($s) {
  # No PATH command lookup, hooks, credentials, fsmonitor, network or global Git config.
  $repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
  Assert-NotReparsePoint $repo
  $root=[Environment]::GetFolderPath('Windows')
  $safe=[Collections.Generic.Dictionary[string,string]]::new()
  $safe['SystemRoot']=$root;$safe['WINDIR']=$root;$safe['PATH']=Join-Path $root 'System32'
  $safe['GIT_CONFIG_NOSYSTEM']='1';$safe['GIT_CONFIG_GLOBAL']='NUL';$safe['GIT_TERMINAL_PROMPT']='0'
  try {
    foreach($operation in @('head','status','remote')) {
      $arguments=[string[]]@('-c','core.fsmonitor=false','-c','core.untrackedCache=false','-C',$repo)
      $arguments+=switch($operation){'head'{@('rev-parse','HEAD')};'status'{@('status','--porcelain','--untracked-files=all')};'remote'{@('config','--local','--get','remote.origin.url')}}
      $capture=[LegalHubMaintenanceDiagnostics.ProcessCapture]::RunIsolated($s.gitPath,$arguments,10000,$safe,$repo)
      try {
        if ($capture.Failure -or $capture.ExitCode -ne 0 -or $capture.Errors.Length -ne 0) { Stop-Diagnostic 'GIT_CHECKPOINT_UNVERIFIED' }
        if ($operation -ceq 'head' -and $capture.Output.Trim() -cne $s.candidateCommit) { Stop-Diagnostic 'EXACT_COMMIT_MISMATCH' }
        if ($operation -ceq 'status' -and $capture.Output.Length -ne 0) { Stop-Diagnostic 'DIRTY_CHECKOUT' }
        if ($operation -ceq 'remote' -and $capture.Output.Trim() -cnotmatch '^(?:git@github\.com:|https://github\.com/|ssh://git@github\.com/)reziflowcloud-netizen/reziflow-cloud(?:\.git)?$') { Stop-Diagnostic 'WRONG_REPOSITORY' }
      } finally {$capture.Errors='';$capture.Output=''}
    }
  } finally {$safe.Clear()}
}
function Get-DiagnosticBindings($x,[string]$Specification) {
  $c=$x.config
  $bindings=[ordered]@{specificationSha256=(Get-DiagnosticHash $Specification);
    configSha256=(Get-DiagnosticHash $x.spec.configPath);
    environmentSha256=(Get-DiagnosticHash $c.environmentFile);
    sourceSha256=(Get-DiagnosticSourceBinding);
    pwshSha256=(Get-DiagnosticHash $x.spec.pwshPath);
    psqlSha256=(Get-DiagnosticHash (Join-Path $c.postgresBin 'psql.exe'));
    scriptSha256=(Get-Sha256Text $x.sql.script);proofSha256=$x.sql.proofSha256;
    identitySha256=$x.sql.identitySha256}
  if ($x.spec.version -eq 2) {
    $bindings.transportSha256=Get-Sha256Text ($x.address.family+'|'+$x.address.address)
    if ($x.syntheticTls) {$bindings.fixtureSha256=Get-DiagnosticHash (Join-Path $c.diagnosticIpv6Fixture 'diagnostic-ipv6-fixture.json')}
    elseif (-not $x.synthetic) {$bindings.addressAttestationSha256=Get-DiagnosticHash $x.spec.addressAttestationFile}
  }
  return $bindings
}
function New-DiagnosticEnvelope([string]$Specification,[string]$Envelope) {
  $x=Get-DiagnosticContext $Specification
  [void](Assert-ChildPath $x.config.privateDirectory $Envelope)
  $e=[ordered]@{version=$x.spec.version;runId=[Guid]::NewGuid().ToString('N');
    expiresUnixSeconds=[DateTimeOffset]::UtcNow.AddHours(24).ToUnixTimeSeconds();
    bindings=(Get-DiagnosticBindings $x $Specification)}
  Write-DiagnosticNewFile $Envelope ($e | ConvertTo-Json -Depth 8)
}
function New-DiagnosticChildEnvironment($x,[string]$RunId) {
  $c=$x.config;$uri=$x.uri;$root=[Environment]::GetFolderPath('Windows')
  $safe=[Collections.Generic.Dictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
  $values=@{SystemRoot=$root;WINDIR=$root;ComSpec=(Join-Path $root 'System32/cmd.exe');
    PATH=((Join-Path $root 'System32')+';'+$root+';'+$c.postgresBin);
    PGHOST=$uri.Host;PGHOSTADDR=$x.address.address;PGPORT=[string]$uri.Port;
    PGDATABASE=$x.spec.pins.database;PGUSER=$x.spec.pins.maintenanceRole;
    PGPASSWORD=[Uri]::UnescapeDataString($uri.UserInfo.Split(':',2)[1]);
    PGCONNECT_TIMEOUT='5';PGOPTIONS='-c lock_timeout=5s -c statement_timeout=30s';
    PGGSSENCMODE='disable';PGAPPNAME=('lhd-'+$RunId);PGSSLMODE='disable';
    TEMP=$c.privateDirectory;TMP=$c.privateDirectory;HOME=$c.privateDirectory;
    USERPROFILE=$c.privateDirectory;APPDATA=$c.privateDirectory;LOCALAPPDATA=$c.privateDirectory}
  if (-not $x.synthetic -or $x.syntheticTls) { $values.PGSSLMODE='verify-full';$values.PGSSLROOTCERT=$c.tlsRootCertFile }
  foreach($key in $values.Keys) { $safe[$key]=[string]$values[$key] }
  return ,$safe
}
function Convert-DiagnosticCapture($capture,[string]$QueryFile) {
  # Closed markers, no arbitrary native output is ever returned, saved or thrown.
  $normalized=$capture.Output.Replace("`r`n","`n")
  $identity=$false;$stage='UNKNOWN';$validPrefix=$true
  switch -CaseSensitive ($normalized) {
    '' {$stage='IDENTITY'}
    "LHD_IDENTITY_OK`n" {$stage='STRUCTURE_PROOF';$identity=$true}
    "LHD_IDENTITY_OK`nLHD_STRUCTURE_OK`n" {$stage='ROLLBACK';$identity=$true}
    "LHD_IDENTITY_OK`nLHD_STRUCTURE_OK`nLHD_ROLLBACK_OK`n" {$stage='STRUCTURE_PROOF';$identity=$true}
    "LHD_IDENTITY_MISMATCH`n" {$stage='ROLLBACK'}
    "LHD_IDENTITY_MISMATCH`nLHD_ROLLBACK_OK`n" {$stage='IDENTITY'}
    default {$validPrefix=$false}
  }
  $d=New-SafePostgresDiagnostic $capture 'Direct' $stage 'DIAGNOSTIC_QUERY_FAILED' $QueryFile
  $status='FAILED';$reason='NATIVE_ERROR'
  if ($capture.Failure -or $capture.CleanupFailed -or $capture.ErrorTruncated) { $reason='PROCESS_FAILURE' }
  elseif (-not $validPrefix) { $reason='UNEXPECTED_OUTPUT';if($capture.ExitCode -eq 0){$status='BLOCKED'} }
  elseif ($capture.ExitCode -eq 0 -and $capture.Errors.Length -eq 0 -and
      $normalized -ceq "LHD_IDENTITY_OK`nLHD_STRUCTURE_OK`nLHD_ROLLBACK_OK`n") { $status='QUERY_COMPLETED';$reason='NONE' }
  elseif ($capture.ExitCode -eq 0 -and $capture.Errors.Length -eq 0 -and
      $normalized -ceq "LHD_IDENTITY_MISMATCH`nLHD_ROLLBACK_OK`n") { $status='BLOCKED';$reason='IDENTITY_MISMATCH' }
  elseif ($capture.ExitCode -eq 0) { $status='BLOCKED';$reason='UNEXPECTED_OUTPUT';$identity=$false }
  return [pscustomobject][ordered]@{status=$status;stage=$stage;reason=$reason;
    nativeExitCode=$d.nativeExitCode;durationMs=$d.durationMs;sqlState=$d.sqlState;
    errorCategory=$d.errorCategory;timeoutCategory=$d.timeoutCategory;
    verifiedIdentity=[bool]$identity;cleanupFailed=$d.cleanupFailed}
}
function Invoke-DiagnosticEnvelope([string]$Specification,[string]$Envelope,[string]$ApprovedEnvelopeSha256,[string]$OwnerApprovalReference='') {
  $x=Get-DiagnosticContext $Specification
  [void](Assert-ChildPath $x.config.privateDirectory $Envelope)
  $e=Read-DiagnosticJson $Envelope
  if ($e.Count -ne 4 -or @($e.Keys | Where-Object {$_ -cnotin @('version','runId','expiresUnixSeconds','bindings')}).Count -or
      $e.version -ne $x.spec.version -or $e.runId -cnotmatch '^[a-f0-9]{32}$' -or
      $e.expiresUnixSeconds -isnot [long] -or
      $e.expiresUnixSeconds -lt [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() -or
      $e.expiresUnixSeconds -gt [DateTimeOffset]::UtcNow.AddHours(24).ToUnixTimeSeconds()) { Stop-Diagnostic 'ENVELOPE_INVALID_OR_EXPIRED' }
  $bindings=Get-DiagnosticBindings $x $Specification
  if (($e.bindings | ConvertTo-Json -Compress) -cne ($bindings | ConvertTo-Json -Compress)) {
    # Compare by keys too: JSON dictionary insertion order is not a security contract.
    if ($e.bindings.Count -ne $bindings.Count) { Stop-Diagnostic 'ENVELOPE_BINDING_MISMATCH' }
    foreach($key in $bindings.Keys) { if ($e.bindings[$key] -cne $bindings[$key]) { Stop-Diagnostic 'ENVELOPE_BINDING_MISMATCH' } }
  }
  if (-not $x.synthetic) {
    if ($OwnerApprovalReference -cnotmatch '^[A-Za-z0-9:/._#-]{8,200}$') { Stop-Diagnostic 'SEPARATE_OWNER_APPROVAL_REQUIRED' }
    if ($ApprovedEnvelopeSha256 -cnotmatch '^[a-f0-9]{64}$' -or
        (Get-DiagnosticHash $Envelope) -cne $ApprovedEnvelopeSha256) { Stop-Diagnostic 'INDEPENDENT_ENVELOPE_APPROVAL_REQUIRED' }
    if ((Read-Host 'Separate owner approval required. Type DIAGNOSTIC ONLY and the envelope SHA256') -cne
        ('DIAGNOSTIC ONLY '+$ApprovedEnvelopeSha256)) { Stop-Diagnostic 'OWNER_CONFIRMATION_REQUIRED' }
  }
  # CreateNew is an atomic one-shot gate, before any client startup. Never delete/reuse this marker.
  Write-DiagnosticNewFile (Join-Path $x.config.privateDirectory ('diagnostic-'+$e.runId+'.attempted')) $e.runId
  $queryFile=Join-Path $x.config.privateDirectory ('diagnostic-'+$e.runId+'.sql')
  $capture=$null;$report=$null;$safe=$null;$queryOwned=$false
  try {
    Write-DiagnosticNewFile $queryFile $x.sql.script
    $queryOwned=$true
    $safe=New-DiagnosticChildEnvironment $x $e.runId
    $capture=[LegalHubMaintenanceDiagnostics.ProcessCapture]::RunIsolated(
      (Join-Path $x.config.postgresBin 'psql.exe'),
      [string[]]@('-w','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate',
        '-v','SHOW_CONTEXT=never','-f',$queryFile),150000,$safe,$x.config.privateDirectory)
    $report=Convert-DiagnosticCapture $capture $queryFile
  } finally {
    if ($capture) { $capture.Errors='';$capture.Output='' }
    if ($safe) { $safe.Clear() }
    if ($queryOwned -and (Test-Path -LiteralPath $queryFile)) {
      try { [IO.File]::Delete($queryFile) } catch { Stop-Diagnostic 'QUERY_FILE_CLEANUP_FAILED' }
    }
  }
  Write-DiagnosticNewFile ($Envelope+'.report.json') ($report | ConvertTo-Json -Compress)
  return $report
}
