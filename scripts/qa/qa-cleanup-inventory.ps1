[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$PointerPath,
  [Parameter(Mandatory=$true)][string]$EvidenceRoot,
  [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
# READ ONLY: metadata and inventory only. No delete, SQL, process stop or secret-file read.
function Get-QaCanonicalPath([string]$Target) {
  $absolute = [IO.Path]::GetFullPath($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Target))
  $ancestor = $absolute
  while ($ancestor) {
    if (Test-Path -LiteralPath $ancestor) {
      $ancestorItem = Get-Item -LiteralPath $ancestor -Force
      if (($ancestorItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Reparse point in target or ancestor; no traversal permitted'
      }
    }
    $parent = [IO.Directory]::GetParent($ancestor)
    if ($null -eq $parent) { break }
    $ancestor = $parent.FullName
  }
  return $absolute
}
$pointerFile = Get-QaCanonicalPath $PointerPath
if ([IO.Path]::GetFileName($pointerFile) -ne 'stage-a-private-pointer.json') { throw 'Not the QA path-only pointer' }
$destination = Get-QaCanonicalPath $OutputPath
if (Test-Path -LiteralPath $destination) { throw 'Refusing to overwrite an existing inventory' }
$pointer = Get-Content -LiteralPath $pointerFile -Raw | ConvertFrom-Json
$privateRoot = Get-QaCanonicalPath $pointer.privateDirectory
$evidence = Get-QaCanonicalPath $EvidenceRoot
$expectedParent = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\')
if ([IO.Path]::GetDirectoryName($privateRoot) -ne $expectedParent -or
    [IO.Path]::GetFileName($privateRoot) -notmatch '^LegalHubStageA-[0-9a-f]{32}$') { throw 'Unrecognised QA private root' }
if ([IO.Path]::GetFileName($evidence) -ne 'meta-lead-ads-resume-20261108') { throw 'Unrecognised QA evidence root' }
$records = [Collections.Generic.List[object]]::new()
$blocked = [Collections.Generic.List[string]]::new()
function Add-QaMetadata([string]$Target, [string]$Phase) {
  $Target = Get-QaCanonicalPath $Target
  if (-not (Test-Path -LiteralPath $Target)) { return }
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push([IO.Path]::GetFullPath($Target))
  while ($pending.Count -gt 0) {
    $path = $pending.Pop()
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      $blocked.Add($item.FullName)
      continue
    }
    $records.Add([pscustomobject]@{
      path=$item.FullName; phase=$Phase; directory=[bool]$item.PSIsContainer
      bytes= $(if ($item.PSIsContainer) {0} else {$item.Length})
      modifiedUtc=$item.LastWriteTimeUtc.ToString('o')
    })
    if ($item.PSIsContainer) {
      foreach ($child in (Get-ChildItem -LiteralPath $item.FullName -Force)) {
        if ($item.FullName -eq $evidence -and $child.Name -eq 'combined-source') { continue }
        $pending.Push($child.FullName)
      }
    }
  }
}
Add-QaMetadata $privateRoot 'T0+24h: entire disposable private QA cluster/config/log tree'
Add-QaMetadata $evidence 'T0+7d: QA evidence; preserve no identifying report'
Add-QaMetadata (Join-Path $evidence 'combined-source\.next') 'T0+7d: generated QA application cache'
Add-QaMetadata (Join-Path $evidence 'combined-source\node_modules\.cache') 'T0+7d: generated QA tooling cache'
$result = [ordered]@{
  createdUtc=[DateTime]::UtcNow.ToString('o')
  mode='READ_ONLY_METADATA'; privateRoot=$privateRoot; evidenceRoot=$evidence
  ownerCopyInventoryConfirmed=$false; cloudVersionHistoryVerified=$false
  deletionPerformed=$false; databaseConnected=$false
  blockedReparsePoints=@($blocked); entries=@($records)
}
$json = $result | ConvertTo-Json -Depth 6
$stream = [IO.File]::Open($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
  $writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
  try { $writer.WriteLine($json) } finally { $writer.Dispose() }
} finally { $stream.Dispose() }
[pscustomobject]@{
  mode='READ_ONLY_METADATA'; entries=$records.Count; blockedReparsePoints=$blocked.Count
  ownerCopyInventoryConfirmed=$false; deletionPerformed=$false; databaseConnected=$false
} | ConvertTo-Json -Compress

