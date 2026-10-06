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
using System.Diagnostics;
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
  static void PublishLaunch(string file,string token,string adapterHash,int guardianPid,uint rootPid) {
    string guardianCreated;
    using(var guardian=Process.GetProcessById(guardianPid)) guardianCreated=guardian.StartTime.ToUniversalTime().ToString("o");
    string adapterCreated;
    using(var adapter=Process.GetCurrentProcess()) adapterCreated=adapter.StartTime.ToUniversalTime().ToString("o");
    if(!System.Text.RegularExpressions.Regex.IsMatch(token,"^[0-9a-f-]{36}$") || !System.Text.RegularExpressions.Regex.IsMatch(adapterHash,"^[0-9a-f]{64}$")) throw new Exception("Invalid launch identity");
    string data="{\"token\":\""+token+"\",\"assigned\":true,\"rootPid\":"+rootPid+",\"adapterSha256\":\""+adapterHash+"\",\"guardianIdentity\":{\"pid\":"+guardianPid+",\"createdAt\":\""+guardianCreated+"\"},\"adapterIdentity\":{\"pid\":"+Process.GetCurrentProcess().Id+",\"createdAt\":\""+adapterCreated+"\"}}";
    string temporary=file+".tmp";
    using(var stream=new FileStream(temporary,FileMode.CreateNew,FileAccess.Write,FileShare.None)) {
      byte[] bytes=Encoding.UTF8.GetBytes(data); stream.Write(bytes,0,bytes.Length); stream.Flush(true);
    }
    File.Move(temporary,file); // Publish only complete flushed receipt bytes.
  }
  public static int Run(string command,string[] args,string cwd,bool verbatim,int survivorTimeout,string cancelFile,string cancelToken,string launchReceipt,string acknowledgeFile,string launchToken,string adapterHash,int guardianPid) {
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
      // The root remains suspended until the guardian has durably bound this
      // actual adapter identity and assignment receipt to its child record.
      PublishLaunch(launchReceipt,launchToken,adapterHash,guardianPid,pi.pid);
      long acknowledgeDeadline=Now()+15000;
      for(;;) {
        if(Now()>acknowledgeDeadline) throw new Exception("Guardian did not acknowledge launch evidence");
        if(File.Exists(cancelFile) && File.ReadAllText(cancelFile)==cancelToken) throw new Exception("Launch cancelled before acknowledgement");
        if(File.Exists(acknowledgeFile)) {
          try {
            if(File.ReadAllText(acknowledgeFile)!=launchToken) throw new Exception("Launch acknowledgement mismatch");
            break;
          } catch(IOException e) {
            // A scanner or another reader can briefly hold the atomically published
            // acknowledgement. Retry only Windows sharing/lock violations, inside
            // the existing deadline. The root stays suspended and cancellation
            // is rechecked on every attempt. All other errors remain fail-closed.
            int sharingCode=e.HResult & 0xffff;
            if(sharingCode!=32 && sharingCode!=33) throw;
          }
        }
        Thread.Sleep(20);
      }
      if(File.Exists(cancelFile) && File.ReadAllText(cancelFile)==cancelToken) throw new Exception("Launch cancelled before resume");
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
$status = [WardOwnedJob]::Run([string]$payload.command, [string[]]$payload.args, [string]$payload.cwd, [bool]$payload.verbatim, [int]$payload.survivorTimeout, [string]$payload.cancelFile, [string]$payload.cancelToken, [string]$payload.launchReceipt, [string]$payload.acknowledgeFile, [string]$payload.launchToken, [string]$payload.adapterHash, [int]$payload.guardianPid)
@{ status=$status; completed=[WardOwnedJob]::Completed; error=[WardOwnedJob]::FailureMessage } | ConvertTo-Json -Compress | Set-Content -LiteralPath $payload.receipt -Encoding UTF8
exit $status
