param(
  [Parameter(Mandatory = $true)][ValidateSet('Preflight', 'Apply', 'Status')][string]$Mode,
  [string]$ApprovedCommit,
  [string[]]$ExpectedMigrations = @(),
  [string]$ConfigPath = (Join-Path $env:LOCALAPPDATA 'LegalHubMaintenance\config.json'),
  [string]$PlanPath,
  [string]$ApprovalReference,
  [switch]$Synthetic
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'core.ps1')
. (Join-Path $PSScriptRoot 'sql-audit.ps1')
. (Join-Path $PSScriptRoot 'plan.ps1')

function Assert-OutsideGit([string]$Repo, [string]$Path) {
  $root = [IO.Path]::GetFullPath($Repo).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
  if ([IO.Path]::GetFullPath($Path).StartsWith($root,
      [StringComparison]::OrdinalIgnoreCase)) {
    Stop-Maintenance 'PRIVATE_FILE_INSIDE_GIT'
  }
}

function Get-Config([string]$Repo) {
  $config = Read-MaintenanceConfig $ConfigPath ([bool]$Synthetic)
  foreach ($path in @($ConfigPath, $config.environmentFile, $config.backupDirectory,
      $config.privateDirectory)) {
    Assert-OutsideGit $Repo $path
  }
  Assert-PrivateAcl $ConfigPath
  Assert-PrivateAcl $config.environmentFile
  Assert-PrivateAcl $config.privateDirectory
  return $config
}

function Get-Expected([string[]]$Names) {
  if (@($Names).Count -eq 0) { Stop-Maintenance 'EXPECTED_MIGRATIONS_REQUIRED' }
  $names = @($Names | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if (@($names).Count -ne @($Names).Count -or
      @($names | Select-Object -Unique).Count -ne @($names).Count) {
    Stop-Maintenance 'EXPECTED_MIGRATIONS_DUPLICATE_OR_EMPTY'
  }
  foreach ($name in $names) {
    if ($name -notmatch '^[0-9]{14}_[a-z0-9_]+$') { Stop-Maintenance 'EXPECTED_MIGRATION_NAME_INVALID' }
  }
  return ,$names
}

function Get-CheckedState([object]$Config, [Uri]$Uri, [string]$Repo,
    [string]$Commit, [string[]]$Expected) {
  [void](Get-GitCheckpoint $Repo $Commit ([bool]$Synthetic))
  Assert-GuardedCommand $Repo
  $migrations = @(Get-MigrationFiles $Repo)
  $ledger = @(Get-ProductionLedger $Config $Uri)
  $ledgerResult = Compare-MigrationLedger $migrations $ledger $Expected
  $audits = @()
  foreach ($name in $Expected) {
    $match = @($migrations | Where-Object Name -eq $name)
    if ($match.Count -ne 1) { Stop-Maintenance 'EXPECTED_MIGRATION_FILE_MISSING' }
    $audit = Test-MigrationSql $match[0].Path
    $audits += [pscustomobject]@{ name = $name; sha256 = $match[0].Sha256; audit = $audit }
  }
  $snapshot = Get-DatabaseSnapshot $Config $Uri
  if ($snapshot.database -ne $Uri.AbsolutePath.TrimStart('/') -or
      $snapshot.role -ne [Uri]::UnescapeDataString($Uri.UserInfo.Split(':', 2)[0])) {
    Stop-Maintenance 'CONNECTED_TARGET_MISMATCH'
  }
  $indexed = @($audits | ForEach-Object { $_.audit.BlockingIndexTables })
  Assert-LockSafety $Config $Uri $snapshot $indexed
  return [pscustomobject]@{
    migrations = $migrations
    ledger = $ledgerResult
    audits = $audits
    snapshot = $snapshot
    fingerprint = Get-TargetFingerprint $Uri $snapshot
  }
}

function Assert-StateEqualsPlan([object]$State, [object]$Plan) {
  if ($State.fingerprint -ne $Plan.targetFingerprint -or
      $State.ledger.AppliedCount -ne $Plan.appliedCount -or
      (($State.ledger.Pending | Sort-Object) -join '|') -ne
        (($Plan.pending | Sort-Object) -join '|')) {
    Stop-Maintenance 'STATE_CHANGED_SINCE_PREFLIGHT'
  }
  foreach ($migration in $Plan.migrations) {
    $current = @($State.audits | Where-Object name -eq $migration.name)
    if ($current.Count -ne 1 -or $current[0].sha256 -ne $migration.sha256) {
      Stop-Maintenance 'SQL_CHANGED_SINCE_PREFLIGHT'
    }
  }
}

function Write-Report([object]$Config, [object]$Plan, [string]$Result,
    [string]$Code = '', [string]$Approval = '') {
  $directory = Get-PlanDirectory $Config
  $path = Join-Path $directory ($Plan.runId + '.report.json')
  $report = [ordered]@{
    runId = $Plan.runId
    createdUtc = [DateTime]::UtcNow.ToString('o')
    approvedCommit = $Plan.approvedCommit
    migrations = @($Plan.pending)
    result = $Result
    reasonCode = $Code
    approvalReference = $Approval
    productionChanged = if ($Result -eq 'APPLIED') { 'YES' } else { 'UNCONFIRMED_OR_NO' }
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $report -Depth 10))
  [IO.File]::WriteAllBytes($path, $bytes)
  Set-PrivateAcl $path
  return $path
}

function Invoke-Preflight([string]$Repo) {
  $config = Get-Config $Repo
  $expected = @(Get-Expected $ExpectedMigrations)
  $commit = Get-GitCheckpoint $Repo $ApprovedCommit ([bool]$Synthetic)
  $uri = Get-PrivateDatabaseUri $config 'DIRECT_URL' ([bool]$Synthetic)
  $state = Get-CheckedState $config $uri $Repo $commit $expected
  $runId = [Guid]::NewGuid().ToString('N').Substring(0, 12)
  $before = Get-RepresentativeFingerprints $config $uri
  $backup = New-PrivateBackup $config $uri $runId
  $cluster = $null
  try {
    $cluster = New-DisposableCluster $config $runId
    Restore-DisposableBackup $config $cluster $backup
    $restored = Get-RepresentativeFingerprints $config $cluster.Uri
    Compare-RepresentativeFingerprints $before $restored
    $restoreLedger = @(Get-ProductionLedger $config $cluster.Uri)
    [void](Compare-MigrationLedger $state.migrations $restoreLedger $expected)
    Invoke-DisposableMigration $cluster $Repo
    $afterLedger = @(Get-ProductionLedger $config $cluster.Uri)
    [void](Compare-MigrationLedger $state.migrations $afterLedger @())
    $excluded = @{}
    foreach ($migration in $state.audits) {
      foreach ($table in $migration.audit.AddedColumns.Keys) {
        if (-not $excluded.ContainsKey($table)) { $excluded[$table] = @() }
        $excluded[$table] += @($migration.audit.AddedColumns[$table])
      }
    }
    $after = Get-RepresentativeFingerprints $config $cluster.Uri $excluded
    Compare-RepresentativeFingerprints $before $after $true
    $plan = [ordered]@{
      version = 1
      runId = $runId
      createdUtc = [DateTime]::UtcNow.ToString('o')
      approvedCommit = $commit
      targetFingerprint = $state.fingerprint
      appliedCount = $state.ledger.AppliedCount
      pending = @($expected)
      migrations = @($state.audits | ForEach-Object {
          [ordered]@{ name = $_.name; sha256 = $_.sha256; risk = $_.audit.Risk }
        })
      backup = [ordered]@{ path = $backup.Path; sha256 = $backup.Sha256;
        bytes = $backup.Bytes; tocEntries = $backup.TocEntries }
      restore = 'PASS'
      localMigration = 'PASS'
      dataIntegrity = 'PASS'
      oldAppNewDb = 'PASS_SCHEMA_ONLY'
      synthetic = [bool]$Synthetic
    }
    $planPath = Save-SealedPlan $config $plan
    Write-Output "PREFLIGHT PASS; run=$runId; pending=$($expected -join ','); restore=PASS; isolatedMigration=PASS; dataIntegrity=PASS; oldAppNewDb=PASS_SCHEMA_ONLY"
    Write-Output "SEALED PLAN: $planPath"
    Write-Output 'No production migration was applied.'
  } finally {
    if ($cluster) { Stop-DisposableCluster $config $cluster }
  }
}

function Invoke-Apply([string]$Repo) {
  if ($Synthetic) { Stop-Maintenance 'SYNTHETIC_APPLY_FORBIDDEN' }
  if (-not $ApprovalReference -or
      $ApprovalReference -notmatch '^[A-Za-z0-9:/._#-]{8,200}$') {
    Stop-Maintenance 'SEPARATE_APPROVAL_REFERENCE_REQUIRED'
  }
  $config = Get-Config $Repo
  $actualPlanPath = if ($PlanPath) { $PlanPath } else { Get-LatestPlanPath $config }
  $plan = Read-SealedPlan $config $actualPlanPath
  if ($plan.synthetic) { Stop-Maintenance 'SYNTHETIC_PLAN_APPLY_FORBIDDEN' }
  if ($plan.restore -ne 'PASS' -or $plan.localMigration -ne 'PASS' -or
      $plan.dataIntegrity -ne 'PASS' -or $plan.oldAppNewDb -ne 'PASS_SCHEMA_ONLY' -or
      @($plan.pending).Count -eq 0 -or
      @($plan.pending).Count -ne @($plan.migrations).Count) {
    Stop-Maintenance 'SEALED_PLAN_INCOMPLETE'
  }
  if ($ApprovedCommit -and $ApprovedCommit -ne $plan.approvedCommit) {
    Stop-Maintenance 'APPROVED_COMMIT_MISMATCH'
  }
  Assert-PlanFresh $plan
  Assert-PlanNotAttempted $config $plan | Out-Null
  Assert-BackupSealed $config $plan
  $uri = Get-PrivateDatabaseUri $config 'DIRECT_URL' $false
  $state = Get-CheckedState $config $uri $Repo $plan.approvedCommit @($plan.pending)
  Assert-StateEqualsPlan $state $plan
  $phrase = Get-ApprovalPhrase $config $plan
  Write-Output 'Separate authorization reference recorded. To apply exactly the sealed migrations, type:'
  Write-Output $phrase
  $typed = Read-Host 'Confirmation'
  if (-not (Test-ApprovalPhrase $config $plan $typed)) {
    Stop-Maintenance 'INTERACTIVE_CONFIRMATION_FAILED'
  }
  # Recheck the actual database, Git tree, SQL, backup, and lock state after operator input.
  Assert-PlanFresh $plan
  Assert-BackupSealed $config $plan
  $state = Get-CheckedState $config $uri $Repo $plan.approvedCommit @($plan.pending)
  Assert-StateEqualsPlan $state $plan
  Assert-PlanNotAttempted $config $plan | Out-Null
  Mark-PlanAttempted $config $plan
  $old = @{}
  foreach ($name in @('DB_MIGRATE_TARGET', 'DB_MIGRATE_CONFIRM',
      'DB_MIGRATE_EXPECTED_HOST', 'DIRECT_URL', 'DATABASE_URL')) {
    $old[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
  }
  $oldPreference = $ErrorActionPreference
  try {
    $env:DB_MIGRATE_TARGET = 'production'
    $env:DB_MIGRATE_CONFIRM = 'production'
    $env:DB_MIGRATE_EXPECTED_HOST = $config.expectedHost
    $env:DIRECT_URL = $uri.AbsoluteUri
    $env:DATABASE_URL = $uri.AbsoluteUri
    # Never echo child output: scripts and database errors can contain credentials.
    Push-Location $Repo
    try {
      $ErrorActionPreference = 'Continue'
      $output = @(& npm run db:migrate:deploy 2>$null)
      $exitCode = $LASTEXITCODE
    }
    finally { Pop-Location }
    if ($exitCode -ne 0) {
      [void](Write-Report $config $plan 'APPLY_ERROR' 'GUARDED_COMMAND_FAILED' $ApprovalReference)
      Stop-Maintenance 'GUARDED_COMMAND_FAILED_DO_NOT_RETRY'
    }
  } finally {
    $ErrorActionPreference = $oldPreference
    foreach ($name in $old.Keys) {
      [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process')
    }
  }
  try {
    $ledger = @(Get-ProductionLedger $config $uri)
    [void](Compare-MigrationLedger (Get-MigrationFiles $Repo) $ledger @())
    [void](Write-Report $config $plan 'APPLIED' '' $ApprovalReference)
    Write-Output "APPLIED; run=$($plan.runId); pending=0; failed=0"
  } catch {
    [void](Write-Report $config $plan 'POSTCHECK_FAILED' 'LEDGER_NOT_VERIFIED' $ApprovalReference)
    Stop-Maintenance 'POSTCHECK_FAILED_DIAGNOSE_NO_RETRY'
  }
}

function Invoke-Status([string]$Repo) {
  $config = Get-Config $Repo
  $path = if ($PlanPath) { $PlanPath } else { Get-LatestPlanPath $config }
  $plan = Read-SealedPlan $config $path
  $reportPath = Join-Path (Get-PlanDirectory $config) ($plan.runId + '.report.json')
  $report = if (Test-Path -LiteralPath $reportPath) {
    Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
  } else { $null }
  $attempted = Test-Path -LiteralPath (Join-Path (Get-PlanDirectory $config) ($plan.runId + '.attempted'))
  $result = if ($report) { $report.result } elseif ($attempted) { 'ATTEMPTED_UNVERIFIED' } else { 'PREFLIGHT_ONLY' }
  Write-Output "STATUS $result; run=$($plan.runId); commit=$($plan.approvedCommit); pending=$($plan.pending -join ',')"
  Write-Output "Backup retained: $(Test-Path -LiteralPath $plan.backup.path)"
  Write-Output 'This offline status does not connect to Production.'
}

try {
  $repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
  switch ($Mode) {
    'Preflight' { Invoke-Preflight $repo }
    'Apply' { Invoke-Apply $repo }
    'Status' { Invoke-Status $repo }
  }
} catch {
  $message = $_.Exception.Message
  $code = if ($message -match 'LMR:([A-Z0-9_]+)') { $Matches[1] } else { 'UNEXPECTED_ERROR' }
  [Console]::Error.WriteLine("LOCAL MAINTENANCE BLOCKED: $code")
  if ($Synthetic -and $code -eq 'UNEXPECTED_ERROR') {
    [Console]::Error.WriteLine("SYNTHETIC DIAGNOSTIC: $($_.Exception.GetType().Name) line=$($_.InvocationInfo.ScriptLineNumber)")
  }
  exit 1
}
