using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
// Test-only registered-alias fixture. The launch path is not the retained image.
public sealed class QaAliasVersionJob : IDisposable {
 [StructLayout(LayoutKind.Sequential)] struct SA { public int length; public IntPtr descriptor; public int inherit; }
 [StructLayout(LayoutKind.Sequential)] struct SI {public int cb; public IntPtr reserved,desktop,title; public uint x,y,xSize,ySize,xChars,yChars,fill,flags; public ushort show,reserved2; public IntPtr reserved3,input,output,error;}
 [StructLayout(LayoutKind.Sequential)] struct SIX { public SI si; public IntPtr attributes; }
 [StructLayout(LayoutKind.Sequential)] struct PI {public IntPtr process,thread; public uint pid,tid;}
 [StructLayout(LayoutKind.Sequential)] struct Basic {public long processTime,jobTime; public uint flags; public UIntPtr min,max; public uint active; public UIntPtr affinity; public uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)] struct IO {public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes;}
 [StructLayout(LayoutKind.Sequential)] struct Extended {public Basic basic; public IO io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
 [StructLayout(LayoutKind.Sequential)] struct Accounting {public long user,kernel,periodUser,periodKernel;public uint faults,total,active,terminated;}
 [StructLayout(LayoutKind.Sequential)] struct FT { public uint low,high; public long Value {get{return ((long)high<<32)|low;}} }
 sealed class Owned {public IntPtr handle,job;public uint pid;public string exe;public long born;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObjectW(IntPtr a,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int type,ref Extended info,uint len);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int type,out Accounting info,uint len,IntPtr ret);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out FT created,out FT exit,out FT kernel,out FT user);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageNameW(IntPtr process,uint flags,StringBuilder text,ref uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFileW(string name,uint access,uint share,ref SA sa,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr retSize);
 [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string exe,StringBuilder line,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SIX startup,out PI info);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 const string NodeImage=@"C:\Program Files\nodejs\node.exe";
 const string RawImage=@"C:\Program Files\WindowsApps\ngrok.ngrok_3.39.11.0_x64__1g87z0zv29zzc\ngrok.exe";
 readonly string approvedAlias;
 IntPtr parent; readonly Dictionary<string,Owned> children=new Dictionary<string,Owned>();
 public static bool ValidTarget(string kind,string launchExecutable,string verifiedImage,string[] args,string alias){
  if(args==null||String.IsNullOrEmpty(launchExecutable)||String.IsNullOrEmpty(verifiedImage)||String.IsNullOrEmpty(alias))return false;
  if(kind=="app")return String.Equals(launchExecutable,NodeImage,StringComparison.OrdinalIgnoreCase)&&String.Equals(verifiedImage,NodeImage,StringComparison.OrdinalIgnoreCase)&&args.Length==2&&args[0]!=null&&args[0].EndsWith(@"\supervisor-fake-child.mjs",StringComparison.OrdinalIgnoreCase)&&args[1]=="--descendant";
  return kind=="tunnel"&&String.Equals(launchExecutable,alias,StringComparison.OrdinalIgnoreCase)&&String.Equals(verifiedImage,RawImage,StringComparison.OrdinalIgnoreCase)&&args.Length==1&&args[0]=="version";
 }
 public static string LastOperation {get;private set;}
 public static int LastNativeCode {get;private set;}
 static Exception Refused(){LastOperation="configuration";LastNativeCode=0;return new InvalidOperationException("OWNED_JOB_REFUSED");}
 static Exception NativeRefused(string operation){LastOperation=operation;LastNativeCode=Marshal.GetLastWin32Error();return new InvalidOperationException("OWNED_JOB_NATIVE_REFUSED");}
 static long Born(IntPtr handle){FT c,e,k,u;if(!GetProcessTimes(handle,out c,out e,out k,out u))throw NativeRefused("query_time");return c.Value;}
 static string Image(IntPtr handle){var s=new StringBuilder(32768);uint n=(uint)s.Capacity;if(!QueryFullProcessImageNameW(handle,0,s,ref n))throw NativeRefused("query_image");return s.ToString();}
 static string Quote(string arg){if(arg==null||arg.IndexOf('\0')>=0)throw Refused();var b=new StringBuilder("\"");int slash=0;foreach(char x in arg){if(x=='\\'){slash++;continue;}if(x=='\"'){b.Append('\\',slash*2+1);b.Append(x);slash=0;continue;}b.Append('\\',slash);slash=0;b.Append(x);}b.Append('\\',slash*2);b.Append('"');return b.ToString();}
 public QaAliasVersionJob(int parentPid,string expectedParent,string knownAlias){
  if(String.IsNullOrEmpty(knownAlias)||knownAlias.IndexOf('\0')>=0||!System.IO.Path.IsPathFullyQualified(knownAlias)||!knownAlias.StartsWith(@"C:\Users\",StringComparison.OrdinalIgnoreCase)||!knownAlias.EndsWith(@"\AppData\Local\Microsoft\WindowsApps\ngrok.exe",StringComparison.OrdinalIgnoreCase))throw Refused();approvedAlias=knownAlias;
  try{parent=OpenProcess(0x101000,false,parentPid);if(parent==IntPtr.Zero)throw NativeRefused("open_parent");if(!String.Equals(Image(parent),expectedParent,StringComparison.OrdinalIgnoreCase)||WaitForSingleObject(parent,0)!=258)throw Refused();}
  catch{if(parent!=IntPtr.Zero){CloseHandle(parent);parent=IntPtr.Zero;}throw;}
 }
 static IntPtr NewEmptyJob(){var handle=CreateJobObjectW(IntPtr.Zero,null);if(handle==IntPtr.Zero)throw NativeRefused("create_job");try{var limit=new Extended();limit.basic.flags=0x2000;if(!SetInformationJobObject(handle,9,ref limit,(uint)Marshal.SizeOf<Extended>()))throw NativeRefused("job_limits");return handle;}catch{CloseHandle(handle);throw;}}
 public bool ParentAlive(){return parent!=IntPtr.Zero&&WaitForSingleObject(parent,0)==258;}
 public int ActiveCount(){int total=0;foreach(var o in children.Values){Accounting a;if(!QueryInformationJobObject(o.job,1,out a,(uint)Marshal.SizeOf<Accounting>(),IntPtr.Zero))return -1;total=checked(total+(int)a.active);}return total;}
 public bool ChildAlive(string kind){Owned o;return children.TryGetValue(kind,out o)&&WaitForSingleObject(o.handle,0)==258;}
 public uint ChildExitCode(string kind){Owned o;uint code;if(!children.TryGetValue(kind,out o))throw Refused();if(!GetExitCodeProcess(o.handle,out code))throw NativeRefused("exit_code");return code;}
 public uint Launch(string kind,string exe,string verifiedImage,string[] args,string cwd,string[] envPairs){
  if(!ParentAlive()||(kind!="app"&&kind!="tunnel")||ChildAlive(kind))throw Refused();
  if(!ValidTarget(kind,exe,verifiedImage,args,approvedAlias))throw Refused();
  if(children.ContainsKey(kind))StopChild(kind);
  // Each kind/generation gets an EMPTY target Job. The child keeps all its
  // inherited jobs; no breakaway/UI/security-limit change is requested.
  IntPtr childJob=IntPtr.Zero,block=IntPtr.Zero;
  var env=String.Join("\0",envPairs)+"\0\0";var line=new StringBuilder(Quote(exe));foreach(var a in args)line.Append(' ').Append(Quote(a));
  var sa=new SA{length=Marshal.SizeOf<SA>(),inherit=1};IntPtr nul=IntPtr.Zero,attrs=IntPtr.Zero,list=IntPtr.Zero;var pi=new PI();bool attributesReady=false;
  try{
   childJob=NewEmptyJob();block=Marshal.StringToHGlobalUni(env);
   nul=CreateFileW("NUL",0xC0000000,3,ref sa,3,0,IntPtr.Zero);if(nul==new IntPtr(-1))throw NativeRefused("open_nul");IntPtr size=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);attrs=Marshal.AllocHGlobal(size);
   if(!InitializeProcThreadAttributeList(attrs,1,0,ref size))throw NativeRefused("attributes_init");attributesReady=true;list=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(list,nul);
   if(!UpdateProcThreadAttribute(attrs,0,new IntPtr(0x20002),list,new IntPtr(IntPtr.Size),IntPtr.Zero,IntPtr.Zero))throw NativeRefused("attributes_update");
   var si=new SIX();si.si.cb=Marshal.SizeOf<SIX>();si.si.flags=0x100;si.si.input=nul;si.si.output=nul;si.si.error=nul;si.attributes=attrs;
   if(!CreateProcessW(exe,line,IntPtr.Zero,IntPtr.Zero,true,0x08080404,block,cwd,ref si,out pi))throw NativeRefused("create_process");
   if(!AssignProcessToJobObject(childJob,pi.process))throw NativeRefused("assign_job");
   var record=new Owned{handle=pi.process,job=childJob,pid=pi.pid,exe=verifiedImage,born=Born(pi.process)};
   if(!String.Equals(Image(pi.process),verifiedImage,StringComparison.OrdinalIgnoreCase)||record.born<=0)throw Refused();
   if(!ParentAlive())throw Refused();
   uint suspended=ResumeThread(pi.thread);if(suspended==0xFFFFFFFF)throw NativeRefused("resume_thread");if(suspended!=1)throw Refused();children.Add(kind,record);pi.process=IntPtr.Zero;childJob=IntPtr.Zero;return record.pid;
  }finally{
   if(childJob!=IntPtr.Zero)TerminateJobObject(childJob,1);
   if(pi.process!=IntPtr.Zero){TerminateProcess(pi.process,1);WaitForSingleObject(pi.process,5000);CloseHandle(pi.process);}
   if(childJob!=IntPtr.Zero)CloseHandle(childJob);
   if(pi.thread!=IntPtr.Zero)CloseHandle(pi.thread);if(attrs!=IntPtr.Zero){if(attributesReady)DeleteProcThreadAttributeList(attrs);Marshal.FreeHGlobal(attrs);}if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);if(nul!=IntPtr.Zero&&nul!=new IntPtr(-1))CloseHandle(nul);if(block!=IntPtr.Zero)Marshal.FreeHGlobal(block);
  }
 }
 static bool Drained(Owned o){Accounting a;bool accounting=QueryInformationJobObject(o.job,1,out a,(uint)Marshal.SizeOf<Accounting>(),IntPtr.Zero);uint waited=WaitForSingleObject(o.handle,0);return accounting&&a.active==0&&waited==0;}
 static void CloseOwned(Owned o){if(o.job!=IntPtr.Zero){CloseHandle(o.job);o.job=IntPtr.Zero;}if(o.handle!=IntPtr.Zero){CloseHandle(o.handle);o.handle=IntPtr.Zero;}}
 public void StopChild(string kind){Owned o;if(!children.TryGetValue(kind,out o))throw Refused();if(WaitForSingleObject(o.handle,0)==258&&(Born(o.handle)!=o.born||!String.Equals(Image(o.handle),o.exe,StringComparison.OrdinalIgnoreCase)))throw Refused();if(!TerminateJobObject(o.job,0))throw NativeRefused("terminate_job");for(int n=0;n<100;n++){if(Drained(o)){children.Remove(kind);CloseOwned(o);return;}Thread.Sleep(50);}throw Refused();}
 public bool StopAll(){bool terminated=true;foreach(var o in children.Values)if(!TerminateJobObject(o.job,0))terminated=false;for(int n=0;n<100;n++){bool drained=true;foreach(var o in children.Values)if(!Drained(o))drained=false;if(drained)return terminated;Thread.Sleep(50);}return false;}
 public void Dispose(){foreach(var o in children.Values)CloseOwned(o);children.Clear();if(parent!=IntPtr.Zero){CloseHandle(parent);parent=IntPtr.Zero;}}
}
