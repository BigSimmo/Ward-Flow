#!/usr/bin/env node
// Ward Flow fold queue trial merge: for every READY line in fold-queue.md, would it merge cleanly
// into the line, on its own and on top of the READY branches above it (a batch in queue order)?
//
//   node scripts/ward-flow/trial-merge.mjs [--queue <file>] [--line <ref>] [--branch <name> ...]
//
// Light git only, safe to run during a gate's test phase: it uses `git merge-tree --write-tree` and
// `git commit-tree`, which write loose objects but touch no branch, index or working tree.
// Prints one line per READY entry: CLEAN or CLASH (with the clashing files), alone and in the batch.
// A branch that clashes in the batch is left out of the running batch, as the steward would.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const queue = opt("--queue", "D:/Repos/ward-flow-logs/fold-queue.md");
const line = opt("--line", "codex/task-ward-flow-live-state-20260831");
const selected = new Set();
for (let i = 0; i < args.length; i++) {
  if (args[i] !== "--branch") continue;
  const branch = args[++i];
  if (!branch || branch.startsWith("--")) {
    console.error("trial-merge: --branch requires a branch name");
    process.exit(2);
  }
  selected.add(branch);
}
const git = (argv) => execFileSync("git", argv, { encoding: "utf8" }).trim();

const queued = readFileSync(queue, "utf8")
  .split(/\r?\n/)
  .filter((text) => /^READY(?:-FAST(?:-ENGINE)?)?\s*\|/.test(text))
  .map((text) => {
    const fields = text.split("|").map((field) => field.trim());
    return { lane: fields[0], thread: fields[1], branch: fields[2].split(/\s/)[0], sha: fields[3] };
  });
const latest = new Map(queued.map((entry, index) => [entry.branch, index]));
const entries = selected.size
  ? queued.filter((entry, index) => selected.has(entry.branch) && latest.get(entry.branch) === index)
  : queued;
for (const branch of selected) {
  if (!latest.has(branch)) {
    console.error(`trial-merge: no READY line for ${branch}`);
    process.exit(2);
  }
}

function mergeTree(base, sha) {
  const result = spawnSync("git", ["merge-tree", "--write-tree", "--name-only", base, sha], { encoding: "utf8" });
  const [tree, ...rest] = result.stdout.trim().split("\n");
  if (result.status === 0) return { clean: true, tree };
  const files = rest.filter((entry) => entry && !entry.startsWith("Auto-merging") && !entry.startsWith("CONFLICT"));
  return { clean: false, files: files.length ? files : rest };
}

let batch = git(["rev-parse", line]);
console.log(`Trial merge onto ${line} @ ${batch.slice(0, 10)} (${entries.length} READY lines)`);
for (const entry of entries) {
  const sha = spawnSync("git", ["rev-parse", "--verify", "--quiet", `${entry.sha}^{commit}`], { encoding: "utf8" });
  if (sha.status !== 0) {
    console.log(`MISSING  ${entry.thread} | ${entry.branch} | ${entry.sha} (commit not found)`);
    continue;
  }
  const commit = sha.stdout.trim();
  const alone = mergeTree(line, commit);
  const inBatch = mergeTree(batch, commit);
  if (inBatch.clean) {
    batch = git(["commit-tree", inBatch.tree, "-p", batch, "-p", commit, "-m", `trial: ${entry.branch}`]);
  }
  const describe = (result) => (result.clean ? "CLEAN" : `CLASH (${result.files.slice(0, 6).join(", ")})`);
  console.log(
    `${entry.lane.padEnd(10)} ${entry.thread} | ${entry.branch} | ${entry.sha}: alone ${describe(alone)}; in batch ${describe(inBatch)}`,
  );
}
