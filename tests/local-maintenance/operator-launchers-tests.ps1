#requires -Version 7
param([string]$PostgresBin='C:\Program Files\PostgreSQL\18\bin',[switch]$ModelsOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if(-not $IsWindows){throw 'OPERATOR_TEST_REQUIRES_WINDOWS'}
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
. (Join-Path $PSScriptRoot 'report-functions.ps1')
$passed=0
function Assert-Test([bool]$Value,[string]$Name){if(-not $Value){throw ('OPERATOR_TEST_FAILED:'+ $Name)};$script:passed++;Write-Output ('PASS '+$Name)}
$pwsh=Join-Path $PSHOME 'pwsh.exe'
$legacy=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
$cmd=Join-Path $env:SystemRoot 'System32/cmd.exe'
$policies=Get-ExecutionPolicy -List|ConvertTo-Json -Compress
$base=Join-Path $env:LOCALAPPDATA 'LegalHubOperatorLauncherTests'
if(-not(Test-Path -LiteralPath $base)){[void](New-Item -ItemType Directory -Path $base);Set-PrivateAcl $base}
Assert-PrivateAcl $base;Assert-NotReparsePoint $base
$id=[guid]::NewGuid().ToString('N').Substring(0,12)
$root=Assert-ChildPath $base (Join-Path $base ($id+' spaces !'))
[void](New-Item -ItemType Directory -Path $root);Set-PrivateAcl $root
[IO.File]::WriteAllText((Join-Path $root 'operator-test-owned.txt'),$id)
$cwd=Join-Path $root 'decoy cwd';[void](New-Item -ItemType Directory -Path $cwd)
# Native Windows argv encoding. cmd /s removes only the extra outer pair.
# Test values contain literal quotes, spaces, bang and a trailing backslash.
function Quote-Arg([string]$Value){return '"'+[regex]::Replace([regex]::Replace($Value,'(\\*)"','$1$1\"'),'(\\+)$','$1$1')+'"'}
function Run-Child([string]$Binary,[string]$RawArguments,[hashtable]$Extra=@{},[int]$DeadlineMs=600000){
  $p=[Diagnostics.ProcessStartInfo]::new($Binary)
  $p.UseShellExecute=$false;$p.CreateNoWindow=$true;$p.WorkingDirectory=$cwd
  $p.Arguments=$RawArguments;$p.RedirectStandardOutput=$true;$p.RedirectStandardError=$true
  $p.Environment.Clear()
  foreach($key in @('SystemRoot','WINDIR','ComSpec','PATHEXT','PATH','TEMP','TMP','USERPROFILE','HOME','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramFiles(x86)','ProgramData')){
    $value=[Environment]::GetEnvironmentVariable($key,'Process');if($value){$p.Environment[$key]=$value}
  }
  $p.Environment['PATH']=$PSHOME+';'+$p.Environment['PATH']
  $p.Environment['DATABASE_URL']='postgresql://synthetic@127.0.0.1:1/never_connect'
  $p.Environment['DIRECT_URL']='postgresql://synthetic@127.0.0.1:1/never_connect'
  foreach($key in $Extra.Keys){$p.Environment[$key]=[string]$Extra[$key]}
  $child=[Diagnostics.Process]::Start($p)
  try{
    $out=$child.StandardOutput.ReadToEndAsync();$err=$child.StandardError.ReadToEndAsync()
    if(-not $child.WaitForExit($DeadlineMs)){$child.Kill($true);[void]$child.WaitForExit(10000);throw 'OPERATOR_TEST_CHILD_DEADLINE'}
    if(-not $out.Wait(10000) -or -not $err.Wait(10000)){throw 'OPERATOR_TEST_DRAIN_FAILED'}
    return [pscustomobject]@{Exit=$child.ExitCode;Output=$out.Result;Error=$err.Result}
  }finally{if(-not $child.HasExited){$child.Kill($true);[void]$child.WaitForExit(10000)};$child.Dispose()}
}
function Run-Bat([string]$Path,[string[]]$Arguments=@(),[hashtable]$Extra=@{}){
  $line=(Quote-Arg $Path)+' '+(($Arguments|ForEach-Object {Quote-Arg $_}) -join ' ')
  return Run-Child $cmd ('/d /s /v:off /c "'+$line+'"') $Extra
}
$launchers=[ordered]@{'PREFLIGHT.bat'='Preflight';'STATUS.bat'='Status';'REPORT.bat'='Report';'APPLY_APPROVED.bat'='Apply'}
$cluster=$null
try{
  $legacyPolicies=Run-Child $legacy '-NoProfile -Command "Get-ExecutionPolicy -List | ConvertTo-Json -Compress"'
  Assert-Test ($legacyPolicies.Exit -eq 0) 'existing Windows PowerShell policy can be observed without modification'
  foreach($name in $launchers.Keys){
    $text=[IO.File]::ReadAllText((Join-Path $repo $name))
    Assert-Test ($text -notmatch '(?i)ExecutionPolicy|Bypass|powershell\.exe|\bcall\b' -and $text -match 'DisableDelayedExpansion') 'launcher has no policy override, legacy fallback or second call parsing'
    $missing=Run-Bat (Join-Path $repo $name) @('-Synthetic') @{PATH=(Join-Path $root 'empty path')}
    Assert-Test ($missing.Exit -eq 78 -and $missing.Error -match 'POWERSHELL_7_NOT_FOUND') 'actual BAT refuses missing pwsh before mode dispatch'
  }
  $unsupported=Join-Path $root 'unsupported runtime';[void](New-Item -ItemType Directory -Path $unsupported)
  [IO.File]::Copy($legacy,(Join-Path $unsupported 'pwsh.exe'))
  if(Test-Path ($legacy+'.config')){[IO.File]::Copy(($legacy+'.config'),(Join-Path $unsupported 'pwsh.exe.config'))}
  $oldProbe=Run-Child (Join-Path $unsupported 'pwsh.exe') '-NoProfile -Command "[Console]::Write($PSVersionTable.PSVersion.Major)"'
  Assert-Test ($oldProbe.Exit -eq 0 -and $oldProbe.Output -ceq '5') 'unsupported runtime fixture is actual Windows PowerShell 5.1'
  foreach($name in $launchers.Keys){
    $old=Run-Bat (Join-Path $repo $name) @('-Synthetic') @{PATH=$unsupported}
    Assert-Test ($old.Exit -eq 78 -and $old.Error -match 'OPERATOR_REQUIRES_POWERSHELL_7') 'actual BAT rejects unsupported host before runner'
  }
  $runner=Join-Path $repo 'scripts/local-maintenance/runner.ps1'
  $direct=Run-Child $legacy ('-NoProfile -File '+(Quote-Arg $runner)+' -Mode Status -Synthetic -ConfigPath '+(Quote-Arg (Join-Path $root 'never read.json')))
  $runtimeRefusal=$direct.Exit -eq 78 -and $direct.Error -match 'OPERATOR_REQUIRES_POWERSHELL_7'
  $policyRefusal=$direct.Exit -ne 0 -and ($direct.Error -match 'PSSecurityException' -or ($direct.Error -match 'about_Execution_Policies' -and $direct.Error -match 'FullyQualifiedErrorId\s*:\s*UnauthorizedAccess'))
  Assert-Test ($runtimeRefusal -or $policyRefusal) 'actual Windows PowerShell 5.1 file entry fails closed without policy override'
  # Existing policy can refuse .ps1 before the runtime check. Independently
  # execute the unchanged source as inline code to verify the early guard too;
  # no ExecutionPolicy setting/flag, module import or database operation is used.
  $marker=Join-Path $root 'add-type-reached.txt'
  $inline="function Add-Type { [IO.File]::WriteAllText('"+$marker.Replace("'","''")+"','reached'); throw 'ADD_TYPE_REACHED' }; & ([scriptblock]::Create([IO.File]::ReadAllText('"+$runner.Replace("'","''")+"'))) -Mode Status -Synthetic"
  $early=Run-Child $legacy ('-NoProfile -EncodedCommand '+[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($inline)))
  Assert-Test ($early.Exit -eq 78 -and $early.Error -match 'OPERATOR_REQUIRES_POWERSHELL_7' -and -not(Test-Path $marker)) 'exact runner source refuses 5.1 before Add-Type even when file policy masks guard'
  # Byte-identical BAT protocol tests, with a test-only endpoint instead of DB code.
  $copy=Join-Path $root 'identical BAT copies';$endpoint=Join-Path $copy 'scripts/local-maintenance'
  [void](New-Item -ItemType Directory -Path $endpoint -Force)
  [IO.File]::WriteAllText((Join-Path $endpoint 'runner.ps1'),@'
param([string]$Mode,[string]$ConfigPath,[string]$ApprovalReference,[switch]$Synthetic)
[IO.File]::WriteAllText($ConfigPath,([ordered]@{mode=$Mode;reference=$ApprovalReference;synthetic=[bool]$Synthetic;extra=@($args)}|ConvertTo-Json -Depth 4))
exit 37
'@)
  $literal='space "quoted" bang! trailing\'
  foreach($name in $launchers.Keys){
    $bat=Join-Path $copy $name;[IO.File]::Copy((Join-Path $repo $name),$bat)
    Assert-Test ((Get-FileHash $bat).Hash -ceq (Get-FileHash (Join-Path $repo $name)).Hash) 'protocol BAT is byte-identical to operator file'
    $capture=Join-Path $root ($name+'.argv.json')
    $r=Run-Bat $bat @('-Synthetic','-ConfigPath',$capture,'-ApprovalReference',$literal)
    Assert-Test ($r.Exit -eq 37) 'BAT preserves arbitrary endpoint exit37'
    $argsRecord=Get-Content -LiteralPath $capture -Raw|ConvertFrom-Json
    Assert-Test ($argsRecord.mode -ceq $launchers[$name] -and $argsRecord.reference -ceq $literal -and $argsRecord.synthetic -and $argsRecord.extra.Count -eq 0) 'spaces literal quotes bang trailing slash and mode preserve exact argv'
  }
  $bad=Run-Bat (Join-Path $repo 'STATUS.bat') @('-Synthetic','-ConfigPath',(Join-Path $root 'missing config.json'))
  Assert-Test ($bad.Exit -eq 1 -and $bad.Error -match 'CONFIG_MISSING') 'real BAT preserves Runner refusal exit1'
  $deny=Run-Bat (Join-Path $repo 'APPLY_APPROVED.bat') @('-Synthetic','-ConfigPath',(Join-Path $root 'never read.json'),'-ApprovalReference',$literal)
  Assert-Test ($deny.Exit -eq 1 -and $deny.Error -match 'SYNTHETIC_APPLY_FORBIDDEN') 'actual APPLY BAT synthetic negative stops before config or SQL'
  $noApproval=Run-Bat (Join-Path $repo 'APPLY_APPROVED.bat') @('-ConfigPath',(Join-Path $root 'never read.json'))
  Assert-Test ($noApproval.Exit -eq 1 -and $noApproval.Error -match 'SEPARATE_APPROVAL_REFERENCE_REQUIRED') 'actual APPLY BAT missing approval stops before config or SQL'
  if(-not $ModelsOnly){
    $private=Join-Path $root 'private reports';$backups=Join-Path $root 'synthetic backups'
    foreach($dir in @($private,$backups)){[void](New-Item -ItemType Directory -Path $dir);Set-PrivateAcl $dir}
    $config=[pscustomobject]@{targetKind='synthetic';environmentFile=(Join-Path $root 'synthetic fixture.env');expectedHost='127.0.0.1';expectedApplicationHost='127.0.0.1';applicationRole='restore_admin';privateDirectory=$private;backupDirectory=$backups;postgresBin=$PostgresBin;nodeBin=(Split-Path (Get-Command node.exe).Source)}
    $cluster=New-DisposableCluster $config ('operator'+$id)
    $dbName='legalhub_runner_synthetic_'+$id
    [void](Invoke-PostgresTool $config $cluster.Uri 'createdb.exe' @('-T','template0',$dbName) 'SYNTHETIC_CREATE_FAILED')
    $builder=[UriBuilder]::new($cluster.Uri);$builder.Path='/'+$dbName;$uri=$builder.Uri
    [IO.File]::WriteAllText($config.environmentFile,"DIRECT_URL=$($uri.AbsoluteUri)`nDATABASE_URL=$($uri.AbsoluteUri)`n");Set-PrivateAcl $config.environmentFile
    $configPath=Join-Path $root 'operator config with spaces.json';[IO.File]::WriteAllText($configPath,($config|ConvertTo-Json));Set-PrivateAcl $configPath
    $fixture=Join-Path $root 'prisma fixture';[void](New-Item -ItemType Directory -Path (Join-Path $fixture 'migrations') -Force)
    [IO.File]::Copy((Join-Path $repo 'prisma/schema.prisma'),(Join-Path $fixture 'schema.prisma'))
    [IO.File]::Copy((Join-Path $repo 'prisma/migrations/migration_lock.toml'),(Join-Path $fixture 'migrations/migration_lock.toml'))
    $files=@(Get-MigrationFiles $repo);$pending=$files[-1].Name
    foreach($m in $files|Where-Object Name -cne $pending){$dir=Join-Path $fixture ('migrations/'+$m.Name);[void](New-Item -ItemType Directory -Path $dir);[IO.File]::WriteAllBytes((Join-Path $dir 'migration.sql'),(Get-ApprovedMigrationBytes $repo $m.Name))}
    Invoke-WithIsolatedEnvironment $config $null @{DATABASE_URL=$uri.AbsoluteUri;DIRECT_URL=$uri.AbsoluteUri;NEXT_TELEMETRY_DISABLED='1'} {
      $old=$ErrorActionPreference;try{$ErrorActionPreference='Continue';$output=@(& (Join-Path $config.nodeBin 'node.exe') (Join-Path $repo 'node_modules/prisma/build/index.js') migrate deploy --schema (Join-Path $fixture 'schema.prisma') 2>$null);if($LASTEXITCODE -ne 0){throw 'OPERATOR_BASE_MIGRATIONS_FAILED'}}finally{$ErrorActionPreference=$old}
    }
    $head=(& git -C $repo rev-parse HEAD).Trim()
    $before=@(Get-ProductionLedger $config $uri).Count
    $r=Run-Bat (Join-Path $repo 'PREFLIGHT.bat') @('-Synthetic','-ApprovedCommit',$head,'-ExpectedMigrations',$pending,'-ConfigPath',$configPath)
    Assert-Test ($r.Exit -eq 0 -and $r.Output -match 'PREFLIGHT PASS') 'ACTUAL BAT PREFLIGHT with snapshot backup restore simulation and seal'
    $plans=@(Get-ChildItem (Join-Path $private 'plans') -Filter '*.sealed.json');Assert-Test ($plans.Count -eq 1) 'actual BAT created one sealed plan'
    $plan=Read-SealedPlan $config $plans[0].FullName
    Assert-Test ($plan.approvedCommit -ceq $head -and $plan.restore -ceq 'PASS' -and $plan.dataIntegrity -ceq 'PASS' -and $plan.structure -ceq 'PASS') 'actual BAT sealed SHA and integrity remain enforced'
    Assert-Test (@(Get-ProductionLedger $config $uri).Count -eq $before) 'actual BAT PREFLIGHT did not migrate synthetic source'
    foreach($name in @('STATUS.bat','REPORT.bat')){
      $r=Run-Bat (Join-Path $repo $name) @('-Synthetic','-ConfigPath',$configPath,'-PlanPath',$plans[0].FullName)
      Assert-Test ($r.Exit -eq 0 -and $r.Output -match 'STATUS PREFLIGHT_ONLY') 'ACTUAL BAT STATUS/REPORT reads private synthetic report from spaced paths'
    }
    Assert-Test (@(Get-ChildItem (Join-Path $private 'plans') -Filter '*.attempted').Count -eq 0) 'no actual APPLY or attempted marker'
  }
  Assert-Test (($policies) -ceq (Get-ExecutionPolicy -List|ConvertTo-Json -Compress)) 'Execution Policy unchanged in operator runtime'
  $legacyAfter=Run-Child $legacy '-NoProfile -Command "Get-ExecutionPolicy -List | ConvertTo-Json -Compress"'
  Assert-Test ($legacyAfter.Exit -eq 0 -and $legacyAfter.Output.Trim() -ceq $legacyPolicies.Output.Trim()) 'Windows PowerShell Execution Policy unchanged'
  Write-Output ('OPERATOR_LAUNCHERS_PASS count='+$passed+' actualDatabase='+(-not $ModelsOnly))
}finally{
  if($cluster){Stop-DisposableCluster $config $cluster;Assert-NoUnverifiedDisposableClusters $config}
  Write-Output 'OPERATOR_OWNED_CLUSTER_STOPPED; synthetic private argv/reports retained locally'
}
