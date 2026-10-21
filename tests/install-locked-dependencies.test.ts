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
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "synthetic-install-fixture" }));
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
    const calls: { command: string; args: string[]; cwd: string }[] = [];
    const result = installLockedDependencies({
      root: backend,
      env: {},
      platform: "linux",
      execute: (command: string, args: string[], options: { cwd: string }) => {
        calls.push({ command, args, cwd: options.cwd });
        expect(existsSync(path.join(backend, "node_modules", installedTreeStampName))).toBe(false);
        populate(backend, packages);
        return { status: 0 };
      },
      log: () => {},
    });
    expect(calls).toEqual([{ command: "npm", args: ["ci", "--ignore-scripts"], cwd: backend }]);
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
    expect(() => installLockedDependencies({ root, execute: () => runResult, env: {}, log: () => {} })).toThrow(
      /locked install failed/i,
    );
    expect(existsSync(path.join(root, "node_modules", installedTreeStampName))).toBe(false);
  });
  it("refuses a successful process whose installed metadata disagrees with the lock", async () => {
    const { installLockedDependencies } = await installer();
    const { root, packages } = fixture();
    expect(() =>
      installLockedDependencies({
        root,
        env: {},
        execute: () => {
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
        populate(root, packages);
        return { status: 0 };
      },
      log: () => {},
    });
    expect(calls).toEqual([["/synthetic/node", ["/synthetic/npm-cli.js", "ci", "--ignore-scripts"]]]);
  });
});
