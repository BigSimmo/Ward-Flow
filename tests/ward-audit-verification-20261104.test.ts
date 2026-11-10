import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import { runInNewContext } from "node:vm";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { selectedScripts, runPrLocalScripts, summarizePrLocalRun } from "../scripts/verify-pr-local.mjs";
import { fullGateInputIdentity } from "../scripts/test-evidence-identity.mjs";
import { releaseGateCases, splitPlaywrightArguments } from "../scripts/ward-flow/browser-run-contract.mjs";
import { journeyRunVerdict } from "../scripts/ward-flow/journey-run-verdict.mjs";

describe("consolidated audit verification boundaries", () => {
  it("requires integration under the full gate and propagates its refusal", () => {
    const selected = selectedScripts({ backend: true }, false, { full: true });
    expect(selected).toContain("test:backend:integration");
    expect(selected).not.toContain("test:backend");
    expect(
      runPrLocalScripts(["test:backend:integration"], {
        runScript: () => 1,
        error: () => {},
      }),
    ).toBe(1);
    expect(summarizePrLocalRun(["test:backend"], { completed: ["test:backend"] })).toContain("NOT RUN");
  });

  it("runs the verification CLI when invoked through a symlink", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "ward-verifier-link-"));
    try {
      const link = path.join(directory, "verify.mjs");
      symlinkSync(path.resolve("scripts/verify-pr-local.mjs"), link);
      expect(execFileSync(process.execPath, [link, "--self-test"], { encoding: "utf8" })).toContain("self-test passed");
    } finally {
      rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("invalidates sampled storage evidence for exhaustive or recording modes", () => {
    const options = {
      root: "/unused-synthetic-root",
      dependencyIdentity: "fixture",
      population: ["tests/ward-flow-storage-validation-zod.test.ts"],
      args: ["run"],
      env: {},
    };
    const sampled = fullGateInputIdentity(options);
    for (const name of ["WARD_STORAGE_VERDICTS_FULL", "WARD_STORAGE_VERDICTS_RECORD"])
      expect(fullGateInputIdentity({ ...options, env: { [name]: "1" } })).not.toBe(sampled);
  });

  it.each(["release-gate-desktop", "release-gate-phone"])("requires every applicable checks case on %s", (project) => {
    const cases = releaseGateCases(true, project, "checks");
    expect(cases).toHaveLength(project === "release-gate-desktop" ? 118 : 104);
    const report = {
      config: { projects: [{ name: project }] },
      errors: [],
      suites: [
        {
          file: "release-gate-axe-sweep.spec.ts",
          specs: cases.map(({ title }) => ({
            title,
            tests: [
              { projectName: project, status: "expected", expectedStatus: "passed", results: [{ status: "passed" }] },
            ],
          })),
        },
      ],
    };
    const verdict = () =>
      journeyRunVerdict([{ label: "checks", code: 0, report }], [project], { requiredCases: cases });
    expect(verdict().ok).toBe(true);
    // A healthy smoke result cannot hide the rest of the checks being skipped.
    for (const spec of report.suites[0]!.specs.slice(1)) {
      spec.tests[0]!.status = "skipped";
      spec.tests[0]!.results = [{ status: "skipped" }];
    }
    expect(verdict().ok).toBe(false);
    expect(verdict().problems).toHaveLength(cases.length - 1);
  });

  it("pins the named obligations independently against all actual sweep declarations", () => {
    const titles: string[] = [];
    const declare = Object.assign((title: string) => titles.push(title), {
      describe: Object.assign((_title: string, body: () => void) => body(), { configure: () => {} }),
      use: () => {},
      beforeEach: () => {},
    });
    const source = readFileSync("tests/release-gate-axe-sweep.spec.ts", "utf8").replace(/^import[^;]+;\n/gm, "");
    const { outputText } = transpileModule(source, {
      compilerOptions: { target: ScriptTarget.ESNext, module: ModuleKind.ESNext },
    });
    runInNewContext(outputText, { test: declare, encodeRecordAddress, HELP_TIPS_OFF_KEY: "synthetic" });
    expect(new Set(releaseGateCases(true, "release-gate-desktop", "checks").map((entry) => entry.title))).toEqual(
      new Set(titles),
    );
  });

  it("retains separated option values while replacing positional browser filters", () => {
    const options = [
      "--project",
      "chromium-mockups",
      "--workers",
      "2",
      "--reporter",
      "line",
      "--output",
      "synthetic results",
      "--timeout=30000",
    ];
    expect(splitPlaywrightArguments([...options, "tests/ui-ward-a.spec.ts", "tests/ui-ward-b.spec.ts"])).toEqual({
      options,
      files: ["tests/ui-ward-a.spec.ts", "tests/ui-ward-b.spec.ts"],
    });
  });

  it("keeps --tsconfig and --add-reporter values out of the spec filters (WF-TEST-07/R3)", () => {
    const options = ["--tsconfig", "x.json", "--add-reporter", "dot"];
    expect(splitPlaywrightArguments([...options, "tests/ui-ward-a.spec.ts"])).toEqual({
      options,
      files: ["tests/ui-ward-a.spec.ts"],
    });
  });
});
