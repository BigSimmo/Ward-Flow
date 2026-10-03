#!/usr/bin/env node
// Ward Flow owner tests (Josh, 25 September 2026): run only the tests that use the files you changed,
// found automatically. Never a full suite of your own; the batch gate covers the rest.
//
//   node scripts/ward-flow/related-tests.mjs [--base <ref>] [--head <ref>] [--root <dir>] [--dry-run]
//
// Changed files = your branch's commits since the ward line, plus uncommitted edits. Changed test
// files always run. Other test files are found by following imports backwards from each changed
// file (src/, scripts/ and tests/, "@/" alias and relative paths). If that selects more than CAP
// files (a file with huge fan-out, such as ward-sites.ts), it falls back to the test files that
// import a changed file DIRECTLY, and if that is still over the cap, to the changed tests alone, and
// prints "fan-out capped: batch gate covers the rest". Runs through the repo's vitest wrapper, which
// uses the per-checkout lock and 2 workers. Also run your type check: node scripts/ward-flow/gate-tsc.mjs
import { execFileSync } from "node:child_process";
import { acquireHeavyRunLock } from "../test-run-lock.mjs";
import { runOwnedChild } from "../owned-child.mjs";
import { offlineTestEnvironment } from "../test-environment.mjs";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { selectedBaselineVerdict } from "./selected-baseline-verdict.mjs";
import { isOfflineUnitTestFile } from "../unit-test-population.mjs";

const CAP = 60;
const LINE = "origin/main";
const args = process.argv.slice(2);
// The public Ward-Flow repository has no local ward line; compare against its origin/main there.
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : LINE;
const dryRun = args.includes("--dry-run");
// --head <ref>: judge a committed range instead of this worktree (for checking the selection).
const head = args.includes("--head") ? args[args.indexOf("--head") + 1] : null;
// --root <dir>: select and run in an exported tree (ready-check's merged tree) instead of this
// checkout. Changed files still come from git here; vitest runs directly in that folder, with 2
// workers, because the caller already holds a run slot.
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
const isTest = isOfflineUnitTestFile;
const isCode = (file) => /\.(tsx?|mjs|js|cjs|css)$/.test(file);
const changedTests = changed.filter(isTest);
const sources = changed.filter((file) => isCode(file) && !isTest(file));

// With no changed source/helper, the graph cannot add a test: changed tests are already selected.
// Keep the normal graph for any executable source (including shared test helpers) or CSS change.
const files = [];
for (const dir of sources.length ? ["src", "scripts", "tests"] : []) {
  (function walk(d) {
    if (!existsSync(path.join(root, d))) return;
    for (const entry of readdirSync(path.join(root, d), { withFileTypes: true })) {
      const rel = `${d}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(rel);
      } else if (/\.(tsx?|mjs|js)$/.test(entry.name)) files.push(rel);
    }
  })(dir);
}

const resolve = (from, specifier) => {
  let target;
  if (specifier.startsWith("@/")) target = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith("."))
    target = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  else return null;
  for (const candidate of [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.mjs`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
  ]) {
    const full = path.join(root, candidate);
    if (existsSync(full) && statSync(full).isFile()) return candidate;
  }
  return null;
};
const importers = new Map();
for (const file of files) {
  const text = readFileSync(path.join(root, file), "utf8");
  for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)["']([^"']+)["']/g)) {
    const target = resolve(file, match[1]);
    if (!target) continue;
    if (!importers.has(target)) importers.set(target, new Set());
    importers.get(target).add(file);
  }
}

const transitive = new Set(changedTests);
const direct = new Set(changedTests);
for (const source of sources) {
  const seen = new Set([source]);
  const queue = [source];
  while (queue.length) {
    const current = queue.shift();
    for (const importer of importers.get(current) ?? []) {
      if (seen.has(importer)) continue;
      seen.add(importer);
      if (isTest(importer)) {
        transitive.add(importer);
        if (current === source) direct.add(importer);
      } else queue.push(importer);
    }
  }
}

let selected = [...transitive];
let note = `${selected.length} related test file(s) for ${changed.length} changed file(s)`;
if (selected.length > CAP) {
  selected = [...direct];
  note = `fan-out capped: ${transitive.size} related files; running the ${selected.length} that import a changed file directly. The batch gate covers the rest.`;
  if (selected.length > CAP) {
    // The changed tests, plus each changed module's own unit tests (tests named after it, such as
    // tests/ward-eligibility*.test.ts for ward-eligibility.ts).
    const stems = sources.map((source) => path.posix.basename(source).replace(/\.[^.]+$/, ""));
    const ownTests = [...direct].filter((test) => stems.some((stem) => path.posix.basename(test).startsWith(stem)));
    selected = [...new Set([...changedTests, ...ownTests])];
    note = `fan-out capped: ${transitive.size} related, ${direct.size} direct; running the ${changedTests.length} changed test file(s) and ${ownTests.length} unit test(s) named after the changed modules. The batch gate covers the rest.`;
  }
}
// Guards that read source text instead of importing it, so the import walk above never finds them.
// Any change to a ward-facing file always runs them (26 Sept: the referral boundary guard caught two
// ward-screen pieces only at the full gate).
const SOURCE_READING_GUARDS = [
  "tests/ward-referral-screen-boundary.test.ts",
  "tests/ward-no-invented-screen-figures.test.ts",
  // 26 Sept: override-surfaces also reads source, and caught a ward-board change only at the gate.
  "tests/ward-override-surfaces.test.ts",
];
if (changed.some((file) => file.startsWith("src/components/ward-management/"))) {
  for (const guard of SOURCE_READING_GUARDS) if (existsSync(path.join(root, guard))) selected.push(guard);
  selected = [...new Set(selected)];
}
selected.sort();
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
 * In --root mode (ready-check's merged tree), a red that is on the expected-reds manifest is the
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
