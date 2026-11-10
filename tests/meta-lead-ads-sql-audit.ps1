if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PowerShell 7 required for synthetic SQL audit' }
$ErrorActionPreference = 'Stop'
function Stop-Maintenance([string]$Code) { throw $Code }
. (Join-Path $PSScriptRoot '..\scripts\local-maintenance\sql-audit.ps1')
$migration = Join-Path $PSScriptRoot '..\prisma\migrations\20261027120000_meta_lead_ads_multitenant\migration.sql'
$sql = [IO.File]::ReadAllText([IO.Path]::GetFullPath($migration))
$approved = Test-MigrationSql $migration
if ($approved.StatementCount -ne 8 -or $approved.Risk -ne 'MEDIUM') { throw 'Approved migration audit mismatch' }

function Assert-Blocked([string]$Name, [string]$Sql) {
  $file = Join-Path $env:TEMP ('meta-lead-ads-audit-' + [guid]::NewGuid().ToString('N') + '.sql')
  try {
    [IO.File]::WriteAllText($file, $Sql, [Text.UTF8Encoding]::new($false))
    try {
      [void](Test-MigrationSql $file)
      throw "AUDITOR_ACCEPTED_UNSAFE_$Name"
    } catch {
      if ($_.Exception.Message -notmatch '^SQL_') { throw }
    }
  } finally {
    Remove-Item -LiteralPath $file -ErrorAction SilentlyContinue
  }
}

Assert-Blocked 'widened_mode' ($sql.Replace("'shadow'))", "'shadow', 'foreign'))"))
Assert-Blocked 'dynamic_array' ($sql.Replace('ARRAY[]::TEXT[]', "ARRAY['foreign']::TEXT[]"))
Assert-Blocked 'unsafe_check' ($sql.Replace('CHECK ("attempts" >= 0)', 'CHECK ("attempts" >= -1)'))
Assert-Blocked 'alter_constraint' ($sql + "`nALTER TABLE ""Lead"" ADD CONSTRAINT ""unsafe"" CHECK (true);`n")
Assert-Blocked 'drop' ($sql + "`nDROP TABLE ""Lead"";`n")
Assert-Blocked 'copy' ($sql + "`nCOPY ""Lead"" TO '/tmp/leads';`n")
Write-Output 'LEAD_ADS_SQL_AUDIT PASS: exact additive SQL accepted; 6 unsafe variants blocked'
