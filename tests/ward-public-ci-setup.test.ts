import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGovernanceAudit } from "../scripts/ward-flow/check-clinical-governance-gate.mjs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { installChromium, runBounded } from "../scripts/ward-ci-public/install-chromium.mjs";
import { classifyChanges, documentChecks } from "../scripts/ward-ci-public/plan.mjs";

const entries = (...files: string[]) => files.map((file) => ({ status: "M", file }));

describe("bounded required Chromium setup", () => {
  it("cold cache installs browser and system dependencies from the locked CLI", () => {
    const calls: string[][] = [];
    expect(
      installChromium({
        execute: (_command, args) => {
          calls.push(args);
          return { status: 0 };
        },
        log: () => {},
      }),
    ).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].slice(1)).toEqual(["install", "--with-deps", "chromium"]);
  });
  it("warm cache still installs system dependencies and verifies/repairs the pinned browser revision", () => {
    const calls: string[][] = [];
    expect(
      installChromium({
        cacheHit: true,
        execute: (_command, args) => {
          calls.push(args);
          return { status: 0 };
        },
        log: () => {},
      }),
    ).toBe(0);
    expect(calls.map((args) => args.slice(1))).toEqual([
      ["install-deps", "chromium"],
      ["install", "chromium"],
    ]);
  });
  it("retries one transient failure, but stops after two failures", () => {
    let calls = 0;
    expect(installChromium({ execute: () => ({ status: ++calls === 1 ? 1 : 0 }), log: () => {} })).toBe(0);
    expect(calls).toBe(2);
    calls = 0;
    expect(
      installChromium({
        execute: () => {
          calls++;
          return { status: 1 };
        },
        log: () => {},
      }),
    ).toBe(1);
    expect(calls).toBe(2);
  });
  it("shares a six-minute budget across all operations and attempts", () => {
    let clock = 0;
    const budgets: number[] = [];
    expect(
      installChromium({
        cacheHit: true,
        now: () => clock,
        execute: (_command, _args, timeout) => {
          budgets.push(timeout);
          clock += timeout;
          return { status: budgets.length === 2 ? 0 : 124 };
        },
        log: () => {},
      }),
    ).toBe(1);
    expect(budgets).toEqual([120_000, 120_000, 120_000]);
    expect(clock).toBe(360_000);
  });
  it.skipIf(process.platform === "win32")("terminates a deliberately stalled local command within its budget", () => {
    const started = Date.now();
    const result = runBounded(process.execPath, ["-e", "setInterval(() => {}, 1000)"], 100);
    expect(result.status).toBe(124);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("maintained document CI scope", () => {
  it.each([
    "docs/ward-flow/decisions.md",
    "docs/ward-flow/owner-decisions-2026-09-16.md",
    "docs/ward-flow/archive/dated-notes/owner-questions-queued-2026-09-10.md",
    "docs/ward-flow/OWNER-RULINGS.md",
    "docs/ward-flow/additional-owner-ruling.md",
  ])("checks owner index for %s without application jobs", (file) => {
    expect(documentChecks(entries(file))).toMatchObject({ owner_index: true, organisation: true });
    expect(classifyChanges(entries(file))).toMatchObject({ unit: false, browser: false });
  });
  it("checks lesson inputs/outputs without rerunning app browsers", () => {
    expect(documentChecks(entries("docs/ward-flow/lessons/example.md"))).toMatchObject({
      rules_index: true,
      organisation: true,
    });
    expect(documentChecks(entries("docs/ward-flow/RULES.md"))).toMatchObject({ rules_index: true });
  });
  it("narrative docs do not trigger unrelated generators", () => {
    expect(documentChecks(entries("docs/ward-flow/README.md"))).toEqual({
      owner_index: false,
      rules_index: false,
      organisation: true,
    });
    expect(classifyChanges(entries("docs/ward-flow/README.md"))).toMatchObject({
      full: false,
      unit: false,
      browser: false,
    });
  });
  it("checks registry changes and fails closed for unavailable/deleted history", () => {
    expect(documentChecks(entries("docs/ward-flow/organisation/registry.json"))).toMatchObject({ organisation: true });
    expect(documentChecks([])).toEqual({ owner_index: true, rules_index: true, organisation: true });
    expect(documentChecks([{ status: "D", file: "docs/ward-flow/decisions.md" }])).toMatchObject({
      owner_index: true,
      rules_index: true,
      organisation: true,
    });
  });
  it("required workflow runs every planned document check and bounded synthetic check", () => {
    const workflow = readFileSync(".github/workflows/ward-flow.yml", "utf8");
    for (const flag of ["owner_index", "rules_index", "organisation"])
      expect(workflow).toContain(`steps.plan.outputs.${flag} == 'true'`);
    expect(workflow).toContain("owner-rulings-index.mjs --check");
    expect(workflow).toContain("rules-index.mjs --check");
    expect(workflow).toContain("organisation.mjs --check --source working-tree");
    expect(workflow).toContain("run: node scripts/ward-flow/check-clinical-governance-gate.mjs");
    expect(workflow).toContain("run: node scripts/ward-ci-public/install-chromium.mjs");
    expect(workflow).toMatch(/id: chromium\n\s*timeout-minutes: 8/u);
  });
  it("independent plan verification rejects a falsely omitted document check", () => {
    const env = {
      ...process.env,
      WARD_BASE_SHA: "invalid",
      WARD_PLAN_FULL: "true",
      WARD_PLAN_UNIT: "true",
      WARD_PLAN_BROWSER: "true",
      WARD_PLAN_POLICY: "false",
      WARD_PLAN_DEPENDENCY_REVIEW: "true",
      WARD_PLAN_OWNER_INDEX: "true",
      WARD_PLAN_RULES_INDEX: "true",
      WARD_PLAN_ORGANISATION: "true",
    };
    const good = spawnSync(process.execPath, ["scripts/ward-ci-public/verify-plan.mjs"], { env, encoding: "utf8" });
    expect(good.status).toBe(0);
    const wrong = spawnSync(process.execPath, ["scripts/ward-ci-public/verify-plan.mjs"], {
      env: { ...env, WARD_PLAN_OWNER_INDEX: "false" },
      encoding: "utf8",
    });
    expect(wrong.status).toBe(1);
    expect(wrong.stderr).toContain("owner_index");
  });
});

describe("bounded synthetic-source CI failure conditions", () => {
  it("rejects malformed fixture IDs and a missing disclaimer without treating approval files as required", () => {
    const root = mkdtempSync(join(tmpdir(), "ward-synthetic-ci-"));
    try {
      const components = join(root, "src/components/ward-management");
      mkdirSync(join(components, "shell"), { recursive: true });
      const seed = join(components, "ward-patients-seed.ts");
      const footer = join(components, "shell/ward-prototype-footer.tsx");
      writeFileSync(seed, 'const fixture = { id: "PT-fixture", umrn: "SYN-123" };');
      writeFileSync(footer, "<footer>Synthetic prototype</footer>");
      expect(runGovernanceAudit(root)).toMatchObject({
        ok: true,
        deploymentReadiness: { status: "CLINICAL_READINESS_UNASSESSED", isApprovedForRealPatients: false },
      });
      writeFileSync(seed, 'const fixture = { id: "outside-prefix", umrn: "unapproved-prefix" };');
      expect(runGovernanceAudit(root)).toMatchObject({ ok: false, isolation: { ok: false } });
      writeFileSync(seed, 'const fixture = { id: "PT-fixture", umrn: "SYN-123" };');
      writeFileSync(footer, "<footer>Application</footer>");
      expect(runGovernanceAudit(root)).toMatchObject({ ok: false, disclaimers: { ok: false } });
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
