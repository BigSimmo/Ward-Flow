#!/usr/bin/env node
// Ward Flow owner tests (Josh, 25 September 2026): run only the tests that use the files you changed,
// found automatically. Never a full suite of your own; the batch gate covers the rest.
//
//   node scripts/ward-flow/related-tests.mjs [--base <ref>] [--head <ref>] [--root <dir>] [--dry-run] [--defer-source-guards]
//
// Changed files = your branch's commits since the ward line, plus uncommitted edits. Changed test
// files always run. Other test files are found by following imports backwards from each changed
// file (src/, scripts/, tests/ and backend/ward-flow/, "@/" alias and relative paths). If that selects more than CAP
// files (a file with huge fan-out, such as ward-sites.ts), it falls back to the test files that
// import a changed file DIRECTLY, and if that is still over the cap, to the changed tests alone, and
// prints "fan-out capped: batch gate covers the rest". Runs through the repo's vitest wrapper, which
// uses the per-checkout lock and 2 workers. Also run your type check: node scripts/ward-flow/gate-tsc.mjs
import { execFileSync } from "node:child_process";
import { acquireHeavyRunLock } from "../test-run-lock.mjs";
import { runOwnedChild } from "../owned-child.mjs";
import { offlineTestEnvironment } from "../test-environment.mjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { selectedBaselineVerdict } from "./selected-baseline-verdict.mjs";
import { selectRelatedTests } from "./related-test-selection.mjs";

const CAP = 60;
const LINE = "origin/main";
const args = process.argv.slice(2);
// The public Ward-Flow repository has no local ward line; compare against its origin/main there.
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : LINE;
const dryRun = args.includes("--dry-run");
// --head <ref>: judge a committed range instead of this worktree (for checking the selection).
const head = args.includes("--head") ? args[args.indexOf("--head") + 1] : null;
// --root <dir>: select and run in another tree (CI passes `.`) instead of this checkout. Changed
// files still come from git here; vitest runs directly in that folder, with 2 workers.
const rootArg = args.includes("--root") ? args[args.indexOf("--root") + 1] : null;
const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const root = rootArg ? path.resolve(rootArg) : gitRoot;
const git = (argv) => execFileSync("git", argv, { cwd: gitRoot, encoding: "utf8" });
const committedOnly = Boolean(head || rootArg);

const changed = [
  ...new Set(
    [
      ...git(["diff", "--name-only", `${base}...${head ?? "HEAD"}`]).split("\n"),
      ...(committedOnly ? [] : git(["diff", "--name-only", "HEAD"]).split("\n")),
      ...(committedOnly ? [] : git(["ls-files", "--others", "--exclude-standard"]).split("\n")),
    ]
      .map((file) => file.trim())
      .filter((file) => file && existsSync(path.join(root, file))),
  ),
];
const { selected, note, deferredSourceGuards } = selectRelatedTests({
  root,
  changed,
  cap: CAP,
  includeSourceGuards: !args.includes("--defer-source-guards"),
});
if (deferredSourceGuards.length)
  console.log(
    `related-tests: ${deferredSourceGuards.length} declared source contracts deferred to the full unit gate: ${deferredSourceGuards.join(", ")}`,
  );
console.log(`related-tests: ${note}`);
if (selected.length === 0) {
  console.log("related-tests: nothing to run. Run your type check: node scripts/ward-flow/gate-tsc.mjs");
  process.exit(0);
}
if (dryRun) {
  for (const file of selected) console.log(`  ${file}`);
  process.exit(0);
}
const reportFile = rootArg ? path.join(root, "related-tests-report.json") : null;
const runner = rootArg
  ? [
      path.join(root, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "--maxWorkers=2",
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${reportFile}`,
      ...selected,
    ]
  : [path.join(root, "scripts/run-vitest.mjs"), "run", ...selected];
const admission = acquireHeavyRunLock({ projectRoot: gitRoot, mode: "exclusive", command: "related-tests" });
let result;
try {
  result = await runOwnedChild(process.execPath, runner, {
    cwd: root,
    stdio: "inherit",
    env: offlineTestEnvironment(admission.environment),
  });
} finally {
  admission.release();
}
console.log("related-tests: also run your type check: node scripts/ward-flow/gate-tsc.mjs");
process.exit(rootArg ? onlyExpectedReds() : (result.status ?? 1));

/**
 * In --root mode, a red that is on the expected-reds manifest is the
 * baseline: require the same failure count and assertion/message signatures in the selected set.
 * Recovery, replacement failures, collection loss and abnormal exits fail. Anything else,
 * or a missing report, fails.
 */
function onlyExpectedReds() {
  try {
    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    const manifest = JSON.parse(readFileSync(path.join(root, "tests", "ward-expected-reds.json"), "utf8"));
    const verdict = selectedBaselineVerdict({ report, selected, expected: manifest.expected, root, runResult: result });
    console.log(`related-tests: ${verdict.reason}; focused evidence only, unselected files remain for the batch gate.`);
    if (!verdict.ok && verdict.comparison) console.log(JSON.stringify(verdict.comparison));
    return verdict.ok ? 0 : 1;
  } catch (error) {
    console.log(`related-tests: could not compare with the expected-reds manifest (${error.message}); failing.`);
    return 1;
  }
}
