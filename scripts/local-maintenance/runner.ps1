param(
  [Parameter(Mandatory = $true)][ValidateSet('Preflight', 'Apply', 'Status', 'Report')][string]$Mode,
  [string]$ApprovedCommit,
  [string[]]$ExpectedMigrations = @(),
  [string]$ConfigPath = (Join-Path $env:LOCALAPPDATA 'LegalHubMaintenance\config.json'),
  [string]$PlanPath,
  [string]$ApprovalReference,
  [switch]$NoMigration,
  [switch]$Synthetic
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
foreach ($module in @('Microsoft.PowerShell.Management', 'Microsoft.PowerShell.Security',
    'Microsoft.PowerShell.Utility')) {
  Import-Module (Join-Path $PSHOME "Modules/$module/$module.psd1") -ErrorAction Stop
}
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
  if (-not $Synthetic) {
    Assert-OutsideGit $Repo $config.tlsRootCertFile
    Assert-PrivateAcl $config.tlsRootCertFile
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
  [void](Assert-PinnedPrismaSchema $Repo)
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
  $appUri = Get-PrivateDatabaseUri $Config 'DATABASE_URL' ([bool]$Synthetic)
  $appState = Get-ApplicationRoleState $Config $appUri $snapshot
  $indexed = @($audits | ForEach-Object { $_.audit.BlockingIndexTables })
  Assert-LockSafety $Config $Uri $snapshot $indexed
  return [pscustomobject]@{
    migrations = $migrations
    ledger = $ledgerResult
    audits = $audits
    snapshot = $snapshot
    applicationRole = $appState.role
    fingerprint = Get-Sha256Text ((Get-TargetFingerprint $Uri $snapshot) + '|' +
      $appUri.Host + '|' + $appState.role)
  }
}

function Assert-StateEqualsPlan([object]$State, [object]$Plan) {
  if ($State.fingerprint -ne $Plan.targetFingerprint -or
      $State.applicationRole -ne $Plan.applicationRole -or
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

function Get-ReportDirectory([object]$Config) {
  $directory = Join-Path $Config.privateDirectory 'reports'
  if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $directory)
    Set-PrivateAcl $directory
  }
  Assert-PrivateAcl $directory
  return $directory
}

function Save-SafeReport([object]$Config, [object]$Report) {
  if ($Report.runId -notmatch '^[0-9a-f]{12}$') { Stop-Maintenance 'REPORT_RUN_ID_INVALID' }
  $path = Join-Path (Get-ReportDirectory $Config) ($Report.runId + '.json')
  $temporary = Join-Path (Get-ReportDirectory $Config) ($Report.runId + '.new')
  $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $Report -Depth 20))
  [IO.File]::WriteAllBytes($temporary, $bytes)
  Set-PrivateAcl $temporary
  if (Test-Path -LiteralPath $path) {
    [IO.File]::Replace($temporary, $path, $null)
  } else { [IO.File]::Move($temporary, $path) }
  Assert-PrivateAcl $path
  return $path
}

function Get-SafeErrorCode([object]$ErrorRecord) {
  if ($ErrorRecord.Exception.Message -match 'LMR:([A-Z0-9_]+)') { return $Matches[1] }
  return 'UNEXPECTED_ERROR'
}

function Write-Report([object]$Config, [object]$Plan, [string]$Result,
    [string]$Code = '', [string]$Approval = '', [object]$Observed = $null) {
  $report = [ordered]@{
    version = 1; runId = $Plan.runId; checkedUtc = [DateTime]::UtcNow.ToString('o')
    approvedCommit = $Plan.approvedCommit; plannedPending = @($Plan.pending)
    lastObservedPending = if ($Observed) { @($Observed.Pending) } else { $null }
    lastObservedAppliedCount = if ($Observed) { $Observed.AppliedCount } else { $null }
    lastObservedFailedCount = if ($Observed) { $Observed.FailedCount } else { $null }
    observationUtc = if ($Observed) { [DateTime]::UtcNow.ToString('o') } else { $null }
    preflight = 'PASS'; backup = 'PASS'; restore = $Plan.restore
    simulation = $Plan.localMigration; structure = $Plan.structure
    sequencePermissions = $Plan.sequencePermissions
    oldAppCompatibility = $Plan.oldAppNewDb
    apply = $Result; result = $Result; reasonCode = $Code
    outcome = if ($Result -eq 'APPLIED') { 'VERIFIED_APPLIED' }
      elseif ($Result -eq 'PREFLIGHT_ONLY') { 'NOT_ATTEMPTED' } else { 'UNKNOWN' }
    approvalReference = $Approval
    nextAction = if ($Result -eq 'APPLIED') { 'APPLICATION_SMOKE_AND_INDEPENDENT_REVIEW' }
      elseif ($Result -eq 'PREFLIGHT_ONLY') { 'SEPARATE_OWNER_DECISION_REQUIRED' }
      elseif ($Result -eq 'ATTEMPTED_UNVERIFIED') { 'DIAGNOSE_LEDGER_AND_OUTCOME_NO_RETRY' }
      else { 'DIAGNOSE_NO_RETRY_RERUN_PREFLIGHT_AFTER_REVIEW' }
  }
  return Save-SafeReport $Config $report
}

function Invoke-Preflight([string]$Repo) {
  $config = Get-Config $Repo
  $runId = [Guid]::NewGuid().ToString('N').Substring(0, 12)
  $state = $null
  try {
    if ($NoMigration) {
      if (@($ExpectedMigrations).Count -gt 0) { Stop-Maintenance 'NO_MIGRATION_WITH_EXPECTED_SET' }
      $expected = @()
    } else { $expected = @(Get-Expected $ExpectedMigrations) }
    $commit = Get-GitCheckpoint $Repo $ApprovedCommit ([bool]$Synthetic)
    $uri = Get-PrivateDatabaseUri $config 'DIRECT_URL' ([bool]$Synthetic)
    $state = Get-CheckedState $config $uri $Repo $commit $expected
    if ($NoMigration) {
      [void](Save-SafeReport $config ([ordered]@{
        version = 1; runId = $runId; checkedUtc = [DateTime]::UtcNow.ToString('o')
        approvedCommit = $commit; plannedPending = @(); lastObservedPending = @()
        lastObservedAppliedCount = $state.ledger.AppliedCount
        lastObservedFailedCount = $state.ledger.FailedCount
        observationUtc = [DateTime]::UtcNow.ToString('o')
        preflight = 'SKIPPED_NO_MIGRATION'; backup = 'NOT_NEEDED'; restore = 'NOT_NEEDED'
        simulation = 'NOT_NEEDED'; structure = 'NOT_NEEDED'
        sequencePermissions = 'NOT_NEEDED'; oldAppCompatibility = 'NOT_NEEDED'
        apply = 'NOT_ATTEMPTED'; result = 'SKIPPED_NO_MIGRATION'; reasonCode = ''
        approvalReference = ''; nextAction = 'NO_SCHEMA_ACTION'
      }))
      Write-Output "PREFLIGHT SKIPPED_NO_MIGRATION; run=$runId; observedPending=0"
      return
    }
    $snapshotHolder = $null
    try {
      $snapshotHolder = Start-ExportedSnapshot $config $uri
      $before = Get-RepresentativeFingerprints $config $uri @{} $snapshotHolder.Id
      $beforeStructure = Get-StructureFingerprint $config $uri $snapshotHolder.Id
      $backup = New-PrivateBackup $config $uri $runId $snapshotHolder.Id
    } finally { Stop-ExportedSnapshot $snapshotHolder }
    $cluster = $null
    try {
      $cluster = New-DisposableCluster $config $runId
      Restore-DisposableBackup $config $cluster $backup
      $restored = Get-RepresentativeFingerprints $config $cluster.Uri
      Compare-RepresentativeFingerprints $before $restored
      $restoredStructure = Get-StructureFingerprint $config $cluster.Uri
      Assert-StructureEqual $beforeStructure $restoredStructure
      $restoreLedger = @(Get-ProductionLedger $config $cluster.Uri)
      [void](Compare-MigrationLedger $state.migrations $restoreLedger $expected)
      Invoke-DisposableMigration $config $cluster $Repo
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
      Compare-RepresentativeFingerprints $restored $after $true
      Assert-CreatedObjects $config $cluster.Uri $state.audits
      Assert-SequenceRolePermissions $config $uri $cluster $state.audits `
        $state.snapshot.role $state.applicationRole
    } finally { if ($cluster) { Stop-DisposableCluster $config $cluster } }
    $plan = [ordered]@{
      version = 1
      runId = $runId
      createdUtc = [DateTime]::UtcNow.ToString('o')
      approvedCommit = $commit
      targetFingerprint = $state.fingerprint
      applicationRole = $state.applicationRole
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
      structure = 'PASS'
      sequencePermissions = 'PASS'
      backupScope = 'public_schema_no_owner_no_acl'
      oldAppNewDb = 'PASS_SCHEMA_ONLY'
      synthetic = [bool]$Synthetic
    }
    $planPath = Save-SealedPlan $config $plan
    [void](Write-Report $config $plan 'PREFLIGHT_ONLY' '' '' $state.ledger)
    Write-Output "PREFLIGHT PASS; run=$runId; pending=$($expected -join ','); restore=PASS; isolatedMigration=PASS; dataIntegrity=PASS; oldAppNewDb=PASS_SCHEMA_ONLY"
    Write-Output "SEALED PLAN: $planPath"
    Write-Output 'No production migration was applied.'
  } catch {
    $code = Get-SafeErrorCode $_
    try {
      [void](Save-SafeReport $config ([ordered]@{
        version = 1; runId = $runId; checkedUtc = [DateTime]::UtcNow.ToString('o')
        approvedCommit = $ApprovedCommit; plannedPending = @($ExpectedMigrations)
        lastObservedPending = if ($state) { @($state.ledger.Pending) } else { $null }
        lastObservedAppliedCount = if ($state) { $state.ledger.AppliedCount } else { $null }
        lastObservedFailedCount = if ($state) { $state.ledger.FailedCount } else { $null }
        observationUtc = if ($state) { [DateTime]::UtcNow.ToString('o') } else { $null }
        preflight = 'BLOCKED'; backup = 'UNKNOWN'; restore = 'UNKNOWN'
        simulation = 'UNKNOWN'; structure = 'UNKNOWN'; sequencePermissions = 'UNKNOWN'
        oldAppCompatibility = 'UNKNOWN'; apply = 'NOT_ATTEMPTED'
        result = 'PREFLIGHT_BLOCKED'; reasonCode = $code; approvalReference = ''
        nextAction = 'FIX_CAUSE_RERUN_PREFLIGHT'
      }))
    } catch { }
    throw
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
      $plan.dataIntegrity -ne 'PASS' -or $plan.structure -ne 'PASS' -or
      $plan.sequencePermissions -ne 'PASS' -or
      $plan.oldAppNewDb -ne 'PASS_SCHEMA_ONLY' -or
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
  Assert-FinalSequencePermissions $config $uri $state
  $phrase = Get-ApprovalPhrase $config $plan
  Write-Output 'Operator attestation reference recorded (not independently authenticated). Type:'
  Write-Output $phrase
  $typed = Read-Host 'Confirmation'
  if (-not (Test-ApprovalPhrase $config $plan $typed)) {
    Stop-Maintenance 'INTERACTIVE_CONFIRMATION_FAILED'
  }
  # The lock covers the final recheck, attempted marker, guarded command, and report.
  $targetLock = Enter-TargetLock $config $uri
  $databaseLock = $null
  try {
    $databaseLock = Start-DatabaseApplyLock $config $uri
    Assert-PlanFresh $plan
    Assert-BackupSealed $config $plan
    $state = Get-CheckedState $config $uri $Repo $plan.approvedCommit @($plan.pending)
    Assert-StateEqualsPlan $state $plan
    Assert-FinalSequencePermissions $config $uri $state
    if ($databaseLock.Process.HasExited) { Stop-Maintenance 'TARGET_DATABASE_LOCK_LOST' }
    Assert-PlanNotAttempted $config $plan | Out-Null
    Mark-PlanAttempted $config $plan
    [void](Write-Report $config $plan 'ATTEMPTED_UNVERIFIED' `
      'AWAITING_GUARDED_COMMAND' $ApprovalReference)
    $boundedUri = Get-PinnedPrismaUri $config $uri $true
    $exitCode = Invoke-WithIsolatedEnvironment $config $null @{
      DB_MIGRATE_TARGET = 'production'
      DB_MIGRATE_CONFIRM = 'production'
      DB_MIGRATE_EXPECTED_HOST = $config.expectedHost
      DIRECT_URL = $boundedUri.AbsoluteUri
      DATABASE_URL = $boundedUri.AbsoluteUri
    } {
      $oldPreference = $ErrorActionPreference
      Push-Location $Repo
      try {
        $ErrorActionPreference = 'Continue'
        # This is the sole authorized production migration command; child output is never echoed.
        $output = @(& (Join-Path $config.nodeBin 'npm.cmd') run db:migrate:deploy 2>$null)
        return $LASTEXITCODE
      } finally {
        $ErrorActionPreference = $oldPreference
        Pop-Location
      }
    }
    if ($exitCode -ne 0) {
      [void](Write-Report $config $plan 'APPLY_ERROR' 'GUARDED_COMMAND_FAILED' $ApprovalReference)
      Stop-Maintenance 'GUARDED_COMMAND_FAILED_DO_NOT_RETRY'
    }
    if ($databaseLock.Process.HasExited) { Stop-Maintenance 'TARGET_DATABASE_LOCK_LOST_AFTER_APPLY' }
    try {
      $ledger = @(Get-ProductionLedger $config $uri)
      $observed = Compare-MigrationLedger (Get-MigrationFiles $Repo) $ledger @()
      [void](Write-Report $config $plan 'APPLIED' '' $ApprovalReference $observed)
      Write-Output "APPLIED; run=$($plan.runId); pending=0; failed=0"
    } catch {
      [void](Write-Report $config $plan 'POSTCHECK_FAILED' 'LEDGER_NOT_VERIFIED' $ApprovalReference)
      Stop-Maintenance 'POSTCHECK_FAILED_DIAGNOSE_NO_RETRY'
    }
  } finally {
    Stop-DatabaseApplyLock $databaseLock
    $targetLock.Dispose()
  }
}

function Invoke-Status([string]$Repo, [bool]$Detailed) {
  $config = Get-Config $Repo
  $reportDir = Join-Path $config.privateDirectory 'reports'
  $plan = $null
  if ($PlanPath) {
    $plan = Read-SealedPlan $config $PlanPath
    $reportPath = Join-Path $reportDir ($plan.runId + '.json')
  } else {
    $latest = if (Test-Path -LiteralPath $reportDir -PathType Container) {
      Get-ChildItem -LiteralPath $reportDir -Filter '*.json' -File |
        Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    } else { $null }
    $reportPath = if ($latest) { $latest.FullName } else { $null }
  }
  $attempted = if ($plan) {
    Test-Path -LiteralPath (Join-Path (Get-PlanDirectory $config) ($plan.runId + '.attempted'))
  } else { $false }
  if (-not $reportPath -or -not (Test-Path -LiteralPath $reportPath -PathType Leaf)) {
    if ($attempted) {
      Write-Output "STATUS ATTEMPTED_UNVERIFIED; run=$($plan.runId); commit=$($plan.approvedCommit)"
      Write-Output 'Apply=ATTEMPTED_UNVERIFIED; Outcome=UNKNOWN; currentDatabaseState=UNKNOWN'
      Write-Output 'Next: DIAGNOSE_LEDGER_AND_OUTCOME_NO_RETRY'
      return
    }
    Write-Output 'STATUS NO_HISTORY; lastObservedPending=UNKNOWN; currentDatabaseState=UNKNOWN'
    Write-Output 'Next: run PREFLIGHT with an approved commit and migration set.'
    return
  }
  Assert-PrivateAcl $reportPath
  $report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $plan) {
    $candidate = Join-Path (Get-PlanDirectory $config) ($report.runId + '.sealed.json')
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $plan = Read-SealedPlan $config $candidate
    }
  }
  if (-not $attempted -and $plan) {
    $attempted = Test-Path -LiteralPath (Join-Path (Get-PlanDirectory $config) ($plan.runId + '.attempted'))
  }
  $result = [string]$report.result
  $effectiveApply = [string]$report.apply
  $effectiveOutcome = if ($report.PSObject.Properties['outcome']) {
    [string]$report.outcome
  } else { 'UNKNOWN' }
  $effectiveNext = [string]$report.nextAction
  if ($attempted -and $result -in @('PREFLIGHT_ONLY', 'ATTEMPTED_UNVERIFIED')) {
    $result = 'ATTEMPTED_UNVERIFIED'
    $effectiveApply = 'ATTEMPTED_UNVERIFIED'
    $effectiveOutcome = 'UNKNOWN'
    $effectiveNext = 'DIAGNOSE_LEDGER_AND_OUTCOME_NO_RETRY'
  }
  if ($plan -and -not $attempted -and $result -eq 'PREFLIGHT_ONLY') {
    try { Assert-PlanFresh $plan }
    catch { $result = 'PREFLIGHT_EXPIRED' }
  }
  $planned = if (@($report.plannedPending).Count) { $report.plannedPending -join ',' } else { 'NONE' }
  $observed = if ($null -eq $report.lastObservedPending) { 'UNKNOWN' }
    elseif (@($report.lastObservedPending).Count) { $report.lastObservedPending -join ',' }
    else { 'NONE' }
  Write-Output "STATUS $result; run=$($report.runId); commit=$($report.approvedCommit)"
  Write-Output "Planned pending: $planned"
  Write-Output "Last observed pending: $observed; appliedCount=$($report.lastObservedAppliedCount); failedCount=$($report.lastObservedFailedCount); observedUtc=$($report.observationUtc)"
  Write-Output "Preflight=$($report.preflight); backup=$($report.backup); restore=$($report.restore); simulation=$($report.simulation); structure=$($report.structure); sequencePermissions=$($report.sequencePermissions); oldApp=$($report.oldAppCompatibility); Apply=$effectiveApply; Outcome=$effectiveOutcome"
  Write-Output "Last checked UTC: $($report.checkedUtc); reason=$($report.reasonCode)"
  Write-Output "Current database state: UNKNOWN (offline). Next: $effectiveNext"
  if ($Detailed) { Write-Output "Redacted report: $reportPath" }
}

try {
  $repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
  switch ($Mode) {
    'Preflight' { Invoke-Preflight $repo }
    'Apply' { Invoke-Apply $repo }
    'Status' { Invoke-Status $repo $false }
    'Report' { Invoke-Status $repo $true }
  }
} catch {
  $message = $_.Exception.Message
  $code = if ($message -match 'LMR:([A-Z0-9_]+)') { $Matches[1] } else { 'UNEXPECTED_ERROR' }
  [Console]::Error.WriteLine("LOCAL MAINTENANCE BLOCKED: $code")
  if ($Synthetic -and $code -eq 'UNEXPECTED_ERROR') {
    [Console]::Error.WriteLine("SYNTHETIC DIAGNOSTIC: $($_.Exception.GetType().Name) line=$($_.InvocationInfo.ScriptLineNumber)")
    [Console]::Error.WriteLine('SYNTHETIC STACK: ' + ($_.ScriptStackTrace -replace "`r?`n", ' | '))
  }
  exit 1
}
