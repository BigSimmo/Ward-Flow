import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Build the process invocation for `npm run <script> [-- args]` without depending on a shell
 * where one can be avoided.
 *
 * Windows fault (3-4 Oct 2026): with `npm_execpath` unset (the pre-push hook runs plain `node`),
 * this used to launch `cmd.exe /d /s /c "npm run …"` through `runOwnedChild`, whose Windows
 * launcher quotes every argument individually. cmd then received the whole command as one quoted
 * token and failed with `'"npm run lint:changed:internal -- …"' is not recognized`, and the
 * typecheck path (which forwards `--tsBuildInfoFile <path>`) failed with "The filename, directory
 * name, or volume label syntax is incorrect." Nothing was linted or typechecked.
 *
 * Resolution order:
 *   1. `npm_execpath` set (launched via npm): run it with the current node, args as an array.
 *   2. Windows: run the npm CLI bundled beside node.exe (`node_modules/npm/bin/npm-cli.js`) with
 *      the current node — no cmd.exe, so each argument reaches npm intact.
 *   3. Windows without a bundled npm CLI: cmd.exe with a single pre-quoted command string and
 *      `windowsVerbatimArguments`, so the launcher does not re-quote it.
 *   4. POSIX: `npm run …` directly (unchanged behaviour).
 *
 * @param {{
 *   script: string,
 *   forwarded?: string[],
 *   npmExecPath?: string,
 *   platform?: NodeJS.Platform,
 *   execPath?: string,
 *   exists?: (file: string) => boolean,
 * }} input
 * @returns {{ command: string, args: string[], options: { windowsVerbatimArguments?: boolean } }}
 */
export function npmScriptInvocation(input) {
  const {
    script,
    forwarded = [],
    platform = process.platform,
    execPath = process.execPath,
    exists = existsSync,
  } = input;
  // An explicitly passed `npmExecPath: undefined` means "not launched via npm"; only an absent
  // key falls back to the environment.
  const npmExecPath = "npmExecPath" in input ? input.npmExecPath : process.env.npm_execpath;
  const npmArgs = forwarded.length ? ["--", ...forwarded] : [];
  const runArgs = ["run", script, ...npmArgs];

  if (npmExecPath) {
    return { command: execPath, args: [npmExecPath, ...runArgs], options: {} };
  }

  if (platform === "win32") {
    const pathApi = path.win32;
    const bundledCli = pathApi.join(pathApi.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js");
    if (exists(bundledCli)) {
      return { command: execPath, args: [bundledCli, ...runArgs], options: {} };
    }
    const line = ["npm", ...runArgs].map((part) => (/[\s"&|<>^]/.test(part) ? `"${part.replace(/"/g, '""')}"` : part));
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `"${line.join(" ")}"`],
      options: { windowsVerbatimArguments: true },
    };
  }

  return { command: "npm", args: runArgs, options: {} };
}
