import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ward-flow.yml", "utf8");
const checker = readFileSync("scripts/ward-ci-public/check-contracts.mjs", "utf8");
const start = checker.indexOf("function requireWorkflow(source) {");
const end = checker.indexOf("\nrequireWorkflow(workflow);", start);
const verify = vm.runInNewContext(`(${checker.slice(start, end).trim()})`, { assert }) as (source: string) => void;

describe("CI remediation wiring", () => {
  it("accepts the complete enforcing workflow", () => {
    expect(() => verify(workflow)).not.toThrow();
  });

  it("plans before allocating the unit and browser runner matrices", () => {
    expect(workflow).toMatch(/^  plan:\n/m);
    for (const job of ["unit", "browser", "build", "coverage", "release-gate"]) {
      const body = new RegExp(`^  ${job}:\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9_-]*:|(?![\\s\\S]))`, "m").exec(
        workflow,
      )?.[1];
      expect(body, job).toMatch(/needs:.*plan/);
      expect(body, job).toMatch(/if:.*needs\.plan\.outputs\./);
    }
  });

  it("prepares the backend engine before a fresh-checkout typecheck", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    expect(manifest.scripts["typecheck:backend"]).toBe(
      "npm --prefix backend/ward-flow run build:engine && npm --prefix backend/ward-flow run typecheck",
    );
  });

  it("requires every canonical release case on desktop and phone", () => {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    expect(manifest.scripts["test:e2e:release-gate"]).toBe(
      "node scripts/run-playwright.mjs --project=release-gate-desktop --project=release-gate-phone --require-release-gate",
    );
  });

  it.each([
    [
      "lint failures",
      (source: string) =>
        source.replace(
          /(run: node --max-old-space-size=8192 node_modules\/eslint\/bin\/eslint\.js[^\n]*)/,
          "$1 || true",
        ),
    ],
    [
      "shared browser proof",
      (source: string) => source.replace("run: node tests/support/ward-shared-mode-run.mjs", "run: echo skipped"),
    ],
    [
      "phone script budget",
      (source: string) => source.replace("run: node scripts/check-script-budget.mjs", "run: echo skipped"),
    ],
    [
      "trusted cache writes",
      (source: string) =>
        source.replace(" && github.ref == 'refs/heads/main' && steps.next-cache", " && steps.next-cache"),
    ],
    [
      "doc-facts comparison base",
      (source: string) =>
        source.replace(/(name: Check doc facts and retired terms\n)\s*env:\n\s*WARD_BASE_SHA:[^\n]*\n/, "$1"),
    ],
    [
      "prepared build consumption",
      (source: string) => source.replace(/WARD_BROWSER_ARTIFACT_DIR:[^\n]*/, "WARD_BROWSER_ARTIFACT_DIR: ''"),
    ],
  ])("rejects silently disabling %s", (_label, mutate) => {
    const changed = mutate(workflow);
    expect(changed).not.toBe(workflow);
    expect(() => verify(changed)).toThrow();
  });
});
