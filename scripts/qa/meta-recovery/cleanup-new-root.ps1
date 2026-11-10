[CmdletBinding(SupportsShouldProcess=$true,ConfirmImpact='Medium')]
param([Parameter(Mandatory=$true)][string]$PointerPath,[Parameter(Mandatory=$true)][string]$ExpectedPrivateRoot,[Parameter(Mandatory=$true)][string]$Manifest,[switch]$Execute)
$ErrorActionPreference='Stop'
function Assert-QaCleanupScope([string]$Expected,[string]$Actual,[string]$Source){
 if($Expected -notmatch '^D:\\LegalHubStageA-[0-9a-f]{32}$' -or [IO.Path]::GetFullPath($Expected) -cne $Expected -or $Actual -cne $Expected -or $Source -eq $Expected -or $Source.StartsWith($Expected+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'CLEANUP_SCOPE_REFUSED'}
}
function Get-QaCleanupExemptPids([object]$Self,[object]$Parent,[string]$Exe,[string]$Owner,[string]$Helper,[string]$Root,[string]$Pointer,[int]$CurrentPid){
 if($Self.ProcessId -ne $CurrentPid -or $Self.ExecutablePath -ne $Exe -or $Self.OwnerSid -ne $Owner){throw 'CLEANUP_SELF_PROOF_REFUSED'}
 $allowed=@($CurrentPid)
 if($Parent -and $Parent.ProcessId -eq $Self.ParentProcessId -and $Parent.ExecutablePath -eq $Exe -and $Parent.OwnerSid -eq $Owner -and (Convert-QaCleanupTime $Parent.CreationDate) -le (Convert-QaCleanupTime $Self.CreationDate)){
  $line=([string]$Parent.CommandLine).Replace('/','\')
  if(@($Helper,$Root,$Pointer|Where-Object{$line.IndexOf($_,[StringComparison]::OrdinalIgnoreCase) -lt 0}).Count -eq 0){$allowed+=[int]$Parent.ProcessId}
 }
 return $allowed
}
function Get-QaCleanupQuiet([object]$Qa,[string]$Pointer,[string]$HelperPath=(Join-Path $PSScriptRoot 'cleanup-new-root.ps1')){
 $ports=@(43126,43127,[int]$Qa.State.cluster.Port)
 # No empty catch: provider/access/query failures must block deletion.
 $allListeners=@(Get-NetTCPConnection -State Listen -ErrorAction Stop)
 if(@($allListeners|Where-Object{$_.LocalPort -in $ports}).Count){throw 'CLEANUP_PORT_BUSY'}
 $root=$Qa.Runtime.privateDirectory.Replace('\','\\').Replace("'","\'")
 $filter="(CommandLine LIKE '%$root%' AND (Name='node.exe' OR Name='ngrok.exe' OR Name='pwsh.exe' OR Name='postgres.exe' OR Name='pg_ctl.exe')) OR (Name='node.exe' AND CommandLine LIKE '%meta-recovery%supervisor.mjs%') OR (Name='pwsh.exe' AND CommandLine LIKE '%supervisor-process.ps1%')"
 $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID) -ErrorAction Stop
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $selfOwner=Invoke-CimMethod -InputObject $self -MethodName GetOwnerSid -ErrorAction Stop -WhatIf:$false
 if($selfOwner.ReturnValue -ne 0){throw 'CLEANUP_SELF_OWNER_REFUSED'};$self|Add-Member -NotePropertyName OwnerSid -NotePropertyValue $selfOwner.Sid -Force
 $parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$self.ParentProcessId) -ErrorAction Stop
 if($parent -and $parent.ExecutablePath -eq $Qa.Runtime.qaPwshExecutable){$parentOwner=Invoke-CimMethod -InputObject $parent -MethodName GetOwnerSid -ErrorAction Stop -WhatIf:$false;if($parentOwner.ReturnValue -ne 0){throw 'CLEANUP_CALLER_OWNER_REFUSED'};$parent|Add-Member -NotePropertyName OwnerSid -NotePropertyValue $parentOwner.Sid -Force}else{$parent=$null}
 $allowed=@(Get-QaCleanupExemptPids $self $parent $Qa.Runtime.qaPwshExecutable $identity $HelperPath $Qa.Runtime.privateDirectory ([IO.Path]::GetFullPath($Pointer)) $PID)
 if(@(Get-CimInstance Win32_Process -Property ProcessId,Name -Filter $filter -ErrorAction Stop|Where-Object{$_.ProcessId -notin $allowed}).Count){throw 'CLEANUP_PROCESS_PRESENT'}
 if(Test-Path -LiteralPath (Join-Path $Qa.State.cluster.Cluster 'postmaster.pid') -ErrorAction Stop){throw 'CLEANUP_PID_FILE_PRESENT'}
}
function Convert-QaCleanupTime([object]$Value){
 if($Value -is [DateTimeOffset]){return $Value.ToUniversalTime()}
 if($Value -is [DateTime]){if($Value.Kind -eq [DateTimeKind]::Unspecified){throw 'CLEANUP_TIME_REFUSED'};return ([DateTimeOffset]::new($Value)).ToUniversalTime()}
 if($Value -isnot [string] -or $Value -notmatch '^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$'){throw 'CLEANUP_TIME_REFUSED'}
 return ([DateTimeOffset]::Parse($Value,[Globalization.CultureInfo]::InvariantCulture)).ToUniversalTime()
}
function Get-QaCleanupHash([object[]]$Rows){
 $sha=[Security.Cryptography.SHA256]::Create()
 try{return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($Rows|ConvertTo-Json -Depth 8 -Compress))))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
}
function Get-QaCleanupSnapshot([object]$Qa,[string]$Pointer){
 $c=$Qa.Runtime;$root=$c.privateDirectory
 if($c.appId -ne '2523488421395251' -or $c.approvedMetaAppId -ne $c.appId -or $c.pageId -ne '1449474971582722' -or $c.formId -ne '2046130655900851' -or $c.enabled -isnot [bool] -or $c.enabled -or $c.workerEnabled -isnot [bool] -or $c.workerEnabled -or $c.approvedTuples -isnot [array] -or $c.approvedTuples.Count -or $c.pilotLeadIds -isnot [array] -or $c.pilotLeadIds.Count){throw 'CLEANUP_RUNTIME_REFUSED'}
 $realFile=Join-Path $root 'meta-real-private.json';Assert-QaPrivateAcl $realFile
 if((Get-Item -LiteralPath $realFile).Length -gt 65536){throw 'CLEANUP_METADATA_SIZE'}
 $real=Get-Content -LiteralPath $realFile -Raw|ConvertFrom-Json
 if($real.appId -ne $c.appId -or $real.pageId -ne $c.pageId -or $real.formId -ne $c.formId -or $real.release -isnot [bool] -or $real.release){throw 'CLEANUP_GATE_REFUSED'}
 $times=@();foreach($pair in @(@($real,'closedAt'),@($real,'earliestClosedAt'),@($c,'cleanupClosedAt'))){$p=$pair[0].PSObject.Properties[$pair[1]];if($p -and $null -ne $p.Value){$times+=Convert-QaCleanupTime $p.Value}}
 if($times.Count -eq 0){throw 'CLEANUP_TIME_MISSING'}
 $t0=@($times|Sort-Object UtcTicks)[0];if($t0 -gt [DateTimeOffset]::UtcNow){throw 'CLEANUP_TIME_FUTURE'}
 if(-not(Test-Path -LiteralPath (Join-Path $Qa.State.cluster.Cluster 'PG_VERSION') -PathType Leaf -ErrorAction Stop)){throw 'CLEANUP_CLUSTER_MARKER_MISSING'}
 Get-QaCleanupQuiet $Qa $Pointer
 $rows=[Collections.Generic.List[object]]::new();$stack=[Collections.Generic.Stack[string]]::new();$stack.Push($root)
 [long]$files=0;[long]$bytes=0;$categories=@{}
 while($stack.Count){
  $directory=$stack.Pop();$items=@(Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop)
  if($directory -eq $root){$items+=Get-Item -LiteralPath $root -Force}
  foreach($item in $items){
   if($item.Attributes.HasFlag([IO.FileAttributes]::ReparsePoint) -or $item.LinkType -or $item.Name -ieq '.git' -or $item.Name -ieq 'combined-source'){throw 'CLEANUP_SOURCE_OR_LINK_REFUSED'}
   $path=[IO.Path]::GetFullPath($item.FullName)
   if($path -ne $root -and -not $path.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'CLEANUP_DESCENDANT_SCOPE_REFUSED'}
   $relative=if($path -eq $root){'.'}else{$path.Substring($root.Length+1)}
   [long]$length=if($item.PSIsContainer){0}else{$item.Length}
   $rows.Add([pscustomobject][ordered]@{relativePath=$relative;directory=[bool]$item.PSIsContainer;length=$length;creationTicks=$item.CreationTimeUtc.Ticks;writeTicks=$item.LastWriteTimeUtc.Ticks;attributes=[int]$item.Attributes})
   if($item.PSIsContainer){if($path -ne $root){$stack.Push($path)};continue}
   $files++;$bytes+=$length
   $category=if($relative -like 'isolated\*\cluster\*'){'qa_postgresql'}elseif($relative -like 'qa-source\*'){'disposable_source_copy_and_build'}elseif($relative -match '^(runtime\.json|cluster-state\.json|qa\.env|meta-.*token\.txt|meta-app-secret\.txt|meta-real-private\.json|ngrok\.yml)$'){'temporary_credentials_and_config'}elseif($relative -match '\.(log|out|err|tmp)$|audit|diagnostic'){'qa_logs_and_diagnostics'}else{'qa_runtime_artifacts'}
   if(-not $categories.ContainsKey($category)){$categories[$category]=[ordered]@{files=[long]0;bytes=[long]0}}
   $categories[$category].files++;$categories[$category].bytes+=$length
  }
 }
 $ordered=@($rows|Sort-Object relativePath)
 Get-QaCleanupQuiet $Qa $Pointer
 return [pscustomobject][ordered]@{target=$root;sourceOriginal=$Qa.Source;sourceHead='51c560a5f0090b669ee4ffe48485ba4d6a3a873e';files=$files;bytes=$bytes;categories=$categories;cleanupT0=$t0.ToString('o');cleanupT0Ticks=$t0.UtcTicks;credentialsDue=$t0.AddHours(24).ToString('o');qaArtifactsDue=$t0.AddDays(7).ToString('o');anonymousResultDue=$t0.AddDays(30).ToString('o');fingerprint=(Get-QaCleanupHash $ordered);metadata=$ordered}
}
try{
 Set-StrictMode -Version Latest
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned' -or ($Execute -and $WhatIfPreference) -or (-not $Execute -and -not $WhatIfPreference)){throw 'CLEANUP_MODE_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $expectedPointer=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../.qa/meta-recovery-20261110/private-pointer.json'))
 if([IO.Path]::GetFullPath($PointerPath) -cne $expectedPointer){throw 'CLEANUP_POINTER_REFUSED'}
 $manifestPath=[IO.Path]::GetFullPath($Manifest)
 if($manifestPath -cne (Join-Path ([IO.Path]::GetDirectoryName($expectedPointer)) 'new-root-cleanup-manifest.json')){throw 'CLEANUP_MANIFEST_SCOPE_REFUSED'}
 Assert-QaNoReparse ([IO.Path]::GetDirectoryName($manifestPath))
 $qa=Read-QaGuardedRuntime $PointerPath -AllowStopped
 if([Environment]::ProcessPath -ne $qa.Runtime.qaPwshExecutable){throw 'CLEANUP_HOST_REFUSED'}
 Assert-QaCleanupScope $ExpectedPrivateRoot $qa.Runtime.privateDirectory $qa.Source
 $snapshot=Get-QaCleanupSnapshot $qa $PointerPath
 if(-not $Execute){
  if(Test-Path -LiteralPath $manifestPath -ErrorAction Stop){throw 'CLEANUP_MANIFEST_ALREADY_EXISTS'}
  $stream=[IO.FileStream]::new($manifestPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);$stream.Dispose()
  $acl=[Security.AccessControl.FileSecurity]::new();$acl.SetAccessRuleProtection($true,$false);$identity=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl.SetOwner($identity)
  foreach($sid in @($identity.Value,'S-1-5-18','S-1-5-32-544')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))}
  Set-Acl -LiteralPath $manifestPath -AclObject $acl -WhatIf:$false -Confirm:$false;Assert-QaPrivateAcl $manifestPath
  [IO.File]::WriteAllText($manifestPath,([ordered]@{version=1;createdUtc=[DateTimeOffset]::UtcNow.ToString('o');previewOnly=$true;snapshot=$snapshot}|ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
  Remove-Item -LiteralPath $ExpectedPrivateRoot -Recurse -Force -WhatIf
  [pscustomobject]@{status='PREVIEW_ONLY';target=$ExpectedPrivateRoot;files=$snapshot.files;bytes=$snapshot.bytes;categories=$snapshot.categories;cleanupT0=$snapshot.cleanupT0;credentialsDue=$snapshot.credentialsDue;manifest=$manifestPath;deletionPerformed=$false}|ConvertTo-Json -Depth 6 -Compress
 }else{
  Assert-QaPrivateAcl $manifestPath
  if((Get-Item -LiteralPath $manifestPath).Length -gt 20971520){throw 'CLEANUP_MANIFEST_SIZE_REFUSED'}
  $approved=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
  if($approved.version -ne 1 -or $approved.previewOnly -ne $true -or $approved.snapshot.target -cne $ExpectedPrivateRoot -or $approved.snapshot.sourceOriginal -cne $qa.Source -or $approved.snapshot.sourceHead -ne $snapshot.sourceHead -or $approved.snapshot.fingerprint -cne $snapshot.fingerprint -or $approved.snapshot.files -ne $snapshot.files -or $approved.snapshot.bytes -ne $snapshot.bytes -or $approved.snapshot.cleanupT0Ticks -ne $snapshot.cleanupT0Ticks){throw 'CLEANUP_MANIFEST_CHANGED'}
  Get-QaCleanupQuiet $qa $PointerPath
  Assert-QaCleanupScope $ExpectedPrivateRoot $qa.Runtime.privateDirectory $qa.Source
  if($PSCmdlet.ShouldProcess($ExpectedPrivateRoot,'Remove only the approved disposable QA tree')){
   Remove-Item -LiteralPath $ExpectedPrivateRoot -Recurse -Force -Confirm:$false -ErrorAction Stop
   if(Test-Path -LiteralPath $ExpectedPrivateRoot -ErrorAction Stop){throw 'CLEANUP_ABSENCE_UNVERIFIED'}
   [pscustomobject]@{status='REMOVED';targetAbsent=$true;files=$snapshot.files;bytes=$snapshot.bytes;sourcePreserved=$true;externalCopies='NOT_VERIFIED';deletionPerformed=$true}|ConvertTo-Json -Compress
  }else{throw 'CLEANUP_NOT_EXECUTED'}
 }
}catch{Write-Output '{"status":"BLOCKED","code":"QA_NEW_ROOT_CLEANUP_REFUSED","deletionConfirmed":false}';exit 1}
