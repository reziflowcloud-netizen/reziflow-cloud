param([switch]$MetadataOnly,[switch]$ExpectedOwnerAuthorizedVersionProbe,[ValidateSet('Minimal','Alias')][string]$Case='Minimal',[string]$ScratchRoot,[string]$AliasDirectory,[int]$ParentPid,[string]$DeadlineUtc)
$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';Set-StrictMode -Version Latest
if(-not $MetadataOnly -and -not $ExpectedOwnerAuthorizedVersionProbe){Write-Output '{"status":"PLAN_ONLY","ngrokStarted":false}';return}
$job=$null;$stage='metadata';$operation='none';$nativeCode=0;$zero=$false;$stopped=$true;$active=0;$entries=0
try{
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $hostSuffix='\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe';$hostPath=[Environment]::ProcessPath
 if(-not $hostPath.EndsWith($hostSuffix,[StringComparison]::OrdinalIgnoreCase) -or (Get-FileHash -LiteralPath $hostPath -Algorithm SHA256).Hash -ne '2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233'){throw 'HOST_REFUSED'}
 Assert-QaNoReparse $hostPath
 $profile=$hostPath.Substring(0,$hostPath.Length-$hostSuffix.Length);$expectedAlias=Join-Path $profile 'AppData\Local\Microsoft\WindowsApps'
 if([IO.Path]::GetFullPath($AliasDirectory) -ne $expectedAlias){throw 'ALIAS_DIRECTORY_REFUSED'}
 Assert-QaNoReparse $AliasDirectory
 $package='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc';$exe=Join-Path $package 'ngrok.exe';$alias=Join-Path $AliasDirectory 'ngrok.exe'
 foreach($file in @($exe,(Join-Path $package 'AppxManifest.xml'),(Join-Path $package 'AppxSignature.p7x'))){Assert-QaNoReparse $file;if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw 'PACKAGE_REFUSED'}}
 if((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -ne '6CCA51C969E13AD038A608B015000815135A3148CE4BB6A6F63C8AA536198E16'){throw 'IMAGE_REFUSED'}
 [xml]$manifest=[IO.File]::ReadAllText((Join-Path $package 'AppxManifest.xml'))
 $identity=$manifest.Package.Identity;$app=@($manifest.SelectNodes('//*[local-name()="Application" and @Id="ngrok"]'));$aliases=@($manifest.SelectNodes('//*[local-name()="ExecutionAlias" and @Alias="ngrok.exe"]'))
 if($identity.Name -ne 'ngrok.ngrok' -or $identity.Version -ne '3.39.11.0' -or $identity.ProcessorArchitecture -ne 'x64' -or $app.Count -ne 1 -or $aliases.Count -ne 1 -or $app[0].Executable -ne 'ngrok.exe' -or $app[0].EntryPoint -ne 'Windows.FullTrustApplication'){throw 'MANIFEST_REFUSED'}
 Add-Type -WarningAction SilentlyContinue -TypeDefinition @'
using System;using System.IO;using System.Text;using System.Runtime.InteropServices;
public static class QaPairMetadata {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateFileW(string p,uint a,uint s,IntPtr x,uint d,uint f,IntPtr t);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool DeviceIoControl(IntPtr h,uint c,IntPtr i,uint n,byte[] o,uint z,out uint u,IntPtr v);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
 [StructLayout(LayoutKind.Sequential)]struct FileInfo{public uint size;public IntPtr path,handle,subject;}
 [StructLayout(LayoutKind.Sequential)]struct Trust{public uint size;public IntPtr policy,sip;public uint ui,revoke,choice;public IntPtr file;public uint action;public IntPtr state,url;public uint flags,context;public IntPtr settings;}
 [DllImport("wintrust.dll",ExactSpelling=true,SetLastError=false)]static extern int WinVerifyTrust(IntPtr hwnd,ref Guid action,ref Trust data);
 public static bool Signature(string path){IntPtr name=Marshal.StringToHGlobalUni(path),info=Marshal.AllocHGlobal(Marshal.SizeOf<FileInfo>());var action=new Guid("00AAC56B-CD44-11D0-8CC2-00C04FC295EE");var data=new Trust{size=(uint)Marshal.SizeOf<Trust>(),ui=2,choice=1,file=info,action=1,flags=0x1010};try{Marshal.StructureToPtr(new FileInfo{size=(uint)Marshal.SizeOf<FileInfo>(),path=name},info,false);return WinVerifyTrust(new IntPtr(-1),ref action,ref data)==0;}finally{if(data.state!=IntPtr.Zero){data.action=2;WinVerifyTrust(new IntPtr(-1),ref action,ref data);}Marshal.FreeHGlobal(info);Marshal.FreeHGlobal(name);}}
 public static bool Alias(string path,string image){var h=CreateFileW(path,0,7,IntPtr.Zero,3,0x00200000,IntPtr.Zero);if(h==new IntPtr(-1))return false;try{var b=new byte[16384];uint n;if(!DeviceIoControl(h,0x900A8,IntPtr.Zero,0,b,(uint)b.Length,out n,IntPtr.Zero)||n<12||BitConverter.ToUInt32(b,0)!=0x8000001B)return false;int length=BitConverter.ToUInt16(b,4);if(length<4||length+8>n||(length-4)%2!=0||BitConverter.ToInt32(b,8)!=3)return false;var fields=new UnicodeEncoding(false,false,true).GetString(b,12,length-4).Split(new[]{'\0'},StringSplitOptions.None);return fields.Length==5&&fields[4].Length==0&&fields[3]=="0"&&fields[0]=="ngrok.ngrok_1g87z0zv29zzc"&&fields[1]=="ngrok.ngrok_1g87z0zv29zzc!ngrok"&&String.Equals(fields[2],image,StringComparison.OrdinalIgnoreCase);}finally{CloseHandle(h);}}
}
'@
 if(-not [QaPairMetadata]::Signature((Join-Path $package 'AppxSignature.p7x')) -or -not [QaPairMetadata]::Alias($alias,$exe)){throw 'TRUSTED_ALIAS_REFUSED'}
 if($MetadataOnly){Write-Output '{"status":"METADATA_VERIFIED","case":"metadata","operation":"none","nativeCode":0,"stopped":true,"activeProcesses":0,"scratchEntries":0,"versionExitedZero":false}';return}
 $stage='scratch';$checkout=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'));$parent=Join-Path $checkout '.qa';Assert-QaNoReparse $parent
 $git='C:\Program Files\Git\cmd\git.exe';Assert-QaNoReparse $git
 & $git -C $checkout check-ignore --quiet -- '.qa/ngrok-caller-pair-placeholder' 2>$null
 if($LASTEXITCODE -ne 0){throw 'SCRATCH_NOT_IGNORED'}
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ScratchRoot)) -ne $parent -or [IO.Path]::GetFileName($ScratchRoot) -notmatch '^ngrok-caller-pair-[a-f0-9]{32}$'){throw 'SCRATCH_REFUSED'}
 Assert-QaNoReparse $ScratchRoot;if(@(Get-ChildItem -LiteralPath $ScratchRoot -Force).Count){throw 'SCRATCH_NOT_EMPTY'}
 $who=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetAccessRuleProtection($true,$false);$acl.SetOwner($who)
 foreach($sid in @($who.Value,'S-1-5-18','S-1-5-32-544')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 Set-Acl -LiteralPath $ScratchRoot -AclObject $acl;Assert-QaPrivateAcl $ScratchRoot
 $expected='C:\Windows\System32;C:\Program Files\nodejs;C:\Program Files\Git\cmd';if($Case -eq 'Alias'){$expected+=';'+$AliasDirectory};if($env:PATH -cne $expected -or $env:PATHEXT -cne '.EXE'){throw 'CALLER_ENV_REFUSED'}
 foreach($name in @('TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')){if([Environment]::GetEnvironmentVariable($name,'Process') -cne $ScratchRoot){throw 'CALLER_ENV_REFUSED'}}
 $deadline=[DateTimeOffset]::Parse($DeadlineUtc,[Globalization.CultureInfo]::InvariantCulture);if($deadline -le [DateTimeOffset]::UtcNow -or $deadline -gt [DateTimeOffset]::UtcNow.AddSeconds(50)){throw 'DEADLINE_REFUSED'}
 $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID);$caller=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ParentPid);$owner=Invoke-CimMethod -InputObject $caller -MethodName GetOwnerSid
 if($self.ParentProcessId -ne $ParentPid -or $caller.ExecutablePath -ne 'C:\Program Files\nodejs\node.exe' -or $owner.ReturnValue -ne 0 -or $owner.Sid -ne $who.Value){throw 'PARENT_REFUSED'}
 $tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'supervisor-ngrok-version.test.ps1'),[ref]$tokens,[ref]$errors);$function=$ast.Find({param($n)$n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-QaVersionChildEnvironmentPairs'},$true);if($errors.Count -or -not $function){throw 'ENV_SOURCE_REFUSED'};. ([scriptblock]::Create($function.Extent.Text));$pairs=Get-QaVersionChildEnvironmentPairs $ScratchRoot
 $source=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'supervisor-process.ps1'));$match=[regex]::Match($source,"(?s)Add-Type -WarningAction SilentlyContinue -TypeDefinition @'\r?\n(?<code>.*?)\r?\n'@");$code=$match.Groups['code'].Value.Replace("`r`n","`n")
 if(-not $match.Success -or [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($code))).ToLowerInvariant() -ne '72fd9543508606d49e93beabe0259944cf762cf78db44ec21a4cab27936f73c9'){throw 'NATIVE_SOURCE_REFUSED'}
 Add-Type -TypeDefinition $code -WarningAction SilentlyContinue
 if(@(Get-ChildItem -LiteralPath $ScratchRoot -Force).Count){throw 'SCRATCH_NOT_EMPTY'}
 $stage='version';$job=[QaOwnedJob]::new($ParentPid,'C:\Program Files\nodejs\node.exe');$inputTask=[Console]::In.ReadLineAsync()
 $discard=$job.Launch('app','C:\Program Files\nodejs\node.exe',[string[]]@((Join-Path $PSScriptRoot 'supervisor-fake-child.mjs'),'--descendant'),$ScratchRoot,$pairs)
 if([DateTimeOffset]::UtcNow -ge $deadline -or $inputTask.IsCompleted){throw 'CANCELLED'}
 $discard=$job.Launch('tunnel',$exe,[string[]]@('version'),$ScratchRoot,$pairs)
 while($job.ChildAlive('tunnel')){if(-not $job.ParentAlive() -or $inputTask.IsCompleted -or [DateTimeOffset]::UtcNow -ge $deadline){throw 'CANCELLED'};Start-Sleep -Milliseconds 100}
 $zero=$job.ChildExitCode('tunnel') -eq 0
}catch{if($null -ne ('QaOwnedJob' -as [type])){$operation=[QaOwnedJob]::LastOperation;$nativeCode=[QaOwnedJob]::LastNativeCode};if($null -eq $operation){$operation='none'}}
finally{if($job){try{$stopped=$job.StopAll();$active=$job.ActiveCount()}catch{$stopped=$false;$active=1000}finally{try{$job.Dispose()}catch{$stopped=$false}}};if($ScratchRoot){try{Assert-QaNoReparse $ScratchRoot;$entries=@(Get-ChildItem -LiteralPath $ScratchRoot -Force).Count}catch{$entries=1000;$stopped=$false}}}
if($operation -notin @('none','configuration','query_time','query_image','open_parent','create_job','job_limits','exit_code','open_nul','attributes_init','attributes_update','create_process','assign_job','resume_thread','terminate_job')){$operation='none';$nativeCode=0}
$passed=$zero -and $stopped -and $active -eq 0 -and $entries -eq 0
[pscustomobject]@{status=if($passed){'PASS'}else{'BLOCKED'};case=if($MetadataOnly){'metadata'}elseif($Case -eq 'Minimal'){'minimal'}else{'alias_path'};operation=$operation;nativeCode=$nativeCode;stopped=$stopped;activeProcesses=$active;scratchEntries=$entries;versionExitedZero=$zero}|ConvertTo-Json -Compress
if(-not $passed){exit 1}
