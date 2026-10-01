#!/usr/bin/env node
// Ward Flow fold lock: lets many threads build in parallel but fold into the ward line one at a time.
//
//   node scripts/ward-flow/fold-lock.mjs status
//   node scripts/ward-flow/fold-lock.mjs acquire "<thread name>" [branch]
//   node scripts/ward-flow/fold-lock.mjs release "<thread name>"
//   node scripts/ward-flow/fold-lock.mjs release --stale     (only if held over 3 hours)
//
// The lock is a directory in the shared git folder, so every worktree of this repository sees the
// same lock, and creating a directory is atomic: two threads cannot both acquire it.
// Exit 0 = done; exit 1 = held by someone else (wait and retry); exit 2 = usage error.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { commitLogs } from "./logs-commit.mjs";

try {
  const remote = execFileSync("git", ["remote"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (!remote && process.env.WARD_FOLD_TEST_FIXTURE !== "1") {
    console.error(
      "Missing repository destination. Retired fold commands require an explicit test-only fixture opt-in.",
    );
    process.exit(2);
  }
  if (remote) {
    console.error("The local Ward line fold workflow is retired in a linked repository.");
    process.exit(2);
  }
} catch {
  console.error("Cannot verify repository remotes. Refusing the retired local Ward workflow.");
  process.exit(2);
}

const STALE_MS = 3 * 60 * 60 * 1000;
const wardLead = process.env.WARD_FOLD_WORKTREE ?? process.cwd();
const line = process.env.WARD_FOLD_LINE ?? "main";
const gitLead = (args) => execFileSync("git", ["-C", wardLead, ...args], { encoding: "utf8" }).trim();

const commonDir = path.resolve(execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim());
const targetCommonDir = path.resolve(wardLead, gitLead(["rev-parse", "--git-common-dir"]));
if (
  process.platform === "win32"
    ? targetCommonDir.toLowerCase() !== commonDir.toLowerCase()
    : targetCommonDir !== commonDir
) {
  console.error("Fold target belongs to a different Git repository. Refusing to touch its lock or branch.");
  process.exit(2);
}
const lockDir = path.join(commonDir, "ward-fold.lock");
const ownerFile = path.join(lockDir, "owner.json");

function readOwner() {
  try {
    return JSON.parse(readFileSync(ownerFile, "utf8"));
  } catch {
    return null;
  }
}

function describe(owner) {
  if (!owner) return "held, owner unknown (lock folder has no owner.json)";
  const mins = Math.round((Date.now() - Date.parse(owner.at)) / 60000);
  return `held by "${owner.who}" (branch ${owner.branch}) for ${mins} min, since ${owner.at}`;
}

const [cmd, who, branchArg] = process.argv.slice(2);

if (cmd === "status") {
  console.log(existsSync(lockDir) ? `Fold lock ${describe(readOwner())}.` : "Fold lock is free.");
  process.exit(0);
}

if (cmd === "acquire" && who) {
  const branch = branchArg || execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
  const lineTip = gitLead(["rev-parse", line]);
  try {
    mkdirSync(lockDir);
  } catch {
    console.log(`Fold lock ${describe(readOwner())}. Wait for it, then try again.`);
    process.exit(1);
  }
  writeFileSync(ownerFile, JSON.stringify({ who, branch, at: new Date().toISOString(), lineTip }, null, 2));
  console.log(`Fold lock acquired by "${who}" for ${branch}. Release it when the fold is done or abandoned.`);
  process.exit(0);
}

if (cmd === "release" && who) {
  const owner = readOwner();
  if (!owner) {
    console.log("Fold lock has no readable owner. Do not release it without inspecting the checkout.");
    process.exit(1);
  }
  if (who === "--stale") {
    if (!Number.isFinite(Date.parse(owner.at)) || Date.now() - Date.parse(owner.at) < STALE_MS) {
      console.log(`Not stale: ${describe(owner)}. Ask that thread instead.`);
      process.exit(1);
    }
    const currentTip = gitLead(["rev-parse", line]);
    const dirty = gitLead(["status", "--porcelain=v1", "--untracked-files=all"]);
    const mergeHead = path.resolve(wardLead, gitLead(["rev-parse", "--git-path", "MERGE_HEAD"]));
    const board = path.join(process.env.WARD_FLOW_LOGS ?? "D:/Repos/ward-flow-logs", "gate-running.md");
    const running =
      existsSync(board) &&
      readFileSync(board, "utf8")
        .split(/\r?\n/)
        .some((entry) => entry.includes(`| ${owner.who} |`));
    if (!owner.lineTip || owner.lineTip !== currentTip || dirty || existsSync(mergeHead) || running) {
      console.log(
        "Stale recovery refused: the Ward line changed, its checkout is not clean, a merge is active, or its gate is running. Inspect it first.",
      );
      process.exit(1);
    }
    console.log(`Releasing stale lock: ${describe(owner)}.`);
  } else if (owner.who !== who) {
    console.log(`Not yours: ${describe(owner)}.`);
    process.exit(1);
  }
  rmSync(lockDir, { recursive: true, force: true });
  console.log("Fold lock released.");
  // A fold has just finished: save the fold queue and sign-outs into the notes history.
  try {
    commitLogs(`fold lock released by ${who}`);
  } catch {
    // Never fail the release over the notes history.
  }
  process.exit(0);
}

console.log("Usage: fold-lock.mjs status | acquire <who> [branch] | release <who> | release --stale");
process.exit(2);
