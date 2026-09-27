#!/usr/bin/env node
/**
 * Verify every git-object SHA and every repository path cited in the Ward Flow documents.
 *
 * WHY THIS EXISTS. The Ward Flow process documents are prose, and prose has no gate. The one
 * thing in them that CAN be checked mechanically is their citations: a document that names a
 * commit or a file is making a claim git can settle. `docs/ward-flow-safety-checklist.md`
 * records the rule this closes -- "a citation without a row looks live to every reader".
 *
 * A CITED SHA MAY NAME ANY GIT OBJECT, not only a commit. A document that quotes a blob hash as
 * a byte-identical proof, or a tree hash from `git merge-tree --write-tree` as a measured merge
 * state, is citing something real; checking only `^{commit}` reported both as broken (measured
 * 2026-09-09: 24 "unresolved SHAs", 0 real defects). Each SHA is tried as commit, then blob, then
 * tree, and the resolved type is reported so a reader sees "resolved as blob", not a bare pass.
 *
 * WHAT IT DOES NOT CHECK, stated so a green run is not read as more than it is:
 *   - whether a cited SHA is the RIGHT one;
 *   - whether a path's CONTENT still says what the document claims;
 *   - whether any rule in those documents is still true.
 * It closes the dangling-citation hole only.
 *
 * PROVE IT CAN FAIL BEFORE BELIEVING IT PASSED:
 *   node scripts/check-ward-citations.mjs --selftest   -> injects one impossible short SHA, one
 *                                                         impossible full-length (40 hex char) SHA
 *                                                         that is not any git object, and one
 *                                                         absent path; must exit 1 and name all three.
 *   node scripts/check-ward-citations.mjs              -> must exit 0 on a healthy tree.
 *   (cd /tmp && node <path>/check-ward-citations.mjs)  -> must exit 2 REFUSED, not 0.
 *
 * THREE EXIT CODES, because "clean" and "never ran" must not look alike:
 *   0  every citation resolved      1  a citation did not resolve      2  the scan never reached
 *                                                                         a corpus -- REFUSED
 *
 * COPY IT INTO ANY WORKTREE, no fold and no install (three Node builtins, no dependencies):
 *   git show claude/Wardquestions:scripts/check-ward-citations.mjs > scripts/check-ward-citations.mjs
 *
 * ALL-DIGIT TOKENS ARE REPORTED, NEVER DROPPED. `1695752` is a byte count, not a commit -- but a
 * genuinely all-digit 7-character SHA is possible (~3.7% of them), and a silent skip is the exact
 * failure this project keeps being caught by. They are listed under their own heading and do not
 * fail the run.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** Every branch a Ward Flow file may legitimately live on. A path is "found" if ANY of them has
 *  it: the documents are written across six worktrees and a path present on the branch that owns
 *  that surface is a real path, even when the branch running this check cannot see it. */
const BRANCHES = [
  // 🔴 THE MASTER LINE MUST BE FIRST AND MUST STAY. Added 2026-09-08, when this script was
  // folded onto that line from `claude/Wardquestions`. Without it the scan reported 325 missing
  // paths, of which the overwhelming majority were present in the working tree the whole time --
  // a gate whose own address book is out of date manufactures findings, and a reader who checks
  // one of them and finds it wrong stops believing the other 324, including the true ones.
  "codex/task-ward-flow-live-state-20260831",
  "claude/Wardquestions",
  "claude/ward-flow-phases-6-7-design",
  "claude/Ward-design",
  "claude/ward-flow-print-fixes",
  "claude/ward-flow-wave1-referral-corrections",
  "claude/ward-flow-setup-967aa0-wf",
];

const DOCS_DIR = "docs";

/**
 * WHICH DOCUMENTS COUNT. `ward-flow-*.md` at the top of `docs/` was the first version and it
 * covered 31 of roughly 130 ward documents -- while printing "documents scanned: 31" in a way that
 * read as the whole corpus. The plans and specs under `docs/superpowers/**` carry the most
 * citations of anything in the project and were all outside it.
 *
 * The pattern deliberately matches `ward-flow` / `ward-management` / `ward-board` rather than the
 * bare word "ward": `forward-codify-retrieval-rpcs-workorder.md` (retired with PsychSift, 26
 * September 2026) contains "ward" and is not a Ward Flow document. A one-file false positive was
 * real, in an inventory generated the same night
 * by a looser match.
 */
const DOC_PREFIX = "ward-flow-";
const WARD_DOC = /(^|[/-])ward-(flow|management|board)/;

const SHA = /`([0-9a-f]{7,40})`/g;
const PATH_RE = /`((?:src|docs|scripts|tests|worker|supabase)\/[A-Za-z0-9_./[\]-]+\.[A-Za-z0-9]+)`/g;

const selftest = process.argv.includes("--selftest");

/** git, exit status only. Never throws: a non-zero status is the answer, not an error. */
function gitOk(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * REFUSE, never crash. An absent `docs/` is the commonest way to run this from the wrong place,
 * and an uncaught ENOENT exits 1 -- which in this tool means "a citation did not resolve". Two
 * very different situations must not share an exit code.
 */
function refuse(message) {
  console.error(
    `\nREFUSED: ${message}\n` +
      `This is not a pass and it is not a failure -- it is a scan that never reached the corpus. ` +
      `Run from the repository root, on a branch that carries docs/${DOC_PREFIX}*.md.`,
  );
  process.exit(2);
}

/** Recursive, because the plans and specs live under `docs/superpowers/**` and carry the most
 *  citations in the project. Unreadable subdirectories are collected and reported rather than
 *  skipped -- a walk that silently loses a directory is the same false green this tool exists to
 *  refuse, one level up. */
const unreadable = [];
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    unreadable.push(`${dir} (${error.code ?? error.message})`);
    return [];
  }
  const found = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.name.endsWith(".md") && WARD_DOC.test(full)) found.push(full);
  }
  return found;
}

const docs = walk(DOCS_DIR);
if (unreadable.length > 0 && docs.length === 0) {
  refuse(`could not read any of: ${unreadable.join(", ")}.`);
}

/** First sighting wins, so the report points at where a reader would meet the citation. */
const shas = new Map();
const paths = new Map();

for (const doc of docs) {
  const lines = readFileSync(doc, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const m of line.matchAll(SHA)) if (!shas.has(m[1])) shas.set(m[1], [doc, index + 1]);
    for (const m of line.matchAll(PATH_RE)) if (!paths.has(m[1])) paths.set(m[1], [doc, index + 1]);
  });
}

if (selftest) {
  shas.set("deadbeefdeadbeef", ["<selftest>", 0]);
  // A full 40-hex-character string that is not any git object of any type. This is the specific
  // failure mode the commit/blob/tree fix could silently introduce: a checker that now resolves
  // ANY hex-shaped string is strictly worse than the one it replaced, because it would call every
  // one of these dangling citations clean. It must still be reported as UNRESOLVED.
  shas.set("0123456789abcdef0123456789abcdef01234567", ["<selftest>", 0]);
  paths.set("src/components/ward-management/does-not-exist.ts", ["<selftest>", 0]);
}

/**
 * REFUSE AN EMPTY SCAN. Without this, running from the wrong directory -- or in a worktree whose
 * `docs/` has no ward documents -- prints `0 SHAs, 0 unresolved` and exits 0. That is the same
 * false green as `83 passed (83)` when 84 files went in: a true-sounding result about a question
 * nobody asked. Ward Verifier named this hole within minutes of the tool being committed, having
 * built the test wrapper that refuses zero collection for exactly the same reason.
 *
 * The floors are deliberately crude. They are not a claim about how many citations SHOULD exist;
 * they only assert that the scan reached a corpus at all.
 */
const MIN_DOCS = 5;
const MIN_CITATIONS = 10;
if (docs.length < MIN_DOCS || shas.size + paths.size < MIN_CITATIONS) {
  refuse(
    `scanned ${docs.length} document(s) in ${path.resolve(DOCS_DIR)} and found ` +
      `${shas.size + paths.size} citation(s); expected at least ${MIN_DOCS} and ${MIN_CITATIONS}.`,
  );
}

/**
 * A CITED SHA IS NOT NECESSARILY A COMMIT. Git has three object types a short hex string can
 * name: commits, blobs, and trees. This project's documents cite all three on purpose --
 * `blob 51263c10` as a byte-identical mutation-test proof, a `git merge-tree --write-tree`
 * result as a measured merge state -- and a check that only tried `^{commit}` reported every one
 * of them as a broken citation. Measured on 2026-09-09: 24 "unresolved SHAs" of which an audit
 * found 0 real defects, all genuine blob/tree citations. Try commit first (the common case),
 * then blob, then tree; a citation that resolves to a real object of ANY type is not dangling.
 */
const SHA_OBJECT_TYPES = ["commit", "blob", "tree"];
function resolveShaType(sha) {
  for (const type of SHA_OBJECT_TYPES) {
    if (gitOk(["cat-file", "-e", `${sha}^{${type}}`])) return type;
  }
  return null;
}

const badShas = [];
const badPaths = [];
const ambiguous = [];
const resolvedNonCommit = [];
const shaTypeCounts = { commit: 0, blob: 0, tree: 0 };
let okShas = 0;
let okPaths = 0;

for (const [sha, where] of [...shas].sort()) {
  const type = resolveShaType(sha);
  if (type) {
    okShas += 1;
    shaTypeCounts[type] += 1;
    if (type !== "commit") resolvedNonCommit.push([sha, where, type]);
  } else if (/^[0-9]+$/.test(sha)) ambiguous.push([sha, where]);
  else badShas.push([sha, where]);
}

for (const [p, where] of [...paths].sort()) {
  if (BRANCHES.some((b) => gitOk(["rev-parse", "--quiet", "--verify", `${b}:${p}`]))) okPaths += 1;
  else badPaths.push([p, where]);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`documents scanned:     ${docs.length}`);
console.log(
  `distinct SHAs cited:   ${shas.size}   resolved: ${okShas} ` +
    `(commit: ${shaTypeCounts.commit}  blob: ${shaTypeCounts.blob}  tree: ${shaTypeCounts.tree})` +
    `   UNRESOLVED: ${badShas.length}   all-digit: ${ambiguous.length}`,
);
console.log(`distinct paths cited:  ${paths.size}   found:    ${okPaths}   MISSING:    ${badPaths.length}`);

const report = (heading, rows, width) => {
  if (rows.length === 0) return;
  console.log(`\n${heading}`);
  for (const [what, [doc, line]] of rows) console.log(`  ${pad(what, width)} ${doc}:${line}`);
};

/**
 * NAME THE TYPE, do not just count it. A bare "resolved: 24" over the old commit-only count would
 * be a silenced check -- it would look identical whether the fix worked or the check was gutted.
 * Listing each non-commit resolution as "resolved as blob" / "resolved as tree" is what lets a
 * reader confirm this run is more correct, not merely quieter.
 */
if (resolvedNonCommit.length > 0) {
  console.log(`\nSHAs resolved as blob/tree (not commit) - correct citations, not broken references`);
  for (const [sha, [doc, line], type] of resolvedNonCommit) {
    console.log(`  ${pad(sha, 42)} resolved as ${pad(type, 6)} ${doc}:${line}`);
  }
}

/**
 * SPLIT THE MISSING PATHS BY WHERE THEY ARE CITED, and say why rather than burying it.
 *
 * A dated plan under `docs/superpowers/plans/` is a RECORD OF A MOMENT. When this project moved
 * `src/app/ward-management/**` to `src/app/mockups/ward-flow/**`, every path those plans name
 * stopped resolving -- and none of them became a false claim, because a dated plan describes the
 * structure that existed when it was written.
 *
 * BOTH GROUPS STILL FAIL THE RUN. The split is there so a reader is not told there are 28 live
 * broken references when there are 28 historical ones, NOT to make the tool green: the remedy for
 * the historical group is a supersession banner on those plans, which is a claim about completed
 * work that only somebody who did it may make. Tuning this check to pass would be exactly the
 * "do not tune the threshold to make an existing diff pass" rule, applied to my own tool.
 */
const isDatedPlan = (doc) => /^docs\/superpowers\/plans\/\d{4}-\d{2}-\d{2}-/.test(doc);
const missingInPlans = badPaths.filter(([, [doc]]) => isDatedPlan(doc));
const missingElsewhere = badPaths.filter(([, [doc]]) => !isDatedPlan(doc));

report("ALL-DIGIT AND UNRESOLVED - probably a figure, reported rather than dropped", ambiguous, 42);
report("UNRESOLVED SHAs", badShas, 42);
report("PATHS ON NO WARD BRANCH - in LIVE documents, these are broken references", missingElsewhere, 58);
report(
  "PATHS ON NO WARD BRANCH - in DATED PLANS. Historical: the structure moved after they were " +
    "written. Remedy is a supersession banner on the plan, not a code change",
  missingInPlans,
  58,
);

process.exit(badShas.length > 0 || badPaths.length > 0 ? 1 : 0);
