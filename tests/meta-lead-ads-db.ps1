param([string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin', [switch]$SkipVisual)
$ErrorActionPreference = 'Stop'
$testId = [guid]::NewGuid().ToString('N')
$root = [IO.Path]::GetFullPath(('D:\LegalHubReleaseTests-' + $testId))
$data = Join-Path $root 'cluster'
$port = $null
$started = $false
$startupAttempted = $false
$exitCode = 1
New-Item -ItemType Directory -Path $root | Out-Null
[IO.File]::WriteAllText((Join-Path $root 'release-tests-owned.txt'), $testId)
try {
  foreach ($name in @(Get-ChildItem Env: | Where-Object Name -match 'DATABASE|DIRECT_URL|TOKEN|SECRET|^META_|^FACEBOOK_|^INSTAGRAM_|^NGROK_|^PRISMA_')) {
    [Environment]::SetEnvironmentVariable($name.Name, $null, 'Process')
  }
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
  if (-not $SkipVisual) {
    & node tests\meta-lead-ads-visual.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic visual assertions failed' }
  }
  & node tests\meta-lead-ads-http.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Synthetic HTTP assertions failed' }
  $regressionDb = 'legalhub_webhook_qa_notifications_qa'
  & (Join-Path $PgBin 'createdb.exe') -h 127.0.0.1 -p $port -U meta_qa $regressionDb
  if ($LASTEXITCODE -ne 0) { throw 'Regression database creation failed' }
  $metaUrl = $env:DATABASE_URL
  try {
    $env:DATABASE_URL = "postgresql://meta_qa@127.0.0.1:$port/$($regressionDb)?schema=public"
    & .\node_modules\.bin\prisma.cmd migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'Regression migration chain failed' }
    $env:NOTIFICATIONS_TEST_DATABASE_URL = $env:DATABASE_URL
    $env:LEAD_WEBHOOK_POOL_TEST_DATABASE_URL = $env:DATABASE_URL
    $env:RUN_DB_TESTS = '1'
    & node --test --test-concurrency=1 tests\notification-events-phase3.test.mjs tests\lead-webhook-pool-timeout.test.mjs tests\staff-routing-v2-db.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Shared ingestion/runtime DB regressions failed' }
  } finally {
    $env:DATABASE_URL = $metaUrl
    Remove-Item Env:NOTIFICATIONS_TEST_DATABASE_URL,Env:LEAD_WEBHOOK_POOL_TEST_DATABASE_URL,Env:RUN_DB_TESTS -ErrorAction SilentlyContinue
  }
  & (Join-Path $PgBin 'createdb.exe') -h 127.0.0.1 -p $port -U meta_qa meta_lead_ads_old_qa
  if ($LASTEXITCODE -ne 0) { throw 'Old-schema disposable database creation failed' }
  $oldFixture = Join-Path $root 'old-schema-fixture'
  $oldMigrations = Join-Path $oldFixture 'migrations'
  New-Item -ItemType Directory -Path $oldMigrations | Out-Null
  Copy-Item -LiteralPath prisma\schema.prisma -Destination (Join-Path $oldFixture 'schema.prisma')
  Copy-Item -LiteralPath prisma\migrations\migration_lock.toml -Destination $oldMigrations
  foreach ($migration in @(Get-ChildItem -LiteralPath prisma\migrations -Directory | Where-Object Name -ne '20261027120000_meta_lead_ads_multitenant')) {
    Copy-Item -LiteralPath $migration.FullName -Destination $oldMigrations -Recurse
  }
  $currentUrl = $env:DATABASE_URL
  try {
    $env:DATABASE_URL = "postgresql://meta_qa@127.0.0.1:$port/meta_lead_ads_old_qa?schema=public"
    & .\node_modules\.bin\prisma.cmd migrate deploy --schema (Join-Path $oldFixture 'schema.prisma')
    if ($LASTEXITCODE -ne 0) { throw 'Old-schema migration chain failed' }
    $env:META_LEAD_ADS_SYNTHETIC_OLD_DB_TEST = '1'
    & node tests\meta-lead-ads-old-db.mjs
    if ($LASTEXITCODE -ne 0) { throw 'New application + old database compatibility failed' }
  } finally {
    $env:DATABASE_URL = $currentUrl
    Remove-Item Env:META_LEAD_ADS_SYNTHETIC_OLD_DB_TEST -ErrorAction SilentlyContinue
  }
  try {
    & node tests\meta-lead-ads-old-app.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Old application + new database compatibility failed' }
  } finally {
    & .\node_modules\.bin\prisma.cmd generate
    if ($LASTEXITCODE -ne 0) { throw 'Prisma Client regeneration failed after old app check' }
  }
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
  $marker = Join-Path $resolvedRoot 'release-tests-owned.txt'
  $links = @(Get-ChildItem -LiteralPath $resolvedRoot -Force -Recurse | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
  if ($stopped -and $resolvedRoot -ceq ('D:\LegalHubReleaseTests-' + $testId) -and
      -not ((Get-Item -LiteralPath $resolvedRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -and
      $links.Count -eq 0 -and (Get-Content -LiteralPath $marker -Raw) -ceq $testId) {
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force -WhatIf
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
    if (Test-Path -LiteralPath $resolvedRoot) { throw 'Disposable cleanup absence check failed' }
  } else {
    Write-Error "Disposable cluster cleanup blocked; inspect local path: $resolvedRoot" -ErrorAction Continue
    $exitCode = 1
  }
}
exit $exitCode
