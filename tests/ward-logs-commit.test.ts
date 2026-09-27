import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The shared notes keep their own history (26 September 2026, after a clean-up emptied the old
// notes folder). logs-commit must commit a change, report "no change" when there is none, never
// stage the git-ignored caches, and never throw when the folder has no history.
const script = path.resolve("scripts/ward-flow/logs-commit.mjs");
const run = (logs: string) =>
  execFileSync(process.execPath, [script, "test"], { encoding: "utf8", env: { ...process.env, WARD_FLOW_LOGS: logs } });
const git = (dir: string, ...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });

describe("logs-commit", () => {
  it("commits a changed notes file, then reports no change", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ward-logs-"));
    git(dir, "init", "-q");
    git(dir, "config", "user.name", "test");
    git(dir, "config", "user.email", "test@example.invalid");
    writeFileSync(path.join(dir, ".gitignore"), "tsc-cache/\n");
    writeFileSync(path.join(dir, "fold-queue.md"), "READY | a\n");
    expect(run(dir)).toContain("committed");
    expect(git(dir, "log", "--oneline")).toContain("notes: test");
    expect(run(dir)).toContain("no change");
  });

  it("stages only the shared files by name, never other files", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ward-logs-"));
    git(dir, "init", "-q");
    git(dir, "config", "user.name", "test");
    git(dir, "config", "user.email", "test@example.invalid");
    writeFileSync(path.join(dir, "sign-out.md"), "- row\n");
    writeFileSync(path.join(dir, "stray.bin"), "x");
    run(dir);
    expect(git(dir, "ls-files").trim().split("\n")).toEqual(["sign-out.md"]);
  });

  it("does nothing, without failing, when the folder has no history", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ward-logs-"));
    expect(run(dir)).toContain("no history");
  });
});
