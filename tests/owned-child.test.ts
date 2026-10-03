import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runOwnedChild, registeredWorkIsActive } from "../scripts/owned-child.mjs";
import { acquireHeavyRunLock, testRunLockInternals } from "../scripts/test-run-lock.mjs";
import { removePathSync } from "../scripts/retryable-fs.mjs";
const roots: string[] = [];
const pendingRoots = new Set<string>();
async function finishFixture(
  invoking: ReturnType<typeof spawn>,
  closed: Promise<void>,
  root: string,
  lease: { release: () => void },
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (invoking.exitCode === null && invoking.signalCode === null) invoking.kill();
    await Promise.race([
      closed,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Fixture process closure unproven; retained root and lease: ${root}`)),
          2000,
        );
      }),
    ]);
    pendingRoots.delete(root);
    lease.release();
  } finally {
    clearTimeout(timer);
  }
}
function requireLeasePath(lease: { path?: string }) {
  if (!lease.path) throw new Error("Fixture lease path is required");
  return lease.path;
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
async function until(predicate: () => boolean, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (!predicate() && Date.now() < deadline) await wait(20);
  expect(predicate()).toBe(true);
}
afterEach(() =>
  roots.splice(0).forEach((root) => {
    if (pendingRoots.has(root)) {
      console.warn(`Retaining fixture with unproven process closure: ${root}`);
      return;
    }
    removePathSync(root, { recursive: true });
  }),
);
describe("owned child lifecycle", () => {
  it("keeps timers responsive and returns the actual nonzero status", async () => {
    let beats = 0;
    const heartbeat = setInterval(() => beats++, 10);
    try {
      const result = await runOwnedChild(process.execPath, ["-e", "setTimeout(()=>process.exit(7),150)"], {
        stdio: "ignore",
      });
      expect(result.status).toBe(7);
      expect(beats).toBeGreaterThan(1);
    } finally {
      clearInterval(heartbeat);
    }
  });
  it("registers before work and preserves the lease until completion", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-owned-child-"));
    roots.push(root);
    const lease = acquireHeavyRunLock({
      projectRoot: root,
      repositoryIdentity: root,
      baseDirectory: root,
      environment: {},
    });
    const work = runOwnedChild(process.execPath, ["-e", "setTimeout(()=>process.exit(0),300)"], {
      cwd: root,
      env: lease.environment,
      stdio: "ignore",
    });
    const deadline = Date.now() + 5000;
    while (!registeredWorkIsActive(requireLeasePath(lease), lease.owner.token) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(registeredWorkIsActive(requireLeasePath(lease), lease.owner.token)).toBe(true);
    lease.release();
    expect(readFileSync(path.join(requireLeasePath(lease), "owner.json"), "utf8")).toContain(lease.owner.token);
    expect((await work).status).toBe(0);
    expect(registeredWorkIsActive(requireLeasePath(lease), lease.owner.token)).toBe(false);
    lease.release();
  });
  it("fails conservatively for unfinished dead guardian records and replaced tokens", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-child-record-"));
    roots.push(root);
    mkdirSync(path.join(root, "children"));
    writeFileSync(path.join(root, "owner.json"), JSON.stringify({ pid: 2147483647, token: "owner" }));
    writeFileSync(
      path.join(root, "children", "work.json"),
      JSON.stringify({ token: "owner", guardianPid: 2147483647, state: "running" }),
    );
    expect(testRunLockInternals.ownerDirectoryIsStale(root)).toBe(false);
    const result = await runOwnedChild(process.execPath, ["-e", "process.exit(0)"], {
      env: { CLINICAL_KB_HEAVY_LOCK_PATH: root, CLINICAL_KB_HEAVY_LOCK_TOKEN: "replaced" },
      stdio: "ignore",
    });
    expect(result.status).toBeNull();
    expect(result.error?.message).toMatch(/invalid run lease/);
  });
  it("preserves quoted arguments and captures output without blocking", async () => {
    const values = ["with spaces", 'quote"inside', "backslash\\", "", "& $(literal)"];
    const result = await runOwnedChild(
      process.execPath,
      ["-e", "console.log(JSON.stringify(process.argv.slice(1)))", ...values],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout!.trim())).toEqual(values);
  });
  it("preserves a failed launch reason and completes admission when no process was created", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-failed-launch-"));
    roots.push(root);
    const lease = acquireHeavyRunLock({
      projectRoot: root,
      repositoryIdentity: root,
      baseDirectory: root,
      environment: {},
    });
    try {
      const result = await runOwnedChild(path.join(root, "nonexistent-executable"), [], {
        cwd: root,
        env: lease.environment,
        stdio: "ignore",
      });
      expect(result.status).not.toBe(0);
      expect(result.error?.message).toBeTruthy();
      expect(registeredWorkIsActive(requireLeasePath(lease), lease.owner.token)).toBe(false);
    } finally {
      lease.release();
    }
  });
  it("keeps admission after normal root exit until a detached descendant finishes", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-owned-descendant-"));
    roots.push(root);
    const pidFile = path.join(root, "descendant.json");
    const lease = acquireHeavyRunLock({
      projectRoot: root,
      repositoryIdentity: root,
      baseDirectory: root,
      environment: {},
    });
    const descendant = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setTimeout(()=>process.exit(0),1200)`;
    const parent = `const child=require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{detached:true,stdio:'ignore'});child.unref();`;
    const work = runOwnedChild(process.execPath, ["-e", parent], {
      cwd: root,
      env: { ...process.env, ...lease.environment },
      stdio: "ignore",
    });
    await until(() => existsSync(pidFile));
    const pid = Number(readFileSync(pidFile, "utf8"));
    expect(alive(pid)).toBe(true);
    expect(registeredWorkIsActive(requireLeasePath(lease), lease.owner.token)).toBe(true);
    lease.release();
    expect(existsSync(path.join(requireLeasePath(lease), "owner.json"))).toBe(true);
    expect((await work).status).toBe(0);
    expect(alive(pid)).toBe(false);
    expect(registeredWorkIsActive(requireLeasePath(lease), lease.owner.token)).toBe(false);
    lease.release();
  }, 20000);
  it("terminates owned descendants after abrupt parent death and retains truly interrupted guardian admission", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-parent-interruption-"));
    roots.push(root);
    const pidFile = path.join(root, "descendant.json");
    const lease = acquireHeavyRunLock({
      projectRoot: root,
      repositoryIdentity: root,
      baseDirectory: root,
      environment: {},
    });
    const moduleUrl = pathToFileURL(path.resolve("scripts/owned-child.mjs")).href;
    const childCode = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`;
    pendingRoots.add(root);
    const invoking = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import {runOwnedChild} from ${JSON.stringify(moduleUrl)};await runOwnedChild(process.execPath,['-e',${JSON.stringify(childCode)}]);`,
      ],
      { cwd: root, env: { ...process.env, ...lease.environment }, stdio: "ignore" },
    );
    const closed = new Promise<void>((resolve) => invoking.once("close", () => resolve()));
    try {
      await until(() => existsSync(pidFile));
      const pid = Number(readFileSync(pidFile, "utf8"));
      invoking.kill();
      await until(() => !alive(pid));
      await wait(250);
      const records = readdirSync(path.join(requireLeasePath(lease), "children"))
        .filter((name) => name.endsWith(".json"))
        .map((name) => JSON.parse(readFileSync(path.join(requireLeasePath(lease), "children", name), "utf8")));
      if (records.some((record) => record.state !== "complete" && !alive(record.guardianPid))) {
        expect(registeredWorkIsActive(requireLeasePath(lease), lease.owner.token)).toBe(true);
      } else await until(() => !registeredWorkIsActive(requireLeasePath(lease), lease.owner.token));
    } finally {
      await finishFixture(invoking, closed, root, lease);
    }
  }, 20000);
  it("gracefully cancels the owned job and records proven completion", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "ward-graceful-interruption-"));
    roots.push(root);
    const pidFile = path.join(root, "child.pid"),
      resultFile = path.join(root, "result.json");
    const lease = acquireHeavyRunLock({
      projectRoot: root,
      repositoryIdentity: root,
      baseDirectory: root,
      environment: {},
    });
    const moduleUrl = pathToFileURL(path.resolve("scripts/owned-child.mjs")).href;
    const childCode = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`;
    const code = `import fs from 'node:fs';import {runOwnedChild} from ${JSON.stringify(moduleUrl)};const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(pidFile)})){clearInterval(timer);process.emit('SIGINT');}},20);const result=await runOwnedChild(process.execPath,['-e',${JSON.stringify(childCode)}]);fs.writeFileSync(${JSON.stringify(resultFile)},JSON.stringify(result));`;
    pendingRoots.add(root);
    const invoking = spawn(process.execPath, ["--input-type=module", "-e", code], {
      cwd: root,
      env: { ...process.env, ...lease.environment },
      stdio: "ignore",
    });
    const closed = new Promise<void>((resolve) => invoking.once("close", () => resolve()));
    try {
      await until(() => existsSync(resultFile));
      expect(JSON.parse(readFileSync(resultFile, "utf8")).signal).toBe("SIGINT");
      expect(alive(Number(readFileSync(pidFile, "utf8")))).toBe(false);
      expect(registeredWorkIsActive(requireLeasePath(lease), lease.owner.token)).toBe(false);
    } finally {
      await finishFixture(invoking, closed, root, lease);
    }
  }, 20000);
});
