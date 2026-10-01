#!/usr/bin/env node
// Ward Flow fold preflight: checks everything that must be true before a branch is merged into the
// ward line, and changes nothing unless asked to make the backup branch.
//
//   node scripts/ward-flow/fold-preflight.mjs --branch <your branch> --backup <backup branch> [--who "<thread name>"]
//   node scripts/ward-flow/fold-preflight.mjs --branch <your branch> --create-backup <topic> [--who "<thread name>"]
//
// Checks, in order:
//   1. You hold the fold lock (and, with --who, it is held under that name). A stale lock is
//      reported, never broken.
//   2. The ward-lead folder is on the ward line, has no merge in progress, and has no uncommitted
//      changes. If it has any, they are listed and the fold is refused: never stash, clean or reset
//      someone else's work; ask Josh.
//   3. Your branch already contains the line's tip (you merged the latest line in and retested).
//   4. No untracked or ignored file in ward-lead sits where the merge would add a file.
//   5. The backup branch exists and points at the line's tip. --create-backup <topic> makes
//      backup/<YYYY-MM-DD>-<topic> at the tip first; that is the only thing this script writes,
//      and only when every other check passed.
//
// Exit 0 = safe to merge; 1 = refused (the reasons are printed); 2 = usage error.
// Options for testing in a scratch repo: --ward-lead <folder>.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

try {
  const remote = execFileSync("git", ["remote"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (remote) {
    console.error("The local Ward line fold workflow is retired in a linked repository.");
    process.exit(2);
  }
} catch {
  console.error("Cannot verify repository remotes. Refusing the retired local Ward workflow.");
  process.exit(2);
}

const LINE = "main";
const STALE_MS = 3 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (!["--branch", "--backup", "--create-backup", "--who", "--ward-lead"].includes(key) || args[i + 1] === undefined) {
    usage();
  }
  opts[key.slice(2)] = args[++i];
}
if (!opts.branch || (!opts.backup && !opts["create-backup"]) || (opts.backup && opts["create-backup"])) usage();

function usage() {
  console.log(
    "Usage: fold-preflight.mjs --branch <branch> (--backup <backup branch> | --create-backup <topic>) [--who <thread name>]",
  );
  process.exit(2);
}

const wardLead = path.resolve(opts["ward-lead"] ?? process.cwd());
const git = (argv) => execFileSync("git", ["-C", wardLead, ...argv], { encoding: "utf8" }).trim();
const tryGit = (argv) => {
  try {
    return git(argv);
  } catch {
    return undefined;
  }
};

const currentCommonDir = path.resolve(
  execFileSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim(),
);
const targetCommonDir = path.resolve(wardLead, git(["rev-parse", "--git-common-dir"]));
if (
  process.platform === "win32"
    ? targetCommonDir.toLowerCase() !== currentCommonDir.toLowerCase()
    : targetCommonDir !== currentCommonDir
) {
  console.error("Fold target belongs to a different Git repository. Refusing to inspect or change it.");
  process.exit(2);
}

const problems = [];
const notes = [];

// 1. The fold lock.
const commonDir = path.resolve(wardLead, git(["rev-parse", "--git-common-dir"]));
const lockDir = path.join(commonDir, "ward-fold.lock");
if (!existsSync(lockDir)) {
  problems.push(
    'The fold lock is not held. Take it first: node scripts/ward-flow/fold-lock.mjs acquire "<thread name>"',
  );
} else {
  let owner = null;
  try {
    owner = JSON.parse(readFileSync(path.join(lockDir, "owner.json"), "utf8"));
  } catch {
    // reported below
  }
  if (!owner) {
    problems.push("The fold lock is held but has no readable owner. Ask the coordinator; do not break it.");
  } else {
    const ageMs = Date.now() - Date.parse(owner.at);
    notes.push(`Fold lock held by "${owner.who}" (branch ${owner.branch}) since ${owner.at}.`);
    if (opts.who && owner.who !== opts.who) {
      problems.push(`The fold lock is held by "${owner.who}", not "${opts.who}". Wait for it; never break it.`);
    }
    if (ageMs > STALE_MS) notes.push("The lock is over three hours old. This script never breaks it.");
  }
}

// 2. The ward-lead folder.
const current = tryGit(["symbolic-ref", "--quiet", "--short", "HEAD"]);
if (current !== LINE) problems.push(`${wardLead} is on "${current ?? "a detached HEAD"}", not ${LINE}.`);
if (existsSync(path.join(path.resolve(wardLead, git(["rev-parse", "--git-dir"])), "MERGE_HEAD"))) {
  problems.push(`${wardLead} has a merge in progress (MERGE_HEAD). Another fold may be under way.`);
}
const dirty = git(["status", "--porcelain=v1", "--untracked-files=all"]);
if (dirty) {
  const lines = dirty.split("\n");
  problems.push(
    `${wardLead} has ${lines.length} uncommitted change(s). Do not fold over them, and never stash, clean or reset them. Ask Josh:\n` +
      lines
        .slice(0, 40)
        .map((line) => `      ${line}`)
        .join("\n") +
      (lines.length > 40 ? `\n      ...and ${lines.length - 40} more` : ""),
  );
}

// 3. The branch contains the line's tip.
const tip = git(["rev-parse", LINE]);
if (!tryGit(["rev-parse", "--verify", "--quiet", `${opts.branch}^{commit}`])) {
  problems.push(`Branch "${opts.branch}" does not exist.`);
} else if (tryGit(["merge-base", "--is-ancestor", tip, opts.branch]) === undefined) {
  problems.push(
    `"${opts.branch}" does not contain the line's tip ${tip.slice(0, 10)}. Merge the line into your branch in your own worktree and retest first.`,
  );
}

// 4. Untracked or ignored files the merge would overwrite.
if (tryGit(["rev-parse", "--verify", "--quiet", `${opts.branch}^{commit}`])) {
  const added = git(["diff", "--name-only", "--diff-filter=A", "-z", tip, opts.branch]).split("\0").filter(Boolean);
  const inTheWay = added.filter((file) => existsSync(path.join(wardLead, file)));
  if (inTheWay.length > 0) {
    problems.push(
      `The merge adds ${inTheWay.length} file(s) that already exist untracked or ignored in ${wardLead}. Ask Josh before touching them:\n` +
        inTheWay
          .slice(0, 40)
          .map((file) => `      ${file}`)
          .join("\n"),
    );
  }
}

// 5. The backup branch.
let backup = opts.backup;
if (opts["create-backup"]) {
  const date = new Date().toISOString().slice(0, 10);
  backup = `backup/${date}-${opts["create-backup"]}`;
  if (tryGit(["rev-parse", "--verify", "--quiet", `refs/heads/${backup}`])) {
    notes.push(`Backup branch ${backup} already exists; not changed.`);
  } else if (problems.length === 0) {
    git(["branch", backup, tip]);
    notes.push(`Created backup branch ${backup} at ${tip.slice(0, 10)}.`);
  } else {
    notes.push(`Backup branch ${backup} not created, because of the problems below.`);
  }
}
const backupSha = tryGit(["rev-parse", "--verify", "--quiet", `refs/heads/${backup}`]);
if (!backupSha) {
  if (!opts["create-backup"] || problems.length === 0) problems.push(`Backup branch "${backup}" does not exist.`);
} else if (backupSha !== tip) {
  problems.push(`Backup branch "${backup}" is at ${backupSha.slice(0, 10)}, not the line's tip ${tip.slice(0, 10)}.`);
}

for (const note of notes) console.log(note);
if (problems.length > 0) {
  console.log(`\nFold preflight REFUSED (${problems.length}):`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}
console.log(
  `\nFold preflight passed. Safe to run: git -C "${wardLead}" merge --no-ff ${opts.branch}\n` +
    `Afterwards: git -C "${wardLead}" diff ${backup}..${LINE} must show only your change; then release the lock.`,
);
