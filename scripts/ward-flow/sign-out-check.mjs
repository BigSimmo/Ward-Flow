#!/usr/bin/env node
// Before you sign out files: who else is signed out on them, and which other unfolded branches
// already change them? Light git only.
//
//   node scripts/ward-flow/sign-out-check.mjs <file> [<file> ...]
//
// Lists, per file: sign-out.md entries from this repository, and every other local task branch
// (not yet in main) whose changes since main touch the file. Exit 1 if any clash, so
// you stop and tell the coordinator before editing.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const git = (argv) => execFileSync("git", argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const root = git(["rev-parse", "--show-toplevel"]);
const { approvedTakeoverFiles, isPublicWardFlowCheckout, scopedActiveSignOutLines, signOutConflicts } = await import(
  pathToFileURL(path.join(root, "scripts/pre-commit-checks.mjs")).href
);
const standaloneWardFlow = isPublicWardFlowCheckout(root);
const LINE = standaloneWardFlow ? "refs/remotes/origin/main" : "codex/task-ward-flow-live-state-20260831";
const SIGN_OUT = process.env.WARD_SIGNOUT_FILE ?? "D:/Repos/ward-flow-logs/sign-out.md";
function readSignOutText() {
  return existsSync(SIGN_OUT) ? readFileSync(SIGN_OUT, "utf8") : "";
}
// --stale: list Active sign-out lines whose branches are all folded into the line or gone, so the
// steward can clear them after each fold. Lists only; it never edits the file.
if (process.argv[2] === "--stale") {
  const text = readSignOutText();
  const section = scopedActiveSignOutLines(text, root);
  const gitLineTip = execFileSync("git", ["rev-parse", LINE], { encoding: "utf8" }).trim();
  const state = (branch) => {
    let tip;
    try {
      tip = execFileSync("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return "gone";
    }
    // A new branch at the line tip can have active sign-outs before its first commit.
    if (tip === gitLineTip) return "open";
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", branch, LINE], { stdio: "ignore" });
      return "folded";
    } catch {
      return "open";
    }
  };
  let stale = 0;
  for (const line of section.split(/\r?\n/).filter((entry) => entry.startsWith("- "))) {
    const fields = line
      .slice(2)
      .split("|")
      .map((field) => field.trim());
    const branches = (fields[2] ?? "").split(/[,\s]+/).filter((name) => /^[\w./-]+\/[\w./-]+$/.test(name));
    if (branches.length === 0) continue;
    const states = branches.map((branch) => `${branch} ${state(branch)}`);
    if (states.every((entry) => !entry.endsWith(" open"))) {
      stale++;
      console.log(`STALE  ${fields[1]}: ${states.join(", ")}`);
    }
  }
  console.log(`sign-out-check: ${stale} stale sign-out line(s).`);
  process.exit(0);
}

const files = process.argv.slice(2).map((file) => file.replace(/\\/g, "/"));
if (files.length === 0) {
  console.log("Usage: sign-out-check.mjs <file> [<file> ...] | --stale");
  process.exit(2);
}
const current = git(["branch", "--show-current"]);
const signOutText = readSignOutText();
const approved = approvedTakeoverFiles(signOutText, current, root);
const toCheck = files.filter((file) => !approved.has(file));
for (const file of files) if (approved.has(file)) console.log(`APPROVED TAKEOVER  ${file}`);
if (toCheck.length === 0) {
  console.log(`sign-out-check: approved takeover for ${files.length} exact file(s).`);
  process.exit(0);
}
const signedOut = signOutConflicts(toCheck, signOutText, current, root);
if (signedOut.length) {
  for (const { file, owner, branch } of signedOut) console.log(`SIGNED OUT  ${file}  by ${owner} (${branch})`);
  console.log("sign-out-check: active sign-out clash. Seek the owner's release or Josh's scoped takeover.");
  process.exit(1);
}

// No branch can have changed a requested path if no task commit outside the line touched it.
// This common case avoids opening every historical branch for a new file.
const history = git([
  "--literal-pathspecs",
  "log",
  "--full-history",
  standaloneWardFlow ? "--branches" : "--branches=ward/*",
  "--not",
  LINE,
  "--format=%H",
  "--",
  ...toCheck,
]);
if (!history) {
  console.log(`sign-out-check: no clash for ${toCheck.length} file(s); no unfolded task commit touches them.`);
  process.exit(0);
}

const branchPrefix = standaloneWardFlow ? "refs/heads/" : "refs/heads/ward/";
const branches = git(["for-each-ref", "--format=%(refname:short)", branchPrefix])
  .split("\n")
  .filter((branch) => branch && branch !== current && branch !== "main");
// Ask Git for folded refs once. A merge-base subprocess per branch made this lightweight
// ownership check take over 25 seconds in a repository with hundreds of historical branches.
const folded = new Set(
  git(["for-each-ref", `--merged=${LINE}`, "--format=%(refname:short)", branchPrefix])
    .split("\n")
    .filter(Boolean),
);
const unfolded = branches.filter((branch) => !folded.has(branch));
const changedByBranch = new Array(unfolded.length);
const execGit = promisify(execFile);
let next = 0;
async function scan() {
  while (next < unfolded.length) {
    const index = next++;
    // Bound concurrent read-only Git comparisons and each command's runtime. Results stay in
    // branch order, and any failure stops the check rather than falsely reporting no clash.
    const { stdout } = await execGit(
      "git",
      ["--literal-pathspecs", "diff", "--name-only", `${LINE}...${unfolded[index]}`, "--", ...toCheck],
      { encoding: "utf8", timeout: 30_000 },
    );
    changedByBranch[index] = new Set(stdout.trim().split(/\r?\n/));
  }
}
await Promise.all(Array.from({ length: Math.min(4, unfolded.length) }, scan));
const touching = [];
for (const [index, branch] of unfolded.entries()) {
  for (const file of toCheck) if (changedByBranch[index].has(file)) touching.push({ file, branch });
}

for (const { file, branch } of touching) console.log(`ALSO CHANGED  ${file}  on unfolded branch ${branch}`);
if (touching.length === 0) {
  console.log(`sign-out-check: no clash for ${toCheck.length} file(s) across ${branches.length} task branches.`);
  process.exit(0);
}
console.log("sign-out-check: clash found. Tell the coordinator before editing these files.");
process.exit(1);
