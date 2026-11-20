$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/local-maintenance/core.ps1')
. (Join-Path $PSScriptRoot '../scripts/local-maintenance/sql-audit.ps1')
foreach ($migration in @('20261119170000_stripe_billing_test_mvp', '20261119190000_stripe_billing_operations')) {
  $path = Join-Path $PSScriptRoot "../prisma/migrations/$migration/migration.sql"
  $audit = Test-MigrationSql $path
  $count = if ($migration -eq '20261119190000_stripe_billing_operations') { 9 } else { 6 }
  if ($audit.StatementCount -ne $count -or $audit.AddedColumns.Count -ne 0) { throw 'Unexpected migration shape' }
  if (@($audit.BlockingIndexTables | Where-Object { $_ -notin @('StripeBillingState', 'StripeBillingEvent', 'StripeBillingOperation') }).Count) { throw 'Existing table index changed' }
  $audit | ConvertTo-Json -Depth 8
}
foreach ($entry in @(
    @{ Migration = '20261120120000_stripe_billing_scheduled_cancel'; Column = 'scheduledCancelAt' },
    @{ Migration = '20261120121000_stripe_billing_cancel_boundary'; Column = 'cancelAtPaidThrough' }
)) {
  $cancelAudit = Test-MigrationSql (Join-Path $PSScriptRoot "../prisma/migrations/$($entry.Migration)/migration.sql")
  if ($cancelAudit.StatementCount -ne 1 -or $cancelAudit.AddedColumns.Count -ne 1 -or
      @($cancelAudit.AddedColumns['StripeBillingCoordinator']).Count -ne 1 -or
      $cancelAudit.AddedColumns['StripeBillingCoordinator'][0] -ne $entry.Column -or
      @($cancelAudit.BlockingIndexTables).Count -ne 0) { throw 'Unexpected scheduled-cancellation migration shape' }
  $cancelAudit | ConvertTo-Json -Depth 8
}
Write-Output 'PASS: existing SQL audit; billing tables/indexes and two nullable coordinator columns only'
