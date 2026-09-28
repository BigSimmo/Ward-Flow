import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { approvedTakeoverFiles, signOutConflicts, unsignedWardFiles } from "../scripts/pre-commit-checks.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const freshness = path.join(repoRoot, "scripts/check-base-freshness.mjs");
const signOut = path.join(repoRoot, "scripts/ward-flow/sign-out-check.mjs");

function run(command, args, cwd, env = {}) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 10_000,
  });
}

function git(cwd, ...args) {
  const result = run("git", args, cwd);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function fixture(origin) {
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

test("standalone Ward-Flow hook reports stale origin/main even on a ward branch", () => {
  const cwd = fixture("https://github.com/BigSimmo/Ward-Flow.git");
  try {
    const result = run(process.execPath, [freshness, "--hook"], cwd, {
      BASE_FRESHNESS_NO_FETCH: "1",
      STALE_BASE_THRESHOLD: "1",
    });
    assert.equal(result.status, 0, result.stderr);
    const hook = JSON.parse(result.stdout.trim());
    assert.match(hook.hookSpecificOutput.additionalContext, /BEHIND origin\/main/);
    assert.doesNotMatch(hook.hookSpecificOutput.additionalContext, /Never merge or rebase origin\/main/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("legacy Database ward hook remains silent", () => {
  const cwd = fixture("https://github.com/BigSimmo/Database.git");
  try {
    git(cwd, "branch", "codex/task-ward-flow-live-state-20260831");
    const result = run(process.execPath, [freshness, "--hook"], cwd, {
      BASE_FRESHNESS_NO_FETCH: "1",
      STALE_BASE_THRESHOLD: "1",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("public sign-out check uses main and ignores Database checkout claims", () => {
  const cwd = fixture("https://github.com/BigSimmo/Ward-Flow.git");
  const log = path.join(cwd, "sign-out.md");
  const file = "scripts/ward-flow/sign-out-check.mjs";
  try {
    writeFileSync(log, `Open sign-outs only\n- date | Old owner | ward/old | D:/Worktrees/Database/ag-old | ${file}\n`);
    const env = { WARD_SIGNOUT_FILE: log };
    const clear = run(process.execPath, [signOut, file], cwd, env);
    assert.equal(clear.status, 0, clear.stderr);
    assert.match(clear.stdout, /no clash/);

    writeFileSync(
      log,
      `Open sign-outs only\n- date | Public owner | ward/other | D:/Worktrees/WardFlow/ag-other | ${file}\n`,
    );
    const clash = run(process.execPath, [signOut, file], cwd, env);
    assert.equal(clash.status, 1, clash.stderr);
    assert.match(clash.stdout, /SIGNED OUT/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pre-commit ownership accepts a public sign-out and ignores old Database claims", () => {
  const file = "scripts/ward-flow/sign-out-check.mjs";
  const root = "D:/Worktrees/WardFlow/ag-startup-boundary";
  const log =
    `Open sign-outs only\n` +
    `- date | Old owner | ward/old | D:/Worktrees/Database/ag-old | ${file}\n` +
    `- date | Current owner | ward/startup-boundary | ${root} | ${file}\n`;
  assert.deepEqual(signOutConflicts([file], log, "ward/startup-boundary", root), []);
  assert.deepEqual(unsignedWardFiles([file], log, "ward/startup-boundary", root), []);
});

test("pre-commit ownership still blocks another public branch's claim", () => {
  const file = "scripts/ward-flow/sign-out-check.mjs";
  const root = "D:/Worktrees/WardFlow/ag-startup-boundary";
  const log =
    `Open sign-outs only\n` +
    `- date | Old owner | ward/old | D:/Worktrees/Database/ag-old | ${file}\n` +
    `- date | Public owner | ward/other | D:/Worktrees/WardFlow/ag-other | ${file}\n`;
  assert.deepEqual(signOutConflicts([file], log, "ward/startup-boundary", root), [
    { file, owner: "Public owner", branch: "ward/other" },
  ]);
  assert.deepEqual(unsignedWardFiles([file], log, "ward/startup-boundary", root), [file]);
});

test("old Database ownership does not grant a public takeover", () => {
  const file = "scripts/ward-flow/sign-out-check.mjs";
  const root = "D:/Worktrees/WardFlow/ag-startup-boundary";
  const log =
    `Open sign-outs only\n` +
    `- date | Old owner | ward/startup-boundary | D:/Worktrees/Database/ag-old | ${file} (approved takeover by Josh: old checkout only)\n`;
  assert.deepEqual([...approvedTakeoverFiles(log, "ward/startup-boundary", root)], []);
  assert.deepEqual(unsignedWardFiles([file], log, "ward/startup-boundary", root), [file]);
});
