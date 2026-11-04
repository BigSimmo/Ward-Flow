import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { installedTreeParity, installedTreeStampName } from "../scripts/check-installed-lock-parity.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => removePathSync(root, { recursive: true })));

async function installer() {
  const file = path.resolve("scripts/install-locked-dependencies.mjs");
  expect(existsSync(file), "a lifecycle-free locked install entry point is required").toBe(true);
  return import(pathToFileURL(file).href);
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "ward-ci-install-"));
  roots.push(root);
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "synthetic-install-fixture", packageManager: "npm@11.17.0" }),
  );
  const packages = { "node_modules/example": { version: "1.0.0" } };
  writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
  return { root, packages };
}

function populate(root: string, packages: Record<string, { version: string }>) {
  mkdirSync(path.join(root, "node_modules", "example"), { recursive: true });
  writeFileSync(path.join(root, "node_modules", ".package-lock.json"), JSON.stringify({ packages }));
  writeFileSync(path.join(root, "node_modules", "example", "package.json"), JSON.stringify({ version: "1.0.0" }));
  writeFileSync(path.join(root, "node_modules", "example", "index.js"), "export const synthetic = true;");
}

describe("locked installation without lifecycle scripts", () => {
  it("attests only after the locked install succeeds, including a nested backend root", async () => {
    const { installLockedDependencies } = await installer();
    const { root, packages } = fixture();
    const backend = path.join(root, "backend", "ward-flow");
    mkdirSync(backend, { recursive: true });
    for (const file of ["package.json", "package-lock.json"])
      writeFileSync(path.join(backend, file), readFileSync(path.join(root, file)));
    writeFileSync(path.join(backend, "package.json"), JSON.stringify({ name: "synthetic-backend-fixture" }));
    const calls: { command: string; args: string[]; cwd: string }[] = [];
    const result = installLockedDependencies({
      root: backend,
      env: {},
      platform: "linux",
      execute: (command: string, args: string[], options: { cwd: string }) => {
        calls.push({ command, args, cwd: options.cwd });
        expect(existsSync(path.join(backend, "node_modules", installedTreeStampName))).toBe(false);
        if (args.includes("--version")) return { status: 0, stdout: "11.17.0\n" };
        populate(backend, packages);
        return { status: 0 };
      },
      log: () => {},
    });
    expect(calls).toEqual([
      { command: "npm", args: ["--version"], cwd: backend },
      { command: "npm", args: ["ci", "--ignore-scripts"], cwd: backend },
    ]);
    expect(result.ok).toBe(true);
    expect(installedTreeParity(backend).ok).toBe(true);
  });
  it.each([
    { status: 1 },
    { status: null, signal: "SIGTERM" },
    { status: null, error: new Error("synthetic launch failure") },
    { status: 0, signal: "SIGTERM" },
  ])("never stamps an unsuccessful install: %j", async (runResult) => {
    const { installLockedDependencies } = await installer();
    const { root } = fixture();
    expect(() =>
      installLockedDependencies({
        root,
        execute: (_command: string, args: string[]) =>
          args.includes("--version") ? { status: 0, stdout: "11.17.0" } : runResult,
        env: {},
        log: () => {},
      }),
    ).toThrow(/locked install failed/i);
    expect(existsSync(path.join(root, "node_modules", installedTreeStampName))).toBe(false);
  });
  it("refuses a successful process whose installed metadata disagrees with the lock", async () => {
    const { installLockedDependencies } = await installer();
    const { root, packages } = fixture();
    expect(() =>
      installLockedDependencies({
        root,
        env: {},
        execute: (_command: string, args: string[]) => {
          if (args.includes("--version")) return { status: 0, stdout: "11.17.0" };
          populate(root, packages);
          writeFileSync(
            path.join(root, "node_modules", "example", "package.json"),
            JSON.stringify({ version: "2.0.0" }),
          );
          return { status: 0 };
        },
        log: () => {},
      }),
    ).toThrow(/metadata does not match/i);
    expect(existsSync(path.join(root, "node_modules", installedTreeStampName))).toBe(false);
  });
  it("reuses a CI-restored tree only when its stamp still matches the lock and the files", async () => {
    const { installLockedDependencies } = await installer();
    const { root, packages } = fixture();
    const stampedInstall = (_command: string, args: string[]) => {
      if (args.includes("--version")) return { status: 0, stdout: "11.17.0" };
      populate(root, packages);
      return { status: 0 };
    };
    installLockedDependencies({ root, env: {}, platform: "linux", execute: stampedInstall, log: () => {} });
    const reusedCalls: string[][] = [];
    const reused = installLockedDependencies({
      root,
      env: { WARD_INSTALL_RESTORED: "true" },
      platform: "linux",
      execute: (command: string, args: string[]) => {
        reusedCalls.push(args);
        return stampedInstall(command, args);
      },
      log: () => {},
    });
    expect(reused.reused).toBe(true);
    expect(reusedCalls).toEqual([["--version"]]);

    // A restored tree that no longer matches its stamp (a file added after the stamp) is reinstalled.
    writeFileSync(path.join(root, "node_modules", "example", "extra.js"), "export {};");
    const refusedCalls: string[][] = [];
    const refused = installLockedDependencies({
      root,
      env: { WARD_INSTALL_RESTORED: "true" },
      platform: "linux",
      execute: (command: string, args: string[]) => {
        refusedCalls.push(args);
        if (args.includes("ci")) removePathSync(path.join(root, "node_modules"), { recursive: true });
        return stampedInstall(command, args);
      },
      log: () => {},
    });
    expect(refused.reused).toBeUndefined();
    expect(refusedCalls).toEqual([["--version"], ["ci", "--ignore-scripts"]]);
    expect(installedTreeParity(root).ok).toBe(true);
  });
  it("never reuses an existing tree unless CI says it restored one", async () => {
    const { installLockedDependencies } = await installer();
    const { root, packages } = fixture();
    const calls: string[][] = [];
    const run = () =>
      installLockedDependencies({
        root,
        env: { WARD_INSTALL_RESTORED: "false" },
        platform: "linux",
        execute: (_command: string, args: string[]) => {
          calls.push(args);
          if (args.includes("--version")) return { status: 0, stdout: "11.17.0" };
          populate(root, packages);
          return { status: 0 };
        },
        log: () => {},
      });
    run();
    run();
    expect(calls.filter((args) => args.includes("ci"))).toHaveLength(2);
  });
  it("uses the selected npm CLI directly when launched through npm", async () => {
    const { installLockedDependencies } = await installer();
    const { root, packages } = fixture();
    const calls: unknown[] = [];
    installLockedDependencies({
      root,
      env: { npm_execpath: "/synthetic/npm-cli.js" },
      execPath: "/synthetic/node",
      execute: (command: string, args: string[]) => {
        calls.push([command, args]);
        if (args.includes("--version")) return { status: 0, stdout: "11.17.0" };
        populate(root, packages);
        return { status: 0 };
      },
      log: () => {},
    });
    expect(calls).toEqual([
      ["/synthetic/node", ["/synthetic/npm-cli.js", "--version"]],
      ["/synthetic/node", ["/synthetic/npm-cli.js", "ci", "--ignore-scripts"]],
    ]);
  });
  it("refuses the wrong npm before touching an existing dependency tree or attesting it", async () => {
    const { installLockedDependencies } = await installer();
    const { root, packages } = fixture();
    populate(root, packages);
    const original = readFileSync(path.join(root, "node_modules", "example", "index.js"), "utf8");
    const calls: string[][] = [];
    expect(() =>
      installLockedDependencies({
        root,
        env: { npm_config_user_agent: "npm/11.17.0 node/v24.22.1" },
        execute: (_command: string, args: string[]) => {
          calls.push(args);
          return { status: 0, stdout: "11.19.1\n" };
        },
        log: () => {},
      }),
    ).toThrow(/requires npm 11\.17\.0; detected 11\.19\.1/);
    expect(calls).toEqual([["--version"]]);
    expect(readFileSync(path.join(root, "node_modules", "example", "index.js"), "utf8")).toBe(original);
    expect(existsSync(path.join(root, "node_modules", installedTreeStampName))).toBe(false);
  });
  it.each([
    { status: 1 },
    { status: null, signal: "SIGTERM" },
    { status: null, error: new Error("synthetic probe failure") },
  ])("refuses an unverifiable npm without starting install: %j", async (probeResult) => {
    const { installLockedDependencies } = await installer();
    const { root } = fixture();
    const calls: string[][] = [];
    expect(() =>
      installLockedDependencies({
        root,
        env: {},
        execute: (_command: string, args: string[]) => {
          calls.push(args);
          return probeResult;
        },
        log: () => {},
      }),
    ).toThrow(/Cannot verify pinned npm/);
    expect(calls).toEqual([["--version"]]);
    expect(existsSync(path.join(root, "node_modules"))).toBe(false);
  });
  it("refuses an unsupported manager before running any command", async () => {
    const { installLockedDependencies } = await installer();
    const { root } = fixture();
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ packageManager: "pnpm@11.17.0" }));
    let invoked = false;
    expect(() =>
      installLockedDependencies({
        root,
        execute: () => {
          invoked = true;
          return { status: 0 };
        },
        log: () => {},
      }),
    ).toThrow(/exact npm@version packageManager pin/);
    expect(invoked).toBe(false);
  });
});
