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
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import os from "node:os";

const git = (argv) => execFileSync("git", argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const root = git(["rev-parse", "--show-toplevel"]);
const {
  approvedTakeoverFiles,
  isCanonicalWardFlowRemote,
  isPublicWardFlowCheckout,
  scopedActiveSignOutLines,
  signOutConflicts,
  unsignedWardFiles,
} = await import(pathToFileURL(path.join(root, "scripts/pre-commit-checks.mjs")).href);
const standaloneWardFlow = isPublicWardFlowCheckout(root);
// The line that "folded" is measured against. The legacy integration branch is absent from a fresh
// clone, so fall back to the local view of main rather than crashing; with no line at all, the
// branch comparison below cannot run and the check fails closed.
const lineExists = (ref) => {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
};
const LINE = [
  standaloneWardFlow ? "refs/remotes/origin/main" : "codex/task-ward-flow-live-state-20260831",
  "refs/remotes/origin/main",
  "refs/heads/main",
].find(lineExists);
function requireLine() {
  if (LINE) return;
  console.error(
    "sign-out-check: no line to compare task branches against (origin/main, main or the legacy line); ownership cannot be established.",
  );
  process.exit(1);
}
// Inline copy of scripts/ward-flow/logs-root.mjs: tests copy this script alone into fixtures.
const SIGN_OUT =
  process.env.WARD_SIGNOUT_FILE ||
  path
    .join(
      process.env.WARD_FLOW_LOGS ||
        (process.platform === "win32" ? "D:/Repos/ward-flow-logs" : path.join(os.homedir(), "ward-flow-logs")),
      "sign-out.md",
    )
    .replace(/\\/g, "/");
// Inline copy of withClaimFiles in scripts/pre-commit-checks.mjs (same reason as above).
function withClaimFiles(logFile, logText) {
  const dir = path.join(path.dirname(logFile), "claims");
  let names;
  try {
    names = readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return logText;
    // An existing but unreadable folder may hold releases or claims: never treat it as empty.
    throw new Error(`claims folder unreadable at ${dir}: ${error.message}`);
  }
  // Event time: claim files from the name's leading UTC stamp, log lines from their first field.
  const stamp = (text) => {
    const match = /^(\d{4})-?(\d{2})-?(\d{2})(?:[T ](\d{2}):?(\d{2}))?/.exec(text);
    return match ? match.slice(1, match[4] ? 6 : 4).join("") : null;
  };
  const files = [];
  for (const name of names) {
    let text;
    try {
      text = readFileSync(path.join(dir, name), "utf8");
    } catch (error) {
      throw new Error(`claim file unreadable at ${path.join(dir, name)}: ${error.message}`);
    }
    const lines = text.split(/\r?\n/).filter((line) => /^(?:- |RELEASED\b)/.test(line));
    if (lines.length) files.push({ key: stamp(name), lines });
  }
  if (!files.length) return logText;
  // Merge into the active section in event order, so a release only clears claims made before it.
  // A log line with only a date ties with every file that day and stays first.
  const start = logText.indexOf("## Active sign-outs");
  const nextHeading = start < 0 ? -1 : logText.indexOf("\n## ", start + 1);
  const end = nextHeading < 0 ? logText.length : nextHeading;
  const section = logText.slice(start < 0 ? 0 : start, end).replace(/\n*$/, "");
  const merged = [];
  const pending = [...files];
  for (const line of section.split(/\r?\n/)) {
    const logKey = stamp(line.replace(/^(?:- |RELEASED )\s*/, ""));
    if (logKey && /^(?:- |RELEASED )/.test(line)) {
      while (pending.length && pending[0].key !== null && logKey > pending[0].key.slice(0, logKey.length)) {
        merged.push(...pending.shift().lines);
      }
    }
    merged.push(line);
  }
  for (const file of pending) merged.push(...file.lines);
  return `${logText.slice(0, start < 0 ? 0 : start)}${merged.join("\n")}\n${logText.slice(end).replace(/^\n*/, nextHeading < 0 ? "" : "\n")}`;
}
function readSignOutText({ reportMissing = false } = {}) {
  try {
    return withClaimFiles(SIGN_OUT, readFileSync(SIGN_OUT, "utf8"));
  } catch (error) {
    if (reportMissing && error.code === "ENOENT") {
      console.log(`sign-out-check: sign-out log missing at ${SIGN_OUT}; stale entries not checked.`);
      process.exit(0);
    }
    console.error(
      `sign-out-check: sign-out log unavailable at ${SIGN_OUT} (${error.code ?? "read failed"}); ownership cannot be established.`,
    );
    process.exit(1);
  }
}
// --stale: list Active sign-out lines whose branches are all folded into the line or gone, so the
// steward can clear them after each fold. Lists only; it never edits the file.
if (process.argv[2] === "--stale") {
  const text = readSignOutText({ reportMissing: true });
  const section = scopedActiveSignOutLines(text, root);
  requireLine();
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

// Explicit, reviewed input only: normal hooks do not supply these arguments. A checksum
// pins reviewed bytes; it is not proof of approval. Admission needs separate owner authority.
const args = process.argv.slice(2);
let historicalAck;
if (args[0] === "--historical-path-ack") {
  if (args[2] !== "--sha256" || !/^[a-f0-9]{64}$/.test(args[3] ?? "") || args.length < 5) {
    console.error("sign-out-check: expected --historical-path-ack <file> --sha256 <reviewed checksum> <paths>.");
    process.exit(2);
  }
  historicalAck = { file: args[1], sha256: args[3] };
  args.splice(0, 4);
}
const files = args.map((file) => file.replace(/\\/g, "/").replace(/^\.\//, ""));
if (files.length === 0) {
  console.log("Usage: sign-out-check.mjs <file> [<file> ...] | --stale");
  process.exit(2);
}
const current = git(["branch", "--show-current"]);
const signOutText = readSignOutText();
const approved = approvedTakeoverFiles(signOutText, current, root);
if (historicalAck && approved.has(".githooks/pre-commit")) {
  console.error("sign-out-check: historical acknowledgement cannot be combined with a takeover of its hook path.");
  process.exit(1);
}
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
requireLine();
let acknowledged;
try {
  if (historicalAck) acknowledged = validateHistoricalAck(historicalAck);
} catch (error) {
  console.error(`sign-out-check: historical acknowledgement rejected: ${error.message}`);
  process.exit(1);
}
function verifyAcknowledgementStillCurrent() {
  if (!acknowledged) return;
  try {
    acknowledged.assertStable();
    const latest = readSignOutText();
    if (approvedTakeoverFiles(latest, current, root).has(".githooks/pre-commit")) {
      throw new Error("a hook takeover appeared while checking history");
    }
    if (signOutConflicts(toCheck, latest, current, root).length) {
      throw new Error("an active owner appeared while checking history");
    }
  } catch (error) {
    console.error(`sign-out-check: historical acknowledgement rejected: ${error.message}`);
    process.exit(1);
  }
}
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
function formatSignOutHint(targetFiles) {
  const unsigned =
    typeof unsignedWardFiles === "function" ? unsignedWardFiles(targetFiles, signOutText, current, root) : [];
  if (!unsigned || unsigned.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);
  const normRoot = root.replace(/\\/g, "/");
  const branchName = current || "<branch>";
  const lineTemplate = `- ${today} | <Your Name> | ${branchName} | ${normRoot} | ${unsigned.join(", ")}. repo=BigSimmo/Ward-Flow.`;

  console.log("");
  console.log(`sign-out hint: ${unsigned.length} file(s) without your active claim in ${SIGN_OUT}:`);
  for (const file of unsigned) {
    console.log(`  MISSING SELF-CLAIM  ${file}`);
  }
  console.log("  For a single-user interactive session, bypass this check via 1-command:");
  console.log('    SKIP_SIGNOUT_GUARD=1 git commit -m "..."');
  console.log(`  Or add your sign-out claim to ${SIGN_OUT}:`);
  console.log(`    ${lineTemplate}`);
}

if (!history) {
  verifyAcknowledgementStillCurrent();
  console.log(`sign-out-check: no clash for ${toCheck.length} file(s); no unfolded task commit touches them.`);
  formatSignOutHint(toCheck);
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
verifyAcknowledgementStillCurrent();
const touching = [];
let acknowledgedCount = 0;
for (const [index, branch] of unfolded.entries()) {
  for (const file of toCheck) {
    if (!changedByBranch[index].has(file)) continue;
    if (acknowledged?.covers(branch, file)) acknowledgedCount++;
    else touching.push({ file, branch });
  }
}
if (acknowledgedCount) console.log(`ACKNOWLEDGED HISTORY  .githooks/pre-commit  on ${acknowledgedCount} exact refs; active ownership remains checked.`);

for (const { file, branch } of touching) console.log(`ALSO CHANGED  ${file}  on unfolded branch ${branch}`);
if (touching.length === 0) {
  console.log(`sign-out-check: no clash for ${toCheck.length} file(s) across ${branches.length} task branches.`);
  formatSignOutHint(toCheck);
  process.exit(0);
}
console.log("sign-out-check: clash found. Tell the coordinator before editing these files.");
process.exit(1);

function validateHistoricalAck(input) {
  const target = ".githooks/pre-commit";
  const fail = (message) => { throw new Error(message); };
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const objectId = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
  const checksum = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  const requiredRefs = new Set([
    "backup/20261002-local-main-before-polish", "backup/20261002-main-before-final-polish",
    "backup/20261002-main-before-preserved-polish", "backup/local-main-historical-20261003",
    "backup/stash-2-20261004", "codex/chat-community-design-c53c", "codex/chat-outstanding-local-fold-bc23",
    "codex/chat-ward-rules-repair-7a69", "codex/chat-workflow-final-efficiency-9034",
    "codex/chat-workflow-remediation-6181", "codex/docs-rules-repair-20261002", "codex/multisystem-repair-20261001",
    "codex/polish-final-preserve-20261002", "codex/polish-gate-baseline-20261002", "codex/polish-local-fold-20261002",
    "codex/polish-main-preserve-20261002", "codex/ward-validation-repair-20261002",
    "codex/workflow-remediation-main-6181", "ward/ag-policy-softening-20261003", "ward/antigravity-docs-repair-20261003",
  ].map((ref) => `refs/heads/${ref}`));
  const boundedFile = (file) => {
    const info = statSync(file);
    if (!info.isFile() || info.size > 262_144) fail("evidence must be a regular file no larger than 256 KiB");
    const bytes = readFileSync(file);
    if (bytes.length > 262_144) fail("evidence grew beyond 256 KiB");
    return bytes;
  };
  const bytes = boundedFile(input.file);
  if (sha256(bytes) !== input.sha256) fail("record checksum mismatch");
  const record = JSON.parse(bytes.toString("utf8"));
  if (!standaloneWardFlow || record.repository !== "BigSimmo/Ward-Flow") fail("repository identity mismatch");
  if (record.version !== 1 || record.state !== "approved-for-admission") fail("record is not approved for admission");
  if (record.path !== target || !toCheck.includes(target)) fail("acknowledgement is only for the exact hook path");
  if (!objectId(record.main) || !objectId(record.mainBlob)) fail("invalid main fingerprint");
  if (!checksum(record.source?.guard) || !checksum(record.source?.parser)) fail("invalid source fingerprint");
  if (!Array.isArray(record.workingHookSha256) || record.workingHookSha256.length < 1 ||
      record.workingHookSha256.length > 2 || !record.workingHookSha256.every(checksum)) fail("invalid working-hook fingerprint");
  if (typeof record.approvalReference !== "string" || !record.approvalReference.trim()) fail("missing approval reference");
  if (typeof record.reviewEvidence?.file !== "string" || !checksum(record.reviewEvidence?.sha256)) fail("invalid review evidence");
  if (!Array.isArray(record.refs) || record.refs.length !== requiredRefs.size) fail("expected exactly the twenty reviewed refs");
  const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: "1", GIT_GRAFT_FILE: process.platform === "win32" ? "NUL" : os.devNull };
  const run = (argv, stdin) => execFileSync("git", argv, {
    cwd: root, env, input: stdin, encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
  const cache = new Map();
  const cached = (argv) => {
    const key = JSON.stringify(argv);
    if (!cache.has(key)) cache.set(key, run(argv));
    return cache.get(key);
  };
  const patchIds = new Map();
  const patchId = (commit) => {
    if (!patchIds.has(commit)) {
      const patch = cached(["show", "--format=", "--no-ext-diff", "--no-textconv", "--binary", commit, "--", target]);
      const id = run(["patch-id", "--stable"], patch).split(/\s+/)[0];
      if (!objectId(id)) fail("empty or invalid patch evidence");
      patchIds.set(commit, id);
    }
    return patchIds.get(commit);
  };
  const tips = () => new Map(run(["for-each-ref", "--format=%(refname) %(objectname)", ...requiredRefs])
    .split("\n").map((line) => line.split(" ")));
  const assertStable = () => {
    if (sha256(boundedFile(input.file)) !== input.sha256) fail("record changed during admission");
    if (!isCanonicalWardFlowRemote(run(["remote", "get-url", "origin"])) ||
        !isCanonicalWardFlowRemote(run(["remote", "get-url", "--push", "origin"]))) fail("repository identity changed");
    const selected = ["refs/remotes/origin/main", "refs/heads/main"].find((ref) => {
      try { run(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]); return true; }
      catch (error) { if (error.status === 1) return false; throw error; }
    });
    // Bind the commit, not a spelling: an equivalent offline fallback stays valid.
    if (!selected || run(["rev-parse", selected]) !== record.main || run(["rev-parse", LINE]) !== record.main) fail("main changed");
    if (run(["rev-parse", `${record.main}:${target}`]) !== record.mainBlob) fail("main hook blob changed");
    if (sha256(readFileSync(fileURLToPath(import.meta.url))) !== record.source.guard ||
        sha256(readFileSync(path.join(root, "scripts/pre-commit-checks.mjs"))) !== record.source.parser) fail("guard source changed");
    if (!record.workingHookSha256.includes(sha256(readFileSync(path.join(root, target))))) fail("working hook changed");
    if (sha256(boundedFile(record.reviewEvidence.file)) !== record.reviewEvidence.sha256) fail("review evidence changed");
    const currentTips = tips();
    for (const item of record.refs) if (currentTips.get(item.ref) !== item.tip) fail(`ref tip changed or missing: ${item.ref}`);
  };
  const seen = new Set();
  const uniqueCommits = new Set();
  const uniqueMerges = new Set();
  for (const item of record.refs) {
    if (!requiredRefs.has(item.ref) || seen.has(item.ref) || !objectId(item.tip) || !objectId(item.blob)) fail("invalid or duplicate ref binding");
    seen.add(item.ref);
    if (!Array.isArray(item.patches) || item.patches.length < 1 || item.patches.length > 6) fail("invalid patch list");
    for (const patch of item.patches) {
      if (!objectId(patch.commit) || !objectId(patch.patchId) || !objectId(patch.mainCommit)) fail("invalid patch binding");
      uniqueCommits.add(patch.commit);
    }
    if (item.merges !== undefined && !Array.isArray(item.merges)) fail("invalid merge evidence");
    if ((item.merges ?? []).length > 6) fail("more than the reviewed merge evidence");
    for (const merge of item.merges ?? []) {
      if (!objectId(merge.commit) || !objectId(merge.blob) || !Array.isArray(merge.parents) ||
          merge.parents.length < 2 || merge.parents.length > 4 || !merge.parents.every(objectId) ||
          !merge.parents.includes(merge.inheritedFrom)) fail("invalid merge binding");
      uniqueMerges.add(merge.commit);
    }
  }
  if (uniqueCommits.size > 6) fail("more than the six reviewed historical hook commits");
  if (uniqueMerges.size > 6) fail("more than the six reviewed historical merges");
  assertStable();
  for (const item of record.refs) {
    if (cached(["rev-parse", `${item.tip}:${target}`]) !== item.blob) fail("historical hook blob mismatch");
    const mergeHistory = cached(["log", "--full-history", "--merges", "--format=%H", `${record.main}..${item.tip}`, "--", target]).split("\n").filter(Boolean);
    const merges = item.merges ?? [];
    if (mergeHistory.length !== merges.length || new Set(merges.map((merge) => merge.commit)).size !== mergeHistory.length) fail("unreviewed merge history");
    for (const merge of merges) {
      const parents = cached(["rev-list", "--parents", "-n", "1", merge.commit]).split(" ").slice(1);
      if (!mergeHistory.includes(merge.commit) || JSON.stringify(parents) !== JSON.stringify(merge.parents) ||
          cached(["rev-parse", `${merge.commit}:${target}`]) !== merge.blob ||
          cached(["rev-parse", `${merge.inheritedFrom}:${target}`]) !== merge.blob) fail("novel or mismatched merge evidence");
    }
    const history = cached(["log", "--full-history", "--no-merges", "--format=%H", `${record.main}..${item.tip}`, "--", target]).split("\n").filter(Boolean);
    if (history.length !== item.patches.length || new Set(item.patches.map((patch) => patch.commit)).size !== history.length) fail("incomplete patch evidence");
    for (const patch of item.patches) {
      if (!history.includes(patch.commit) || patchId(patch.commit) !== patch.patchId) fail("historical patch evidence mismatch");
      cached(["merge-base", "--is-ancestor", patch.mainCommit, record.main]);
      if (patch.disposition === "equivalent") {
        if (patchId(patch.mainCommit) !== patch.patchId) fail("patch is not equivalent to its main evidence");
      } else if (patch.disposition === "superseded") {
        if (item.ref !== "refs/heads/ward/ag-policy-softening-20261003" || patch.decision !== "superseded-do-not-import" ||
            !objectId(patch.mainPatchId) || patchId(patch.mainCommit) !== patch.mainPatchId ||
            typeof patch.reason !== "string" || !patch.reason.trim()) fail("invalid supersession evidence");
      } else fail("unknown patch disposition");
    }
  }
  return { assertStable, covers: (branch, file) => file === target && seen.has(`refs/heads/${branch}`) };
}
