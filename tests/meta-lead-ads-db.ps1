param([string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin')
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:TEMP ('legalhub-meta-lead-ads-qa-' + [guid]::NewGuid().ToString('N'))
$data = Join-Path $root 'cluster'
$port = $null
$started = $false
$startupAttempted = $false
$exitCode = 1
New-Item -ItemType Directory -Path $root | Out-Null
try {
  foreach ($name in @('initdb.exe','pg_ctl.exe','createdb.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $PgBin $name))) { throw "PostgreSQL 18 tool missing: $name" }
  }
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
  & (Join-Path $PgBin 'initdb.exe') -D $data -U meta_qa -A trust --no-instructions *> (Join-Path $root 'initdb.log')
  if ($LASTEXITCODE -ne 0) { throw 'Disposable initdb failed' }
  $startupAttempted = $true
  & (Join-Path $PgBin 'pg_ctl.exe') -D $data -l (Join-Path $root 'postgres.log') -o "-h 127.0.0.1 -p $port" start
  if ($LASTEXITCODE -ne 0) { throw 'Disposable PostgreSQL failed to start' }
  $started = $true
  & (Join-Path $PgBin 'createdb.exe') -h 127.0.0.1 -p $port -U meta_qa meta_lead_ads_qa
  if ($LASTEXITCODE -ne 0) { throw 'Disposable database creation failed' }
  $env:DATABASE_URL = "postgresql://meta_qa@127.0.0.1:$port/meta_lead_ads_qa?schema=public"
  $env:META_LEAD_ADS_SYNTHETIC_DB_TEST = '1'
  & .\node_modules\.bin\prisma.cmd migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'Full migration chain failed' }
  & .\node_modules\.bin\prisma.cmd migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma\schema.prisma --exit-code
  if ($LASTEXITCODE -ne 0) { throw 'Schema drift detected' }
  & node tests\meta-lead-ads-db.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic DB assertions failed' }
  & node tests\meta-lead-ads-visual.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic visual assertions failed' }
  & node tests\meta-lead-ads-http.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic HTTP assertions failed' }
  $exitCode = 0
} catch {
  Write-Error $_.Exception.Message -ErrorAction Continue
} finally {
  Remove-Item Env:DATABASE_URL,Env:META_LEAD_ADS_SYNTHETIC_DB_TEST -ErrorAction SilentlyContinue
  $stopped = -not $startupAttempted
  if ($startupAttempted) {
    & (Join-Path $PgBin 'pg_ctl.exe') -D $data status
    if ($LASTEXITCODE -eq 0) {
      & (Join-Path $PgBin 'pg_ctl.exe') -D $data -m fast -w stop
      $stopped = $LASTEXITCODE -eq 0
    } else {
      $stopped = $LASTEXITCODE -eq 3
    }
  }
  $resolvedRoot = [System.IO.Path]::GetFullPath($root)
  $resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\') + '\'
  if ($stopped -and $resolvedRoot.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -and
      (Split-Path $resolvedRoot -Leaf) -match '^legalhub-meta-lead-ads-qa-[0-9a-f]{32}$') {
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
  } else {
    Write-Error "Disposable cluster cleanup blocked; inspect local path: $resolvedRoot" -ErrorAction Continue
    $exitCode = 1
  }
}
exit $exitCode
