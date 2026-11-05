import { selectedBaselineVerdict } from "../scripts/ward-flow/selected-baseline-verdict.mjs";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { splitPlaywrightArguments } from "../scripts/ward-flow/playwright-arguments.mjs";
import { releaseGateCases } from "../scripts/ward-flow/browser-run-contract.mjs";
import { journeyRunVerdict } from "../scripts/ward-flow/journey-run-verdict.mjs";
import { fullGateInputIdentity } from "../scripts/test-evidence-identity.mjs";

function report(project: string, cases: ReturnType<typeof releaseGateCases>, skipAll = false) {
  return {
    config: { projects: [{ name: project }] },
    suites: [
      {
        specs: cases.map((entry) => {
          const skip = skipAll || entry.approvedSkip;
          return {
            title: entry.title,
            file: entry.file,
            tests: [
              {
                projectName: project,
                status: skip ? "skipped" : "expected",
                expectedStatus: skip ? "skipped" : "passed",
                results: [{ status: skip ? "skipped" : "passed" }],
              },
            ],
          };
        }),
      },
    ],
  };
}
describe("consolidated audit acceptance boundaries", () => {
  it("requires every sweep identity and allows only named phone exceptions", () => {
    for (const project of ["release-gate-desktop", "release-gate-phone"]) {
      const cases = releaseGateCases(true, project, "checks");
      expect(cases).toHaveLength(75);
      const verdict = (data: object) =>
        journeyRunVerdict([{ label: "sweep", code: 0, report: data }], [project], { requiredCases: cases });
      expect(verdict(report(project, cases)).ok).toBe(true);
      expect(verdict(report(project, cases.slice(1))).ok).toBe(false);
      const skipped = report(project, cases, true);
      skipped.suites[0].specs[0].tests[0] = {
        projectName: project,
        status: "expected",
        expectedStatus: "passed",
        results: [{ status: "passed" }],
      };
      expect(verdict(skipped).ok).toBe(false);
      expect(cases.filter((entry) => entry.approvedSkip)).toHaveLength(project.endsWith("phone") ? 14 : 0);
    }
  });
  it("keeps spaced and equals option values while replacing grouped file filters", () => {
    for (const args of [
      ["--project", "chromium-mockups", "--workers", "2", "--timeout", "30000"],
      ["--project=chromium-mockups", "--workers=2", "--timeout=30000"],
    ]) {
      expect(splitPlaywrightArguments([...args, "ward-.*spec.ts"])).toEqual({
        options: args,
        files: ["ward-.*spec.ts"],
      });
    }
  });
  it("does not count a selected wholly skipped file as executed acceptance", () => {
    const root = process.cwd(),
      file = "tests/synthetic.test.ts";
    const verdict = selectedBaselineVerdict({
      root,
      selected: [file],
      expected: [],
      runResult: { status: 0 },
      report: {
        numTotalTests: 1,
        testResults: [{ name: path.join(root, file), status: "passed", assertionResults: [{ status: "pending" }] }],
      },
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/not run|incomplete/);
  });
  it("refuses fixture recording as reusable full acceptance", () => {
    expect(() =>
      fullGateInputIdentity({
        root: process.cwd(),
        population: [],
        args: [],
        dependencyIdentity: "synthetic",
        env: { WARD_STORAGE_VERDICTS_RECORD: "1" },
      }),
    ).toThrow(/recording is not acceptance/);
  });
  it("executes symlinked verification and backend entry points and leaves imports inert", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ward-audit-cli-"));
    for (const [file, args, code, message] of [
      ["verify-pr-local.mjs", ["--self-test"], 0, "self-test passed"],
      ["run-backend-tests.mjs", ["--integration"], 1, "WARD_TEST_DATABASE_URL"],
    ] as const) {
      const target = path.resolve("scripts", file),
        alias = path.join(dir, file);
      symlinkSync(target, alias);
      const run = (entry: string) =>
        spawnSync(process.execPath, [entry, ...args], {
          encoding: "utf8",
          env: { ...process.env, WARD_TEST_DATABASE_URL: "", ALLOW_PROVIDER_TESTS: "0" },
        });
      for (const entry of [target, alias]) {
        const result = run(entry);
        expect(result.status).toBe(code);
        expect(result.stdout + result.stderr).toContain(message);
      }
      const imported = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", `await import(${JSON.stringify(target)})`],
        { encoding: "utf8" },
      );
      expect(imported.status).toBe(0);
      expect(imported.stdout + imported.stderr).toBe("");
    }
  });
});
