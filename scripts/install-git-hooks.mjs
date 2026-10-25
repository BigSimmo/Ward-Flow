#!/usr/bin/env node
/**
 * install-git-hooks — point git at the committed .githooks/ directory.
 *
 * Runs automatically from the package.json `postinstall` script, so every
 * `npm install` / `npm ci` (local, CI, and Claude web containers) self-installs
 * the pre-commit documentation sync and pre-push guards. The repo's SessionStart hook only runs on remote web
 * containers, so postinstall is the reliable cross-surface install point.
 *
 * Contract: this must NEVER fail an install. Every failure path swallows the
 * error and exits 0. It is idempotent — a no-op when the repository-local
 * core.hooksPath is already `.githooks`. It never changes global or system config.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync } from "node:fs";
import path from "node:path";

const HOOKS_DIR = ".githooks";
function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function gitConfigGet([scope, key]) {
  try {
    return git(["config", scope, "--get", key]);
  } catch {
    return "";
  }
}

try {
  // Only act inside a git work tree.
  let insideRepo = false;
  try {
    insideRepo = git(["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    insideRepo = false;
  }
  if (!insideRepo) process.exit(0);

  // Set the repository-local value only. A machine-wide hooks folder (global or system config, for
  // example a secret scanner) is left in place, but it stops running in this repository, so say so
  // rather than overriding it silently.
  const current = gitConfigGet(["--local", "core.hooksPath"]);
  if (current !== HOOKS_DIR) {
    git(["config", "--local", "core.hooksPath", HOOKS_DIR]);
    console.log(`[install-git-hooks] core.hooksPath set to ${HOOKS_DIR} for this repository`);
  }
  for (const scope of ["--global", "--system"]) {
    const outer = gitConfigGet([scope, "core.hooksPath"]);
    if (outer && outer !== HOOKS_DIR) {
      console.warn(
        `[install-git-hooks] warning: your ${scope.slice(2)} core.hooksPath (${outer}) does not run in this ` +
          `repository, because it uses ${HOOKS_DIR}. Call those hooks from ${HOOKS_DIR} if you need both.`,
      );
    }
  }

  // Best-effort: ensure committed hooks are executable on POSIX (harmless on Windows).
  for (const hookName of ["pre-commit", "pre-push"]) {
    const hook = path.join(process.cwd(), HOOKS_DIR, hookName);
    if (!existsSync(hook)) continue;
    try {
      chmodSync(hook, 0o755);
    } catch {
      /* non-fatal */
    }
  }
} catch (error) {
  // Never break `npm install` over hook setup.
  console.warn(`[install-git-hooks] skipped: ${error?.message ?? error}`);
}

process.exit(0);
