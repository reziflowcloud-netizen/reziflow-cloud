param(
  [ValidateSet('Prepare','Execute')][string]$Mode='Prepare',
  [string]$Specification,
  [string]$Envelope,
  [string]$ApprovedEnvelopeSha256='',
  [string]$OwnerApprovalReference=''
)
# Deliberately before Add-Type; no ExecutionPolicy changes or PS5 fallback.
if ($PSVersionTable.PSEdition -ne 'Core' -or $PSVersionTable.PSVersion.Major -lt 7 -or
    [Environment]::OSVersion.Platform -ne 'Win32NT') {
  [Console]::Error.WriteLine('LHD:POWERSHELL_7_WINDOWS_REQUIRED'); exit 2
}
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
try {
  foreach($module in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Security','Microsoft.PowerShell.Utility')) {
    Import-Module (Join-Path $PSHOME "Modules/$module/$module.psd1") -ErrorAction Stop
  }
  . (Join-Path $PSScriptRoot 'diagnostic-only-lib.ps1')
  if ($Mode -ceq 'Prepare') {
    New-DiagnosticEnvelope $Specification $Envelope
    [Console]::Out.WriteLine('{"status":"PREPARED_OFFLINE","productionAuthorization":false}')
    exit 0
  }
  $report=Invoke-DiagnosticEnvelope $Specification $Envelope $ApprovedEnvelopeSha256 $OwnerApprovalReference
  [Console]::Out.WriteLine(($report | ConvertTo-Json -Compress))
  if ($report.status -cne 'QUERY_COMPLETED') { exit 1 }
  exit 0
} catch {
  # Never emit ErrorRecord, paths, user inputs, native text or SQL results.
  $code='UNEXPECTED_ERROR'
  if ($_.Exception.Message -cmatch '^LHD:([A-Z0-9_]{1,80})$') { $code=$Matches[1] }
  [Console]::Out.WriteLine(('{"status":"BLOCKED","stage":"LOCAL_GATE","reason":"'+$code+'"}'))
  exit 2
}
