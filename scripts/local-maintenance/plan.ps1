function Get-PlanKey([object]$Config, [bool]$Create) {
  $path = Join-Path $Config.privateDirectory 'seal.key'
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    if (-not $Create) { Stop-Maintenance 'SEAL_KEY_MISSING' }
    $bytes = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew,
      [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    Set-PrivateAcl $path
  }
  Assert-PrivateAcl $path
  $key = [IO.File]::ReadAllBytes($path)
  if ($key.Length -ne 32) { Stop-Maintenance 'SEAL_KEY_INVALID' }
  return ,$key
}

function Get-PlanMac([byte[]]$Key, [byte[]]$Payload) {
  $hmac = [Security.Cryptography.HMACSHA256]::new($Key)
  try { return $hmac.ComputeHash($Payload) } finally { $hmac.Dispose() }
}

function Test-EqualBytes([byte[]]$A, [byte[]]$B) {
  if ($A.Length -ne $B.Length) { return $false }
  $difference = 0
  for ($i = 0; $i -lt $A.Length; $i++) {
    $difference = $difference -bor ([int]$A[$i] -bxor [int]$B[$i])
  }
  return $difference -eq 0
}

function Get-PlanDirectory([object]$Config) {
  $directory = Join-Path $Config.privateDirectory 'plans'
  if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $directory)
    Set-PrivateAcl $directory
  }
  Assert-PrivateAcl $directory
  return $directory
}

function Save-SealedPlan([object]$Config, [object]$Plan) {
  $directory = Get-PlanDirectory $Config
  $path = Assert-ChildPath $directory (Join-Path $directory ($Plan.runId + '.sealed.json'))
  if (Test-Path -LiteralPath $path) { Stop-Maintenance 'PLAN_ALREADY_EXISTS' }
  $json = ConvertTo-Json -InputObject $Plan -Depth 30 -Compress
  $payload = [Text.Encoding]::UTF8.GetBytes($json)
  $key = Get-PlanKey $Config $true
  $mac = Get-PlanMac $key $payload
  $wrapper = [ordered]@{
    version = 1
    payload = [Convert]::ToBase64String($payload)
    mac = [BitConverter]::ToString($mac).Replace('-', '').ToLowerInvariant()
  }
  $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write, [IO.FileShare]::None)
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $wrapper -Compress))
    $stream.Write($bytes, 0, $bytes.Length)
  } finally { $stream.Dispose() }
  Set-PrivateAcl $path
  return $path
}

function Read-SealedPlan([object]$Config, [string]$PlanPath) {
  $directory = Get-PlanDirectory $Config
  $path = Assert-ChildPath $directory $PlanPath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Stop-Maintenance 'PLAN_MISSING' }
  Assert-PrivateAcl $path
  try {
    $wrapper = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($wrapper.version -ne 1 -or $wrapper.mac -notmatch '^[0-9a-f]{64}$') {
      Stop-Maintenance 'PLAN_WRAPPER_INVALID'
    }
    $payload = [Convert]::FromBase64String($wrapper.payload)
    $stored = [byte[]]::new(32)
    for ($i = 0; $i -lt 32; $i++) {
      $stored[$i] = [Convert]::ToByte($wrapper.mac.Substring($i * 2, 2), 16)
    }
    $expected = Get-PlanMac (Get-PlanKey $Config $false) $payload
    if (-not (Test-EqualBytes $stored $expected)) { Stop-Maintenance 'PLAN_SEAL_MISMATCH' }
    $plan = [Text.Encoding]::UTF8.GetString($payload) | ConvertFrom-Json
    if ($plan.version -ne 1 -or $plan.runId -notmatch '^[0-9a-f]{12}$') {
      Stop-Maintenance 'PLAN_PAYLOAD_INVALID'
    }
    return $plan
  } catch {
    if ($_.Exception.Message -like 'LMR:*') { throw }
    Stop-Maintenance 'PLAN_UNREADABLE'
  }
}

function Get-LatestPlanPath([object]$Config) {
  $directory = Get-PlanDirectory $Config
  $latest = Get-ChildItem -LiteralPath $directory -Filter '*.sealed.json' -File |
    Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if (-not $latest) { Stop-Maintenance 'NO_SAVED_PLAN' }
  return $latest.FullName
}

function Assert-PlanFresh([object]$Plan) {
  try { $created = [DateTime]::Parse($Plan.createdUtc).ToUniversalTime() }
  catch { Stop-Maintenance 'PLAN_TIME_INVALID' }
  if ($created -gt [DateTime]::UtcNow.AddMinutes(2) -or
      $created -lt [DateTime]::UtcNow.AddHours(-4)) {
    Stop-Maintenance 'PLAN_EXPIRED_RERUN_PREFLIGHT'
  }
}

function Assert-BackupSealed([object]$Config, [object]$Plan) {
  $path = Assert-ChildPath $Config.backupDirectory $Plan.backup.path
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Stop-Maintenance 'SEALED_BACKUP_MISSING' }
  Assert-PrivateAcl $path
  if ((Get-Item -LiteralPath $path).Length -ne [long]$Plan.backup.bytes -or
      (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Plan.backup.sha256) {
    Stop-Maintenance 'SEALED_BACKUP_CHANGED'
  }
}

function Assert-PlanNotAttempted([object]$Config, [object]$Plan) {
  $path = Join-Path (Get-PlanDirectory $Config) ($Plan.runId + '.attempted')
  if (Test-Path -LiteralPath $path) { Stop-Maintenance 'PLAN_ALREADY_ATTEMPTED' }
  return $path
}

function Mark-PlanAttempted([object]$Config, [object]$Plan) {
  $path = Assert-PlanNotAttempted $Config $Plan
  $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write, [IO.FileShare]::None)
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes([DateTime]::UtcNow.ToString('o'))
    $stream.Write($bytes, 0, $bytes.Length)
  } finally { $stream.Dispose() }
  Set-PrivateAcl $path
}

function Get-ApprovalPhrase([object]$Config, [object]$Plan) {
  return "APPLY $($Config.expectedHost) $($Plan.approvedCommit) $($Plan.runId) $($Plan.pending -join ',')"
}

function Test-ApprovalPhrase([object]$Config, [object]$Plan, [string]$Typed) {
  return $Typed -ceq (Get-ApprovalPhrase $Config $Plan)
}
