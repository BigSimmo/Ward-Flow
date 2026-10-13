#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { fork, spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeInputSignature } from "../gate-receipts.mjs";
import { installedToolchainIdentity } from "../test-evidence-identity.mjs";
import { offlineTestEnvironment } from "../test-environment.mjs";
import { isOfflineUnitTestFile } from "../unit-test-population.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RECEIPT_SCHEMA = 1;
const RECEIPT_PRODUCER = "ward-flow-test-batch";
const RECEIPT_SCOPE = "focused batch; not full repository acceptance";
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const GUARDS = [
  "tests/ward-referral-screen-boundary.test.ts",
  "tests/ward-no-invented-screen-figures.test.ts",
  "tests/ward-override-surfaces.test.ts",
];
const digest = (value) => createHash("sha256").update(value).digest("hex");
const save = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + "\n");

function requireLiteralPath(file) {
  if (typeof file !== "string") throw new Error("A literal repository path is required");
  if (!file) throw new Error("A nonempty repository path is required");
  if (/[\0\r\n*?]/u.test(file)) throw new Error("Wildcard and control characters are refused");
  if (file.startsWith("-")) throw new Error("Options cannot be used as paths");
}

function leavesDirectory(relative) {
  if (relative === "..") return true;
  if (relative.startsWith(".." + path.sep)) return true;
  if (relative.startsWith("../")) return true;
  return path.isAbsolute(relative);
}

export function exactPath(root, file) {
  requireLiteralPath(file);
  const absolute = path.resolve(root, file);
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  if (leavesDirectory(relative)) throw new Error("Path leaves the repository");
  if (!relative) throw new Error("An input file is required");
  if (!existsSync(absolute)) throw new Error(`Missing input: ${relative}`);
  const resolved = path.relative(realpathSync(root), realpathSync(absolute));
  if (leavesDirectory(resolved)) throw new Error("Input link leaves the repository");
  return relative;
}

function requirePlan(plan) {
  if (plan.schemaVersion !== 1) throw new Error("schemaVersion 1 is required");
  if (!Array.isArray(plan.tests)) throw new Error("A tests array is required");
  if (!plan.tests.length) throw new Error("A nonempty tests array is required");
}

function selectTests(plan, root, changedFiles) {
  const tests = plan.tests.map((file) => exactPath(root, file));
  if (changedFiles.some((file) => file.startsWith("src/components/ward-management/"))) tests.push(...GUARDS);
  const selected = [...new Set(tests)].sort();
  for (const file of selected) {
    if (!isOfflineUnitTestFile(file)) throw new Error(`Not an offline unit test: ${file}`);
    exactPath(root, file);
  }
  return selected;
}

function boundedInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
  if (value < minimum) throw new Error(`${label} must be at least ${minimum}`);
  if (value > maximum) throw new Error(`${label} must be at most ${maximum}`);
  return value;
}

function executionSettings(plan, selected) {
  const executionMode = plan.executionMode ?? "focused";
  if (!["focused", "guarded"].includes(executionMode)) throw new Error("Use focused or guarded executionMode");
  if (executionMode === "focused" && selected.length > 16)
    throw new Error("Focused mode is limited to 16 exact files; split the batch or use guarded mode");
  return {
    workers: boundedInteger(plan.workers ?? 2, 1, 2, "Workers"),
    timeoutMs: boundedInteger(plan.timeoutMs ?? 180000, 1000, 900000, "Batch deadline"),
    executionMode,
  };
}

export function prepareBatch(plan, root = ROOT) {
  requirePlan(plan);
  const changedFiles = (plan.changedFiles ?? []).map((file) => exactPath(root, file));
  const selected = selectTests(plan, root, changedFiles);
  return {
    tests: selected,
    changedFiles,
    ...executionSettings(plan, selected),
    extraInputs: (plan.extraInputs ?? []).map((file) => exactPath(root, file)),
  };
}

/** @param {Record<string, string | undefined>} environment
 * @param {number} workers
 * @returns {Record<string, string | undefined>} */
export function batchEnvironment(environment, workers) {
  return offlineTestEnvironment(environment, {
    NODE_ENV: "test",
    VITEST_MAX_WORKERS: String(workers),
    GATE_RECEIPTS: "off",
    GATE_ARBITER: "off",
    WARD_GATE_EXCLUDE_FILES: "",
    WARD_GATE_SKIP_TOOLING: "",
    WARD_GATE_SHARD: "",
  });
}

function requirePassingReport(report) {
  if (!object(report)) throw new Error("A test report object is required");
  if (report.success !== true) throw new Error("A successful test report is required");
  if (report.numFailedTests !== 0 || report.numFailedTestSuites !== 0)
    throw new Error("Test failures remain or counts are missing");
  boundedInteger(report.numTotalTests, 1, Number.MAX_SAFE_INTEGER, "Total test cases");
  boundedInteger(report.numPassedTests, 1, report.numTotalTests, "Passed test cases");
  boundedInteger(report.numPendingTests, 0, report.numTotalTests, "Skipped test cases");
  const todo = report.numTodoTests === undefined ? 0 : report.numTodoTests;
  boundedInteger(todo, 0, report.numTotalTests, "TODO test cases");
  if (report.numPassedTests + report.numPendingTests + todo !== report.numTotalTests)
    throw new Error("Test case counts do not reconcile");
}

export function verifyTestReport(report, tests, root = ROOT) {
  requirePassingReport(report);
  if (!Array.isArray(report.testResults)) throw new Error("Per-file test results are required");
  for (const result of report.testResults) {
    if (!object(result) || typeof result.name !== "string" || !Array.isArray(result.assertionResults))
      throw new Error("Per-file assertions are required");
    if (!result.assertionResults.some((assertion) => assertion.status === "passed"))
      throw new Error("Every selected file must execute a passing assertion");
    if (
      result.assertionResults.some((assertion) => !["passed", "pending", "skipped", "todo"].includes(assertion.status))
    )
      throw new Error("A selected file contains failed or unknown assertion results");
  }
  const assertions = report.testResults.flatMap((result) => result.assertionResults);
  const passed = assertions.filter((assertion) => assertion.status === "passed").length;
  const todo = assertions.filter((assertion) => assertion.status === "todo").length;
  if (
    assertions.length !== report.numTotalTests ||
    passed !== report.numPassedTests ||
    todo !== (report.numTodoTests === undefined ? 0 : report.numTodoTests) ||
    assertions.length - passed - todo !== report.numPendingTests
  )
    throw new Error("Reported counts differ from observed assertions");
  const actual = report.testResults.map((result) => path.relative(root, result.name).replaceAll("\\", "/")).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...tests].sort()))
    throw new Error("Executed files differ from the exact batch selection");
  return {
    files: actual.length,
    tests: report.numTotalTests,
    passed: report.numPassedTests,
    skipped: report.numPendingTests,
    todo,
  };
}

function extraInputIdentity(root, batch) {
  const envFiles = [".env", ".env.local", ".env.test", ".env.test.local"].filter((file) =>
    existsSync(path.join(root, file)),
  );
  return [...new Set([...batch.extraInputs, ...batch.tests, ...batch.changedFiles, ...envFiles])]
    .sort()
    .map((file) => [file, digest(readFileSync(path.join(root, file)))]);
}

/** @param {string} root
 * @param {{tests:string[], changedFiles:string[], extraInputs:string[], workers:number, timeoutMs:number, executionMode:string}} batch
 * @param {Record<string, string | undefined>} environment
 * @param {string | null} [dependencies] */
export function inputIdentity(root, batch, environment, dependencies = null) {
  const source = computeInputSignature(root, null);
  if (!source) throw new Error("Source identity unavailable");
  return digest(
    JSON.stringify({
      version: 3,
      root: realpathSync(root),
      source: source.hash,
      node: digest(readFileSync(process.execPath)),
      batch,
      dependencies,
      environment: Object.entries(environment).sort(([a], [b]) => a.localeCompare(b)),
      extras: extraInputIdentity(root, batch),
    }),
  );
}

/** @param {{root: string, tests: string[]} | null} [context] */
export function reusableReceipt(receipt, identity, evidenceRoot, environment, context = null) {
  if (environment.CI) return false;
  if (!object(receipt) || !context) return false;
  if (receipt.schemaVersion !== RECEIPT_SCHEMA || receipt.producer !== RECEIPT_PRODUCER) return false;
  if (receipt.repository !== "BigSimmo/Ward-Flow" || receipt.scope !== RECEIPT_SCOPE) return false;
  if (receipt.status !== "passed") return false;
  if (receipt.identity !== identity) return false;
  if (!object(receipt.artifacts) || !object(receipt.batch) || !Array.isArray(receipt.batch.tests)) return false;
  try {
    if (receipt.root !== realpathSync(context.root)) return false;
    if (JSON.stringify([...receipt.batch.tests].sort()) !== JSON.stringify([...context.tests].sort())) return false;
    const artifacts = {};
    for (const key of ["testReport", "log"]) {
      const entry = receipt.artifacts[key];
      if (!object(entry) || typeof entry.file !== "string" || typeof entry.hash !== "string") return false;
      if (!entry.file || entry.file === "." || entry.file === ".." || path.basename(entry.file) !== entry.file)
        return false;
      if (/[<>:"|?*\\/\u0000-\u001f]/u.test(entry.file) || /[. ]$/u.test(entry.file)) return false;
      if (!/^[a-f0-9]{64}$/u.test(entry.hash)) return false;
      const file = path.join(evidenceRoot, entry.file);
      if (!lstatSync(file).isFile()) return false;
      const bytes = readFileSync(file);
      if (digest(bytes) !== entry.hash) return false;
      artifacts[key] = bytes;
    }
    const summary = verifyTestReport(JSON.parse(artifacts.testReport.toString("utf8")), context.tests, context.root);
    return object(receipt.summary) && Object.entries(summary).every(([key, value]) => receipt.summary[key] === value);
  } catch {
    // Malformed, unreadable, missing or replaced artifacts cause a fresh run, never a false pass.
    return false;
  }
}

export function executeBatch({ root, args, environment, timeoutMs, logFile, guarded = false }) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const options = {
      cwd: root,
      env: environment,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    };
    // Focused mode keeps native owned-job supervision without acquiring a run slot.
    const child = guarded
      ? spawn(process.execPath, args, options)
      : fork(fileURLToPath(new URL("../owned-child.mjs", import.meta.url)), ["--guardian"], {
          ...options,
          execArgv: [],
          stdio: ["ignore", "pipe", "pipe", "ipc"],
        });
    let completion;
    if (!guarded) {
      child.on("message", (message) => {
        if (message?.result) completion = message.result;
      });
      child.send({ command: process.execPath, args, cwd: root, env: environment, options: { windowsHide: true } });
    }
    let timedOut = false,
      finished = false,
      grace;
    const finish = (status, exitCode) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearTimeout(grace);
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
      if (status === "termination_failed") {
        child.stdout.destroy();
        child.stderr.destroy();
        if (child.connected) child.disconnect();
        child.unref();
      }
      resolve({ status, exitCode, durationMs: Date.now() - start, ownedPid: child.pid });
    };
    const append = (bytes) => writeFileSync(logFile, bytes, { flag: "a" });
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const cancel = () => {
      if (finished || timedOut) return;
      timedOut = true;
      grace = setTimeout(() => finish("termination_failed", null), 12000);
      try {
        if (guarded) child.kill("SIGTERM");
        else if (child.connected) child.send({ cancel: "SIGTERM" }, () => {});
      } catch {
        /* Close can win a termination race; the grace bound records unknown termination. */
      }
    };
    const timer = setTimeout(cancel, timeoutMs);
    const interrupt = cancel;
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    child.once("error", (error) => {
      clearTimeout(timer);
      clearTimeout(grace);
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
      reject(error);
    });
    child.once("close", (code) => {
      const exitCode = guarded ? code : (completion?.status ?? null);
      const proven = guarded || Boolean(completion && !completion.error);
      finish(timedOut ? "timed_out" : proven && exitCode === 0 ? "passed" : "failed", exitCode);
    });
  });
}

function readOption(args, index, options) {
  const switches = new Map([
    ["--reuse", "reuse"],
    ["--dry-run", "dryRun"],
  ]);
  if (switches.has(args[index])) {
    options[switches.get(args[index])] = true;
    return index;
  }
  if (!["--plan", "--output"].includes(args[index])) throw new Error(`Unknown option: ${args[index]}`);
  const name = args[index].slice(2);
  const value = args[index + 1];
  if (!value) throw new Error(`Incomplete option: ${name}`);
  options[name] = value;
  return index + 1;
}

function cliOptions(args) {
  const options = { reuse: false, dryRun: false };
  for (let i = 0; i < args.length; i++) i = readOption(args, i, options);
  if (!options.plan || !options.output)
    throw new Error("Use --plan <JSON> --output <outside-repository-directory> [--dry-run] [--reuse]");
  return options;
}

function outputDirectory(directory) {
  const output = path.resolve(directory);
  const relative = path.relative(ROOT, output);
  if (!leavesDirectory(relative)) throw new Error("Evidence must stay outside the repository");
  mkdirSync(output, { recursive: true });
  const resolved = path.relative(realpathSync(ROOT), realpathSync(output));
  if (!leavesDirectory(resolved)) throw new Error("Evidence link resolves inside the repository");
  return output;
}

function readReceipt(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function artifacts(output, result) {
  return Object.fromEntries(
    Object.entries(result).map(([key, file]) => [
      key,
      { file: path.basename(file), hash: digest(readFileSync(path.join(output, file))) },
    ]),
  );
}

function runContext(options, batch, output) {
  const environment = batchEnvironment(process.env, batch.workers);
  const reuse = options.reuse && !environment.CI;
  const dependencies = reuse ? installedToolchainIdentity(ROOT) : null;
  if (reuse && !dependencies) throw new Error("Dependency bytes unavailable; rerun without --reuse");
  const identity = inputIdentity(ROOT, batch, environment, dependencies);
  const receiptFile = path.join(output, `pass-${identity}.json`);
  return { environment, reuse, dependencies, identity, receiptFile, batch, output };
}

function tryReuse(context) {
  if (!context.reuse) return false;
  const previous = readReceipt(context.receiptFile);
  if (
    !reusableReceipt(previous, context.identity, context.output, context.environment, {
      root: ROOT,
      tests: context.batch.tests,
    })
  )
    return false;
  console.log(
    JSON.stringify({
      status: "reused",
      recordedAt: previous.recordedAt,
      summary: previous.summary,
      receiptFile: context.receiptFile,
    }),
  );
  return true;
}

function runFiles(context) {
  const { batch, output } = context;
  const prefix = `batch-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const reportFile = path.join(output, `${prefix}.tests.json`),
    logFile = path.join(output, `${prefix}.log`);
  const guarded = batch.executionMode === "guarded";
  // Both modes use current main's admission and offline wrapper. Focused mode still bounds the
  // selection and uses owned supervision, but never bypasses a shared recovery/admission hold.
  const runner = "scripts/run-vitest.mjs";
  const args = [
    path.join(ROOT, runner),
    "run",
    ...batch.tests,
    "--allowOnly=false",
    "--reporter=dot",
    "--reporter=json",
    `--outputFile=${reportFile}`,
  ];
  writeFileSync(logFile, "");
  return { args, logFile, reportFile, prefix, guarded };
}

async function runBatch(options, batch, output) {
  const context = runContext(options, batch, output);
  if (tryReuse(context)) return;
  const files = runFiles(context);
  const { args, logFile, guarded } = files;
  const result = await executeBatch({
    root: ROOT,
    args,
    environment: context.environment,
    timeoutMs: batch.timeoutMs,
    logFile,
    guarded,
  }).catch((error) => ({ status: "launch_failed", error: error.message, exitCode: null, durationMs: 0 }));
  const record = {
    ...result,
    schemaVersion: RECEIPT_SCHEMA,
    producer: RECEIPT_PRODUCER,
    repository: "BigSimmo/Ward-Flow",
    root: realpathSync(ROOT),
    identity: context.identity,
    batch,
    recordedAt: new Date().toISOString(),
    scope: RECEIPT_SCOPE,
  };
  if (result.status === "passed") validateCompletedBatch({ record, context, reportFile: files.reportFile });
  persistResult(record, context, files);
}

function persistResult(record, context, files) {
  const { output, receiptFile, reuse } = context;
  const { logFile, reportFile, prefix } = files;
  record.artifacts = artifacts(output, {
    log: path.basename(logFile),
    ...(existsSync(reportFile) ? { testReport: path.basename(reportFile) } : {}),
  });
  const recordFile = path.join(output, `${prefix}.result.json`);
  save(recordFile, record);
  if (reuse && record.status === "passed") save(receiptFile, record);
  console.log(JSON.stringify({ ...record, artifacts: undefined, recordFile }));
  if (record.status !== "passed") process.exitCode = 1;
}

function validateCompletedBatch({ record, context, reportFile }) {
  const { batch, environment, dependencies, reuse } = context;
  try {
    record.summary = verifyTestReport(JSON.parse(readFileSync(reportFile, "utf8")), batch.tests);
    const afterDependencies = reuse ? installedToolchainIdentity(ROOT) : dependencies;
    if (
      afterDependencies !== dependencies ||
      inputIdentity(ROOT, batch, environment, afterDependencies) !== record.identity
    )
      throw new Error("Inputs changed while the batch ran; result cannot validate the new source");
  } catch (error) {
    record.status = "invalid_evidence";
    record.error = error.message;
  }
}

export async function main(args = process.argv.slice(2)) {
  const options = cliOptions(args);
  const batch = prepareBatch(JSON.parse(readFileSync(path.resolve(options.plan), "utf8")));
  if (options.dryRun) {
    console.log(JSON.stringify({ ...batch, scope: "focused batch; final gates unchanged", providerCalls: 0 }));
    return;
  }
  await runBatch(options, batch, outputDirectory(options.output));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
