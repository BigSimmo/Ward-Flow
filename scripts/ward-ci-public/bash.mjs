import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Preserve native Git Bash discovery; a bare bash on Windows may launch WSL.
export function resolveBash() {
  if (process.platform !== "win32") return "bash";
  const env = process.env;
  const candidates = [
    env.ProgramFiles && path.win32.join(env.ProgramFiles, "Git", "bin", "bash.exe"),
    env["ProgramFiles(x86)"] && path.win32.join(env["ProgramFiles(x86)"], "Git", "bin", "bash.exe"),
    env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"),
  ];
  const gitExecPath = spawnSync("git", ["--exec-path"], { encoding: "utf8" });
  // <git>/mingw64/libexec/git-core -> <git>/bin/bash.exe
  if (gitExecPath.status === 0 && gitExecPath.stdout.trim())
    candidates.push(path.win32.resolve(gitExecPath.stdout.trim(), "..", "..", "..", "bin", "bash.exe"));
  const system32 = path.win32.join(env.SystemRoot || "C:\\Windows", "System32").toLowerCase();
  const found = candidates.find(
    (candidate) =>
      candidate && existsSync(candidate) && !path.win32.resolve(candidate).toLowerCase().startsWith(system32),
  );
  if (found) return found;
  throw new Error(
    "check-contracts needs Git Bash on Windows (%ProgramFiles%\\Git\\bin\\bash.exe); it refuses the WSL System32\\bash.exe.",
  );
}
