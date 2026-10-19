import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  approvedTakeoverFiles,
  signOutConflicts,
  unsignedWardFiles,
  WARD_FLOW_IDENTITY_ANCHOR,
} from "../scripts/pre-commit-checks.mjs";
import { HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY } from "./helpers/ward-flow-history";

const repoRoot = path.resolve(import.meta.dirname, "..");
const signOut = path.join(repoRoot, "scripts/ward-flow/sign-out-check.mjs");

function run(command: string, args: string[], cwd: string, env: Record<string, string | undefined> = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 30_000,
  });
}

function git(cwd: string, ...args: string[]) {
  const result = run("git", args, cwd);
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

// Ownership checks need history descending from the Ward-Flow identity anchor. Borrow this
// checkout's objects for that rather than copying them.
const objects = path.resolve(repoRoot, git(repoRoot, "rev-parse", "--git-common-dir"), "objects").replace(/\\/g, "/");

function fixture(origin: string, { anchored = false } = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), "ward-startup-"));
  git(cwd, "init", "-q", "-b", "main");
  mkdirSync(path.join(cwd, "scripts"));
  copyFileSync(path.join(repoRoot, "scripts/pre-commit-checks.mjs"), path.join(cwd, "scripts/pre-commit-checks.mjs"));
  git(cwd, "config", "user.name", "Ward Test");
  git(cwd, "config", "user.email", "ward-test@example.invalid");
  if (anchored) {
    mkdirSync(path.join(cwd, ".git", "objects", "info"), { recursive: true });
    writeFileSync(path.join(cwd, ".git", "objects", "info", "alternates"), `${objects}\n`);
    // The index stays empty, so the first commit below records only the fixture's own files.
    git(cwd, "update-ref", "refs/heads/main", WARD_FLOW_IDENTITY_ANCHOR);
  }
  writeFileSync(path.join(cwd, "README.md"), "public ward fixture\n");
  git(cwd, "add", "README.md");
  git(cwd, "commit", "-qm", "base");
  git(cwd, "remote", "add", "origin", origin);
  git(cwd, "branch", "ward/task");
  writeFileSync(path.join(cwd, "README.md"), "new main commit\n");
  git(cwd, "commit", "-qam", "new main");
  writeFileSync(path.join(cwd, "README.md"), "second main commit\n");
  git(cwd, "commit", "-qam", "second main");
  git(cwd, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(cwd, "checkout", "-q", "ward/task");
  return cwd;
}

describe("public startup boundary", () => {
  it("public sign-out check uses main and ignores Database checkout claims", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const cwd = fixture("https://github.com/BigSimmo/Ward-Flow.git", { anchored: true });
    const other = fixture("https://github.com/BigSimmo/Ward-Flow.git", { anchored: true });
    const log = path.join(cwd, "sign-out.md");
    const file = "scripts/ward-flow/sign-out-check.mjs";
    try {
      writeFileSync(
        log,
        `Open sign-outs only\n- date | Old owner | ward/old | D:/Worktrees/Database/ag-old | ${file}\n`,
      );
      const env = { WARD_SIGNOUT_FILE: log };
      const clear = run(process.execPath, [signOut, file], cwd, env);
      expect(clear.status, clear.stderr).toBe(0);
      expect(clear.stdout).toMatch(/no clash/);

      writeFileSync(log, `Open sign-outs only\n- date | Public owner | ward/other | ${other} | ${file}\n`);
      const clash = run(process.execPath, [signOut, file], cwd, env);
      expect(clash.status, clash.stderr).toBe(1);
      expect(clash.stdout).toMatch(/SIGNED OUT/);
    } finally {
      rmSync(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(other, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("pre-commit ownership accepts a public sign-out and ignores old Database claims", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const file = "scripts/ward-flow/sign-out-check.mjs";
    const root = fixture("https://github.com/BigSimmo/Ward-Flow.git", { anchored: true });
    const log =
      `Open sign-outs only\n` +
      `- date | Old owner | ward/old | D:/Worktrees/Database/ag-old | ${file}\n` +
      `- date | Current owner | ward/startup-boundary | ${root} | ${file}\n`;
    try {
      expect(signOutConflicts([file], log, "ward/startup-boundary", root)).toEqual([]);
      expect(unsignedWardFiles([file], log, "ward/startup-boundary", root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("pre-commit ownership still blocks another public branch's claim", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const file = "scripts/ward-flow/sign-out-check.mjs";
    const root = fixture("https://github.com/BigSimmo/Ward-Flow.git", { anchored: true });
    const other = fixture("https://github.com/BigSimmo/Ward-Flow.git", { anchored: true });
    const log =
      `Open sign-outs only\n` +
      `- date | Old owner | ward/old | D:/Worktrees/Database/ag-old | ${file}\n` +
      `- date | Public owner | ward/other | ${other} | ${file}\n`;
    try {
      expect(signOutConflicts([file], log, "ward/startup-boundary", root)).toEqual([
        { file, owner: "Public owner", branch: "ward/other" },
      ]);
      expect(unsignedWardFiles([file], log, "ward/startup-boundary", root)).toEqual([file]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      rmSync(other, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("old Database ownership does not grant a public takeover", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const file = "scripts/ward-flow/sign-out-check.mjs";
    const root = fixture("https://github.com/BigSimmo/Ward-Flow.git", { anchored: true });
    const log =
      `Open sign-outs only\n` +
      `- date | Old owner | ward/startup-boundary | D:/Worktrees/Database/ag-old | ${file} (approved takeover by Josh: old checkout only)\n`;
    try {
      expect([...approvedTakeoverFiles(log, "ward/startup-boundary", root)]).toEqual([]);
      expect(unsignedWardFiles([file], log, "ward/startup-boundary", root)).toEqual([file]);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
