function Read-GuardedMigrationDiagnostic([object[]]$Lines, [int]$ExitCode) {
  $fallback = [pscustomobject]@{ version = 1; exitCode = $ExitCode;
    category = 'DIAGNOSTIC_UNAVAILABLE'; prismaCodes = @(); sqlstates = @();
    processError = $null; outputLimited = $false }
  try {
    $prefix = 'GUARDED_MIGRATION_DIAGNOSTIC '
    $frames = @($Lines | Where-Object { $_ -is [string] -and $_.StartsWith($prefix, [StringComparison]::Ordinal) })
    if ($frames.Count -ne 1 -or $frames[0].Length -gt 2048) { return $fallback }
    $value = $frames[0].Substring($prefix.Length) | ConvertFrom-Json -ErrorAction Stop
    $names = @('version','exitCode','category','prismaCodes','sqlstates','processError','outputLimited')
    if (@(Compare-Object ($names | Sort-Object) (@($value.PSObject.Properties.Name) | Sort-Object)).Count -or
        ($value.version -isnot [int] -and $value.version -isnot [long]) -or $value.version -ne 1 -or
        ($value.exitCode -isnot [int] -and $value.exitCode -isnot [long]) -or
        $value.exitCode -ne $ExitCode -or $ExitCode -lt 0 -or $ExitCode -gt 255 -or
        $value.category -isnot [string] -or $value.category -cnotin @('NONE','UNCLASSIFIED_FAILURE','OUTPUT_LIMIT','TIMEOUT',
          'PROCESS_START','TLS','AUTHENTICATION','CONNECTION','PERMISSION','CONFIGURATION','DATABASE_OR_MIGRATION_STATE','ENTRYPOINT_GUARD') -or
        $value.prismaCodes -isnot [array] -or $value.sqlstates -isnot [array] -or
        $value.prismaCodes.Count -gt 4 -or $value.sqlstates.Count -gt 4 -or $value.outputLimited -isnot [bool] -or
        ($null -ne $value.processError -and ($value.processError -isnot [string] -or
          $value.processError -cnotin @('ENOENT','EACCES','EPERM','ENOBUFS','ETIMEDOUT')))) { return $fallback }
    foreach ($code in $value.prismaCodes) { if ($code -isnot [string] -or $code -cnotmatch '^P[0-9]{4}$') { return $fallback } }
    foreach ($code in $value.sqlstates) { if ($code -isnot [string] -or $code -cnotmatch '^[0-9A-Z]{5}$') { return $fallback } }
    return [pscustomobject]@{ version = 1; exitCode = $ExitCode; category = $value.category;
      prismaCodes = @($value.prismaCodes); sqlstates = @($value.sqlstates);
      processError = $value.processError; outputLimited = $value.outputLimited }
  } catch { return $fallback }
}
