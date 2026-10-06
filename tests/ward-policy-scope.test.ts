import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { classifyChanges, policyContractTests } from "../scripts/ward-ci-public/plan.mjs";
const scope = (...files: string[]) => classifyChanges(files.map((file) => ({ status: "M", file })));
describe("policy-only coverage contract", () => {
  it.each([
    "AGENTS.md",
    "docs/task-receipts.md",
    "docs/agents/task-efficiency.md",
    "README.local-source.md",
    "docs/ward-flow/HOW-WE-WORK.md",
    "docs/DOCS-SYSTEM.md",
  ])("runs meaningful contracts for %s without application browser jobs", (file) => {
    expect(scope(file)).toMatchObject({ full: true, unit: false, browser: false, policy: true });
  });
  it.each([
    "src/app/layout.tsx",
    "scripts/guard-push.mjs",
    "docs/agents/execute.sh",
    ".github/workflows/ward-flow.yml",
    "unknown.md",
  ])("retains broad protection when mixed with %s", (file) => {
    expect(scope("AGENTS.md", file)).toMatchObject({ full: true, unit: true, browser: true });
  });
  it("keeps deletion, rename and missing population conservative", () => {
    for (const status of ["D", "R100", "?"])
      expect(classifyChanges([{ status, file: "AGENTS.md" }]).browser).toBe(true);
    expect(classifyChanges([]).browser).toBe(true);
  });
  it("keeps backend verification when policy and backend are mixed", () => {
    expect(scope("AGENTS.md", "backend/ward-flow/server.mjs")).toMatchObject({ full: true, unit: true, browser: true });
  });
  it("uses existing contract files and includes them in the required static job", () => {
    expect(policyContractTests.length).toBeGreaterThan(0);
    for (const file of policyContractTests) expect(existsSync(new URL(`../${file}`, import.meta.url))).toBe(true);
    const workflow = readFileSync(new URL("../.github/workflows/ward-flow.yml", import.meta.url), "utf8");
    expect(workflow).toMatch(/steps\.plan\.outputs\.policy == 'true'/u);
    expect(workflow).toContain("node scripts/ward-ci-public/check-policy-contracts.mjs");
    expect(workflow).toContain("needs: [reuse, static, unit, browser, secret-scan, build, coverage]");
  });
});
