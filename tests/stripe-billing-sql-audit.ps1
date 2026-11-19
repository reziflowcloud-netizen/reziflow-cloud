$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/local-maintenance/core.ps1')
. (Join-Path $PSScriptRoot '../scripts/local-maintenance/sql-audit.ps1')
$path = Join-Path $PSScriptRoot '../prisma/migrations/20261119170000_stripe_billing_test_mvp/migration.sql'
$audit = Test-MigrationSql $path
if ($audit.StatementCount -ne 6 -or $audit.AddedColumns.Count -ne 0) { throw 'Unexpected migration shape' }
if (@($audit.BlockingIndexTables | Where-Object { $_ -notin @('StripeBillingState', 'StripeBillingEvent') }).Count) { throw 'Existing table index changed' }
$audit | ConvertTo-Json -Depth 8
Write-Output 'PASS: existing Local Maintenance Runner SQL audit; only two new billing tables and their indexes'
