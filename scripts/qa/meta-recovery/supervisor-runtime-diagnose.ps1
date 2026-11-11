param([Parameter(Mandatory=$true)][string]$PointerPath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$stage='host'
$nativeCode=0
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $stage='pointer_acl';Assert-QaPrivateAcl $PointerPath
 $stage='pointer_parse';$p=Get-Content -LiteralPath $PointerPath -Raw|ConvertFrom-Json
 $stage='root';$root=Get-QaCanonicalDirectory $p.privateDirectory;Assert-QaPrivateAcl $root
 $stage='marker';Assert-QaPrivateAcl (Join-Path $root 'qa-owned.txt');if((Get-Content -LiteralPath (Join-Path $root 'qa-owned.txt') -Raw).Trim() -ne 'LegalHub Stage A synthetic QA'){throw 'REFUSED'}
 $stage='runtime_acl';Assert-QaPrivateAcl $p.runtimeFile;Assert-QaPrivateAcl $p.stateFile
 $stage='runtime_parse';$c=Get-Content -LiteralPath $p.runtimeFile -Raw|ConvertFrom-Json;$s=Get-Content -LiteralPath $p.stateFile -Raw|ConvertFrom-Json
 $stage='database_target';Assert-QaDatabaseTarget ([Uri]$c.databaseUrl) $s.cluster $c.databaseUrl
 $stage='postgres_ownership';Assert-QaRunningPostgres $s.config $s.cluster $root
 $stage='repo';$discard=Get-QaCanonicalDirectory $c.repo
 $stage='source_path';$source=Get-QaCanonicalDirectory $c.sourceOriginal
 $stage='git_resolution';if((Get-Command git.exe -CommandType Application).Source -ne 'C:\Program Files\Git\cmd\git.exe'){throw 'REFUSED'}
 $stage='source_git_bare_resolution'
 try{$discard=Get-Command git -CommandType Application -ErrorAction Stop}catch [System.Management.Automation.CommandNotFoundException]{$stage='source_git_bare_command_missing';throw 'REFUSED'}
 # Provider text stays in memory. Emit only finite classification, never the
 # raw stderr, local path, hash, command line, config or credential value.
 $stage='source_git_head'
 $savedPreference=$ErrorActionPreference
 try{
  $ErrorActionPreference='Continue'
  try{
   $global:LASTEXITCODE=-9876
   $head=@(& 'C:\Program Files\Git\cmd\git.exe' -C $source rev-parse HEAD 2>&1);$code=$LASTEXITCODE
   if($code -eq -9876){
    $stage='source_git_not_started'
    foreach($record in $head){
     if($record -is [System.Management.Automation.ErrorRecord]){
      $failure=$record.Exception
      for($depth=0;$depth -lt 6 -and $failure;$depth++){
       if($failure -is [ComponentModel.Win32Exception]){$nativeCode=[int]$failure.NativeErrorCode;if($nativeCode -in @(5,225,577,1260)){$stage='source_git_security_execution'}}
       $failure=$failure.InnerException
      }
     }
    }
    throw 'REFUSED'
   }
  }
  catch{
   if($stage -ne 'source_git_not_started' -and $stage -ne 'source_git_security_execution'){$stage='source_git_invocation_failure'}
   $failure=$_.Exception
   for($depth=0;$depth -lt 6 -and $failure;$depth++){
    if($failure -is [ComponentModel.Win32Exception]){switch($failure.NativeErrorCode){5{$stage='source_git_security_execution'}225{$stage='source_git_security_execution'}577{$stage='source_git_security_execution'}1260{$stage='source_git_security_execution'}}}
    $failure=$failure.InnerException
   }
   if($_.CategoryInfo.Category -in @('PermissionDenied','SecurityError')){$stage='source_git_security_execution'}
   if($_.FullyQualifiedErrorId -match '^VariableIsUndefined(?:,|$)'){$stage='source_git_last_exit_missing'}
   elseif($_.FullyQualifiedErrorId -match '^NativeCommandFailed(?:,|$)'){$stage='source_git_native_failure'}
   elseif($_.FullyQualifiedErrorId -match '^CommandNotFoundException(?:,|$)'){$stage='source_git_command_missing'}
   elseif($_.FullyQualifiedErrorId -match '^PropertyNotFoundStrict(?:,|$)'){$stage='source_git_property_missing'}
   throw 'REFUSED'
  }
 }finally{$ErrorActionPreference=$savedPreference}
 if($code -ne 0){
  $text=$head -join "`n"
  if($text -match 'detected dubious ownership'){$stage='source_git_security_ownership'}
  elseif($text -match 'Permission denied|Access is denied'){$stage='source_git_security_access'}
  else{$stage='source_git_head_failure'}
  throw 'REFUSED'
 }
 $stage='source_guard';$discard=Assert-QaSource $source
 $stage='full_guard';$discard=Read-QaGuardedRuntime $PointerPath
 @{status='PASS';stage='full_guard'}|ConvertTo-Json -Compress
}catch{
 @{status='BLOCKED';stage=$stage;nativeCode=$nativeCode}|ConvertTo-Json -Compress
 exit 1
}
