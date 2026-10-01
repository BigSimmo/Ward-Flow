import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let gitRoot = path.resolve(__dirname, "..");
try {
  gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: __dirname,
    encoding: "utf8",
  }).trim();
} catch {
  gitRoot = "D:/Worktrees/Database/ward-lead";
}
const script = path.join(path.resolve(__dirname, ".."), "scripts/ward-flow/sign-out-check.mjs");

describe("ward sign-out-check", () => {
  it("prints usage and exits 2 when no arguments are given", () => {
    const run = spawnSync(process.execPath, [script], {
      cwd: gitRoot,
      encoding: "utf8",
    });
    expect(run.status).toBe(2);
    expect(run.stdout).toContain("Usage: sign-out-check.mjs");
  });

  it("checks stale entries cleanly with --stale", () => {
    const dummySignOut = path.join(tmpdir(), `dummy-sign-out-${Date.now()}.md`);
    writeFileSync(
      dummySignOut,
      "Open sign-outs only\n\n- 2026-09-30 00:00 | Test | non-existent-branch | D:/none | file.ts\n",
    );
    const run = spawnSync(process.execPath, [script, "--stale"], {
      cwd: gitRoot,
      encoding: "utf8",
      env: { ...process.env, WARD_SIGNOUT_FILE: dummySignOut },
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("stale sign-out line(s)");
  });

  it("reports no clash on a non-clashing file", () => {
    const run = spawnSync(process.execPath, [script, "src/components/ward-management/ward-eligibility.ts"], {
      cwd: gitRoot,
      encoding: "utf8",
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("no clash for 1 file(s)");
  });
});
