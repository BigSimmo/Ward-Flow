$ErrorActionPreference = 'Stop'
# Keep the native job handle alive until every process assigned to it has exited.
# The root is suspended until assignment, so even an immediately detached child
# remains in this job. Closing our handle on interruption terminates the job.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.IO;
public static class WardOwnedJob {
  public static bool Completed = false;
  public static string FailureMessage = null;
  static long Now() { return DateTime.UtcNow.Ticks / TimeSpan.TicksPerMillisecond; }
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO {
    public uint cb; public string reserved; public string desktop; public string title;
    public uint x,y,xsize,ysize,xchars,ychars,fill,flags; public ushort show,reserved2;
    public IntPtr reservedPtr,input,output,error;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr process,thread; public uint pid,tid; }
  [StructLayout(LayoutKind.Sequential)] struct LIMIT { public long perProcess,perJob; public uint flags; public UIntPtr min,max; public uint active; public UIntPtr affinity; public uint priority,scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct IO { public ulong reads,writes,others,readBytes,writeBytes,otherBytes; }
  [StructLayout(LayoutKind.Sequential)] struct EXTENDED { public LIMIT basic; public IO io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
  [StructLayout(LayoutKind.Sequential)] struct ACCOUNTING { public long user,kernel,thisUser,thisKernel; public uint faults,total,active,terminated; }
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security,string name);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr data,uint length);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out ACCOUNTING data,uint length,IntPtr returned);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string application,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string directory,ref STARTUPINFO startup,out PROCESS_INFORMATION process);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint millis);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
  static string Quote(string value) {
    var b = new StringBuilder("\""); int slashes=0;
    foreach(char c in value) {
      if(c=='\\') { slashes++; continue; }
      if(c=='\"') b.Append('\\',slashes*2+1); else b.Append('\\',slashes);
      b.Append(c); slashes=0;
    }
    return b.Append('\\',slashes*2).Append('"').ToString();
  }
  static Exception Failure() { return new Win32Exception(Marshal.GetLastWin32Error()); }
  public static int Run(string command,string[] args,string cwd,bool verbatim,int survivorTimeout,string cancelFile,string cancelToken) {
    IntPtr job=IntPtr.Zero; PROCESS_INFORMATION pi=new PROCESS_INFORMATION(); bool assigned=false;
    try {
      job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero) throw Failure();
      var limit=new EXTENDED(); limit.basic.flags=0x2000; // KILL_ON_JOB_CLOSE; no breakaway permission
      int size=Marshal.SizeOf(limit); IntPtr ptr=Marshal.AllocHGlobal(size);
      try { Marshal.StructureToPtr(limit,ptr,false); if(!SetInformationJobObject(job,9,ptr,(uint)size)) throw Failure(); }
      finally { Marshal.FreeHGlobal(ptr); }
      var line=new StringBuilder(Quote(command)); foreach(string arg in args) line.Append(' ').Append(verbatim ? arg : Quote(arg));
      var startup=new STARTUPINFO(); startup.cb=(uint)Marshal.SizeOf(startup); startup.flags=0x100;
      startup.input=GetStdHandle(-10); startup.output=GetStdHandle(-11); startup.error=GetStdHandle(-12);
      if(!CreateProcess(null,line,IntPtr.Zero,IntPtr.Zero,true,0x00000004 | 0x08000000,IntPtr.Zero,cwd,ref startup,out pi)) throw Failure();
      if(!AssignProcessToJobObject(job,pi.process)) throw Failure(); assigned=true;
      if(ResumeThread(pi.thread)==0xffffffff) throw Failure();
      long rootExit=0; bool timedOut=false,cancelled=false;
      for(;;) {
        ACCOUNTING accounting;
        if(!QueryInformationJobObject(job,1,out accounting,(uint)Marshal.SizeOf(typeof(ACCOUNTING)),IntPtr.Zero)) throw Failure();
        if(accounting.active==0) break;
        if(File.Exists(cancelFile) && File.ReadAllText(cancelFile)==cancelToken) {
          cancelled=true; if(!TerminateJobObject(job,130)) throw Failure(); break;
        }
        if(WaitForSingleObject(pi.process,0)==0) {
          if(rootExit==0) rootExit=Now();
          if(Now()-rootExit>survivorTimeout) { timedOut=true; if(!TerminateJobObject(job,125)) throw Failure(); break; }
        }
        Thread.Sleep(20);
      }
      if(timedOut || cancelled) {
        long deadline=Now()+5000;
        for(;;) {
          ACCOUNTING accounting;
          if(!QueryInformationJobObject(job,1,out accounting,(uint)Marshal.SizeOf(typeof(ACCOUNTING)),IntPtr.Zero)) throw Failure();
          if(accounting.active==0) break;
          if(Now()>deadline) throw new Exception("Owned job termination could not be established");
          Thread.Sleep(20);
        }
        Completed=true;
        if(cancelled) return 130;
        Console.Error.WriteLine("Owned child left descendants running after exit; its job was terminated."); return 125;
      }
      uint code; if(!GetExitCodeProcess(pi.process,out code)) throw Failure(); Completed=true; return unchecked((int)code);
    } catch(Exception e) { FailureMessage=e.Message; if(pi.process==IntPtr.Zero) Completed=true; Console.Error.WriteLine("Owned Windows job failed: "+e.Message); return 126; }
    finally {
      if(pi.process!=IntPtr.Zero && !assigned) TerminateProcess(pi.process,126);
      if(job!=IntPtr.Zero) CloseHandle(job);
      if(pi.thread!=IntPtr.Zero) CloseHandle(pi.thread);
      if(pi.process!=IntPtr.Zero) CloseHandle(pi.process);
    }
  }
}
'@
$payload = [Console]::In.ReadLine() | ConvertFrom-Json
$status = [WardOwnedJob]::Run([string]$payload.command, [string[]]$payload.args, [string]$payload.cwd, [bool]$payload.verbatim, [int]$payload.survivorTimeout, [string]$payload.cancelFile, [string]$payload.cancelToken)
@{ status=$status; completed=[WardOwnedJob]::Completed; error=[WardOwnedJob]::FailureMessage } | ConvertTo-Json -Compress | Set-Content -LiteralPath $payload.receipt -Encoding UTF8
exit $status
