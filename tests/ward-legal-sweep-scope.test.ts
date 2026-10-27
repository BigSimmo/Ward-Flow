import { describe, expect, it } from "vitest";

import { legalSweepInputs, legalSweepTests, needsLegalSweep } from "../scripts/ward-ci-public/legal-sweep-scope.mjs";

// The real tree, as the planner reads it on a pull request.
const inputs = legalSweepInputs(".");
const changed = (...files: string[]) => files.map((file) => ({ status: "M", file }));

describe("legal-figure sweep scope (Josh, 27 October 2026)", () => {
  it("finds every sweep file and follows their imports into the engine", () => {
    const sweep = legalSweepTests(".");
    expect(sweep.length).toBeGreaterThanOrEqual(8);
    for (const file of sweep) expect(inputs.has(file)).toBe(true);
    for (const file of [
      "tests/helpers/ward-legal-figure-sweep.ts",
      "tests/setup/reducer-slices.setup.ts",
      "src/components/ward-management/ward-flow-reducer.ts",
      "src/components/ward-management/ward-flow-events.ts",
      "src/components/ward-management/ward-legal-forms.ts",
    ])
      expect(inputs.has(file), file).toBe(true);
  });

  it("runs the sweep when a pull request changes the engine, a sweep file or its helper", () => {
    for (const file of [
      "src/components/ward-management/ward-flow-reducer.ts",
      "tests/ward-legal-figure-guard-sweep-3.test.ts",
      "tests/helpers/ward-legal-figure-sweep.ts",
    ])
      expect(needsLegalSweep(changed("docs/ward-flow/PUBLIC-CI.md", file), inputs).run, file).toBe(true);
  });

  it("runs the sweep when configuration that every test or this decision depends on changes", () => {
    for (const file of [
      "package-lock.json",
      "vitest.config.mts",
      "tsconfig.json",
      "tests/setup/jsdom.setup.ts",
      ".github/workflows/ward-flow.yml",
      "scripts/check-ward-expected-reds.mjs",
      "scripts/ward-ci-public/legal-sweep-scope.mjs",
      "tests/ward-expected-reds.json",
    ])
      expect(needsLegalSweep(changed(file), inputs).run, file).toBe(true);
  });

  it("leaves the sweep out for screen, style, unrelated test and document changes", () => {
    const outside = [
      "src/components/ward-management/ward/ward-home-tab.module.css",
      "docs/ward-flow/PUBLIC-CI.md",
      "tests/ward-gate-shard-balance.test.ts",
    ];
    for (const file of outside) expect(inputs.has(file), file).toBe(false);
    expect(needsLegalSweep(changed(...outside), inputs)).toEqual({ run: false, reason: "no change reaches the sweep" });
  });

  it("fails closed on deletions, renames, an empty diff or a tree with no sweep files", () => {
    expect(needsLegalSweep([{ status: "D", file: "docs/ward-flow/PUBLIC-CI.md" }], inputs).run).toBe(true);
    expect(needsLegalSweep([{ status: "R100", file: "docs/ward-flow/PUBLIC-CI.md" }], inputs).run).toBe(true);
    expect(needsLegalSweep([], inputs).run).toBe(true);
    expect(needsLegalSweep(changed("docs/ward-flow/PUBLIC-CI.md"), new Set<string>()).run).toBe(true);
  });
});
