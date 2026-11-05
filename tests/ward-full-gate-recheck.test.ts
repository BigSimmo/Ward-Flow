import { describe, expect, it } from "vitest";
import path from "node:path";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  approvedPlatformSkippedFiles,
  executedAssertionCount,
  suiteExecutionSummary,
  mergeGateReports,
  planFullGateRecheck,
  runFullGateBatches,
  splitFullGateBatches,
  validateBatchReport,
  validatePolicyReport,
  withGateRunResult,
} from "../scripts/ward-flow/full-gate-recheck.mjs";

const root = "/work";
const names = ["tests/a.test.ts", "tests/b.test.ts", "tests/c.dom.test.tsx"];
const windowsSkippedFile = "tests/guard-push-no-merge-base.test.ts";
const suite = (name: string, status = "passed") => ({
  name,
  status,
  assertionResults: [{ status: status === "failed" ? "failed" : "passed" }],
});
const receipt = () => ({
  version: 2,
  commit: "a".repeat(40),
  population: names,
  platform: process.platform,
  approvedSkippedFiles: [],
  skippedTooling: false,
  environmentFingerprint: "offline-default",
  problemFiles: [names[1]],
  report: withGateRunResult(
    { numTotalTests: 3, testResults: [suite(names[0]), suite(names[1], "failed"), suite(names[2])] },
    names,
    root,
    { status: 1 },
  ),
});
const input = () => ({
  receipt: receipt(),
  currentCommit: "b".repeat(40),
  changes: [{ status: "M", path: names[1] }],
  population: names,
  skippedTooling: false,
  environmentFingerprint: "offline-default",
  referencedByOtherTests: [],
  minimumTests: 3,
});

describe("a bounded full gate recheck", () => {
  it("floors executed assertions rather than skipped, pending, todo or unknown assertions", () => {
    const report = {
      numTotalTests: 2500,
      testResults: [
        {
          ...suite(names[0]),
          assertionResults: [
            { status: "passed" },
            { status: "failed" },
            { status: "pending" },
            { status: "skipped" },
            { status: "todo" },
            { status: "unknown" },
          ],
        },
      ],
    };
    expect(executedAssertionCount(report)).toBe(2);
    const prior = receipt();
    prior.report.numTotalTests = 2500;
    prior.report.testResults[0].assertionResults = [{ status: "pending" }];
    expect(planFullGateRecheck({ ...input(), receipt: prior }).eligible).toBe(false);
  });

  it("records executed and skipped populations separately for every named suite", () => {
    const report = {
      testResults: [
        {
          ...suite(names[0]),
          assertionResults: [
            { status: "passed" },
            { status: "failed" },
            { status: "skipped" },
            { status: "todo" },
            { status: "unknown" },
          ],
        },
        { ...suite(names[1]), assertionResults: [{ status: "pending" }] },
        { ...suite(names[2], "failed"), assertionResults: [] },
      ],
    };
    const expected = [
      { file: names[0], status: "passed", executed: 2, passed: 1, failed: 1, skipped: 1, todo: 1, unknown: 1 },
      { file: names[1], status: "passed", executed: 0, passed: 0, failed: 0, skipped: 1, todo: 0, unknown: 0 },
      { file: names[2], status: "failed", executed: 0, passed: 0, failed: 0, skipped: 0, todo: 0, unknown: 0 },
    ];
    expect(suiteExecutionSummary(report, root)).toEqual(expected);
    expect(withGateRunResult(report, names, root, { status: 1 }).wardGateRuns[0].suites).toEqual(expected);
  });

  it("requires each selected policy suite to execute a passed assertion while permitting legitimate skips", () => {
    const report = {
      numTotalTests: 2,
      testResults: [{ ...suite(names[0]), assertionResults: [{ status: "pending" }, { status: "skipped" }] }],
    };
    expect(validateBatchReport(report, [names[0]], root).valid).toBe(false);
    expect(validateBatchReport(report, [names[0]], root, { approvedSkippedFiles: [names[0]] }).valid).toBe(false);
    expect(validatePolicyReport(report, [names[0]], root).valid).toBe(false);
    report.testResults[0].assertionResults.push({ status: "passed" });
    expect(validatePolicyReport(report, [names[0]], root)).toEqual({ valid: true, failing: [] });
    report.testResults[0].assertionResults.push({ status: "unknown" });
    expect(validatePolicyReport(report, [names[0]], root).valid).toBe(false);
    report.testResults[0].assertionResults.pop();
    report.testResults.push({ ...suite(names[1]), assertionResults: [{ status: "pending" }] });
    expect(validatePolicyReport(report, names.slice(0, 2), root).valid).toBe(false);
  });

  it("selects a changed failing test and reuses only complete earlier results", () => {
    expect(planFullGateRecheck(input())).toEqual({ eligible: true, selected: [names[1]] });
  });

  it.each([
    ["source changed", { changes: [{ status: "M", path: "src/lib/ward-flow-engine.ts" }] }],
    ["test added", { changes: [{ status: "A", path: "tests/new.test.ts" }] }],
    ["test deleted", { changes: [{ status: "D", path: names[1] }] }],
    ["test renamed", { changes: [{ status: "R100", path: names[1] }] }],
    ["different test changed", { changes: [{ status: "M", path: names[0] }] }],
    ["shared test import", { referencedByOtherTests: [names[1]] }],
    ["tooling scope changed", { skippedTooling: true }],
    ["test environment changed", { environmentFingerprint: "different" }],
    ["same commit", { currentCommit: "a".repeat(40) }],
    [
      "too many failures",
      { receipt: { ...receipt(), problemFiles: Array.from({ length: 9 }, (_, i) => `tests/${i}.test.ts`) } },
    ],
    [
      "missing previous suite",
      {
        receipt: {
          ...receipt(),
          report: { numTotalTests: 3, testResults: [suite(names[0]), suite(names[1], "failed")] },
        },
      },
    ],
    ["changed population", { population: names.slice(0, 2) }],
  ])("refuses reuse when %s", (_name, override) => {
    expect(planFullGateRecheck({ ...input(), ...override }).eligible).toBe(false);
  });

  it("replaces only rerun suites and refuses a missing or unexpected result", () => {
    const rerun = withGateRunResult(
      {
        numTotalTests: 2,
        testResults: [
          { ...suite(path.resolve(root, names[1])), assertionResults: [{ status: "passed" }, { status: "passed" }] },
        ],
      },
      [names[1]],
      root,
      { status: 0 },
    );
    const merged = mergeGateReports({ baseReport: receipt().report, rerunReport: rerun, selected: [names[1]], root });
    expect(merged.numTotalTests).toBe(4);
    expect(merged.wardGateRuns.map((run: { status: number }) => run.status)).toEqual([1, 0]);
    expect(validateBatchReport(merged, names, root, { requireProcessEvidence: true }).valid).toBe(true);
    expect(merged.testResults.map((result: { name: string; status: string }) => [result.name, result.status])).toEqual([
      [path.resolve(root, names[0]), "passed"],
      [path.resolve(root, names[1]), "passed"],
      [path.resolve(root, names[2]), "passed"],
    ]);
    expect(() =>
      mergeGateReports({ baseReport: receipt().report, rerunReport: { testResults: [] }, selected: [names[1]], root }),
    ).toThrow();
    expect(() =>
      mergeGateReports({
        baseReport: receipt().report,
        rerunReport: { testResults: [suite(path.resolve(root, names[0]))] },
        selected: [names[1]],
        root,
      }),
    ).toThrow();
  });

  it("refuses a legacy receipt or a bounded rerun with abnormal process evidence", () => {
    const legacy = receipt();
    expect(
      planFullGateRecheck({
        ...input(),
        receipt: { ...legacy, report: { numTotalTests: 3, testResults: legacy.report.testResults } },
      }).eligible,
    ).toBe(false);
    const rerun = withGateRunResult({ numTotalTests: 1, testResults: [suite(names[1])] }, [names[1]], root, {
      status: 1,
    });
    expect(() =>
      mergeGateReports({ baseReport: receipt().report, rerunReport: rerun, selected: [names[1]], root }),
    ).toThrow(/exit status/);
  });
});

describe("explicit platform-only skipped suites", () => {
  const skippedReport = () => ({
    numTotalTests: 1,
    testResults: [{ name: windowsSkippedFile, status: "passed", assertionResults: [{ status: "pending" }] }],
  });

  it("accepts only the selected known Windows skip and keeps policy execution strict", () => {
    const report = skippedReport();
    const options = { platform: "win32" as const, approvedSkippedFiles: [windowsSkippedFile] };
    expect(approvedPlatformSkippedFiles([windowsSkippedFile], "win32")).toEqual([windowsSkippedFile]);
    expect(approvedPlatformSkippedFiles([windowsSkippedFile], "linux")).toEqual([]);
    expect(approvedPlatformSkippedFiles(names, "win32")).toEqual([]);
    expect(validateBatchReport(report, [windowsSkippedFile], root, options).valid).toBe(true);
    expect(executedAssertionCount(report)).toBe(0);
    expect(validatePolicyReport(report, [windowsSkippedFile], root).valid).toBe(false);
    expect(validateBatchReport(report, [windowsSkippedFile], root, { ...options, platform: "linux" }).valid).toBe(
      false,
    );
    expect(validateBatchReport(report, [windowsSkippedFile], root, { platform: "win32" }).valid).toBe(false);
  });

  it("rejects forged, duplicate or unselected approval entries even alongside passing results", () => {
    const report = { numTotalTests: 1, testResults: [suite(names[0])] };
    for (const approvedSkippedFiles of [[names[0]], [windowsSkippedFile], [windowsSkippedFile, windowsSkippedFile]]) {
      expect(validateBatchReport(report, [names[0]], root, { platform: "win32", approvedSkippedFiles }).valid).toBe(
        false,
      );
    }
    expect(
      validateBatchReport(
        { ...report, testResults: [{ ...suite(names[0]), assertionResults: [{ status: "pending" }] }] },
        [names[0]],
        root,
        {
          platform: "win32",
          approvedSkippedFiles: [names[0]],
        },
      ).valid,
    ).toBe(false);
  });

  it("validates a known Windows skip identically when fresh and resumed and refuses another platform", () => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-platform-skip-"));
    let calls = 0;
    const options = {
      root,
      stateDir,
      population: [windowsSkippedFile],
      platform: "win32" as const,
      approvedSkippedFiles: [windowsSkippedFile],
      skippedTooling: false,
      commit: "a".repeat(40),
      environmentFingerprint: "controlled-platform-contract",
      runBatch: ({ reportPath }: { reportPath: string }) => {
        calls++;
        writeFileSync(reportPath, JSON.stringify(skippedReport()));
        return { status: 0 };
      },
    };
    try {
      expect(executedAssertionCount(runFullGateBatches(options))).toBe(0);
      expect(executedAssertionCount(runFullGateBatches(options))).toBe(0);
      expect(calls).toBe(1);
      expect(() => runFullGateBatches({ ...options, platform: "linux", approvedSkippedFiles: [] })).toThrow(
        /different commit, checkout or population/,
      );
      expect(calls).toBe(1);
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it("uses the same platform contract when validating receipts and merging a bounded correction", () => {
    const population = [windowsSkippedFile, names[1]];
    const platform = "win32" as const;
    const approvedSkippedFiles = [windowsSkippedFile];
    const prior = {
      ...receipt(),
      population,
      platform,
      approvedSkippedFiles,
      report: withGateRunResult(
        {
          numTotalTests: 2,
          testResults: [...skippedReport().testResults, suite(names[1], "failed")],
        },
        population,
        root,
        { status: 1 },
      ),
    };
    const options = {
      ...input(),
      receipt: prior,
      population,
      platform,
      approvedSkippedFiles,
      minimumTests: 1,
    };
    expect(planFullGateRecheck(options)).toEqual({ eligible: true, selected: [names[1]] });
    expect(planFullGateRecheck({ ...options, platform: "linux", approvedSkippedFiles: [] }).eligible).toBe(false);
    expect(planFullGateRecheck({ ...options, receipt: { ...prior, approvedSkippedFiles: [names[1]] } }).eligible).toBe(
      false,
    );
    const corrected = withGateRunResult({ numTotalTests: 1, testResults: [suite(names[1])] }, [names[1]], root, {
      status: 0,
    });
    const merged = mergeGateReports({
      baseReport: prior.report,
      rerunReport: corrected,
      selected: [names[1]],
      root,
      platform,
      approvedSkippedFiles,
    });
    expect(
      validateBatchReport(merged, population, root, { requireProcessEvidence: true, platform, approvedSkippedFiles })
        .valid,
    ).toBe(true);
    expect(executedAssertionCount(merged)).toBe(1);
    expect(() =>
      mergeGateReports({
        baseReport: prior.report,
        rerunReport: corrected,
        selected: [names[1]],
        root,
        platform: "linux",
      }),
    ).toThrow(/selected files not run/);
  });
});

describe("crash-resumable FULL batches", () => {
  it("partitions deterministically within file and command-length limits", () => {
    const batches = splitFullGateBatches(names, { maxFiles: 2, maxChars: 36 });
    expect(batches.flat()).toEqual(names);
    expect(batches.every((batch: string[]) => batch.length <= 2 && batch.join(" ").length <= 36)).toBe(true);
  });

  it("collects an explicit manifest-backed shard atomically beyond command-length limits", () => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-single-shard-"));
    const population = Array.from({ length: 500 }, (_, index) => `tests/long-hosted-shard-regression-${index}.test.ts`);
    const calls: string[][] = [];
    expect(population.join(" ").length).toBeGreaterThan(12_000);
    try {
      const report = runFullGateBatches({
        population,
        root,
        commit: "a".repeat(40),
        skippedTooling: false,
        environmentFingerprint: "manifest-backed-shard",
        stateDir,
        singleBatch: true,
        maxFiles: Number.POSITIVE_INFINITY,
        runBatch: ({ files, reportPath }: { files: string[]; reportPath: string }) => {
          calls.push(files);
          writeFileSync(
            reportPath,
            JSON.stringify({ numTotalTests: files.length, testResults: files.map((file) => suite(file)) }),
          );
          return { status: 0 };
        },
      });
      expect(calls).toEqual([population]);
      expect(report.testResults.map((entry: { name: string }) => entry.name)).toEqual(population);
      expect(report.wardGateRuns).toHaveLength(1);
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it("keeps local batching and refuses its checkpoints when switching selection transport", () => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-transport-change-"));
    const calls: string[][] = [];
    const options = {
      population: names,
      root,
      commit: "a".repeat(40),
      skippedTooling: false,
      environmentFingerprint: "controlled-input",
      stateDir,
      maxFiles: 2,
      runBatch: ({ files, reportPath }: { files: string[]; reportPath: string }) => {
        calls.push(files);
        writeFileSync(
          reportPath,
          JSON.stringify({ numTotalTests: files.length, testResults: files.map((file) => suite(file)) }),
        );
        return { status: 0 };
      },
    };
    try {
      runFullGateBatches(options);
      expect(calls).toEqual([names.slice(0, 2), names.slice(2)]);
      expect(() => runFullGateBatches({ ...options, singleBatch: true })).toThrow(
        /different commit, checkout or population/,
      );
      expect(calls).toHaveLength(2);
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it("rejects an old checkpoint even when its former batches contain the same population", () => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-legacy-transport-"));
    let calls = 0;
    const options = {
      population: names,
      root,
      commit: "a".repeat(40),
      skippedTooling: false,
      environmentFingerprint: "controlled-input",
      stateDir,
      singleBatch: true,
      runBatch: ({ files, reportPath }: { files: string[]; reportPath: string }) => {
        calls++;
        writeFileSync(
          reportPath,
          JSON.stringify({ numTotalTests: files.length, testResults: files.map((file) => suite(file)) }),
        );
        return { status: 0 };
      },
    };
    try {
      runFullGateBatches(options);
      const identityPath = path.join(stateDir, "state.json");
      const legacy = JSON.parse(readFileSync(identityPath, "utf8"));
      legacy.version = 3;
      delete legacy.selectionTransport;
      writeFileSync(identityPath, JSON.stringify(legacy));
      expect(() => runFullGateBatches(options)).toThrow(/different commit, checkout or population/);
      expect(calls).toBe(1);
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it.each([
    ["a missing selected file", { numTotalTests: 1, testResults: [suite(names[0])] }, { status: 0 }],
    [
      "a wholly skipped suite",
      {
        numTotalTests: 2,
        testResults: [suite(names[0]), { ...suite(names[1]), assertionResults: [{ status: "pending" }] }],
      },
      { status: 0 },
    ],
    [
      "an import crash reported as green",
      { numTotalTests: 1, testResults: [suite(names[0]), { name: names[1], status: "failed", assertionResults: [] }] },
      { status: 0 },
    ],
    [
      "an interrupted launch",
      { numTotalTests: 2, testResults: names.slice(0, 2).map((file) => suite(file)) },
      { status: null, signal: "SIGTERM" },
    ],
  ])("refuses %s in explicit single-batch mode", (_label, report, runResult) => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-single-incomplete-"));
    try {
      expect(() =>
        runFullGateBatches({
          population: names.slice(0, 2),
          root,
          commit: "a".repeat(40),
          skippedTooling: false,
          environmentFingerprint: "controlled-input",
          stateDir,
          singleBatch: true,
          runBatch: ({ reportPath }: { reportPath: string }) => {
            writeFileSync(reportPath, JSON.stringify(report));
            return runResult;
          },
        }),
      ).toThrow(/batch 1 is incomplete/);
      expect(existsSync(path.join(stateDir, "batch-001.json"))).toBe(false);
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it("accepts only a complete saved batch before it may be reused", () => {
    const report = {
      numTotalTests: 2,
      testResults: [suite(path.resolve(root, names[0])), suite(path.resolve(root, names[1]))],
    };
    expect(validateBatchReport(report, names.slice(0, 2), root)).toEqual({ valid: true, failing: [] });
    expect(
      validateBatchReport({ ...report, testResults: report.testResults.slice(0, 1) }, names.slice(0, 2), root).valid,
    ).toBe(false);
    expect(
      validateBatchReport(
        { ...report, testResults: [report.testResults[0], report.testResults[0]] },
        names.slice(0, 2),
        root,
      ).valid,
    ).toBe(false);
    expect(validateBatchReport({ ...report, numTotalTests: 0 }, names.slice(0, 2), root).valid).toBe(false);
  });

  it.each([
    ["all-passed report with exit 1", { status: 1 }, "passed", {}],
    ["failed assertions with exit 0", { status: 0 }, "failed", {}],
    ["abnormal exit", { status: 2 }, "failed", {}],
    ["signal after reporting", { status: null, signal: "SIGTERM" }, "passed", {}],
    ["launch error", { status: null, error: new Error("spawn failed") }, "passed", {}],
    ["missing process result", undefined, "passed", {}],
    ["unhandled errors alongside acknowledged failures", { status: 1 }, "failed", { unhandledErrors: ["synthetic"] }],
    ["reported errors", { status: 1 }, "failed", { errors: ["synthetic"] }],
    ["reported unhandled count", { status: 1 }, "failed", { numUnhandledErrors: 1 }],
  ])("does not checkpoint or resume %s", (_label, runResult, status, extra) => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-invalid-"));
    const report = { numTotalTests: 1, testResults: [suite(names[0], status)], ...extra };
    const options = {
      population: [names[0]],
      root,
      commit: "a".repeat(40),
      skippedTooling: false,
      environmentFingerprint: "controlled-fixture-input",
      stateDir,
      runBatch: ({ reportPath }: { reportPath: string }) => {
        writeFileSync(reportPath, JSON.stringify(report));
        return runResult;
      },
    };
    try {
      expect(() => runFullGateBatches(options)).toThrow(/batch 1 is incomplete/);
      const stable = path.join(stateDir, "batch-001.json");
      expect(existsSync(stable)).toBe(false);
      // Saved results must pass the same process checks as fresh reports.
      writeFileSync(stable, JSON.stringify(withGateRunResult(report, [names[0]], root, runResult)));
      expect(() => runFullGateBatches(options)).toThrow(/saved batch 1 is invalid/);
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it("retains ordinary exit-1 assertion failures for manifest comparison and checkpoint reuse", () => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-red-"));
    let calls = 0;
    const options = {
      population: [names[0]],
      root,
      commit: "a".repeat(40),
      skippedTooling: false,
      environmentFingerprint: "controlled-fixture-input",
      stateDir,
      runBatch: ({ reportPath }: { reportPath: string }) => {
        calls++;
        writeFileSync(reportPath, JSON.stringify({ numTotalTests: 1, testResults: [suite(names[0], "failed")] }));
        return { status: 1 };
      },
    };
    try {
      expect(runFullGateBatches(options).wardGateRuns[0].status).toBe(1);
      expect(runFullGateBatches(options).testResults[0].status).toBe("failed");
      expect(calls).toBe(1);
      const stable = path.join(stateDir, "batch-001.json");
      const legacy = JSON.parse(readFileSync(stable, "utf8"));
      delete legacy.wardGateRuns;
      writeFileSync(stable, JSON.stringify(legacy));
      expect(() => runFullGateBatches(options)).toThrow(/missing test process evidence/);
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it.each([
    ["an empty assertion list", { name: names[0], status: "failed", message: "Failed to load url ./missing" }, []],
    ["no assertion list", { name: names[0], status: "failed", message: "SyntaxError" }, undefined],
  ])("counts an import-crash suite with %s as a failing file rather than aborting", (_label, crashed, list) => {
    const crashSuite = list === undefined ? crashed : { ...crashed, assertionResults: list };
    const report = { numTotalTests: 1, testResults: [crashSuite, suite(names[1])] };
    const evidenced = withGateRunResult(report, names.slice(0, 2), root, { status: 1 });
    expect(evidenced.wardGateRuns[0].failingFiles).toEqual([names[0]]);
    expect(validateBatchReport(evidenced, names.slice(0, 2), root, { requireProcessEvidence: true })).toEqual({
      valid: true,
      failing: [names[0]],
    });
    // A lone crashed file collects zero tests; it is still a failing file, never an empty report.
    const lone = withGateRunResult({ numTotalTests: 0, testResults: [crashSuite] }, [names[0]], root, { status: 1 });
    expect(validateBatchReport(lone, [names[0]], root, { requireProcessEvidence: true })).toEqual({
      valid: true,
      failing: [names[0]],
    });
    // Never tightened away: a crash with exit 0, or a crash the evidence omits, still refuses.
    const exitZero = withGateRunResult(report, names.slice(0, 2), root, { status: 0 });
    expect(validateBatchReport(exitZero, names.slice(0, 2), root).valid).toBe(false);
    const omitted = { ...evidenced, wardGateRuns: [{ ...evidenced.wardGateRuns[0], failingFiles: [] }] };
    expect(validateBatchReport(omitted, names.slice(0, 2), root).valid).toBe(false);
    // The crash can never satisfy a policy suite.
    expect(validatePolicyReport(report, names.slice(0, 2), root).valid).toBe(false);
  });

  it("still refuses an empty report, or a suite without assertions that did not fail", () => {
    for (const status of ["passed", "skipped", "pending", undefined]) {
      const report = { numTotalTests: 0, testResults: [{ name: names[0], status, assertionResults: [] }] };
      expect(validateBatchReport(report, [names[0]], root).valid).toBe(false);
      expect(validateBatchReport({ ...report, numTotalTests: 1 }, [names[0]], root).valid).toBe(false);
    }
    const malformed = { numTotalTests: 1, testResults: [{ name: names[0], status: "failed", assertionResults: "x" }] };
    expect(validateBatchReport(malformed, [names[0]], root).valid).toBe(false);
    expect(validateBatchReport({ numTotalTests: 0, testResults: [] }, [], root).valid).toBe(false);
  });

  it("checkpoints an import crash as a failing batch and keeps it failing on resume", () => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-import-crash-"));
    let calls = 0;
    const options = {
      population: [names[0]],
      root,
      commit: "a".repeat(40),
      skippedTooling: false,
      environmentFingerprint: "controlled-fixture-input",
      stateDir,
      runBatch: ({ reportPath }: { reportPath: string }) => {
        calls++;
        writeFileSync(
          reportPath,
          JSON.stringify({
            numTotalTests: 0,
            testResults: [{ name: names[0], status: "failed", assertionResults: [] }],
          }),
        );
        return { status: 1 };
      },
    };
    try {
      expect(runFullGateBatches(options).wardGateRuns[0].failingFiles).toEqual([names[0]]);
      expect(runFullGateBatches(options).testResults[0].status).toBe("failed");
      expect(calls).toBe(1);
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });

  it("keeps completed batches and findings after a crash, then runs only the missing batch", () => {
    const stateDir = mkdtempSync(path.join(tmpdir(), "ward-gate-test-"));
    const options = {
      population: names,
      root,
      commit: "a".repeat(40),
      skippedTooling: false,
      environmentFingerprint: "controlled-fixture-input",
      stateDir,
      maxFiles: 2,
    };
    const calls: number[] = [];
    const runBatch = ({ files, index, reportPath }: { files: string[]; index: number; reportPath: string }) => {
      calls.push(index);
      if (index === 1 && calls.filter((call) => call === 1).length === 1) throw new Error("simulated crash");
      writeFileSync(
        reportPath,
        JSON.stringify({
          numTotalTests: files.length,
          testResults: files.map((file) => suite(path.resolve(root, file))),
        }),
      );
      return { status: 0 };
    };
    try {
      expect(() => runFullGateBatches({ ...options, runBatch })).toThrow("simulated crash");
      expect(() => runFullGateBatches({ ...options, environmentFingerprint: "", runBatch })).toThrow(
        /reliable outcome/,
      );
      expect(readFileSync(path.join(stateDir, "findings.log"), "utf8")).toContain("batch 1/");
      const report = runFullGateBatches({ ...options, runBatch });
      expect(calls).toEqual([0, 1, 1]);
      expect(report.testResults).toHaveLength(3);
      expect(report.numTotalTests).toBe(3);
      expect(() => runFullGateBatches({ ...options, commit: "b".repeat(40), runBatch })).toThrow(
        /different commit|checkpoint/i,
      );
    } finally {
      rmSync(stateDir, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});
