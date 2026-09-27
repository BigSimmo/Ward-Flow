import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(__dirname, "..");
const script = path.join(sourceRoot, "scripts/ward-flow/trial-merge.mjs");
const root = mkdtempSync(path.join(tmpdir(), "ward-trial-repo-"));
const git = (args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
git(["init", "--quiet"]);
git([
  "-c",
  "user.name=Ward Test",
  "-c",
  "user.email=ward@example.invalid",
  "commit",
  "--quiet",
  "--allow-empty",
  "-m",
  "base",
]);
const head = git(["rev-parse", "HEAD"]);

function run(extra: string[]) {
  const queue = path.join(mkdtempSync(path.join(tmpdir(), "ward-trial-merge-")), "queue.md");
  writeFileSync(
    queue,
    [
      `READY | old | ward/one | ${head} | old check`,
      `READY | other | ward/two | ${head} | check`,
      `READY | latest | ward/one | ${head} | current check`,
      `READY-FAST-ENGINE | engine | ward/three | ${head} | check`,
    ].join("\n"),
  );
  return spawnSync(process.execPath, [script, "--queue", queue, "--line", head, ...extra], {
    cwd: root,
    encoding: "utf8",
    timeout: 15000,
  });
}

describe("ward trial merge selection", () => {
  it("checks only selected branches, using their latest READY entries", () => {
    const result = run(["--branch", "ward/one"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("(1 READY lines)");
    expect(result.stdout).toContain("latest | ward/one");
    expect(result.stdout).not.toContain("old | ward/one");
    expect(result.stdout).not.toContain("ward/two");
  });

  it("retains whole-queue behaviour when no branch is selected", () => {
    const result = run([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("(4 READY lines)");
  });

  it("includes the engine fast lane when selected", () => {
    const result = run(["--branch", "ward/three"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("READY-FAST-ENGINE engine | ward/three");
  });

  it("rejects a selected branch without a READY entry", () => {
    const result = run(["--branch", "ward/missing"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("no READY line for ward/missing");
  });
});
