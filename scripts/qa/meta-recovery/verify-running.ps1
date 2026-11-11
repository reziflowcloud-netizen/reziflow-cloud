param([Parameter(Mandatory=$true)][string]$RuntimeFile)
$ErrorActionPreference='Stop'
try {
  Set-StrictMode -Version Latest
  . (Join-Path $PSScriptRoot 'guard.ps1')
  Assert-QaPrivateAcl $RuntimeFile
  $root=Get-QaCanonicalDirectory ([IO.Path]::GetDirectoryName($RuntimeFile))
  if($root -notmatch '^D:\\LegalHubStageA-[0-9a-f]{32}$' -or [IO.Path]::GetFullPath($RuntimeFile) -ne (Join-Path $root 'runtime.json')){throw 'QA_SERVER_RUNTIME_PATH_REFUSED'}
  $stateFile=Join-Path $root 'cluster-state.json';Assert-QaPrivateAcl $stateFile
  $c=Get-Content -LiteralPath $RuntimeFile -Raw|ConvertFrom-Json
  $s=Get-Content -LiteralPath $stateFile -Raw|ConvertFrom-Json
  if($c.privateDirectory -ne $root -or $s.config.privateDirectory -ne $root -or $s.config.expectedHost -ne '127.0.0.1' -or $s.config.expectedApplicationHost -ne '127.0.0.1'){throw 'QA_SERVER_RUNTIME_MISMATCH'}
  Assert-QaDatabaseTarget ([Uri]$c.databaseUrl) $s.cluster $c.databaseUrl
  Assert-QaRunningPostgres $s.config $s.cluster $root
  Write-Output 'QA_SERVER_OWNERSHIP_PASS'
}catch{
  Write-Output 'QA_SERVER_OWNERSHIP_BLOCKED'
  exit 1
}
