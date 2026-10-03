import { describe, expect, it } from "vitest";
import path from "node:path";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  executedAssertionCount,
  mergeGateReports,
  planFullGateRecheck,
  runFullGateBatches,
  splitFullGateBatches,
  validateBatchReport,
  validatePolicyReport,
} from "../scripts/ward-flow/full-gate-recheck.mjs";

const root = "/work";
const names = ["tests/a.test.ts", "tests/b.test.ts", "tests/c.dom.test.tsx"];
const suite = (name: string, status = "passed") => ({
  name,
  status,
  assertionResults: [{ status: status === "failed" ? "failed" : "passed" }],
});
const receipt = () => ({
  version: 2,
  commit: "a".repeat(40),
  population: names,
  skippedTooling: false,
  environmentFingerprint: "offline-default",
  problemFiles: [names[1]],
  report: { numTotalTests: 3, testResults: [suite(names[0]), suite(names[1], "failed"), suite(names[2])] },
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

  it("requires each selected policy suite to execute a passed assertion while permitting legitimate skips", () => {
    const report = {
      numTotalTests: 2,
      testResults: [{ ...suite(names[0]), assertionResults: [{ status: "pending" }, { status: "skipped" }] }],
    };
    expect(validateBatchReport(report, [names[0]], root).valid).toBe(true);
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
    const rerun = {
      numTotalTests: 2,
      testResults: [
        { ...suite(path.resolve(root, names[1])), assertionResults: [{ status: "passed" }, { status: "passed" }] },
      ],
    };
    const merged = mergeGateReports({ baseReport: receipt().report, rerunReport: rerun, selected: [names[1]], root });
    expect(merged.numTotalTests).toBe(4);
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
});

describe("crash-resumable FULL batches", () => {
  it("partitions deterministically within file and command-length limits", () => {
    const batches = splitFullGateBatches(names, { maxFiles: 2, maxChars: 36 });
    expect(batches.flat()).toEqual(names);
    expect(batches.every((batch: string[]) => batch.length <= 2 && batch.join(" ").length <= 36)).toBe(true);
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
