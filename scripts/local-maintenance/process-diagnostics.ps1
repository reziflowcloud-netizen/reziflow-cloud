# Native errors remain private, bounded in memory, and never enter reports.
if (-not ('LegalHubMaintenanceDiagnostics.ProcessCapture' -as [type])) {
  Add-Type -Path (Join-Path $PSScriptRoot 'diagnostic-process.cs')
}
function Get-PostgresDiagnosticStage([string]$Code) {
  switch -Regex -CaseSensitive ($Code) {
    '^STRUCTURE_PROOF_' { return 'STRUCTURE_PROOF' }
    '^STRUCTURE_' { return 'STRUCTURE' }
    'LEDGER' { return 'LEDGER' }
    'IDENTITY|TARGET_SNAPSHOT|APPLICATION_ROLE' { return 'IDENTITY' }
    'SNAPSHOT|EXPORT' { return 'SNAPSHOT' }
    '^BACKUP_' { return 'BACKUP' }
    '^ISOLATED_RESTORE_' { return 'RESTORE' }
    default { return 'OTHER_NATIVE' }
  }
}
function New-SafePostgresDiagnostic($Capture, [string]$Mode, [string]$Stage,
    [string]$Code, [string]$QueryFile = '', [string]$OperationCode = $Code) {
  $state = $null
  # Accept only a complete one-line psql -f sqlstate report for this exact file.
  # A message containing five plausible characters is never sufficient.
  if ($Capture.ExitCode -eq 3 -and -not $Capture.ErrorTruncated -and $QueryFile) {
    $forms=@($QueryFile,$QueryFile.Replace('\','/'))|Select-Object -Unique
    $prefix='(?:'+(($forms|ForEach-Object {[regex]::Escape($_)}) -join '|')+')'
    # libpq sqlstate verbosity retains the server-localized severity. Only the
    # two exact verified severity tokens and the exact supplied filename pass.
    $pattern = '\Apsql:' + $prefix + ':[1-9][0-9]*: (?:ERROR|ОШИБКА):  ([0-9A-Z]{5})\r?\n\z'
    $match = [regex]::Match($Capture.Errors, $pattern)
    if ($match.Success -and $match.Groups[1].Value -cin @(
        '42601','42P01','42703','42883','0A000','42501','57014','55P03',
        '28000','28P01','08000','08001','08003','08006','08004','08P01',
        '53100','53200','53300','53400','P0001')) { $state = $match.Groups[1].Value }
  }
  $category = 'UNKNOWN'
  if ($state -cin @('42601','42P01','42703','42883','0A000')) { $category='SQL_COMPATIBILITY' }
  elseif ($state -ceq '42501') { $category='PERMISSION' }
  elseif ($state -ceq '57014') { $category='QUERY_CANCELED' }
  elseif ($state -ceq '55P03') { $category='LOCK_UNAVAILABLE' }
  elseif ($state -cin @('28000','28P01')) { $category='AUTH' }
  elseif ($state -like '08*' -or $Capture.ExitCode -eq 2) { $category='CONNECTION' }
  elseif ($state -cin @('53100','53200','53300','53400')) { $category='RESOURCE' }
  # 57014 also means user cancellation; 55P03 also means NOWAIT. Neither proves
  # a specific server timeout. Only our enforced process deadline is proven.
  return [pscustomobject][ordered]@{
    stage=$Stage; connectionMode=$Mode; nativeExitCode=$Capture.ExitCode
    durationMs=[long]$Capture.DurationMs; sqlState=$state
    timeoutCategory=$(if($Capture.Failure -ceq 'DEADLINE'){'PROCESS_DEADLINE'}else{'UNKNOWN'})
    errorCategory=$category; runnerFailureCode=$Code; operationFailureCode=$OperationCode
    cleanupFailed=[bool]$Capture.CleanupFailed
  }
}
function Get-SafePostgresDiagnostic([object]$ErrorRecord) {
  # Copy a closed schema, never serialize Exception/Data or a capture object.
  $d=$ErrorRecord.Exception.Data['SafePostgresDiagnostic']
  if (-not $d) { return $null }
  $keys=@('stage','connectionMode','nativeExitCode','durationMs','sqlState',
    'timeoutCategory','errorCategory','runnerFailureCode','operationFailureCode','cleanupFailed')
  if (@($d.PSObject.Properties.Name).Count -ne $keys.Count -or
      @($d.PSObject.Properties.Name|Where-Object {$_ -cnotin $keys}).Count) { return $null }
  foreach($key in @('stage','connectionMode','timeoutCategory','errorCategory','runnerFailureCode','operationFailureCode')) { if($d.$key -isnot [string]) { return $null } }
  if ($d.stage -cnotin @('STRUCTURE_PROOF','STRUCTURE','LEDGER','IDENTITY','SNAPSHOT','BACKUP','RESTORE','OTHER_NATIVE') -or
      $d.connectionMode -cnotin @('Direct','Session') -or
      ($null -ne $d.nativeExitCode -and $d.nativeExitCode -isnot [int]) -or
      $d.durationMs -isnot [long] -or $d.durationMs -lt 0 -or
      ($null -ne $d.sqlState -and $d.sqlState -cnotin @('42601','42P01','42703','42883','0A000','42501','57014','55P03','28000','28P01','08000','08001','08003','08006','08004','08P01','53100','53200','53300','53400','P0001')) -or
      $d.timeoutCategory -cnotin @('UNKNOWN','PROCESS_DEADLINE') -or
      $d.errorCategory -cnotin @('UNKNOWN','SQL_COMPATIBILITY','PERMISSION','QUERY_CANCELED','LOCK_UNAVAILABLE','AUTH','CONNECTION','RESOURCE') -or
      $d.runnerFailureCode -cnotmatch '^[A-Z0-9_]{1,100}$' -or
      $d.operationFailureCode -cnotmatch '^[A-Z0-9_]{1,100}$' -or
      $ErrorRecord.Exception.Message -cne ('LMR:'+$d.runnerFailureCode) -or
      $d.cleanupFailed -isnot [bool]) { return $null }
  $copy=[ordered]@{}
  foreach($key in $keys){$copy[$key]=$d.$key}
  if ($ErrorRecord.Exception.Data['QueryFileCleanupFailed'] -eq $true) { $copy.cleanupFailed=$true }
  return [pscustomobject]$copy
}
function Throw-PostgresDiagnostic([string]$Code, [object]$Diagnostic) {
  $failure = [Exception]::new('LMR:'+$Code)
  $failure.Data['SafePostgresDiagnostic']=$Diagnostic
  throw $failure
}
function Invoke-DiagnosticPostgresProcess([string]$Binary,[string[]]$Arguments,
    [ValidateSet('Direct','Session')][string]$Mode,[string]$FailureCode,
    [ValidateRange(50,150000)][int]$DeadlineMs=150000) {
  $capture=[LegalHubMaintenanceDiagnostics.ProcessCapture]::Run($Binary,$Arguments,$DeadlineMs)
  $prefix=if($Mode -ceq 'Session'){'SESSION_TOOL_'}else{'PSQL_TOOL_'}
  $code=switch -CaseSensitive ($capture.Failure) {
    'DEADLINE' {$prefix+'DEADLINE_EXCEEDED'}
    'DRAIN' {$prefix+'DRAIN_FAILED'}
    'OUTPUT' {$prefix+'OUTPUT_TOO_LARGE'}
    'START' {$FailureCode}
    'CLEANUP' {$prefix+'CLEANUP_UNVERIFIED'}
    default {$FailureCode}
  }
  $queryFile=''
  for($i=0;$i -lt $Arguments.Count-1;$i++){if($Arguments[$i] -ceq '-f'){$queryFile=$Arguments[$i+1]}}
  $diag=New-SafePostgresDiagnostic $capture $Mode (Get-PostgresDiagnosticStage $FailureCode) $code $queryFile $FailureCode
  if([IO.Path]::GetFileName($Binary) -ine 'psql.exe'){ $diag.sqlState=$null; $diag.errorCategory='UNKNOWN' }
  # Drop the private raw reference before returning or throwing.
  $capture.Errors=''
  if($capture.Failure){Throw-PostgresDiagnostic $code $diag}
  return [pscustomobject]@{ExitCode=$capture.ExitCode;Output=@($capture.Output -split '\r?\n'|Where-Object {$_});Diagnostic=$(if($capture.ExitCode -ne 0){$diag}else{$null})}
}
