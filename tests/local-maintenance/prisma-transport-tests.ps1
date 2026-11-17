#requires -Version 7
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
. (Join-Path $repo 'scripts\local-maintenance\core.ps1')
. (Join-Path $repo 'scripts\local-maintenance\migration-diagnostics.ps1')
$script:checks=0
function Check([bool]$Condition,[string]$Label){if(-not $Condition){throw "TEST_FAILED:$Label"};$script:checks++}
$config=[pscustomobject]@{tlsRootCertFile='C:\synthetic private certs\root#.pem'}
$remote=[Uri]::new('postgresql://synthetic:synthetic@db.synthetic.invalid:5432/synthetic')
$url=Get-PinnedPrismaUri $config $remote $true
$pairs=@{};foreach($pair in $url.Query.TrimStart('?').Split('&')){$kv=$pair.Split('=',2);$pairs[$kv[0]]=[Uri]::UnescapeDataString($kv[1])}
Check ($pairs.sslcert -ceq $config.tlsRootCertFile) 'PRISMA_CA_EXACT_ABSOLUTE_PATH'
Check (-not $pairs.ContainsKey('sslrootcert')) 'NO_LIBPQ_ONLY_PRISMA_OPTION'
Check ($pairs.sslaccept -ceq 'strict') 'STRICT_CERTIFICATE_VALIDATION'
Check ($pairs.sslmode -ceq 'require') 'TLS_REQUIRED'
Check ($pairs.connect_timeout -ceq '5') 'BOUNDED_CONNECT'
Check ($pairs.options -ceq '-c lock_timeout=5s -c statement_timeout=120s') 'UNCHANGED_DDL_TIMEOUTS'
Check ($url.Host -ceq $remote.Host -and $url.Port -eq 5432 -and $url.UserInfo -ceq $remote.UserInfo -and $url.AbsolutePath -ceq $remote.AbsolutePath) 'TARGET_UNCHANGED'
Check ((Get-PinnedPrismaUri $config ([Uri]::new('postgresql://synthetic@127.0.0.1:54321/synthetic'))).Query -match 'sslmode=disable') 'EXISTING_DISPOSABLE_LOOPBACK_POLICY'
Check ((Get-PinnedPrismaUri $config ([Uri]::new('postgresql://synthetic@127.0.0.10:5432/synthetic'))).Query -match 'sslmode=require') 'NO_BROAD_LOOPBACK_EXEMPTION'
$base=[ordered]@{version=1;exitCode=1;category='TLS';prismaCodes=@('P1011');sqlstates=@();processError=$null;outputLimited=$false}
function Frame([object]$Value){return 'GUARDED_MIGRATION_DIAGNOSTIC '+($Value|ConvertTo-Json -Depth 5 -Compress)}
$valid=Read-GuardedMigrationDiagnostic @((Frame $base)) 1
Check ($valid.category -ceq 'TLS' -and $valid.prismaCodes[0] -ceq 'P1011') 'VALID_DIAGNOSTIC_SURVIVES_JSON_ROUNDTRIP'
foreach($change in @(@{version='1'},@{exitCode='1'},@{exitCode=$true},@{exitCode=1.5},@{category='private-secret'},
  @{prismaCodes=@('private-secret')},@{sqlstates=@('private-secret')},@{processError='private-secret'},@{outputLimited='false'},
  @{prismaCodes='P1011'},@{version=2},@{secret='private-secret'})){
 $value=[ordered]@{};foreach($key in $base.Keys){$value[$key]=$base[$key]};foreach($key in $change.Keys){$value[$key]=$change[$key]}
 $observed=Read-GuardedMigrationDiagnostic @((Frame $value)) 1
 Check ($observed.category -ceq 'DIAGNOSTIC_UNAVAILABLE') 'MALFORMED_DIAGNOSTIC_REJECTED'
 Check (($observed|ConvertTo-Json -Compress) -notmatch 'private-secret') 'NO_UNKNOWN_PAYLOAD_REFLECTION'
}
Check ((Read-GuardedMigrationDiagnostic @('no frame') 1).category -ceq 'DIAGNOSTIC_UNAVAILABLE') 'ABSENT_FRAME'
Check ((Read-GuardedMigrationDiagnostic @('GUARDED_MIGRATION_DIAGNOSTIC invalid') 1).category -ceq 'DIAGNOSTIC_UNAVAILABLE') 'INVALID_JSON'
Check ((Read-GuardedMigrationDiagnostic @((Frame $base),(Frame $base)) 1).category -ceq 'DIAGNOSTIC_UNAVAILABLE') 'DUPLICATE_FRAMES'
Check ((Read-GuardedMigrationDiagnostic @((Frame $base)) 0).category -ceq 'DIAGNOSTIC_UNAVAILABLE') 'ACTUAL_EXIT_CODE_CANNOT_BE_OVERRIDDEN'
Check ((Read-GuardedMigrationDiagnostic @('GUARDED_MIGRATION_DIAGNOSTIC '+('x'*2048)) 1).category -ceq 'DIAGNOSTIC_UNAVAILABLE') 'OVERSIZED_FRAME'
Write-Output "PASS $script:checks targeted Prisma transport/diagnostic checks; no database connections"
