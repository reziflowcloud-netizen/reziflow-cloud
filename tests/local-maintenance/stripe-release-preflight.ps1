#requires -Version 7
param([string]$PostgresBin='C:\Program Files\PostgreSQL\18\bin',
  [string]$StripeCommit='b623fd21b8fe21672a308f911b8adee9ba57768b')
# Exercise the actual clean, pinned combined checkout. Only the baseline schema,
# old client and synthetic databases are fixtures; no replacement Git commit is built.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $repo 'scripts/local-maintenance/core.ps1')
. (Join-Path $repo 'scripts/local-maintenance/sql-audit.ps1')
. (Join-Path $repo 'scripts/local-maintenance/plan.ps1')
$approvedStripe='b623fd21b8fe21672a308f911b8adee9ba57768b'
if($StripeCommit -cne $approvedStripe){throw 'STRIPE_FIXTURE_COMMIT_NOT_REVIEWED'}
$pending=[string[]]@('20261119170000_stripe_billing_test_mvp','20261119190000_stripe_billing_operations','20261120120000_stripe_billing_scheduled_cancel','20261120121000_stripe_billing_cancel_boundary')
$approvedHashes=@('2ffda4bdc897c43a469e4e1fa8099e94f0beaee6ccd35014ab7d8d3dafa52ee3','56f645f52c1d4e50c7091f95468a255ad2059a5320dc2ac91adbba8b6f59ee3f','efaad2383f25d110326f1397d4616768d83a0a9db5fcb67a959786705752f1a0','b08f27dd3c0df48a27956b9c42a603b6fb2a17e7c46b592132e586dd30f85c6f')
function Assert-Test([bool]$Value,[string]$Name){if(-not $Value){throw "STRIPE_PREFLIGHT_TEST_FAILED:$Name"};Write-Output "PASS $Name"}
function Export-Blob([string]$Ref,[string]$Path){
  $info=[Diagnostics.ProcessStartInfo]::new('git.exe')
  foreach($arg in @('-C',$repo,'cat-file','blob',$Ref)){[void]$info.ArgumentList.Add($arg)}
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
  $process=[Diagnostics.Process]::Start($info)
  try{
    $drain=$process.StandardError.ReadToEndAsync()
    $file=[IO.File]::Create($Path)
    try{$process.StandardOutput.BaseStream.CopyTo($file)}finally{$file.Dispose()}
    $process.WaitForExit();[void]$drain.GetAwaiter().GetResult()
    if($process.ExitCode -ne 0){throw 'REVIEWED_FIXTURE_BLOB_UNAVAILABLE'}
  }finally{$process.Dispose()}
}
$base=Join-Path $env:LOCALAPPDATA 'LegalHubStripeMaintenancePreflightTests'
if(-not(Test-Path $base)){[void](New-Item -ItemType Directory -Path $base);Set-PrivateAcl $base}
Assert-PrivateAcl $base;Assert-NotReparsePoint $base
$id=[guid]::NewGuid().ToString('N').Substring(0,12)
$root=Assert-ChildPath $base (Join-Path $base $id)
[void](New-Item -ItemType Directory -Path $root);Set-PrivateAcl $root
$marker=Join-Path $root 'stripe-preflight-test-owned.txt';[IO.File]::WriteAllText($marker,$id);Set-PrivateAcl $marker
foreach($dir in @('private','backups')){[void](New-Item -ItemType Directory -Path (Join-Path $root $dir));Set-PrivateAcl (Join-Path $root $dir)}
$config=[pscustomobject]@{targetKind='synthetic';environmentFile=(Join-Path $root 'synthetic.env');expectedHost='127.0.0.1';expectedApplicationHost='127.0.0.1';
  privateDirectory=(Join-Path $root 'private');backupDirectory=(Join-Path $root 'backups');postgresBin=$PostgresBin;
  nodeBin=(Split-Path (Get-Command node.exe).Source);applicationRole='restore_admin'}
$fixture=$repo
$source=$null;$target=$null
try{
  $head=(& git -C $repo rev-parse HEAD).Trim()
  if($LASTEXITCODE -ne 0 -or (& git -C $repo status --porcelain)){throw 'ACTUAL_COMBINED_CHECKOUT_NOT_CLEAN'}
  foreach($reviewed in @($approvedStripe,'bdcbb4edb22aacf05a0a7001061282c56b9d40ca')){
    & git -C $repo merge-base --is-ancestor $reviewed $head
    if($LASTEXITCODE -ne 0){throw 'REVIEWED_SOURCE_NOT_IN_COMBINED_HISTORY'}
  }
  $actualFiles=@(Get-MigrationFiles $repo)
  Assert-Test ($actualFiles.Count -eq 58) 'actual combined checkout has exactly 58 migrations'
  for($i=0;$i -lt $pending.Count;$i++){
    $file=@($actualFiles|Where-Object Name -ceq $pending[$i])[0]
    Assert-Test ($file.ApprovedSha256 -ceq $approvedHashes[$i] -and $file.PendingExecutableSafe) ('actual reviewed SQL '+$pending[$i])
    [void](Test-MigrationSql $file.Path)
  }
  Write-Output "ACTUAL_COMBINED_HEAD=$head StripeSQL=$StripeCommit"
  $source=New-DisposableCluster $config ('source'+$id)
  $dbName='legalhub_runner_synthetic_'+$id
  [void](Invoke-PostgresTool $config $source.Uri 'createdb.exe' @('-T','template0',$dbName) 'SYNTHETIC_CREATE_FAILED')
  $builder=[UriBuilder]::new($source.Uri);$builder.Path='/'+$dbName;$sourceUri=$builder.Uri
  [IO.File]::WriteAllText($config.environmentFile,"DIRECT_URL=$($sourceUri.AbsoluteUri)`nDATABASE_URL=$($sourceUri.AbsoluteUri)`n");Set-PrivateAcl $config.environmentFile
  $configPath=Join-Path $root 'config.json';[IO.File]::WriteAllText($configPath,($config|ConvertTo-Json));Set-PrivateAcl $configPath
  $baseline=Join-Path $fixture '.qa/main-baseline';[void](New-Item -ItemType Directory -Path $baseline -Force)
  Export-Blob '41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04:prisma/schema.prisma' (Join-Path $baseline 'schema.prisma')
  $schema=[IO.File]::ReadAllText((Join-Path $baseline 'schema.prisma')).Replace('provider = "prisma-client-js"','provider = "prisma-client-js"'+[Environment]::NewLine+'  output = "./old-client"')
  [IO.File]::WriteAllText((Join-Path $baseline 'schema.prisma'),$schema)
  [void](New-Item -ItemType Directory -Path (Join-Path $baseline 'migrations'))
  Copy-Item -LiteralPath (Join-Path $repo 'prisma/migrations/migration_lock.toml') -Destination (Join-Path $baseline 'migrations/migration_lock.toml')
  $mainFiles=@($actualFiles|Where-Object {$_.Name -cnotin $pending})
  Assert-Test ($mainFiles.Count -eq 54) 'main baseline contains exactly 54 migrations'
  foreach($migration in $mainFiles){
    $dir=Join-Path $baseline ('migrations/'+$migration.Name);[void](New-Item -ItemType Directory -Path $dir)
    [IO.File]::WriteAllBytes((Join-Path $dir 'migration.sql'),(Get-ApprovedMigrationBytes $repo $migration.Name))
  }
  Export-Blob '41efb9a65c4aa04d61c3ece52e53f3bb5edf8b04:src/lib/billing.ts' (Join-Path $baseline 'billing.ts')
  $compat=Join-Path $fixture '.qa/stripe-legacy-compat.cjs'
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'stripe-legacy-compat.cjs') -Destination $compat
  Invoke-WithIsolatedEnvironment $config $null @{DATABASE_URL=$sourceUri.AbsoluteUri;DIRECT_URL=$sourceUri.AbsoluteUri;STRIPE_BILLING_ENABLED='false';NEXT_TELEMETRY_DISABLED='1'} {
    Push-Location $fixture
    try{
      $cli=Join-Path $fixture 'node_modules/prisma/build/index.js'
      $output=@(& (Join-Path $config.nodeBin 'node.exe') $cli migrate deploy --schema (Join-Path $baseline 'schema.prisma') 2>$null)
      if($LASTEXITCODE -ne 0){throw 'SYNTHETIC_MAIN_MIGRATIONS_FAILED'}
      $output=@(& (Join-Path $config.nodeBin 'node.exe') $cli generate --schema (Join-Path $baseline 'schema.prisma') 2>$null)
      if($LASTEXITCODE -ne 0){throw 'SYNTHETIC_OLD_CLIENT_GENERATE_FAILED'}
      & (Join-Path $config.nodeBin 'node.exe') $compat seed
      if($LASTEXITCODE -ne 0){throw 'SYNTHETIC_DATA_SEED_FAILED'}
    }finally{Pop-Location}
  }
  $files=@(Get-MigrationFiles $fixture);$ledger=@(Get-ProductionLedger $config $sourceUri)
  $state=Compare-MigrationLedger $files $ledger $pending
  Assert-Test ($state.AppliedCount -eq 54 -and $state.Pending.Count -eq 4) 'actual disposable ledger is 54 applied plus 4 pending'
  $before=Get-RepresentativeFingerprints $config $sourceUri
  foreach($table in @('LeadMessage','Lead','Organization','User','NotificationPreference')){
    Assert-Test ([int]$before[$table].count -gt 0) ('nonempty synthetic representative '+$table)
  }
  $entry=Join-Path $root 'preflight-entry.ps1'
  [IO.File]::WriteAllText($entry,@'
param($Repo,$Config,$Head,[switch]$WrongSet)
$names=[string[]]@('20261119170000_stripe_billing_test_mvp','20261119190000_stripe_billing_operations','20261120120000_stripe_billing_scheduled_cancel','20261120121000_stripe_billing_cancel_boundary')
if($WrongSet){$names=@($names|Select-Object -First 3)}
& (Join-Path $Repo 'scripts/local-maintenance/runner.ps1') -Mode Preflight -Synthetic -ApprovedCommit $Head -ExpectedMigrations $names -ConfigPath $Config
if($?){exit 0}else{exit 1}
'@);Set-PrivateAcl $entry
  $errorPath=Join-Path $root 'runner.err'
  $output=@(& (Join-Path $PSHOME 'pwsh.exe') -NoProfile -File $entry -Repo $fixture -Config $configPath -Head $head -WrongSet 2>$errorPath)
  Assert-Test ($LASTEXITCODE -ne 0 -and (Get-Content $errorPath -Raw).Contains('PENDING_SET_MISMATCH')) 'actual wrong pending set fails closed before backup'
  Assert-Test (@(Get-ChildItem $config.backupDirectory -File).Count -eq 0) 'negative preflight made no backup'
  $output=@(& (Join-Path $PSHOME 'pwsh.exe') -NoProfile -File $entry -Repo $fixture -Config $configPath -Head $head 2>$errorPath)
  $exitCode=$LASTEXITCODE
  $safeCodes=@(Get-Content $errorPath|Where-Object {$_ -match '^LOCAL MAINTENANCE BLOCKED: [A-Z_]+$'})
  if($exitCode -ne 0){Write-Output ($safeCodes -join ' ');throw 'ACTUAL_FOUR_PENDING_PREFLIGHT_FAILED'}
  Assert-Test (($output -join ' ').Contains('PREFLIGHT PASS')) 'actual four-pending Runner PREFLIGHT exit0'
  $plans=@(Get-ChildItem (Join-Path $config.privateDirectory 'plans') -Filter '*.sealed.json' -File)
  Assert-Test ($plans.Count -eq 1) 'one sealed PASS plan exists'
  $plan=Read-SealedPlan $config $plans[0].FullName;Assert-PlanFresh $plan
  Assert-Test ($plan.synthetic -eq $true -and $plan.approvedCommit -ceq $head -and $plan.appliedCount -eq 54) 'sealed plan pins actual combined commit and synthetic baseline'
  Assert-Test (@($plan.pending).Count -eq 4 -and ($plan.pending -join '|') -ceq ($pending -join '|') -and
    @($plan.pending|Where-Object {$_ -isnot [string]}).Count -eq 0) 'sealed pending set contains four scalar ordered names'
  Assert-Test (($plan.migrations.name -join '|') -ceq ($pending -join '|')) 'sealed migration manifest order is exact'
  foreach($migration in $plan.migrations){
    $file=@($files|Where-Object Name -ceq $migration.name)[0]
    Assert-Test ($migration.sha256 -ceq $file.Sha256) ('sealed SQL checksum '+$migration.name)
  }
  foreach($gate in @('restore','localMigration','dataIntegrity','structure','sequencePermissions')){
    Assert-Test ($plan.$gate -ceq 'PASS') ('sealed gate '+$gate)
  }
  $report=Get-Content (Join-Path $config.privateDirectory ('reports/'+$plan.runId+'.json')) -Raw|ConvertFrom-Json
  Assert-Test ($report.result -ceq 'PREFLIGHT_ONLY' -and @($report.plannedPending).Count -eq 4) 'actual persisted report records four pending and PREFLIGHT_ONLY'
  Compare-RepresentativeFingerprints $before (Get-RepresentativeFingerprints $config $sourceUri)
  Assert-Test (@(Get-ProductionLedger $config $sourceUri).Count -eq 54) 'preflight did not migrate its synthetic source'
  $target=New-DisposableCluster $config ('legacy'+$id)
  $backup=[pscustomobject]@{Path=$plan.backup.path;Sha256=$plan.backup.sha256}
  Restore-DisposableBackup $config $target $backup
  Invoke-DisposableMigration $config $target $fixture
  [void](Compare-MigrationLedger $files @(Get-ProductionLedger $config $target.Uri) @())
  Invoke-WithIsolatedEnvironment $config $null @{DATABASE_URL=$target.Uri.AbsoluteUri;DIRECT_URL=$target.Uri.AbsoluteUri;STRIPE_BILLING_ENABLED='false'} {
    Push-Location $fixture
    try{& (Join-Path $config.nodeBin 'node.exe') $compat verify;if($LASTEXITCODE -ne 0){throw 'OLD_APP_NEW_DB_FAILED'}}finally{Pop-Location}
  }
  Write-Output 'STRIPE_FOUR_PENDING_PREFLIGHT_PASS applied=54 pending=4 scalarNames=4 sealed=PASS oldAppNewDb=PASS'
}finally{
  if($target){Stop-DisposableCluster $config $target}
  if($source){Stop-DisposableCluster $config $source}
  Assert-NoUnverifiedDisposableClusters $config
  [void](Assert-ChildPath $base $root);Assert-NotReparsePoint $root
  if([IO.File]::ReadAllText($marker) -cne $id){throw 'STRIPE_PREFLIGHT_CLEANUP_MARKER_MISMATCH'}
  $stack=[Collections.Generic.Stack[string]]::new();$stack.Push($root)
  while($stack.Count){
    foreach($entry in [IO.Directory]::EnumerateFileSystemEntries($stack.Pop())){
      $attributes=[IO.File]::GetAttributes($entry)
      if($attributes -band [IO.FileAttributes]::ReparsePoint){throw 'STRIPE_PREFLIGHT_CLEANUP_REPARSE_FORBIDDEN'}
      if($attributes -band [IO.FileAttributes]::Directory){$stack.Push($entry)}
    }
  }
  Remove-Item -LiteralPath $root -Recurse -Force
  Write-Output 'STRIPE_PREFLIGHT_SYNTHETIC_CLEANUP_VERIFIED'
}
