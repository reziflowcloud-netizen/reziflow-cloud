param(
 [Parameter(Mandatory=$true)][string]$PointerPath,
 [Parameter(Mandatory=$true)][int]$ParentPid,
 [Parameter(Mandatory=$true)][string]$NodeExe,
 [switch]$CheckOnly
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$job=$null
$stage='host'
function Convert-QaDeadlineUtc([object]$Value){
 # ConvertFrom-Json on newer PowerShell returns typed DateTime values. Parsing
 # their culture-formatted string loses Kind/offset, so preserve the type first.
 if($Value -is [DateTimeOffset]){return $Value.ToUniversalTime()}
 if($Value -is [DateTime]){
  if($Value.Kind -eq [DateTimeKind]::Unspecified){throw 'DEADLINE_ZONE_REQUIRED'}
  return ([DateTimeOffset]::new($Value)).ToUniversalTime()
 }
 if($Value -isnot [string] -or $Value -notmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$'){throw 'DEADLINE_ISO_REQUIRED'}
 $parsed=[DateTimeOffset]::MinValue
 if(-not[DateTimeOffset]::TryParse($Value,[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$parsed)){throw 'DEADLINE_INVALID'}
 return $parsed.ToUniversalTime()
}
try {
 Set-StrictMode -Version Latest
 if($PSVersionTable.PSVersion.Major -ne 7 -or $PSVersionTable.PSEdition -ne 'Core' -or (Get-ExecutionPolicy) -ne 'RemoteSigned'){throw 'HOST_REFUSED'}
 . (Join-Path $PSScriptRoot 'guard.ps1')
 $stage='git_dependency'
 $gitExe='C:\Program Files\Git\cmd\git.exe'
 Assert-QaNoReparse $gitExe
 if(-not(Test-Path -LiteralPath $gitExe -PathType Leaf) -or (Get-Command git.exe -CommandType Application -ErrorAction Stop).Source -ne $gitExe){throw 'GIT_DEPENDENCY_REFUSED'}
 $stage='runtime'
 $qa=Read-QaGuardedRuntime $PointerPath
 $c=$qa.Runtime
 if([Environment]::ProcessPath -ne $c.qaPwshExecutable -or $NodeExe -ne 'C:\Program Files\nodejs\node.exe' -or $c.appId -ne '2523488421395251' -or $c.approvedMetaAppId -ne $c.appId -or $c.pageId -ne '1449474971582722' -or $c.formId -ne '2046130655900851'){throw 'TARGET_REFUSED'}
 $stage='approval';$approval=$c.supervisorApproval
 $deadline=Convert-QaDeadlineUtc $approval.deadlineAt
 if($deadline -le [DateTimeOffset]::UtcNow -or $deadline -gt [DateTimeOffset]::UtcNow.AddMinutes(35) -or $c.ngrokExe -ne $approval.ngrokExe -or $approval.fullCaptureDisabled -ne $true -or $approval.freePlanVerified -ne $true){throw 'APPROVAL_REFUSED'}
 $stage='executables';foreach($file in @($NodeExe,$c.ngrokExe)){Assert-QaNoReparse $file;if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw 'EXECUTABLE_REFUSED'}}
 if((Get-FileHash -LiteralPath $c.ngrokExe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $approval.ngrokSha256){throw 'EXECUTABLE_CHANGED'}
 $stage='private_acl';foreach($leaf in @('meta-app-secret.txt','meta-page-token.txt','meta-real-private.json','ngrok.yml')){Assert-QaPrivateAcl (Join-Path $c.privateDirectory $leaf)}
 $stage='parent'
 $self=Get-CimInstance Win32_Process -Filter ('ProcessId='+$PID)
 $parent=Get-CimInstance Win32_Process -Filter ('ProcessId='+$ParentPid)
 $owner=Invoke-CimMethod -InputObject $parent -MethodName GetOwnerSid
 if($self.ParentProcessId -ne $ParentPid -or $parent.ExecutablePath -ne $NodeExe -or $owner.ReturnValue -ne 0 -or $owner.Sid -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value){throw 'PARENT_REFUSED'}
 if($CheckOnly){[Console]::Out.WriteLine('{"status":"VALIDATED"}');return}
 # CheckOnly is also used while our app is running. Occupancy checks belong
 # only to the actual guardian and each relevant launch/readiness command.
 function Get-QaHttpListeners([int]$Port){return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)}
 function Assert-QaHttpOwner([int]$Port,[int]$ExpectedPid,[switch]$AllowAbsent){
  $listeners=@(Get-QaHttpListeners $Port)
  if($AllowAbsent -and $listeners.Count -eq 0){return $false}
  if($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1' -or $listeners[0].OwningProcess -ne $ExpectedPid){throw 'HTTP_OWNER_REFUSED'}
  return $true
 }
 $stage='http_ports';foreach($port in @([int]$c.appPort,[int]$c.gatePort)){if(@(Get-QaHttpListeners $port).Count){throw 'HTTP_PORT_BUSY'}}
 # No shell, no PID/name based termination. Each child is created suspended,
 # assigned to this unnamed Job, then resumed. The Job handle is never inherited.
 # Native retained handles avoid PID reuse. Closing the guardian kills its Job.
 $stage='native_job'
 Add-Type -WarningAction SilentlyContinue -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public sealed class QaOwnedJob : IDisposable {
 [StructLayout(LayoutKind.Sequential)] struct SA { public int length; public IntPtr descriptor; public int inherit; }
 [StructLayout(LayoutKind.Sequential)] struct SI {public int cb; public IntPtr reserved,desktop,title; public uint x,y,xSize,ySize,xChars,yChars,fill,flags; public ushort show,reserved2; public IntPtr reserved3,input,output,error;}
 [StructLayout(LayoutKind.Sequential)] struct SIX { public SI si; public IntPtr attributes; }
 [StructLayout(LayoutKind.Sequential)] struct PI {public IntPtr process,thread; public uint pid,tid;}
 [StructLayout(LayoutKind.Sequential)] struct Basic {public long processTime,jobTime; public uint flags; public UIntPtr min,max; public uint active; public UIntPtr affinity; public uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)] struct IO {public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes;}
 [StructLayout(LayoutKind.Sequential)] struct Extended {public Basic basic; public IO io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
 [StructLayout(LayoutKind.Sequential)] struct Accounting {public long user,kernel,periodUser,periodKernel;public uint faults,total,active,terminated;}
 [StructLayout(LayoutKind.Sequential)] struct FT { public uint low,high; public long Value {get{return ((long)high<<32)|low;}} }
 sealed class Owned {public IntPtr handle;public uint pid;public string exe;public long born;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObjectW(IntPtr a,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int type,ref Extended info,uint len);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int type,out Accounting info,uint len,IntPtr ret);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out FT created,out FT exit,out FT kernel,out FT user);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageNameW(IntPtr process,uint flags,StringBuilder text,ref uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFileW(string name,uint access,uint share,ref SA sa,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr retSize);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string exe,StringBuilder line,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SIX startup,out PI info);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 IntPtr job,parent; readonly Dictionary<string,Owned> children=new Dictionary<string,Owned>();
 static Exception Refused(){return new InvalidOperationException("OWNED_JOB_REFUSED");}
 static long Born(IntPtr handle){FT c,e,k,u;if(!GetProcessTimes(handle,out c,out e,out k,out u))throw Refused();return c.Value;}
 static string Image(IntPtr handle){var s=new StringBuilder(32768);uint n=(uint)s.Capacity;if(!QueryFullProcessImageNameW(handle,0,s,ref n))throw Refused();return s.ToString();}
 static string Quote(string arg){if(arg==null||arg.IndexOf('\0')>=0)throw Refused();var b=new StringBuilder("\"");int slash=0;foreach(char x in arg){if(x=='\\'){slash++;continue;}if(x=='\"'){b.Append('\\',slash*2+1);b.Append(x);slash=0;continue;}b.Append('\\',slash);slash=0;b.Append(x);}b.Append('\\',slash*2);b.Append('"');return b.ToString();}
 public QaOwnedJob(int parentPid,string expectedParent){
  parent=OpenProcess(0x101000,false,parentPid);if(parent==IntPtr.Zero||!String.Equals(Image(parent),expectedParent,StringComparison.OrdinalIgnoreCase)||WaitForSingleObject(parent,0)!=258)throw Refused();
  job=CreateJobObjectW(IntPtr.Zero,null);if(job==IntPtr.Zero)throw Refused();var limit=new Extended();limit.basic.flags=0x2000;
  if(!SetInformationJobObject(job,9,ref limit,(uint)Marshal.SizeOf<Extended>()))throw Refused();
 }
 public bool ParentAlive(){return parent!=IntPtr.Zero&&WaitForSingleObject(parent,0)==258;}
 public int ActiveCount(){Accounting a;if(!QueryInformationJobObject(job,1,out a,(uint)Marshal.SizeOf<Accounting>(),IntPtr.Zero))return -1;return (int)a.active;}
 public bool ChildAlive(string kind){Owned o;return children.TryGetValue(kind,out o)&&WaitForSingleObject(o.handle,0)==258;}
 public uint Launch(string kind,string exe,string[] args,string cwd,string[] envPairs){
  if(!ParentAlive()||(kind!="app"&&kind!="tunnel")||ChildAlive(kind))throw Refused();
  var env=String.Join("\0",envPairs)+"\0\0";var block=Marshal.StringToHGlobalUni(env);var line=new StringBuilder(Quote(exe));foreach(var a in args)line.Append(' ').Append(Quote(a));
  var sa=new SA{length=Marshal.SizeOf<SA>(),inherit=1};IntPtr nul=IntPtr.Zero,attrs=IntPtr.Zero,list=IntPtr.Zero;var pi=new PI();bool attributesReady=false;
  try{
   nul=CreateFileW("NUL",0xC0000000,3,ref sa,3,0,IntPtr.Zero);if(nul==new IntPtr(-1))throw Refused();IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);attrs=Marshal.AllocHGlobal(size);
   if(!InitializeProcThreadAttributeList(attrs,1,0,ref size))throw Refused();attributesReady=true;list=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(list,nul);
   if(!UpdateProcThreadAttribute(attrs,0,new IntPtr(0x20002),list,new IntPtr(IntPtr.Size),IntPtr.Zero,IntPtr.Zero))throw Refused();
   var si=new SIX();si.si.cb=Marshal.SizeOf<SIX>();si.si.flags=0x100;si.si.input=nul;si.si.output=nul;si.si.error=nul;si.attributes=attrs;
   if(!CreateProcessW(exe,line,IntPtr.Zero,IntPtr.Zero,true,0x08080404,block,cwd,ref si,out pi))throw Refused();
   if(!AssignProcessToJobObject(job,pi.process))throw Refused();
   var record=new Owned{handle=pi.process,pid=pi.pid,exe=exe,born=Born(pi.process)};
   if(!String.Equals(Image(pi.process),exe,StringComparison.OrdinalIgnoreCase)||record.born<=0)throw Refused();
   if(ResumeThread(pi.thread)==0xFFFFFFFF)throw Refused();Owned old;if(children.TryGetValue(kind,out old))CloseHandle(old.handle);children[kind]=record;pi.process=IntPtr.Zero;return record.pid;
  }finally{
   if(pi.process!=IntPtr.Zero){TerminateProcess(pi.process,1);WaitForSingleObject(pi.process,5000);CloseHandle(pi.process);}
   if(pi.thread!=IntPtr.Zero)CloseHandle(pi.thread);if(attrs!=IntPtr.Zero){if(attributesReady)DeleteProcThreadAttributeList(attrs);Marshal.FreeHGlobal(attrs);}if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);if(nul!=IntPtr.Zero&&nul!=new IntPtr(-1))CloseHandle(nul);Marshal.FreeHGlobal(block);
  }
 }
 public void StopChild(string kind){Owned o;if(!children.TryGetValue(kind,out o))throw Refused();if(WaitForSingleObject(o.handle,0)==258){if(Born(o.handle)!=o.born||!String.Equals(Image(o.handle),o.exe,StringComparison.OrdinalIgnoreCase))throw Refused();if(!TerminateProcess(o.handle,0)||WaitForSingleObject(o.handle,5000)!=0)throw Refused();}}
 public bool StopAll(){if(job==IntPtr.Zero)return true;if(!TerminateJobObject(job,0))return false;for(int n=0;n<100;n++){Accounting a;if(!QueryInformationJobObject(job,1,out a,(uint)Marshal.SizeOf<Accounting>(),IntPtr.Zero))return false;bool signalled=true;foreach(var o in children.Values)if(WaitForSingleObject(o.handle,0)!=0)signalled=false;if(a.active==0&&signalled)return true;Thread.Sleep(50);}return false;}
 public void Dispose(){if(job!=IntPtr.Zero){CloseHandle(job);job=IntPtr.Zero;}foreach(var o in children.Values)CloseHandle(o.handle);children.Clear();if(parent!=IntPtr.Zero){CloseHandle(parent);parent=IntPtr.Zero;}}
}
'@
 $job=[QaOwnedJob]::new($ParentPid,$NodeExe)
 $kinds=[Collections.Generic.HashSet[string]]::new()
 $appPid=0
 [Console]::Out.WriteLine('{"status":"READY"}')
 $read=[Console]::In.ReadLineAsync()
 $stopping=$false
 while(-not $stopping){
  $stage='health'
  if(-not $job.ParentAlive() -or [DateTimeOffset]::UtcNow -ge $deadline){break}
  foreach($kind in $kinds){if(-not $job.ChildAlive($kind)){throw 'CHILD_EXITED'}}
  if(-not $read.Wait(200)){continue}
  $line=$read.Result
  if($null -eq $line){break}
  if($line.Length -gt 65536){throw 'COMMAND_SIZE'}
  $command=$line|ConvertFrom-Json
  switch($command.command){
   'launch' {
    if($command.kind -notin @('app','tunnel') -or $command.enabled -isnot [bool]){throw 'COMMAND_REFUSED'}
    if($command.kind -eq 'app'){
     $stage='launch_app'
     if(@(Get-QaHttpListeners ([int]$c.appPort)).Count){throw 'APP_PORT_BUSY'}
     if($command.exe -ne $NodeExe -or ($command.enabled -and $approval.allowEnable -ne $true)){throw 'APP_REFUSED'}
     $expected=@('--require',(Join-Path $PSScriptRoot 'supervisor-egress.cjs'),(Join-Path $c.repo 'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p',[string]$c.appPort)
     if($command.env.DATABASE_URL -ne $c.databaseUrl -or $command.env.DIRECT_URL -ne $c.databaseUrl -or $command.env.META_LEAD_ADS_APP_ID -ne $c.appId -or $command.env.WEB_PUSH_ENABLED -ne 'false' -or $command.env.META_LEAD_ADS_RETENTION_ENABLED -ne 'false' -or $command.env.META_LEAD_ADS_ENABLED -ne ([string]$command.enabled).ToLowerInvariant() -or $command.env.META_LEAD_ADS_WORKER_ENABLED -ne ([string]$command.enabled).ToLowerInvariant()){throw 'APP_ENV_REFUSED'}
    }else{
     $stage='launch_tunnel'
     [void](Assert-QaHttpOwner ([int]$c.gatePort) $ParentPid)
     if($command.exe -ne $c.ngrokExe -or $approval.allowTunnel -ne $true -or $command.enabled){throw 'TUNNEL_REFUSED'}
     Assert-QaPrivateAcl (Join-Path $c.privateDirectory 'ngrok.yml')
     $yaml=([IO.File]::ReadAllText((Join-Path $c.privateDirectory 'ngrok.yml'))).Replace("`r",'').Trim()
     if($yaml -notmatch '\Aversion: "3"\nagent:\n  authtoken: "[A-Za-z0-9_-]{20,512}"\n  console_ui: false\n  inspect_db_size: -1\n  web_addr: false\n  log: false\n  remote_management: false\z'){throw 'NGROK_CONFIG_REFUSED'}
     $expected=@('http',('http://127.0.0.1:'+$c.gatePort),'--url',('https://'+$c.hostname),'--inspect=false','--config',(Join-Path $c.privateDirectory 'ngrok.yml'))
    }
    $allowed=@('SystemRoot','WINDIR','PATH','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')
    if($command.kind -eq 'app'){$allowed+=@('NODE_ENV','NEXT_TELEMETRY_DISABLED','DATABASE_URL','DIRECT_URL','JWT_SECRET','NOTIFICATIONS_ENABLED','NOTIFICATION_EVENTS_ENABLED','NOTIFICATION_SCHEDULED_EVENTS_ENABLED','WEB_PUSH_ENABLED','META_LEAD_ADS_APP_ID','META_LEAD_ADS_APP_SECRET','META_LEAD_ADS_VERIFY_TOKEN','META_LEAD_ADS_RECEIPT_HMAC_KEY','META_LEAD_ADS_WORKER_SECRET','META_LEAD_ADS_ENABLED','META_LEAD_ADS_WORKER_ENABLED','META_LEAD_ADS_RETENTION_ENABLED','META_LEAD_ADS_APPROVED_TUPLES','META_LEAD_ADS_PILOT_ORGANIZATION_ID','META_LEAD_ADS_GRAPH_VERSION','META_LEAD_ADS_ACTIVATED_AT','QA_REAL_CONFIG');if($command.enabled){$allowed+=('META_LEAD_ADS_PAGE_TOKEN_'+$c.pageId)}}
    if(@($command.env.PSObject.Properties).Count -ne $allowed.Count -or $command.env.SystemRoot -ne 'C:\Windows' -or $command.env.WINDIR -ne 'C:\Windows' -or $command.env.PATH -ne 'C:\Windows\System32;C:\Program Files\nodejs'){throw 'ENV_REFUSED'}
    foreach($name in @('TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA')){if($command.env.$name -ne $c.privateDirectory){throw 'ENV_REFUSED'}}
    if(@($command.args).Count -ne $expected.Count){throw 'ARGUMENTS_REFUSED'}
    for($i=0;$i -lt $expected.Count;$i++){if($command.args[$i] -cne $expected[$i]){throw 'ARGUMENTS_REFUSED'}}
    $pairs=[Collections.Generic.List[string]]::new()
    foreach($property in $command.env.PSObject.Properties){if($property.Name -cnotin $allowed -or [string]$property.Value -match "`0"){throw 'ENV_REFUSED'};$pairs.Add($property.Name+'='+[string]$property.Value)}
    $pairs.Sort([StringComparer]::OrdinalIgnoreCase)
    $childPid=$job.Launch($command.kind,$command.exe,[string[]]$command.args,$c.repo,$pairs.ToArray())
    if($command.kind -eq 'app'){$appPid=[int]$childPid}
    [void]$kinds.Add($command.kind)
    [Console]::Out.WriteLine((@{status='LAUNCHED';kind=$command.kind;pid=$childPid}|ConvertTo-Json -Compress))
   }
   'stopChild' {$stage='stop_child';if($command.kind -ne 'app'){throw 'STOP_KIND_REFUSED'};$job.StopChild('app');[void]$kinds.Remove('app');[Console]::Out.WriteLine('{"status":"CHILD_STOPPED","kind":"app"}')}
   'appReady' {$stage='app_ready';if($appPid -le 0 -or -not $kinds.Contains('app')){throw 'APP_NOT_LAUNCHED'};if(Assert-QaHttpOwner ([int]$c.appPort) $appPid -AllowAbsent){[Console]::Out.WriteLine('{"status":"APP_READY"}')}else{[Console]::Out.WriteLine('{"status":"APP_WAIT"}')}}
   'health' {if($kinds.Contains('app')){[void](Assert-QaHttpOwner ([int]$c.appPort) $appPid -AllowAbsent)};if($kinds.Contains('tunnel')){[void](Assert-QaHttpOwner ([int]$c.gatePort) $ParentPid)};[Console]::Out.WriteLine('{"status":"HEALTHY"}')}
   'stop' {$stopping=$true}
   default {throw 'COMMAND_REFUSED'}
  }
  if(-not $stopping){$read=[Console]::In.ReadLineAsync()}
 }
 $stage='stop';if(-not $job.StopAll()){throw 'STOP_UNVERIFIED'}
 [Console]::Out.WriteLine('{"status":"STOPPED"}')
}catch{
 if($job){try{[void]$job.StopAll()}catch{}}
 [Console]::Out.WriteLine((@{status='BLOCKED';stage=$stage}|ConvertTo-Json -Compress))
 exit 1
}finally{
 if($job){$job.Dispose()}
}
