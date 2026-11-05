import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { legalSweepInputs, legalSweepTests, needsLegalSweep } from "../scripts/ward-ci-public/legal-sweep-scope.mjs";

// The real tree, as the planner reads it on a pull request.
const inputs = legalSweepInputs(".");
const changed = (...files: string[]) => files.map((file) => ({ status: "M", file }));
const fixtures: string[] = [];
afterEach(() => {
  for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(overrides: Record<string, string | null> = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "ward-legal-sweep-scope-"));
  fixtures.push(root);
  const files = {
    "tests/ward-legal-figure-guard-sweep-1.test.ts": "export {};",
    "tests/setup/reducer-slices.setup.ts": "export {};",
    "scripts/check-ward-expected-reds.mjs": 'import "./batch.mjs";',
    "scripts/batch.mjs": 'import "./identity.mjs";',
    "scripts/identity.mjs": "export {};",
    "vitest.config.mts": 'import "./scripts/config.mjs";',
    "scripts/config.mjs": "export {};",
    ...overrides,
  };
  for (const [file, source] of Object.entries(files)) {
    if (source === null) continue;
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, source);
  }
  return root;
}

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

  it("runs the sweep for changes to the execution harness and its transitive dependencies", () => {
    for (const file of [
      "scripts/ward-flow/full-gate-recheck.mjs",
      "scripts/test-evidence-identity.mjs",
      "scripts/dependency-inventory-policy.mjs",
      "scripts/retryable-fs.mjs",
    ])
      expect(needsLegalSweep(changed(file), inputs).run, file).toBe(true);
    const root = fixture();
    expect(needsLegalSweep(changed("scripts/identity.mjs"), legalSweepInputs(root)).run).toBe(true);
  });

  it("runs the sweep for changes to dependencies imported by the Vitest configuration", () => {
    for (const file of ["scripts/coverage-contract.mjs", "scripts/test-cache-path.mjs"])
      expect(needsLegalSweep(changed(file), inputs).run, file).toBe(true);
    const root = fixture();
    expect(needsLegalSweep(changed("scripts/config.mjs"), legalSweepInputs(root)).run).toBe(true);
  });

  it.each(["scripts/check-ward-expected-reds.mjs", "vitest.config.mts", "tests/setup/reducer-slices.setup.ts"])(
    "refuses to narrow scope when the required execution input %s is missing",
    (file) => {
      expect(() => legalSweepInputs(fixture({ [file]: null }))).toThrow(file);
    },
  );

  it("refuses to narrow scope when a local harness dependency cannot be resolved", () => {
    const root = fixture({ "scripts/batch.mjs": 'import "./missing.mjs";' });
    expect(() => legalSweepInputs(root)).toThrow(
      "Cannot resolve local sweep input ./missing.mjs imported by scripts/batch.mjs",
    );
  });

  it("leaves the sweep out for screen, style, unrelated test and document changes", () => {
    const outside = [
      "src/components/ward-management/ward/ward-home-tab.tsx",
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
