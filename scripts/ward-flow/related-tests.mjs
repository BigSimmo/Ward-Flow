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
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const CAP = 60;
const LINE = "codex/task-ward-flow-live-state-20260831";
const args = process.argv.slice(2);
// The public Ward-Flow repository has no local ward line; compare against its origin/main there.
const lineExists = (() => {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", `${LINE}^{commit}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const base = args.includes("--base") ? args[args.indexOf("--base") + 1] : lineExists ? LINE : "origin/main";
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
const isTest = (file) => /^tests\/.*\.test\.tsx?$/.test(file);
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
const result = spawnSync(process.execPath, runner, { cwd: root, stdio: "inherit" });
console.log("related-tests: also run your type check: node scripts/ward-flow/gate-tsc.mjs");
process.exit(rootArg && result.status !== 0 ? onlyExpectedReds() : (result.status ?? 1));

/**
 * In --root mode (ready-check's merged tree), a red that is on the expected-reds manifest is the
 * baseline, not the branch's fault: pass when every failing file is listed there and fails no more
 * tests than its entry allows (a NEW failure inside an already-red file still fails). Anything else,
 * or a missing report, fails.
 */
function onlyExpectedReds() {
  try {
    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    const manifest = JSON.parse(readFileSync(path.join(root, "tests", "ward-expected-reds.json"), "utf8"));
    const allowed = new Map(manifest.expected.map((entry) => [entry.file, entry.failing]));
    const failing = report.testResults
      .map((file) => ({
        file: path.relative(root, file.name).split(path.sep).join("/"),
        count: file.assertionResults.filter((test) => test.status === "failed").length,
      }))
      .filter((file) => file.count > 0);
    const suiteErrors = report.testResults.filter(
      (file) => file.status === "failed" && file.assertionResults.every((test) => test.status !== "failed"),
    );
    const unexpected = failing.filter((file) => !(allowed.has(file.file) && file.count <= allowed.get(file.file)));
    if (suiteErrors.length === 0 && unexpected.length === 0 && failing.length > 0) {
      console.log(
        `related-tests: the only reds are on the expected-reds manifest (${failing.map((file) => `${file.file} ${file.count}`).join(", ")}): baseline, not this branch.`,
      );
      return 0;
    }
    for (const file of unexpected) console.log(`related-tests: NEW red ${file.file} (${file.count} failing)`);
    for (const file of suiteErrors) console.log(`related-tests: file failed to run ${file.name}`);
    return 1;
  } catch (error) {
    console.log(`related-tests: could not compare with the expected-reds manifest (${error.message}); failing.`);
    return 1;
  }
}
