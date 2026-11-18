# Read-only provenance for the one supported Store ngrok package and its registered alias.
# The alias is the launch entry point; the signed package's pinned raw image remains
# the process identity. No other reparse point or executable is accepted.
function Test-QaNgrokStoreManifest([xml]$Manifest){
 $identity=$Manifest.Package.Identity;$app=@($Manifest.SelectNodes('//*[local-name()="Application" and @Id="ngrok"]'));$aliases=@($Manifest.SelectNodes('//*[local-name()="ExecutionAlias" and @Alias="ngrok.exe"]'))
 return $identity.Name -ceq 'ngrok.ngrok' -and $identity.Version -ceq '3.39.11.0' -and $identity.ProcessorArchitecture -ceq 'x64' -and $app.Count -eq 1 -and $aliases.Count -eq 1 -and $app[0].Executable -ceq 'ngrok.exe' -and $app[0].EntryPoint -ceq 'Windows.FullTrustApplication'
}
function Get-QaVerifiedNgrokStoreAlias([string]$ExpectedImage,[string]$ExpectedHash,[string]$ApprovedHostPath){
 $suffix='\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe';$hostPath=[Environment]::ProcessPath
 if($PSVersionTable.PSVersion.Major -ne 7 -or (Get-ExecutionPolicy) -ne 'RemoteSigned' -or $hostPath -cne $ApprovedHostPath -or -not $hostPath.EndsWith($suffix,[StringComparison]::OrdinalIgnoreCase)){throw 'STORE_HOST_REFUSED'}
 Assert-QaNoReparse $hostPath
 if((Get-FileHash -LiteralPath $hostPath -Algorithm SHA256).Hash -cne '2A6769A3330DC1084D0154BFDE7D164AB750CA7F700F313F9D417C1BE78B2233'){throw 'STORE_HOST_REFUSED'}
 $package='C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc';$image=Join-Path $package 'ngrok.exe';$hash='6cca51c969e13ad038a608b015000815135a3148ce4bb6a6f63c8aa536198e16'
 if($ExpectedImage -cne $image -or $ExpectedHash -cne $hash){throw 'STORE_TARGET_REFUSED'}
 $profile=$hostPath.Substring(0,$hostPath.Length-$suffix.Length);$directory=Join-Path $profile 'AppData\Local\Microsoft\WindowsApps';$alias=Join-Path $directory 'ngrok.exe';Assert-QaNoReparse $directory
 foreach($file in @($image,(Join-Path $package 'AppxManifest.xml'),(Join-Path $package 'AppxSignature.p7x'))){Assert-QaNoReparse $file;if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw 'STORE_FILE_REFUSED'}}
 if((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash -or -not (Test-QaNgrokStoreManifest ([xml][IO.File]::ReadAllText((Join-Path $package 'AppxManifest.xml'))))){throw 'STORE_IMAGE_REFUSED'}
 if(-not ('QaNgrokStoreMetadata' -as [type])){
 Add-Type -WarningAction SilentlyContinue -TypeDefinition @'
using System;using System.IO;using System.Text;using System.Runtime.InteropServices;
public static class QaNgrokStoreMetadata {
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
 }
 if(-not [QaNgrokStoreMetadata]::Signature((Join-Path $package 'AppxSignature.p7x')) -or -not [QaNgrokStoreMetadata]::Alias($alias,$image)){throw 'STORE_ALIAS_REFUSED'}
 return [pscustomobject]@{LaunchAlias=$alias;AliasDirectory=$directory;VerifiedImage=$image;ImageSha256=$hash}
}
