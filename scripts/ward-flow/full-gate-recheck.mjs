// A FULL run can be rechecked without repeating its passing files only for an isolated test-file
// correction. Source and shared-runner changes may affect tests outside an import graph: fail closed.
import path from "node:path";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const TEST = /^tests\/.*\.(?:test\.ts|dom\.test\.tsx)$/;
const MAX_RECHECK_FILES = 8;
const sameFiles = (a, b) => a.length === b.length && a.every((file, index) => file === b[index]);
const sorted = (files) => [...files].sort();

export function splitFullGateBatches(files, { maxFiles = 100, maxChars = 12_000 } = {}) {
  const batches = [];
  let batch = [];
  for (const file of files) {
    if (file.length > maxChars) throw new Error(`test path exceeds command limit: ${file}`);
    if (batch.length && (batch.length >= maxFiles || [...batch, file].join(" ").length > maxChars)) {
      batches.push(batch);
      batch = [];
    }
    batch.push(file);
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export function validateBatchReport(report, expectedFiles, root) {
  if (!Array.isArray(report?.testResults) || !Number.isInteger(report.numTotalTests) || report.numTotalTests < 1)
    return { valid: false, reason: "missing or empty Vitest report" };
  const files = report.testResults.map((suite) => relativeName(root, suite.name));
  if (new Set(files).size !== files.length || !sameFiles(sorted(files), sorted(expectedFiles)))
    return { valid: false, reason: "batch result files differ from selected files" };
  if (report.testResults.some((suite) => !Array.isArray(suite.assertionResults)))
    return { valid: false, reason: "batch result has no assertion list" };
  const failing = report.testResults
    .filter((suite) => suite.status === "failed" || suite.assertionResults.some((test) => test.status === "failed"))
    .map((suite) => relativeName(root, suite.name));
  return { valid: true, failing };
}

export function runFullGateBatches({
  population,
  root,
  commit,
  skippedTooling,
  environmentFingerprint = "",
  stateDir,
  runBatch,
  maxFiles = 100,
}) {
  const batches = splitFullGateBatches(population, { maxFiles });
  const identity = {
    version: 1,
    commit,
    root: path.resolve(root),
    population,
    skippedTooling,
    environmentFingerprint,
    batches,
  };
  mkdirSync(stateDir, { recursive: true });
  const identityPath = path.join(stateDir, "state.json");
  if (existsSync(identityPath)) {
    const saved = JSON.parse(readFileSync(identityPath, "utf8"));
    if (JSON.stringify(saved) !== JSON.stringify(identity))
      throw new Error(
        "FULL checkpoint belongs to a different commit, checkout or population; choose a fresh state directory",
      );
  } else {
    writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`, { flag: "wx" });
  }
  const testResults = [];
  let numTotalTests = 0;
  for (const [index, files] of batches.entries()) {
    const stable = path.join(stateDir, `batch-${String(index + 1).padStart(3, "0")}.json`);
    const resumed = existsSync(stable);
    if (!resumed) {
      const pending = `${stable}.${process.pid}.${Date.now()}.partial`;
      runBatch({ files, index, reportPath: pending });
      if (!existsSync(pending)) throw new Error(`batch ${index + 1} produced no report`);
      const candidate = JSON.parse(readFileSync(pending, "utf8"));
      const check = validateBatchReport(candidate, files, root);
      if (!check.valid) throw new Error(`batch ${index + 1} is incomplete: ${check.reason}`);
      renameSync(pending, stable);
      appendFileSync(
        path.join(stateDir, "findings.log"),
        `${new Date().toISOString()} | batch ${index + 1}/${batches.length} | ${files.length} files | ${candidate.numTotalTests} tests | failures: ${check.failing.join(", ") || "none"}\n`,
      );
    }
    const report = JSON.parse(readFileSync(stable, "utf8"));
    const check = validateBatchReport(report, files, root);
    if (!check.valid) throw new Error(`saved batch ${index + 1} is invalid: ${check.reason}`);
    console.log(
      `FULL batch ${index + 1}/${batches.length}: ${resumed ? "reused" : "ran"} ${files.length} files, ${report.numTotalTests} tests; failures: ${check.failing.length}.`,
    );
    testResults.push(...report.testResults);
    numTotalTests += report.numTotalTests;
  }
  return { numTotalTests, testResults };
}

export function planFullGateRecheck({
  receipt,
  currentCommit,
  changes,
  population,
  skippedTooling,
  environmentFingerprint,
  referencedByOtherTests = /** @type {string[]} */ ([]),
  minimumTests = 2500,
}) {
  const refuse = (reason) => ({ eligible: false, reason });
  if (receipt?.version !== 1 || !/^[a-f0-9]{40}$/.test(receipt.commit ?? ""))
    return refuse("missing or invalid full-run receipt");
  if (!/^[a-f0-9]{40}$/.test(currentCommit ?? "") || currentCommit === receipt.commit)
    return refuse("recheck needs a new committed tip");
  if (receipt.skippedTooling !== skippedTooling) return refuse("the tooling-test selection changed");
  if (receipt.environmentFingerprint !== environmentFingerprint) return refuse("the test environment changed");
  if (!Array.isArray(receipt.population) || !sameFiles(sorted(receipt.population), sorted(population)))
    return refuse("the test population changed");
  const prior = receipt.report;
  if (!Array.isArray(prior?.testResults) || (prior.numTotalTests ?? 0) < minimumTests)
    return refuse("the original full report is incomplete");
  const ran = prior.testResults.map((suite) => suite.name);
  if (new Set(ran).size !== ran.length || !sameFiles(sorted(ran), sorted(population)))
    return refuse("the original full report did not cover exactly the population");
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > MAX_RECHECK_FILES)
    return refuse("the correction is empty or too broad");
  if (changes.some(({ status, path: file }) => status !== "M" || !TEST.test(file)))
    return refuse("source, setup, new, deleted or renamed tests require FULL");
  const selected = sorted([...new Set(changes.map((change) => change.path))]);
  if (selected.some((file) => !population.includes(file) || referencedByOtherTests.includes(file)))
    return refuse("a changed test is uncollected or imported by another test");
  if (
    !Array.isArray(receipt.problemFiles) ||
    receipt.problemFiles.length === 0 ||
    receipt.problemFiles.some((file) => !selected.includes(file))
  )
    return refuse("the original gate problem extends beyond the changed tests");
  return { eligible: true, selected };
}

const relativeName = (root, name) =>
  path.isAbsolute(name) ? path.relative(root, name).replace(/\\/g, "/") : name.replace(/\\/g, "/");

export function mergeGateReports({ baseReport, rerunReport, selected, root }) {
  if (!Array.isArray(baseReport?.testResults) || !Array.isArray(rerunReport?.testResults))
    throw new Error("missing test results in the full or recheck report");
  const replacements = new Map();
  for (const suite of rerunReport.testResults) {
    const file = relativeName(root, suite.name);
    if (!selected.includes(file) || replacements.has(file) || !Array.isArray(suite.assertionResults))
      throw new Error(`unexpected or duplicate recheck result: ${file}`);
    replacements.set(file, suite);
  }
  if (replacements.size !== selected.length)
    throw new Error(`recheck reported ${replacements.size} of ${selected.length} selected files`);
  const testResults = baseReport.testResults.map((suite) => {
    const replacement = replacements.get(suite.name);
    return { ...(replacement ?? suite), name: path.resolve(root, suite.name) };
  });
  const numTotalTests = testResults.reduce((total, suite) => total + suite.assertionResults.length, 0);
  return { ...baseReport, testResults, numTotalTests };
}
