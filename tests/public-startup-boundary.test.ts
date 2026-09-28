import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { approvedTakeoverFiles, signOutConflicts, unsignedWardFiles } from "../scripts/pre-commit-checks.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const freshness = path.join(repoRoot, "scripts/check-base-freshness.mjs");
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

function fixture(origin: string) {
  const cwd = mkdtempSync(path.join(tmpdir(), "ward-startup-"));
  git(cwd, "init", "-q", "-b", "main");
  mkdirSync(path.join(cwd, "scripts"));
  copyFileSync(path.join(repoRoot, "scripts/pre-commit-checks.mjs"), path.join(cwd, "scripts/pre-commit-checks.mjs"));
  git(cwd, "config", "user.name", "Ward Test");
  git(cwd, "config", "user.email", "ward-test@example.invalid");
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
  it("standalone Ward-Flow hook reports stale origin/main even on a ward branch", () => {
    const cwd = fixture("https://github.com/BigSimmo/Ward-Flow.git");
    try {
      const result = run(process.execPath, [freshness, "--hook"], cwd, {
        BASE_FRESHNESS_NO_FETCH: "1",
        STALE_BASE_THRESHOLD: "1",
      });
      expect(result.status, result.stderr).toBe(0);
      const hook = JSON.parse(result.stdout.trim());
      expect(hook.hookSpecificOutput.additionalContext).toMatch(/BEHIND origin\/main/);
      expect(hook.hookSpecificOutput.additionalContext).not.toMatch(/Never merge or rebase origin\/main/);
    } finally {
      rmSync(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("standalone Ward-Flow startup stays offline until fetch is explicitly requested", () => {
    const cwd = fixture("https://github.com/BigSimmo/Ward-Flow.git");
    try {
      const remote = path.join(cwd, "remote.git");
      git(cwd, "init", "--bare", "-q", remote);
      git(cwd, "config", `url.${pathToFileURL(remote).href}.insteadOf`, "https://github.com/BigSimmo/Ward-Flow.git");
      git(cwd, "checkout", "-q", "main");
      git(cwd, "push", "-q", "origin", "main");
      git(cwd, "update-ref", "refs/remotes/origin/main", "main~1");
      git(cwd, "checkout", "-q", "ward/task");

      const cachedHead = git(cwd, "rev-parse", "origin/main");
      const offline = run(process.execPath, [freshness, "--json"], cwd, {
        BASE_FRESHNESS_FETCH: "0",
        BASE_FRESHNESS_NO_FETCH: "0",
      });
      expect(offline.status, offline.stderr).toBe(0);
      expect(JSON.parse(offline.stdout).behind).toBe(1);
      expect(git(cwd, "rev-parse", "origin/main")).toBe(cachedHead);

      const online = run(process.execPath, [freshness, "--json", "--fetch"], cwd, {
        BASE_FRESHNESS_FETCH: "0",
        BASE_FRESHNESS_NO_FETCH: "0",
      });
      expect(online.status, online.stderr).toBe(0);
      expect(JSON.parse(online.stdout).behind).toBe(2);
      expect(git(cwd, "rev-parse", "origin/main")).not.toBe(cachedHead);
    } finally {
      rmSync(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("legacy Database ward hook remains silent", () => {
    const cwd = fixture("https://github.com/BigSimmo/Database.git");
    try {
      git(cwd, "branch", "codex/task-ward-flow-live-state-20260831");
      const result = run(process.execPath, [freshness, "--hook"], cwd, {
        BASE_FRESHNESS_NO_FETCH: "1",
        STALE_BASE_THRESHOLD: "1",
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe("");
    } finally {
      rmSync(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("public sign-out check uses main and ignores Database checkout claims", () => {
    const cwd = fixture("https://github.com/BigSimmo/Ward-Flow.git");
    const other = fixture("https://github.com/BigSimmo/Ward-Flow.git");
    const log = path.join(cwd, "sign-out.md");
    const file = "scripts/ward-flow/sign-out-check.mjs";
    try {
      writeFileSync(log, `Open sign-outs only\n- date | Old owner | ward/old | D:/Worktrees/Database/ag-old | ${file}\n`);
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

  it("pre-commit ownership accepts a public sign-out and ignores old Database claims", () => {
    const file = "scripts/ward-flow/sign-out-check.mjs";
    const root = fixture("https://github.com/BigSimmo/Ward-Flow.git");
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

  it("pre-commit ownership still blocks another public branch's claim", () => {
    const file = "scripts/ward-flow/sign-out-check.mjs";
    const root = fixture("https://github.com/BigSimmo/Ward-Flow.git");
    const other = fixture("https://github.com/BigSimmo/Ward-Flow.git");
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

  it("old Database ownership does not grant a public takeover", () => {
    const file = "scripts/ward-flow/sign-out-check.mjs";
    const root = fixture("https://github.com/BigSimmo/Ward-Flow.git");
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
