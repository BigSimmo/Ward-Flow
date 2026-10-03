#!/usr/bin/env node
/**
 * THE WARD SUITE'S FAILING SET MUST EQUAL THE MANIFEST — IN BOTH DIRECTIONS.
 *
 * 🔴 **WHY THIS EXISTS.** The convention was "one deliberate red; any second red is a real failure".
 * It degrades silently: with two reds a run LOOKS normal to whoever reads it next and neither gets
 * investigated. It broke twice on 2026-09-06 inside one hour — once when a fix sat unfolded and the
 * line genuinely carried two, and once when a red was retired under CI pressure by quoting a
 * builder's open position as if it were the owner's ruling.
 *
 * ⚠️ **THE THIRD CHECK IS THE POINT, AND AN `it.fails` TRIPWIRE CANNOT DO IT.** An entry that STOPS
 * failing fails this gate. `it.fails` passes on ANY error including a typo in the test body, and it
 * keeps passing after the underlying defect is fixed — so it converts a visible red into an
 * invisible green. Here, a red is retired by a person deleting its entry and saying why.
 *
 * ⚠️ **AND IT MUST BE A GATE WHILE THE MANIFEST IS EMPTY, WHICH IS THE STATE IT SHIPS IN.** Set
 * equality alone is vacuous against a broken run: discover nothing, run nothing, fail nothing, and
 * `actual === expected === {}` reports success. So the run is floored on BOTH the number of files
 * walked and the number of tests executed, and either floor breaking is a hard failure with its own
 * message. The floors are the load-bearing half of this script; the comparison is the easy half.
 */
import { execFileSync } from "node:child_process";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import { runOwnedChild } from "./owned-child.mjs";
import { childProcessExitCode } from "./child-process-result.mjs";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { isOfflineUnitTestFile } from "./unit-test-population.mjs";
import { fullGateInputIdentity } from "./test-evidence-identity.mjs";
import { fileURLToPath } from "node:url";
import {
  executedAssertionCount,
  mergeGateReports,
  planFullGateRecheck,
  runFullGateBatches,
  validateBatchReport,
} from "./ward-flow/full-gate-recheck.mjs";

import { referencedTestChanges } from "./ward-flow/test-module-dependencies.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(projectRoot, "tests", "ward-expected-reds.json");
const MIN_FILE_SECONDS = 0.1;
const UNIT_DURATIONS = path.join(projectRoot, "scripts", "ward-flow", "unit-durations.json");

/**
 * Floors, deliberately well below the real population rather than at it.
 *
 * ⚠️ A floor set AT the current size goes red the day the population legitimately shrinks by one,
 * and the reflex is to lower it — which is how a floor becomes decoration. These sit far enough
 * below that only a BROKEN discovery or a BROKEN run trips them, and
 * `tests/ward-expected-reds-manifest.test.ts` asserts the real population still clears them, so the
 * headroom cannot silently evaporate.
 */
const FLOOR_FILES = 200;
const FLOOR_TESTS = 2500;

/**
 * The gate's population: every unit test file (see isUnitTestFile below). Until 26 September 2026
 * this was a ward-only union (the tests/ward-* glob plus files naming ward code), which left the
 * rest of the unit tests in no gate at all.
 */
function wardPopulation() {
  const testsDir = path.join(projectRoot, "tests");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(testsDir);
  return files
    .map((file) => path.relative(projectRoot, file).replace(/\\/gu, "/"))
    .filter((relative) => isUnitTestFile(relative))
    .sort();
}

/**
 * Every unit test Vitest collects (vitest.config.mts: tests/**\/*.test.ts and tests/**\/*.dom.test.tsx),
 * except the provider-backed *.live.test.ts. Since 26 September 2026 the gate runs ALL of them: the
 * old ward-only union skipped about 130 non-ward files, so a red there (test-runner-safety) reached
 * the line with no gate ever running it. PsychSift is gone, so every remaining test is this repo's.
 */
export const isUnitTestFile = isOfflineUnitTestFile;

/**
 * The comparison, as a pure function, so BOTH directions can be proved without a nine-minute run.
 *
 * 🔴 **THE SECOND DIRECTION IS THE ONE THAT MATTERS AND THE ONE NOBODY TESTS.** "An unexpected red
 * fails the gate" is easy to believe and easy to check. "An entry that STOPS failing also fails the
 * gate" is the property `it.fails` structurally cannot give, it is the property that would have
 * caught a red being retired under deadline pressure — and it only ever fires on a day when
 * everything looks like it is going right. A control for it belongs in the suite, not in a habit.
 */
/**
 * Tooling tests: tests whose SUBJECT is a repository script, hook or this gate, not Ward Flow itself.
 * Josh's ruling (25 September 2026, R32): a batch gate may skip them when the batch changes no
 * tooling (WARD_GATE_SKIP_TOOLING=1, from scripts/ward-flow/gate-build-flag.mjs); the night shift
 * runs them on the line tip. An explicit list, not a pattern: a product guard that happens to run a
 * script (the text-size ratchet, the wording scans) must never be skipped by accident.
 */
export const TOOLING_TESTS = [
  "tests/ci-cache-safety.test.ts",
  "tests/dependency-drift-check.test.ts",
  "tests/guard-push.test.ts",
  "tests/playwright-exit-code-contract.test.ts",
  "tests/pre-commit-checks.test.ts",
  "tests/pre-commit-ward-flow-main-guard.test.ts",
  "tests/test-runner-safety.test.ts",
  "tests/ward-errata-freshness-gate.test.ts",
  "tests/ward-expected-reds-comparison.test.ts",
  "tests/ward-expected-reds-manifest.test.ts",
  "tests/ward-expected-reds-summary.test.ts",
  "tests/ward-flow-chat-control.test.ts",
  "tests/ward-full-gate-recheck.test.ts",
  "tests/ward-gate-build-flag.test.ts",
  "tests/ward-mutation-harness-reachable.test.ts",
  "tests/ward-mutation-tooling.test.ts",
  "tests/ward-organisation-core.test.ts",
  "tests/ward-run-slot.test.ts",
  "tests/ward-run-ward-tests-skips.test.ts",
  "tests/ward-source-control-chars-gate.test.ts",
];

/**
 * Contracts for editor/agent configuration intentionally absent from the standalone public
 * repository. This exact list is excluded only by public CI, and only while all three private
 * configuration roots are absent. Product, push-guard and runtime tests remain in the suite.
 */
export const PUBLIC_ABSENT_TOOLING_TESTS = [
  "tests/agent-scopes.test.ts",
  "tests/bare-pr-publication-policy.test.ts",
  "tests/claude-code-settings.test.ts",
  "tests/cursor-mcp-contract.test.ts",
  "tests/pr-handoff-stop.test.ts",
  "tests/push-format-guard.test.ts",
  "tests/session-start-hook.test.ts",
];

export function selectPublicPopulation(population, privateRootsPresent) {
  if (privateRootsPresent) throw new Error("Public CI scope requires private editor/agent roots to be absent.");
  const excluded = new Set(PUBLIC_ABSENT_TOOLING_TESTS);
  const missing = PUBLIC_ABSENT_TOOLING_TESTS.filter((file) => !population.includes(file));
  if (missing.length > 0) throw new Error(`Public CI exclusion list is stale: ${missing.join(", ")}`);
  return population.filter((file) => !excluded.has(file));
}

export function compareFailingSet({ failing, expected }) {
  const failingCount = new Map(failing.map((entry) => [entry.file, entry.count]));
  const expectedCount = new Map(expected.map((entry) => [entry.file, entry.failing]));

  const unexpected = [...failingCount.keys()].filter((file) => !expectedCount.has(file)).sort();
  const recovered = [...expectedCount.keys()].filter((file) => !failingCount.has(file)).sort();

  /*
   * ⚠️ **THE COUNT IS WHY FILE-LEVEL KEYING IS SAFE ENOUGH, and it is Ward Builder Three's fix.**
   * Keying on file alone, a listed file with one expected red and one NEW real red is
   * indistinguishable from a listed file with one expected red — the new failure hides inside an
   * entry that is already sanctioned. Pinning test NAMES would close it and re-open the wording-pin
   * trap, where a rename reads as a fix.
   *
   * An integer closes most of it for free: `assertionResults` is already in the report. A second red
   * in a listed file moves 1 to 2 and fails. **It does NOT close everything** — swap one red for
   * another in the same file and the count is unchanged — but it turns "any number of extra reds in
   * a listed file" into "only an exactly-compensating swap".
   */
  const miscounted = [...expectedCount.entries()]
    .filter(([file]) => failingCount.has(file))
    .filter(([file, expectedFailures]) => failingCount.get(file) !== expectedFailures)
    .map(([file, expectedFailures]) => ({ file, expected: expectedFailures, actual: failingCount.get(file) }))
    .sort((a, b) => a.file.localeCompare(b.file));

  /*
   * The count cannot see a red that changes its REASON inside the same test: batch 2's
   * patient-link-default-deny kept one failing test while it started flagging a second file. An
   * entry may therefore pin `signatures` (test name plus the first line of its failure message;
   * print the current ones with --print-signatures). When pinned, any failure whose signature is
   * not on the list is reported as changed. Entries without `signatures` keep count-only checking.
   */
  const changed = [];
  for (const entry of expected) {
    if (!Array.isArray(entry.signatures)) continue;
    const actual = failing.find((failure) => failure.file === entry.file);
    for (const signature of actual?.signatures ?? []) {
      if (!entry.signatures.includes(signature)) changed.push({ file: entry.file, signature });
    }
  }

  return { unexpected, recovered, miscounted, changed };
}

/** Test name plus the first line of its failure message, with colour codes and trailing space removed. */
export function failureSignature(fullName, message = "") {
  // eslint-disable-next-line no-control-regex
  const firstLine = String(message)
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n")[0]
    .trim();
  return `${fullName} :: ${firstLine}`;
}

/**
 * Everything wrong with one manifest entry, as a list of sentences. Pure, and exported so it can be
 * exercised against entries this repository does not contain.
 *
 * 🔴 **IT LIVES HERE BECAUSE THE VALIDATORS THAT USED TO BE INSIDE THE TEST BODIES WERE VACUOUS.**
 * They looped over `manifest.expected`, which ships EMPTY, so all four passed over zero entries —
 * every day, until somebody files the first one. Proved by mutation on 2026-09-06: inverting the
 * count check to `false` and the kind check to `.not.toContain` left the suite GREEN on both.
 *
 * ⚠️ **A VALIDATOR THAT HAS NEVER RUN IS INDISTINGUISHABLE FROM ONE THAT WORKS, and an empty
 * manifest is exactly the state in which somebody "simplifies" one.** The mistake would surface
 * weeks later, on the first entry filed, as a validator that sanctions anything. Found by Ward
 * Builder Three, reviewing.
 *
 * The fix is the same one that made `compareFailingSet` provable: extract the predicate and hand it
 * fixtures the test controls, rather than hoping real data exercises it.
 */
export function validateEntry(entry, { kinds, population }) {
  const problems = [];
  if (!kinds.includes(entry.kind)) {
    problems.push(
      `kind "${entry.kind}" is not declared. An owner-question and a backlog item are different ` +
        "objects, and only the first must never be cleared to make a build green.",
    );
  }
  for (const field of ["reason", "owner", "retiredWhen"]) {
    if ((entry[field] ?? "").trim().length <= 10) {
      problems.push(
        `${field} is missing or too short. An entry without one is a red nobody can act on — it ` +
          "reads as sanctioned and is really just unexplained.",
      );
    }
  }
  if (!Number.isInteger(entry.failing) || entry.failing <= 0) {
    problems.push(
      "failing must be a positive integer. Without it a second red appearing in this file is " +
        "invisible: the entry sanctions the file rather than the specific reds it was filed for.",
    );
  }
  if (!population.includes(entry.file)) {
    problems.push(
      `${entry.file} is not in the ward population, so the gate would report it as "no longer ` +
        'failing" forever. Either it was renamed or the entry is stale.',
    );
  }
  return problems;
}

/**
 * Whether a run is big enough, and COMPLETE enough, to be worth comparing at all.
 *
 * 🔴 **`filesRan` VERSUS `files` IS THE ONE THAT MATTERS, AND THE FIRST VERSION OF THIS DID NOT HAVE
 * IT.** Found by Ward Builder Three reviewing the script rather than my summary of it. I floored on
 * files DISCOVERED and tests EXECUTED and never checked that the files I asked for came back.
 *
 * ⚠️ **THAT IS NOT HYPOTHETICAL ON THIS MACHINE.** It dropped test files three times tonight —
 * batches printing a normal summary having silently not run five files, and once two — on the same
 * box that OOMed a dev server and a commit hook. With files dropped: enough tests still run to clear
 * the sum floor, a dropped file that WOULD have failed is simply absent from `failing`, and if it is
 * not in the manifest **its red vanishes and the gate reports OK.** A new real red, silently
 * absorbed, which is the one thing this gate exists to prevent.
 *
 * **A floor on a SUM cannot substitute: a sum survives losing members.**
 */
/**
 * 🔴 **THE SUMMARY LINE, AND WHY IT IS A FUNCTION RATHER THAN A TEMPLATE AT THE CALL SITE.**
 *
 * On 2026-09-12 this gate printed, over a real run:
 *
 *     check:ward-expected-reds OK — 414 files, 4974 tests, undefined failing, all 0 manifest
 *     entries accounted for.
 *
 * ⚠️ **The failing set is an ARRAY and the template asked it for `.size`.** Arrays carry `.length`;
 * `.size` is `Map` and `Set`. **The same line asked `expected.size` and was right, because that one
 * IS a Map** — one line, two collections, two different count properties, and JavaScript answers the
 * wrong one with `undefined` rather than an error.
 *
 * 🔴 **The word that survives in a reader's memory is OK.** The verdict was sound — the sets had
 * genuinely been compared — but the evidence beside it was missing, and a tool that says OK over an
 * uncounted population will one day say OK over a real red. **Nobody rereads a line that has said OK
 * a hundred times.**
 *
 * ✅ **So this does not take a count from its caller. It takes the COLLECTION and counts it**, which
 * is the only version where a caller cannot pick the wrong property — and it **throws** rather than
 * returning a cheerful string when a count cannot be taken. `check:ward-expected-reds` reporting
 * nothing is recoverable; reporting OK is not.
 */
function countOf(collection, what) {
  if (Array.isArray(collection)) return collection.length;
  if (collection instanceof Map || collection instanceof Set) return collection.size;
  throw new Error(
    `check:ward-expected-reds cannot take a count of ${what}: expected an Array, Map or Set and got ` +
      `${collection === null ? "null" : typeof collection}. Refusing to report a verdict beside a ` +
      `figure this tool could not measure.`,
  );
}

export function summariseRun({ files, tests, failing, expected }) {
  for (const [value, what] of [
    [files, "the file count"],
    [tests, "the test count"],
  ]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(
        `check:ward-expected-reds cannot report ${what}: ${String(value)} is not a whole count. ` +
          `Refusing rather than printing a verdict beside it.`,
      );
    }
  }

  const failingCount = countOf(failing, "the failing set");
  const manifestCount = countOf(expected, "the manifest entries");

  return (
    `check:ward-expected-reds OK — ${files} files, ${tests} tests, ${failingCount} failing, ` +
    `all ${manifestCount} manifest ${manifestCount === 1 ? "entry" : "entries"} accounted for.`
  );
}

export function floorBreaches({ files, filesRan, tests }, floors = { files: FLOOR_FILES, tests: FLOOR_TESTS }) {
  const breaches = [];
  if (files < floors.files) breaches.push(`files ${files} < ${floors.files}`);
  if (tests < floors.tests) breaches.push(`tests ${tests} < ${floors.tests}`);
  if (filesRan !== undefined && filesRan !== files) {
    breaches.push(`asked for ${files} files, ${filesRan} came back — ${files - filesRan} dropped`);
  }
  return breaches;
}

/**
 * WARD_GATE_SHARD="<index>/<count>" (public CI only): run one disjoint slice of the population so
 * the slices can run on separate runners at once. Returns null when unset. Anything malformed
 * throws, so a typo can never quietly run the whole suite or nothing.
 */
export function parseGateShard(value) {
  if (value === undefined || value === "") return null;
  const match = /^(\d+)\/(\d+)$/.exec(value);
  const index = match ? Number(match[1]) : NaN;
  const count = match ? Number(match[2]) : NaN;
  if (!match || count < 1 || count > 16 || index < 1 || index > count) {
    throw new Error(`WARD_GATE_SHARD must be "<index>/<count>" with 1 <= index <= count <= 16, got "${value}".`);
  }
  return { index, count };
}

/**
 * The shard's files. With measured durations (scripts/ward-flow/unit-durations.json), files are
 * dealt longest first onto whichever shard has the least measured time so far, so the shards finish
 * at about the same moment; an unmeasured file counts as the median. Without measurements, every
 * count-th file of the sorted population. Either way the deal depends only on the population, the
 * durations and the count, so every runner computes the same split: the shards are disjoint and
 * together exactly the population, and the manifest entries each shard checks (those for its own
 * files) also cover the manifest exactly once.
 */
export function selectGateShard(population, { index, count }, durations = {}) {
  const files = [...population].sort();
  const measured = files
    .map((file) => durations[file])
    .filter((seconds) => Number.isFinite(seconds) && seconds >= 0)
    .sort((a, b) => a - b);
  if (measured.length === 0) return files.filter((_, position) => position % count === index - 1);
  const median = measured[Math.floor(measured.length / 2)];
  const shards = Array.from({ length: count }, () => ({ seconds: 0, files: [] }));
  const weighted = files
    .map((file) => {
      const seconds = durations[file];
      // The record is rounded to tenths, so a file recorded as 0 still costs a worker something; the
      // floor keeps such files spread across the shards instead of piling onto one.
      const measuredSeconds = Number.isFinite(seconds) && seconds >= 0 ? seconds : median;
      return { file, seconds: Math.max(measuredSeconds, MIN_FILE_SECONDS) };
    })
    .sort((a, b) => b.seconds - a.seconds || (a.file < b.file ? -1 : 1));
  for (const { file, seconds } of weighted) {
    let lightest = shards[0];
    for (const shard of shards) if (shard.seconds < lightest.seconds) lightest = shard;
    lightest.files.push(file);
    lightest.seconds += seconds;
  }
  return shards[index - 1].files.sort();
}

/** Measured seconds per unit test file, or {} when the record is missing or unreadable. */
export function readUnitDurations(file = UNIT_DURATIONS) {
  try {
    const seconds = JSON.parse(readFileSync(file, "utf8")).seconds;
    return seconds && typeof seconds === "object" ? seconds : {};
  } catch {
    return {};
  }
}

function fail(lines) {
  console.error(`\ncheck:ward-expected-reds FAILED\n`);
  for (const line of lines) console.error(line);
  console.error("");
  process.exit(1);
}

/**
 * True when this module was invoked directly (`node scripts/check-ward-expected-reds.mjs`), false
 * when merely imported (which the sibling control tests do, to reach the pure helpers above).
 *
 * ⚠️ **COMPARING RAW PATH STRINGS — THE PREVIOUS FORM — FAILS SILENTLY ON WINDOWS.** `argv[1]` and
 * `import.meta.url` can each be spelled through a different drive-letter case, or resolve through a
 * junction one side doesn't go through, while naming the exact same file on disk. `path.resolve(...)
 * === fileURLToPath(...)` then compares two strings that both correctly identify this file but are
 * not textually identical, so `invokedDirectly` is `false`, the whole `else` branch below never
 * runs, and the process exits 0 with no output — which reads exactly like "nothing was asked of
 * it", not like a bug. Identical fix, same rationale, as `scripts/run-ward-tests.mjs`'s own
 * `isDirectInvocation` — kept as a second copy here rather than a shared import so this file's
 * "only these two scripts, and their own tests" edit boundary stays exact.
 *
 * `fs.realpathSync` resolves both sides through any symlink/junction to the same real path, and a
 * case-insensitive compare closes the drive-letter-case gap on win32 specifically. `resolveRealPath`
 * and `platform` are injectable so this can be unit-tested for both the junction and the
 * drive-letter-case case without needing a real junction or a second OS.
 *
 * @param {string | undefined} argv1
 * @param {string} moduleUrl
 * @param {{ resolveRealPath?: (p: string) => string, platform?: string }} [options] - narrowed to
 *   the single-argument shape this function actually calls `resolveRealPath` with (never
 *   `typeof realpathSync`'s full overload set, which also demands an unused `.native` method) so a
 *   plain test double can be passed without reimplementing `fs.realpathSync`'s whole signature.
 */
export function isDirectInvocation(
  argv1,
  moduleUrl,
  { resolveRealPath = realpathSync, platform = process.platform } = {},
) {
  if (!argv1) return false;
  const real = (p) => {
    try {
      return resolveRealPath(p);
    } catch {
      return p;
    }
  };
  const invoked = real(path.resolve(argv1));
  const self = real(fileURLToPath(moduleUrl));
  return platform === "win32" ? invoked.toLowerCase() === self.toLowerCase() : invoked === self;
}

/*
 * Everything below runs ONLY when this file is executed directly. Importing it — which the control
 * test does — must never kick off the ward suite as a side effect.
 */
const invokedDirectly = isDirectInvocation(process.argv[1], import.meta.url);
if (invokedDirectly && process.env.WARD_OWNED_FULL_GATE !== "1") {
  const admission = acquireHeavyRunLock({ projectRoot, mode: "exclusive", command: "check:ward-expected-reds" });
  try {
    const result = await runOwnedChild(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      cwd: projectRoot,
      env: { ...admission.environment, WARD_OWNED_FULL_GATE: "1" },
    });
    process.exitCode = childProcessExitCode(result);
  } finally {
    admission.release();
  }
} else if (!invokedDirectly) {
  // Imported for its pure helpers above.
} else {
  // The synchronous checkpoint batch collector is itself an owned child. Only
  // a validated inherited exclusive lease may enter this branch.
  const inherited = acquireHeavyRunLock({
    projectRoot,
    mode: "exclusive",
    command: "FULL collector inherited admission",
  });
  if (!inherited.reentrant) {
    inherited.release();
    throw new Error("Owned FULL collector requires a validated inherited admission");
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const expected = new Map(manifest.expected.map((entry) => [entry.file, entry]));

  let population = wardPopulation();
  let skippedTooling = [];
  if (process.env.WARD_GATE_SKIP_TOOLING === "1") {
    const tooling = population.filter((file) => TOOLING_TESTS.includes(file));
    skippedTooling = tooling;
    population = population.filter((file) => !tooling.includes(file));
    for (const file of tooling) expected.delete(file);
    console.log(`tooling tests skipped: no tooling change (${tooling.length} files; the night shift runs them):`);
    for (const file of tooling) console.log(`    ${file}`);
  }
  if (process.env.WARD_PUBLIC_STANDALONE === "1") {
    const privateRootsPresent = [".claude", ".agents", ".cursor"].some((root) =>
      existsSync(path.join(projectRoot, root)),
    );
    population = selectPublicPopulation(population, privateRootsPresent);
    for (const file of PUBLIC_ABSENT_TOOLING_TESTS) expected.delete(file);
    console.log(`Public standalone CI: ${PUBLIC_ABSENT_TOOLING_TESTS.length} absent private-tooling suites omitted.`);
  }
  if (population.length < FLOOR_FILES) {
    fail([
      `Discovered only ${population.length} ward test files, below the floor of ${FLOOR_FILES}.`,
      "",
      "This is a BROKEN DISCOVERY, not a small suite. The comparison below would have compared an",
      "empty failing set against an empty manifest and reported success — which is the exact vacuity",
      "this floor exists to stop. Fix the walk before trusting any result from this gate.",
    ]);
  }

  // The discovery floor above is always checked on the whole population; a shard only narrows what
  // this runner executes, and drops the manifest entries that belong to another shard's files.
  let shard;
  try {
    shard = parseGateShard(process.env.WARD_GATE_SHARD);
  } catch (error) {
    fail([error.message]);
  }
  let runFloors;
  if (shard) {
    if (process.env.WARD_FULL_GATE_RECHECK) fail(["WARD_GATE_SHARD cannot be combined with WARD_FULL_GATE_RECHECK."]);
    const wholeCount = population.length;
    population = selectGateShard(population, shard, readUnitDurations());
    // Duration-balanced shards hold different numbers of files, so each shard's floors are the
    // whole-suite floors scaled by its share of the files (an equal split gives FLOOR / count).
    const share = population.length / wholeCount;
    runFloors = { files: Math.floor(FLOOR_FILES * share), tests: Math.floor(FLOOR_TESTS * share) };
    for (const file of [...expected.keys()]) if (!population.includes(file)) expected.delete(file);
    console.log(
      `Shard ${shard.index}/${shard.count}: ${population.length} of ${wholeCount} files, ${expected.size} manifest entr(y/ies).`,
    );
  }

  const reportDir = mkdtempSync(path.join(tmpdir(), "ward-reds-"));
  const reportPath = path.join(reportDir, "report.json");
  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
    if (dirty) fail(["FULL evidence requires a committed, clean tree; commit the batch before this gate."]);
    const stateDir =
      process.env.WARD_FULL_GATE_STATE_DIR ??
      path.join(
        tmpdir(),
        "ward-full-gate",
        createHash("sha256").update(projectRoot.toLowerCase()).digest("hex").slice(0, 12),
        shard ? `${commit}-shard-${shard.index}-of-${shard.count}` : commit,
      );
    const gateEnvironment = {
      ...process.env,
      CI: "true",
      ALLOW_PROVIDER_TESTS: "false",
      WARD_GATE_EXCLUDE_FILES: skippedTooling.join("\n"),
    };
    const environmentFingerprint = fullGateInputIdentity({
      root: projectRoot,
      env: gateEnvironment,
      population,
      args: ["run", "--pool=forks", "--reporter=json"],
    });
    const recheck = process.env.WARD_FULL_GATE_RECHECK;
    let report;
    if (recheck) {
      // Reuse only a complete first run, on an ancestor, after a correction confined to its failing
      // test files. An unsupported recheck exits with a reason; it never launches a surprise full run.
      const receipt = JSON.parse(readFileSync(recheck, "utf8"));
      execFileSync("git", ["merge-base", "--is-ancestor", receipt.commit, commit], {
        cwd: projectRoot,
        stdio: "ignore",
      });
      const changes = execFileSync("git", ["diff", "--name-status", `${receipt.commit}..HEAD`], {
        cwd: projectRoot,
        encoding: "utf8",
      })
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [status, ...files] = line.split("\t");
          return { status, path: files.at(-1) };
        });
      const referencedByOtherTests = referencedTestChanges({
        root: projectRoot,
        population,
        changed: changes
          .filter((change) => change.status === "M" && isOfflineUnitTestFile(change.path))
          .map((change) => change.path),
      });
      const plan = planFullGateRecheck({
        receipt,
        currentCommit: commit,
        changes,
        population,
        skippedTooling: skippedTooling.length > 0,
        environmentFingerprint,
        referencedByOtherTests,
      });
      if (!plan.eligible) fail([`Bounded recheck refused: ${plan.reason}. Run FULL on the stable corrected batch.`]);
      const args = [
        path.join(projectRoot, "node_modules", "vitest", "vitest.mjs"),
        "run",
        "--pool=forks",
        "--reporter=json",
        `--outputFile=${reportPath}`,
        ...plan.selected,
      ];
      try {
        execFileSync(process.execPath, args, {
          cwd: projectRoot,
          stdio: ["ignore", "ignore", "inherit"],
          env: gateEnvironment,
        });
      } catch {
        /* Vitest exits non-zero for a red; the JSON report decides the gate. */
      }
      if (!existsSync(reportPath)) fail(["Bounded recheck produced no JSON report."]);
      const rerun = JSON.parse(readFileSync(reportPath, "utf8"));
      const check = validateBatchReport(rerun, plan.selected, projectRoot);
      if (!check.valid) fail([`Bounded recheck incomplete: ${check.reason}`]);
      report = mergeGateReports({
        baseReport: receipt.report,
        rerunReport: rerun,
        selected: plan.selected,
        root: projectRoot,
      });
      console.log(
        `FULL recheck: ${plan.selected.length} corrected file(s) reran; ${population.length - plan.selected.length} complete earlier results reused from ${receipt.commit.slice(0, 10)}.`,
      );
    } else {
      // Each atomic batch report survives a process crash. The next run on the same commit validates
      // the saved population and resumes at the first missing batch; no passing batch runs twice.
      console.log(`FULL checkpoint: ${stateDir}`);
      report = runFullGateBatches({
        population,
        root: projectRoot,
        commit,
        skippedTooling: skippedTooling.length > 0,
        environmentFingerprint,
        stateDir,
        // A CI shard is one runner's whole share: one vitest process (still split by the command
        // length limit) avoids a second start-up and a second slowest-file tail.
        ...(shard ? { maxFiles: Number.POSITIVE_INFINITY } : {}),
        runBatch: ({ files, reportPath: batchReport }) => {
          try {
            execFileSync(
              process.execPath,
              [
                path.join(projectRoot, "node_modules", "vitest", "vitest.mjs"),
                "run",
                "--pool=forks",
                "--reporter=json",
                `--outputFile=${batchReport}`,
                ...files,
              ],
              {
                cwd: projectRoot,
                stdio: ["ignore", "ignore", "inherit"],
                env: gateEnvironment,
              },
            );
          } catch {
            /* The report retains failed assertions; absence or incompleteness still fails. */
          }
        },
      });
    }
    const totalTests = executedAssertionCount(report);
    console.log(
      `FULL assertion population: ${report.numTotalTests ?? 0} collected; ${totalTests} executed (passed or failed).`,
    );
    const suites = report.testResults ?? [];

    // WARD_SUITE_TIMINGS_OUT=<file>: keep each file's duration (the JSON report is deleted below), so
    // the gate's slowest files can be found without another run.
    if (process.env.WARD_SUITE_TIMINGS_OUT) {
      const timings = suites
        .map((suite) => ({
          file: path.relative(projectRoot, suite.name).split(path.sep).join("/"),
          seconds: Math.round(((suite.endTime ?? 0) - (suite.startTime ?? 0)) / 100) / 10,
          status: suite.status,
        }))
        .sort((a, b) => b.seconds - a.seconds);
      writeFileSync(process.env.WARD_SUITE_TIMINGS_OUT, `${JSON.stringify(timings, null, 1)}\n`);
    }

    const failingFiles = [];
    for (const suite of suites) {
      const relative = path.relative(projectRoot, suite.name).split(path.sep).join("/");
      const count = (suite.assertionResults ?? []).filter((result) => result.status === "failed").length;
      // A suite marked failed with zero failed assertions threw before running anything — a collection
      // error. That is a red, and counting it as one keeps it visible rather than invisible.
      if (count > 0 || suite.status === "failed") {
        const signatures = (suite.assertionResults ?? [])
          .filter((result) => result.status === "failed")
          .map((result) => failureSignature(result.fullName, result.failureMessages?.[0]));
        failingFiles.push({ file: relative, count: Math.max(count, 1), signatures });
      }
    }

    // The run collects by the config's include, not by an explicit list, so prove the two agree:
    // a file the config collects that `population` does not name could hold a red no manifest
    // entry can cover, and a population file the run never reported is a dropped file.
    const collected = new Set(suites.map((suite) => path.relative(projectRoot, suite.name).split(path.sep).join("/")));
    const unexpectedlyCollected = [...collected].filter((file) => !population.includes(file)).sort();
    const neverReported = population.filter((file) => !collected.has(file));
    if (unexpectedlyCollected.length > 0 || neverReported.length > 0) {
      fail([
        "The files Vitest ran are not the gate's population:",
        ...unexpectedlyCollected.map((file) => `    ran but not in the population: ${file}`),
        ...neverReported.map((file) => `    in the population but never reported: ${file}`),
        "",
        "vitest.config.mts's include and wardPopulation() have drifted apart. Fix whichever is wrong;",
        "never compare a run against a population it did not execute.",
      ]);
    }

    const breaches = floorBreaches({ files: population.length, filesRan: suites.length, tests: totalTests }, runFloors);
    if (breaches.length > 0) {
      fail([
        "The run is not sound enough to compare:",
        ...breaches.map((breach) => `    ${breach}`),
        "",
        "A DROPPED FILE IS THE DANGEROUS ONE. Its tests simply do not appear, so a red inside it is",
        "absent from the failing set rather than reported — and if it is not in the manifest, this gate",
        "would have said OK. This machine has dropped files repeatedly; re-run before believing this.",
      ]);
    }

    if (process.argv.includes("--print-signatures")) {
      for (const failure of failingFiles) {
        console.log(`${failure.file}:`);
        for (const signature of failure.signatures) console.log(`  ${JSON.stringify(signature)}`);
      }
    }

    const { unexpected, recovered, miscounted, changed } = compareFailingSet({
      failing: failingFiles,
      expected: [...expected.values()],
    });
    const problemFiles = [
      ...new Set([
        ...unexpected,
        ...recovered,
        ...miscounted.map((item) => item.file),
        ...changed.map((item) => item.file),
      ]),
    ].sort();
    if (!recheck) {
      const receiptPath = path.join(stateDir, `receipt-${Date.now()}-${process.pid}.json`);
      const receipt = {
        version: 2,
        commit,
        population,
        skippedTooling: skippedTooling.length > 0,
        environmentFingerprint,
        problemFiles,
        report: {
          ...report,
          testResults: suites.map((suite) => ({
            ...suite,
            name: path.relative(projectRoot, suite.name).split(path.sep).join("/"),
          })),
        },
      };
      writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`, { flag: "wx" });
      appendFileSync(
        path.join(stateDir, "findings.log"),
        `${new Date().toISOString()} | complete population | ${population.length} files | ${totalTests} tests | gate problem files: ${problemFiles.join(", ") || "none"} | receipt: ${receiptPath}\n`,
      );
      console.log(`FULL receipt: ${receiptPath}`);
    }

    const problems = [];
    if (unexpected.length > 0) {
      problems.push(
        `${unexpected.length} ward test file(s) are failing and are NOT in the manifest:`,
        ...unexpected.map((file) => `    ${file}`),
        "",
        "These are real failures. Fix them, or — only if a red is deliberate and holds something open —",
        "add an entry to tests/ward-expected-reds.json with its kind, its reason, and whose question it",
        "is. An entry whose reason is a guess is worse than no entry.",
        "",
      );
    }
    if (recovered.length > 0) {
      problems.push(
        `${recovered.length} manifest entr(y/ies) are NO LONGER FAILING:`,
        ...recovered.map((file) => `    ${file} — ${expected.get(file)?.reason ?? "(no reason recorded)"}`),
        "",
        "⚠️ THIS IS THE CHECK THAT EXISTS FOR THIS DIRECTION AND IT IS NOT A FORMALITY. A red that stops",
        "failing has either been fixed — in which case delete the entry and say so — or, if its kind is",
        "owner-question, the question it was holding open may have just been answered BY DEFAULT by",
        "somebody's change. Read the entry before clearing it. Do not delete an entry to make this pass.",
        "",
      );
    }
    if (changed.length > 0) {
      problems.push(
        `${changed.length} failure(s) inside listed files do NOT match their pinned signatures:`,
        ...changed.map((entry) => `    ${entry.file} — ${entry.signature}`),
        "",
        "A listed red has changed its reason, or a new red is hiding inside an approved entry. Treat it",
        "as a new failure. Re-pin only after reading it, and never to make the gate green.",
        "",
      );
    }
    if (miscounted.length > 0) {
      problems.push(
        `${miscounted.length} manifest entr(y/ies) are failing a DIFFERENT NUMBER of times than recorded:`,
        ...miscounted.map((entry) => `    ${entry.file} — expected ${entry.expected}, found ${entry.actual}`),
        "",
        "A listed file is sanctioned for the reds its entry records, not for any number of them. A count",
        "that went UP is a new failure hiding inside an entry somebody already approved. A count that",
        "went DOWN means part of what the entry was holding open has resolved — read the entry before",
        "adjusting the number.",
        "",
      );
    }
    if (problems.length > 0) fail(problems);

    console.log(summariseRun({ files: population.length, tests: totalTests, failing: failingFiles, expected }));
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
}
