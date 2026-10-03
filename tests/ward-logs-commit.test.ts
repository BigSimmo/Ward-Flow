import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { removePathSync } from "../scripts/retryable-fs.mjs";
import { commitLogs } from "../scripts/ward-flow/logs-commit.mjs";
const roots: string[] = [];
const temp = () => {
  const root = mkdtempSync(path.join(tmpdir(), "ward-logs-"));
  roots.push(root);
  return root;
};
afterEach(() => roots.splice(0).forEach((root) => removePathSync(root, { recursive: true })));

// The shared notes keep their own history (26 September 2026, after a clean-up emptied the old
// notes folder). logs-commit must commit a change, report "no change" when there is none, never
// stage the git-ignored caches, and never throw when the folder has no history.
const script = path.resolve("scripts/ward-flow/logs-commit.mjs");
const run = (logs: string, file = "fold-queue.md") =>
  execFileSync(process.execPath, [script, "test", file], {
    encoding: "utf8",
    env: { ...process.env, WARD_FLOW_LOGS: logs },
  });
const git = (dir: string, ...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });

describe("logs-commit", () => {
  it("commits a changed notes file, then reports no change", () => {
    const dir = temp();
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
    const dir = temp();
    git(dir, "init", "-q");
    git(dir, "config", "user.name", "test");
    git(dir, "config", "user.email", "test@example.invalid");
    writeFileSync(path.join(dir, "sign-out.md"), "- row\n");
    writeFileSync(path.join(dir, "stray.bin"), "x");
    run(dir, "sign-out.md");
    expect(git(dir, "ls-files").trim().split("\n")).toEqual(["sign-out.md"]);
  });

  it("does nothing, without failing, when the folder has no history", () => {
    const dir = temp();
    expect(run(dir)).toContain("no history");
  });
  it("refuses an existing staged index without committing or changing it", () => {
    const dir = temp();
    git(dir, "init", "-q");
    writeFileSync(path.join(dir, "sign-out.md"), "foreign work");
    writeFileSync(path.join(dir, "fold-queue.md"), "ours");
    git(dir, "add", "sign-out.md");
    const before = git(dir, "diff", "--cached");
    expect(commitLogs("test", { logs: dir, ownedFiles: ["fold-queue.md"] })).toMatch(/refused/);
    expect(git(dir, "diff", "--cached")).toBe(before);
    expect(commitLogs("test", { logs: dir })).toMatch(/exact owned/);
  });
});
