import { describe, expect, it } from "vitest";
import { npmScriptInvocation } from "../scripts/npm-script-invocation.mjs";

const forwarded = ["src/a b.ts", "--max-warnings", "0", "--tsBuildInfoFile", "C:\\Users\\x y\\.cache\\t.tsbuildinfo"];

describe("npmScriptInvocation", () => {
  it("runs npm_execpath with the current node and passes every argument separately", () => {
    const result = npmScriptInvocation({
      script: "lint:changed:internal",
      forwarded,
      npmExecPath: "/opt/npm/bin/npm-cli.js",
      platform: "linux",
      execPath: "/usr/bin/node",
      exists: () => false,
    });
    expect(result).toEqual({
      command: "/usr/bin/node",
      args: ["/opt/npm/bin/npm-cli.js", "run", "lint:changed:internal", "--", ...forwarded],
      options: {},
    });
  });

  it("keeps POSIX behaviour: npm run <script> -- args, no shell", () => {
    const result = npmScriptInvocation({
      script: "typecheck:source:internal",
      forwarded: [],
      npmExecPath: undefined,
      platform: "darwin",
      execPath: "/usr/local/bin/node",
      exists: () => true,
    });
    expect(result).toEqual({ command: "npm", args: ["run", "typecheck:source:internal"], options: {} });
  });

  it("on Windows without npm_execpath, uses the npm CLI bundled beside node.exe instead of cmd.exe", () => {
    const checked: string[] = [];
    const result = npmScriptInvocation({
      script: "lint:changed:internal",
      forwarded,
      npmExecPath: undefined,
      platform: "win32",
      execPath: "C:\\Program Files\\nodejs\\node.exe",
      exists: (file) => {
        checked.push(file);
        return true;
      },
    });
    const cli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
    expect(checked).toEqual([cli]);
    expect(result.command).toBe("C:\\Program Files\\nodejs\\node.exe");
    expect(result.args).toEqual([cli, "run", "lint:changed:internal", "--", ...forwarded]);
    expect(result.options).toEqual({});
    expect(result.command).not.toMatch(/cmd(\.exe)?$/i);
  });

  it("on Windows without a bundled npm CLI, pre-quotes one cmd string and disables launcher re-quoting", () => {
    const result = npmScriptInvocation({
      script: "lint:changed:internal",
      forwarded: ["src/a b.ts", "--max-warnings", "0"],
      npmExecPath: undefined,
      platform: "win32",
      execPath: "C:\\node\\node.exe",
      exists: () => false,
    });
    expect(result.command).toBe("cmd.exe");
    expect(result.options).toEqual({ windowsVerbatimArguments: true });
    expect(result.args).toEqual(["/d", "/s", "/c", '"npm run lint:changed:internal -- "src/a b.ts" --max-warnings 0"']);
  });
});
