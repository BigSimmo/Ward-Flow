import { fork, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { removePathSync } from "./retryable-fs.mjs";

const TOKEN = "CLINICAL_KB_HEAVY_LOCK_TOKEN";
const LEASE = "CLINICAL_KB_HEAVY_LOCK_PATH";
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
};

// Unfinished guardian records are deliberately retained even if their PID died.
// Descendant ownership is then unknown; automatic reclamation would be unsafe.
export function registeredWorkIsActive(leasePath, token) {
  const directory = path.join(leasePath, "children");
  if (!existsSync(directory)) return false;
  return readdirSync(directory).some((name) => {
    if (!name.endsWith(".json")) return false;
    const record = json(path.join(directory, name));
    return !record || ((!token || record.token === token) && record.state !== "complete");
  });
}

function writeRecord(file, record) {
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(record));
  renameSync(temporary, file);
}

/**
 * Run an owned process asynchronously and keep its admission alive after parent interruption.
 * Environment fixtures may intentionally omit variables; this matches Node's
 * child environment contract rather than Next's augmented process.env type.
 * @param {string} command
 * @param {string[]} args
 * @param {Omit<import('node:child_process').SpawnOptions,'env'|'cwd'> & {env?:Record<string,string|undefined>,cwd?:string}} [options]
 * @returns {Promise<{status: number|null, signal?: string|null, error?: {message:string}, stdout?:string, stderr?:string}>}
 */
export function runOwnedChild(
  command,
  args,
  { cwd = process.cwd(), env = process.env, stdio = "inherit", ...options } = {},
) {
  return new Promise((resolve) => {
    const guardian = fork(fileURLToPath(import.meta.url), ["--guardian"], {
      cwd,
      env,
      execArgv: [],
      stdio: Array.isArray(stdio) ? [...stdio, "ipc"] : stdio,
    });
    const send = (message) => {
      if (guardian.connected) {
        try {
          guardian.send(message, () => {});
        } catch {
          /* close handler reports incomplete work */
        }
      }
    };
    const cancel = (signal) => send({ cancel: signal });
    const interrupt = () => cancel("SIGINT");
    const terminate = () => cancel("SIGTERM");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    let result;
    let stdout = "",
      stderr = "";
    guardian.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    guardian.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    guardian.on("message", (message) => {
      if (message?.result) result = message.result;
    });
    guardian.on("error", (error) => {
      result = { status: null, error };
    });
    guardian.on("close", (status, signal) => {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
      resolve({
        ...(result ?? {
          status: null,
          signal,
          error: { message: `owned child guardian exited ${status} without a completion result` },
        }),
        stdout,
        stderr,
      });
    });
    // The guardian registers itself before it starts work. If the IPC channel
    // closes before this message arrives, it exits without launching anything.
    send({ command, args, cwd, env, options });
  });
}

async function supervise(message) {
  const { command, args, cwd, env, options } = message;
  const leasePath = env[LEASE];
  const token = env[TOKEN];
  let recordFile;
  const record = {
    token,
    guardianPid: process.pid,
    childPid: null,
    startedAt: new Date().toISOString(),
    state: "running",
  };
  if (leasePath || token) {
    if (!leasePath || !token || json(path.join(leasePath, "owner.json"))?.token !== token)
      throw new Error("owned child inherited an invalid run lease");
    mkdirSync(path.join(leasePath, "children"), { recursive: true });
    recordFile = path.join(leasePath, "children", `${randomUUID()}.json`);
    writeRecord(recordFile, record);
    if (json(path.join(leasePath, "owner.json"))?.token !== token)
      throw new Error("owned child lease changed before launch");
  }
  if (!process.connected) {
    if (recordFile) removePathSync(recordFile);
    return { status: null, signal: "SIGTERM" };
  }
  let child;
  // Closing IPC must not let the guardian event loop end between child close
  // and the final native completion receipt/record write.
  const keepAlive = setInterval(() => {}, 1000);
  let cancelled;
  let cancellation = Promise.resolve();
  let cancellationTimer;
  let cancelFile;
  const cancelToken = randomUUID();
  const stop = (signal) => {
    if (cancelled) return;
    cancelled = signal;
    if (recordFile) {
      record.cancellation = signal;
      writeRecord(recordFile, record);
    }
    if (!child?.pid || child.exitCode !== null) return;
    if (process.platform === "win32") {
      // Ask the native job holder to terminate its job and prove zero active
      // processes. Only an unresponsive adapter is killed through its handle,
      // in which case no completion receipt means admission stays unknown.
      writeFileSync(cancelFile, cancelToken, { flag: "wx" });
      cancellationTimer = setTimeout(() => {
        if (child.exitCode === null) child.kill();
      }, 8000);
    } else {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already stopped */
      }
    }
  };
  const onMessage = (incoming) => {
    if (incoming?.cancel) stop(incoming.cancel);
  };
  const disconnected = () => stop("SIGTERM");
  process.on("message", onMessage);
  process.on("disconnect", disconnected);
  let result;
  let completed = false;
  let receipt;
  try {
    if (process.platform === "win32") {
      receipt = path.join(recordFile ? path.dirname(recordFile) : os.tmpdir(), `ward-owned-job-${randomUUID()}.json`);
      cancelFile = `${receipt}.cancel`;
      child = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          fileURLToPath(new URL("./owned-child-windows.ps1", import.meta.url)),
        ],
        { cwd, env, stdio: ["pipe", "inherit", "inherit"], windowsHide: true },
      );
      child.stdin.on("error", () => {});
      child.stdin.end(
        JSON.stringify({
          command,
          args,
          cwd,
          verbatim: options?.windowsVerbatimArguments === true,
          survivorTimeout: 5000,
          receipt,
          cancelFile,
          cancelToken,
        }) + "\n",
      );
    } else {
      child = spawn(command, args, { ...options, cwd, env, stdio: "inherit", detached: true });
    }
    record.childPid = child.pid ?? null;
    if (recordFile) writeRecord(recordFile, record);
    result = await new Promise((resolve) => {
      child.on("error", (error) => resolve({ status: null, error: { message: error.message } }));
      child.on("close", (status, signal) => resolve({ status, signal }));
    });
    await cancellation;
    if (recordFile) {
      record.childResult = result;
      writeRecord(recordFile, record);
    }
    if (process.platform === "win32") {
      const proof = json(receipt);
      completed = proof?.completed === true && proof.status === result.status;
      if (proof?.error) result.error = { message: proof.error };
      if (!completed) {
        if (recordFile) {
          record.reason = `native proof=${JSON.stringify(proof)} adapter status=${result.status}`;
          writeRecord(recordFile, record);
        }
        result = {
          status: null,
          error: {
            message: "Windows owned job completion could not be established; retain admission for explicit recovery",
          },
        };
      }
    } else if (child.pid) {
      const deadline = Date.now() + 5000;
      for (;;) {
        try {
          process.kill(-child.pid, 0);
        } catch (error) {
          completed = error.code === "ESRCH";
          break;
        }
        if (Date.now() > deadline) {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            /* probe below establishes completion */
          }
          const killDeadline = Date.now() + 5000;
          while (Date.now() < killDeadline) {
            try {
              process.kill(-child.pid, 0);
            } catch (error) {
              completed = error.code === "ESRCH";
              break;
            }
            await pause(50);
          }
          result = {
            status: completed ? 125 : null,
            error: {
              message: completed
                ? "Owned child left descendants running after exit; its process group was terminated"
                : "Owned process group completion unknown; retain admission for explicit recovery",
            },
          };
          break;
        }
        await pause(50);
      }
    } else if (result.error) {
      completed = true; // spawn failed before any process existed
    }
    if (recordFile && completed) {
      record.state = "complete";
      writeRecord(recordFile, record);
    }
    return cancelled ? { status: null, signal: cancelled } : result;
  } finally {
    process.removeListener("message", onMessage);
    clearInterval(keepAlive);
    process.removeListener("disconnect", disconnected);
    clearTimeout(cancellationTimer);
    if (receipt) removePathSync(receipt, { force: true });
    if (cancelFile) removePathSync(cancelFile, { force: true });
  }
}

if (process.argv[2] === "--guardian") {
  let received = false;
  process.once("message", async (message) => {
    received = true;
    try {
      const result = await supervise(message);
      if (process.connected)
        process.send({ result }, () => {
          if (process.connected) process.disconnect();
        });
    } catch (error) {
      if (process.connected) {
        try {
          process.send({ result: { status: null, error: { message: error.message } } }, () => {
            if (process.connected) process.disconnect();
          });
        } catch {
          /* unfinished record retained */
        }
      }
    }
  });
  process.once("disconnect", () => {
    if (!received) process.exit(1);
  });
}
