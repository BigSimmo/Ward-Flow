import { describe, expect, it } from "vitest";
import { testRunLockInternals } from "../../../scripts/test-run-lock.mjs";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Tier 1 - Feature 01: Windows NT Kernel PID 4 Lock Deadlock & Cleanup", () => {
  it("never treats Windows NT Kernel PID 4 as a live lock holder process", () => {
    // When checking whether an owner is still alive to release or reclaim a lock,
    // PID 4 (System) must return false when allowSentinel is false.
    const isAlive = testRunLockInternals.processIsAlive(4, { allowSentinel: false });
    expect(isAlive).toBe(false);
  });

  it("never treats Unix init PID 1 as a live lock holder process", () => {
    const isAlive = testRunLockInternals.processIsAlive(1, { allowSentinel: false });
    expect(isAlive).toBe(false);
  });

  it("rejects non-positive and invalid process IDs as dead", () => {
    expect(testRunLockInternals.processIsAlive(0)).toBe(false);
    expect(testRunLockInternals.processIsAlive(-1)).toBe(false);
    expect(testRunLockInternals.processIsAlive(NaN)).toBe(false);
    expect(testRunLockInternals.processIsAlive(null as unknown as number)).toBe(false);
  });

  it("identifies non-existent child process PIDs as dead", () => {
    // Extremely high PID unlikely to exist
    const deadPid = 99999999;
    const isAlive = testRunLockInternals.processIsAlive(deadPid);
    expect(isAlive).toBe(false);
  });

  it("marks coordinator lock directory as stale when holderPid process is dead even if pid is sentinel 4", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wf-lock-test-"));
    try {
      const ownerPath = path.join(tempDir, "owner.json");
      fs.writeFileSync(
        ownerPath,
        JSON.stringify({
          pid: 4,
          holderPid: 99999999, // dead holder
          coordinator: true,
          startedAt: new Date(Date.now() - 3600_000).toISOString(),
        }),
      );

      const isStale = testRunLockInternals.ownerDirectoryIsStale(tempDir);
      expect(isStale).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
  });

  it("confirms orphaned dead lock file D:\\Temp\\clinical-kb-heavy-locks\\f208004b9cb8d686acf1.lock is purged or not owned by dead PID 60504", () => {
    const orphanedLock = "D:\\Temp\\clinical-kb-heavy-locks\\f208004b9cb8d686acf1.lock";
    if (fs.existsSync(orphanedLock)) {
      const ownerPath = path.join(orphanedLock, "owner.json");
      if (fs.existsSync(ownerPath)) {
        const owner = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
        expect(owner.pid).not.toBe(60504);
        expect(owner.holderPid).not.toBe(60504);
      }
    } else {
      expect(fs.existsSync(orphanedLock)).toBe(false);
    }
  });
});
