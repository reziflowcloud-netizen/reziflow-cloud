param([Parameter(Mandatory=$true)][string]$PrivateRoot,[Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
try{
  if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
  . (Join-Path $PSScriptRoot 'guard.ps1')
  $root=Get-QaCanonicalDirectory $PrivateRoot
  $target=[IO.Path]::GetFullPath($Path)
  if($root -notmatch '^D:\\LegalHubStageA-[0-9a-f]{32}$' -or ($target -ne $root -and -not $target.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase))){throw 'TARGET_REFUSED'}
  Assert-QaPrivateAcl $root
  $marker=Join-Path $root 'qa-owned.txt';Assert-QaPrivateAcl $marker
  if((Get-Content -LiteralPath $marker -Raw).Trim() -ne 'LegalHub Stage A synthetic QA'){throw 'MARKER_REFUSED'}
  Assert-QaPrivateAcl $target
  Write-Output 'QA_PRIVATE_PATH_PASS'
}catch{Write-Output 'QA_PRIVATE_PATH_BLOCKED';exit 1}
