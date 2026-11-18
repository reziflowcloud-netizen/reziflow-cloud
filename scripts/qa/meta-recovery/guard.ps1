Set-StrictMode -Version Latest

function Assert-QaNoReparse([string]$Path) {
  if ($Path -notmatch '^[A-Za-z]:\\') { throw 'QA_PATH_NOT_ABSOLUTE' }
  $current=[IO.Path]::GetFullPath($Path)
  while($current){
    if(-not(Test-Path -LiteralPath $current)){throw 'QA_PATH_MISSING'}
    if((Get-Item -LiteralPath $current -Force).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)){throw 'QA_REPARSE_REFUSED'}
    $parent=[IO.Path]::GetDirectoryName($current.TrimEnd('\','/'))
    if(-not $parent -or $parent -eq $current){break};$current=$parent
  }
}

function Get-QaCanonicalDirectory([string]$Path) {
  Assert-QaNoReparse $Path
  if(-not(Test-Path -LiteralPath $Path -PathType Container)){throw 'QA_DIRECTORY_REQUIRED'}
  return [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path).TrimEnd('\','/')
}

function Assert-QaPrivateAcl([string]$Path) {
  Assert-QaNoReparse $Path
  $acl=Get-Acl -LiteralPath $Path
  $current=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $current){throw 'QA_OWNER_REFUSED'}
  $allowed=@($current,'S-1-5-18','S-1-5-32-544')
  foreach($entry in $acl.Access){
    if($entry.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow){continue}
    if($entry.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed){throw 'QA_ACL_TOO_BROAD'}
  }
}

function Assert-QaSource([string]$Path) {
  $source=Get-QaCanonicalDirectory $Path
  $head=@(& git -C $source rev-parse HEAD 2>$null)
  if($LASTEXITCODE -ne 0 -or $head.Count -ne 1 -or $head[0].Trim() -ne '51c560a5f0090b669ee4ffe48485ba4d6a3a873e'){throw 'QA_SOURCE_HEAD_REFUSED'}
  $dirty=@(& git -C $source status --porcelain 2>$null)
  if($LASTEXITCODE -ne 0 -or $dirty.Count){throw 'QA_SOURCE_DIRTY'}
  foreach($leaf in @('.env','.env.local','.env.production','.env.production.local','.env.development','.env.development.local')){
    if(Test-Path -LiteralPath (Join-Path $source $leaf)){throw 'QA_SOURCE_ENV_REFUSED'}
  }
  Assert-QaNoReparse (Join-Path $source 'scripts/local-maintenance/core.ps1')
  return $source
}

function Assert-QaTreeNoReparse([string]$Path) {
  Assert-QaNoReparse $Path
  $stack=New-Object 'System.Collections.Generic.Stack[string]';$stack.Push($Path)
  while($stack.Count){
    foreach($item in Get-ChildItem -LiteralPath $stack.Pop() -Force -ErrorAction Stop){
      if($item.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)){throw 'QA_TREE_REPARSE_REFUSED'}
      if($item.PSIsContainer){$stack.Push($item.FullName)}
    }
  }
}

function Assert-QaDatabaseTarget([Uri]$Uri,[object]$Cluster,[string]$ExpectedUri) {
  if($Uri.Scheme -notin @('postgres','postgresql') -or $Uri.Host -ne '127.0.0.1' -or $Uri.Port -le 0 -or $Uri.Port -eq 5432 -or $Uri.Port -ne [int]$Cluster.Port -or $Uri.AbsolutePath -ne ('/legalhub_runner_'+$Cluster.RunId) -or $Uri.AbsolutePath.TrimStart('/') -ne $Cluster.Database -or $ExpectedUri -ne ([Uri]$Cluster.Uri).AbsoluteUri -or $Uri.AbsoluteUri -ne $ExpectedUri){throw 'QA_DATABASE_TARGET_REFUSED'}
}

# Pure metadata validation, also usable with synthetic test snapshots.
function Assert-QaRunningEvidence([object]$Evidence,[switch]$ForStop) {
  $allowedStatus=if($ForStop){@('ready','starting','stopping')}else{@('ready')}
  if([int]$Evidence.PidfilePid -le 0 -or [int]$Evidence.ProcessId -ne [int]$Evidence.PidfilePid -or [int]$Evidence.PidfilePort -ne [int]$Evidence.ExpectedPort -or $Evidence.PidfileListenAddress -ne '127.0.0.1' -or $Evidence.PidfileStatus -notin $allowedStatus){throw 'QA_SERVER_PIDFILE_REFUSED'}
  if([IO.Path]::GetFullPath($Evidence.PidfileDataPath) -ne $Evidence.ExpectedClusterPath -or [IO.Path]::GetFullPath($Evidence.ExecutablePath) -ne $Evidence.ExpectedExecutablePath -or $Evidence.ProcessOwnerSid -ne $Evidence.CurrentOwnerSid){throw 'QA_SERVER_PROCESS_REFUSED'}
  $processTime=[DateTimeOffset]$Evidence.ProcessCreatedUtc
  $rootTime=[DateTimeOffset]$Evidence.RootCreatedUtc
  if($processTime -lt $rootTime.AddSeconds(-1) -or [Math]::Abs($processTime.ToUnixTimeSeconds()-[long]$Evidence.PidfileStartUnix) -gt 5){throw 'QA_SERVER_START_TIME_REFUSED'}
  $dataOptions=[regex]::Matches([string]$Evidence.CommandLine,'(?i)(?:^|\s)"?-D"?\s+(?:"(?<data>[^"]+)"|(?<data>\S+))(?=\s|$)')
  if($dataOptions.Count -ne 1 -or [IO.Path]::GetFullPath($dataOptions[0].Groups['data'].Value) -ne $Evidence.ExpectedClusterPath){throw 'QA_SERVER_COMMAND_REFUSED'}
  $listeners=@($Evidence.Listeners)
  if($ForStop -and $listeners.Count -eq 0){return}
  if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or [int]$listeners[0].OwningProcess -ne [int]$Evidence.PidfilePid){throw 'QA_SERVER_LISTENER_OWNER_REFUSED'}
}

function Assert-QaRunningPostgres([object]$Config,[object]$Cluster,[string]$PrivateRoot,[switch]$ForStop) {
  $root=Get-QaCanonicalDirectory $PrivateRoot
  if($root -notmatch '^D:\\LegalHubStageA-[0-9a-f]{32}$' -or $Config.targetKind -ne 'synthetic' -or $Config.privateDirectory -ne $root -or $Config.postgresBin -ne 'C:\Program Files\PostgreSQL\18\bin' -or $Cluster.RunId -notmatch '^stagea[0-9a-f]{32}$' -or [int]$Cluster.Port -le 0 -or [int]$Cluster.Port -eq 5432){throw 'QA_SERVER_TARGET_REFUSED'}
  $expectedRoot=Join-Path (Join-Path $root 'isolated') $Cluster.RunId
  $expectedCluster=Join-Path $expectedRoot 'cluster'
  if([IO.Path]::GetFullPath($Cluster.Root) -ne $expectedRoot -or [IO.Path]::GetFullPath($Cluster.Cluster) -ne $expectedCluster){throw 'QA_SERVER_PATH_REFUSED'}
  foreach($path in @($root,$expectedRoot,$expectedCluster,(Join-Path $root 'qa-owned.txt'),(Join-Path $expectedRoot 'runner-owned.txt'))){Assert-QaPrivateAcl $path}
  if((Get-Content -LiteralPath (Join-Path $root 'qa-owned.txt') -Raw).Trim() -ne 'LegalHub Stage A synthetic QA' -or (Get-Content -LiteralPath (Join-Path $expectedRoot 'runner-owned.txt') -Raw).Trim() -ne $Cluster.RunId){throw 'QA_SERVER_MARKER_REFUSED'}
  $pidFile=Join-Path $expectedCluster 'postmaster.pid';Assert-QaPrivateAcl $pidFile
  if((Get-Item -LiteralPath $pidFile).Length -gt 8192){throw 'QA_SERVER_PIDFILE_SIZE_REFUSED'}
  $lines=@(Get-Content -LiteralPath $pidFile)
  if($lines.Count -lt 8){throw 'QA_SERVER_PIDFILE_INCOMPLETE'}
  $pidNumber=0;$pidPort=0;[long]$pidStart=0
  if(-not[int]::TryParse($lines[0],[ref]$pidNumber) -or -not[long]::TryParse($lines[2],[ref]$pidStart) -or -not[int]::TryParse($lines[3],[ref]$pidPort) -or $pidNumber -le 0){throw 'QA_SERVER_PIDFILE_INVALID'}
  $process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidNumber) -ErrorAction Stop
  if(-not $process -or -not $process.ExecutablePath -or -not $process.CreationDate){throw 'QA_SERVER_PROCESS_MISSING'}
  $owner=Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction Stop
  if($owner.ReturnValue -ne 0){throw 'QA_SERVER_OWNER_UNKNOWN'}
  $evidence=[pscustomobject]@{PidfilePid=$pidNumber;PidfileDataPath=$lines[1];PidfileStartUnix=$pidStart;PidfilePort=$pidPort;PidfileListenAddress=$lines[5].Trim();PidfileStatus=$lines[7].Trim();ExpectedPort=[int]$Cluster.Port;ExpectedClusterPath=$expectedCluster;ExpectedExecutablePath=(Join-Path $Config.postgresBin 'postgres.exe');ProcessId=[int]$process.ProcessId;ExecutablePath=$process.ExecutablePath;CommandLine=$process.CommandLine;ProcessCreatedUtc=([DateTime]$process.CreationDate).ToUniversalTime();RootCreatedUtc=(Get-Item -LiteralPath $root).CreationTimeUtc;CurrentOwnerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;ProcessOwnerSid=$owner.Sid;Listeners=@(Get-NetTCPConnection -State Listen -LocalPort $Cluster.Port -ErrorAction SilentlyContinue)}
  Assert-QaRunningEvidence $evidence -ForStop:$ForStop
  $again=Get-CimInstance Win32_Process -Filter ('ProcessId='+$pidNumber) -ErrorAction Stop
  $after=@(Get-Content -LiteralPath $pidFile)
  if(-not $again -or $again.CreationDate -ne $process.CreationDate -or ($after -join "`n") -ne ($lines -join "`n")){throw 'QA_SERVER_CHANGED_DURING_CHECK'}
}

# This result contains private configuration. Always assign it; never print it.
function Read-QaGuardedRuntime([string]$PointerPath,[switch]$AllowStopped) {
  Assert-QaPrivateAcl $PointerPath
  $p=Get-Content -LiteralPath $PointerPath -Raw|ConvertFrom-Json
  $root=Get-QaCanonicalDirectory $p.privateDirectory
  if($root -notmatch '^D:\\LegalHubStageA-[0-9a-f]{32}$'){throw 'QA_PRIVATE_ROOT_REFUSED'}
  Assert-QaPrivateAcl $root
  Assert-QaPrivateAcl (Join-Path $root 'qa-owned.txt')
  if((Get-Content -LiteralPath (Join-Path $root 'qa-owned.txt') -Raw).Trim() -ne 'LegalHub Stage A synthetic QA'){throw 'QA_OWNER_MARKER_REFUSED'}
  if([IO.Path]::GetFullPath($p.runtimeFile) -ne (Join-Path $root 'runtime.json') -or [IO.Path]::GetFullPath($p.stateFile) -ne (Join-Path $root 'cluster-state.json')){throw 'QA_PRIVATE_FILE_PATH_REFUSED'}
  foreach($file in @($p.runtimeFile,$p.stateFile)){Assert-QaPrivateAcl $file}
  $c=Get-Content -LiteralPath $p.runtimeFile -Raw|ConvertFrom-Json
  $s=Get-Content -LiteralPath $p.stateFile -Raw|ConvertFrom-Json
  if($c.privateDirectory -ne $root -or $s.config.privateDirectory -ne $root -or $s.config.targetKind -ne 'synthetic' -or $s.config.expectedHost -ne '127.0.0.1' -or $s.config.expectedApplicationHost -ne '127.0.0.1'){throw 'QA_RUNTIME_ISOLATION_REFUSED'}
  if($s.cluster.RunId -notmatch '^stagea[0-9a-f]{32}$'){throw 'QA_CLUSTER_ID_REFUSED'}
  $expectedRoot=Join-Path (Join-Path $root 'isolated') $s.cluster.RunId
  if([IO.Path]::GetFullPath($s.cluster.Root) -ne $expectedRoot -or [IO.Path]::GetFullPath($s.cluster.Cluster) -ne (Join-Path $expectedRoot 'cluster')){throw 'QA_CLUSTER_PATH_REFUSED'}
  Assert-QaPrivateAcl $s.cluster.Cluster
  Assert-QaPrivateAcl (Join-Path $expectedRoot 'runner-owned.txt')
  if((Get-Content -LiteralPath (Join-Path $expectedRoot 'runner-owned.txt') -Raw).Trim() -ne $s.cluster.RunId){throw 'QA_CLUSTER_MARKER_REFUSED'}
  $uri=[Uri]$c.databaseUrl
  Assert-QaDatabaseTarget $uri $s.cluster $c.databaseUrl
  if(-not $AllowStopped){Assert-QaRunningPostgres $s.config $s.cluster $root}
  if((Get-QaCanonicalDirectory $c.repo) -ne (Join-Path $root 'qa-source')){throw 'QA_RUNTIME_REPO_REFUSED'}
  $source=Assert-QaSource $c.sourceOriginal
  if($source -eq $root -or $source.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -or $p.sourceOriginal -ne $source){throw 'QA_SOURCE_LOCATION_REFUSED'}
  return [pscustomobject]@{Pointer=$p;Runtime=$c;State=$s;Source=$source}
}
