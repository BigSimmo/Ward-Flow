import { spawn, execFile } from "node:child_process";
import { join } from "node:path";

// Builds a shell-free Azure CLI invocation. On Windows `az` is a batch wrapper (az.cmd), which Node
// refuses to spawn without a shell, and `shell: true` would join arguments unescaped so values such
// as `||` in a JMESPath query or a crafted administrator name could run other commands. Instead we
// run cmd.exe ourselves with every argument quoted for the C runtime and every cmd metacharacter
// caret-escaped twice (once for cmd.exe, once more for the az.cmd wrapper's own re-parse).
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

/** Quote one argument so cmd.exe and then az.cmd hand it to Azure CLI unchanged. */
export function escapeWindowsArgument(value) {
  let arg = String(value);
  arg = arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, "$1$1");
  arg = `"${arg}"`;
  return arg.replace(CMD_META, "^$1").replace(CMD_META, "^$1");
}

/** Returns a bounded CLI invocation; cmd.exe alone uses verbatim argument mode. */
export function azInvocation(args, platform = process.platform, env = process.env) {
  for (const arg of args) {
    if (typeof arg !== "string") throw new TypeError("Azure CLI arguments must be strings");
    // cmd.exe cannot carry these safely, and no Ward Flow setting legitimately contains them.
    if (/[\0\r\n]/.test(arg)) throw new Error("Azure CLI argument contains a line break or NUL character");
  }
  // Deployment creation can wait for resource provisioning; inventory/directory calls get two
  // minutes. Both remain bounded on every platform without changing argument construction.
  const timeout = args.slice(0, 3).join(" ") === "deployment group create" ? 600_000 : 120_000;
  const options = { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, shell: false, timeout, killSignal: "SIGKILL" };
  if (platform !== "win32") return { command: "az", args: [...args], options };
  const line = ["az.cmd", ...args.map(escapeWindowsArgument)].join(" ");
  return {
    command: env.ComSpec || env.COMSPEC || "cmd.exe",
    args: ["/d", "/s", "/c", `"${line}"`],
    options: { ...options, windowsVerbatimArguments: true },
  };
}

/** Execute a CLI invocation, terminating its owned Windows tree before reporting a timeout. */
export function executeAz(call) {
  const { timeout, killSignal = "SIGKILL", maxBuffer = 4 * 1024 * 1024, encoding = "utf8", ...options } = call.options;
  if (!Number.isSafeInteger(timeout) || timeout <= 0 || timeout > 600_000)
    throw new RangeError("Azure CLI timeout must be between 1 and 600000 milliseconds");
  return new Promise((resolve) => {
    const child = spawn(call.command, call.args, { ...options, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [],
      stderr = [];
    let outBytes = 0,
      errBytes = 0,
      error,
      status = null,
      signal = null;
    let closed = false,
      exited = false,
      stopping = false,
      cleanupPending = false,
      treeTermination;
    const finish = () => {
      if (!closed || cleanupPending) return;
      clearTimeout(timer);
      resolve({
        pid: child.pid,
        status,
        signal,
        error,
        stdout: Buffer.concat(stdout).toString(encoding),
        stderr: Buffer.concat(stderr).toString(encoding),
        treeTermination,
      });
    };
    const unconfirmed = () => {
      error = Object.assign(new Error("Azure CLI process-tree termination could not be confirmed"), {
        code: "ETREEKILL",
      });
      // Do not target a PID after our own exit receipt: Windows may already have reused it.
      if (!exited) child.kill(killSignal);
      child.stdout.destroy();
      child.stderr.destroy();
      closed = true;
      finish();
    };
    const stop = (cause) => {
      if (stopping || closed) return;
      stopping = true;
      error = cause;
      if (exited || !Number.isSafeInteger(child.pid) || child.pid <= 0) {
        unconfirmed();
        return;
      }
      if (process.platform !== "win32") {
        if (!child.kill(killSignal)) unconfirmed();
        return;
      }
      cleanupPending = true;
      const taskkill = join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe");
      execFile(
        taskkill,
        ["/PID", String(child.pid), "/T", "/F"],
        { shell: false, windowsHide: true, timeout: 5_000, killSignal: "SIGKILL", maxBuffer: 64 * 1024 },
        (failure, _stdout, nativeError) => {
          cleanupPending = false;
          treeTermination = {
            status: failure ? null : 0,
            errorCode: failure?.code ?? null,
            diagnostic: failure ? nativeError?.trim().slice(0, 2048) : undefined,
          };
          if (failure) unconfirmed();
          else finish();
        },
      );
    };
    const timer = setTimeout(
      () => stop(Object.assign(new Error("Azure CLI timed out"), { code: "ETIMEDOUT" })),
      timeout,
    );
    child.on("error", (failure) => {
      error ??= failure;
    });
    child.on("exit", () => {
      exited = true;
    });
    child.on("close", (code, endedBy) => {
      status = code;
      signal = endedBy;
      closed = true;
      finish();
    });
    for (const [stream, chunks, isOut] of [
      [child.stdout, stdout, true],
      [child.stderr, stderr, false],
    ]) {
      stream.on("data", (chunk) => {
        if (isOut) outBytes += chunk.length;
        else errBytes += chunk.length;
        if ((isOut ? outBytes : errBytes) > maxBuffer)
          stop(Object.assign(new Error("Azure CLI output limit exceeded"), { code: "ENOBUFS" }));
        else chunks.push(chunk);
      });
    }
  });
}

/** Check process completion and the expected JSON shape without including provider output in errors. */
export function azResponse(result, args, expected = "object", requiredStrings = []) {
  const flag = args.findIndex((arg) => arg.startsWith("--"));
  const command = args.slice(0, flag < 0 ? 3 : Math.min(flag, 3)).join(" ");
  const fail = (reason) => {
    throw new Error(`Azure command failed (${command}): ${reason}. Inspect the command outcome before retrying`);
  };
  if (result.error?.code === "ETREEKILL") fail("local process-tree termination could not be confirmed");
  if (result.error?.code === "ETIMEDOUT") fail("timed out; the provider operation may still be running");
  if (result.error) fail(`execution error ${result.error.code ?? "unknown"}`);
  if (result.signal) fail(`terminated by signal ${result.signal}`);
  if (!Number.isInteger(result.status)) fail("missing exit status");
  if (result.status !== 0) fail(`exit status ${result.status}; check the selected identity and Azure access`);
  if (expected === "none") return null;
  const invalid = (reason) => {
    throw new Error(`Azure response invalid (${command}): ${reason}. Inspect the provider response before retrying`);
  };
  if (typeof result.stdout !== "string" || !result.stdout.trim()) invalid("empty JSON output");
  let value;
  try {
    value = JSON.parse(result.stdout);
  } catch {
    invalid("malformed JSON output");
  }
  const object = (item) => item !== null && typeof item === "object" && !Array.isArray(item);
  if (expected === "array") {
    if (!Array.isArray(value) || !value.every(object)) invalid("expected an array of objects");
  } else if (expected !== "object" || !object(value)) {
    invalid("expected an object");
  }
  if (requiredStrings.some((field) => typeof value[field] !== "string" || !value[field]))
    invalid("missing required string fields");
  return value;
}

/**
 * Find an earlier run of a named deployment (for example one whose local wait timed out) so setup can
 * resume from its outputs instead of rejecting the network that run created. Returns the succeeded
 * deployment, null when there is none, and throws while it is still running or after it failed.
 */
export function priorDeployment(deployments, name) {
  const found = deployments.find((row) => row?.name === name);
  if (!found) return null;
  const state = found.properties?.provisioningState;
  if (state === "Succeeded") return found;
  if (["Running", "Accepted", "Deleting", "Updating", "Creating"].includes(state))
    throw new Error(`Deployment ${name} is still running in Azure; wait for it to finish, then rerun setup`);
  throw new Error(`Deployment ${name} ended as ${state ?? "unknown"}; inspect it in Azure before retrying`);
}
