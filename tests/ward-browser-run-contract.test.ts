import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  includeGroupCsrf,
  RELEASE_GATE_PARTS,
  RELEASE_GATE_PROJECTS,
  releaseGateCases,
  releaseGateCheckCases,
  releaseGatePartArgsProblem,
  releaseGatePartFor,
  releaseGateProjectFor,
  sharedModeCases,
} from "../scripts/ward-flow/browser-run-contract.mjs";

describe("complete release gate and shared-build browser selection", () => {
  it("requires all seven operational journeys on both device projects only for the full preset", () => {
    expect(releaseGateCases(false)).toEqual([]);
    const cases = releaseGateCases(true).filter((entry) => entry.file !== "release-gate-axe-sweep.spec.ts");
    expect(cases).toHaveLength(14);
    for (const project of ["release-gate-desktop", "release-gate-phone"]) {
      expect(cases.filter((entry) => entry.project === project).map((entry) => entry.title.split(":")[0])).toEqual([
        "ED referral to bed offer",
        "Morning bed meeting",
        "Transfer with transport",
        "Discharge with bed release",
        "Inpatient transfer",
        "Community referral",
        "Legal form",
      ]);
    }
    for (const entry of cases) {
      const source = readFileSync(`tests/${entry.file}`, "utf8");
      expect(source, entry.title).toContain(JSON.stringify(entry.title));
    }
  });

  it("narrows one CI leg to one device project only by name, still requiring all seven journeys there", () => {
    expect(releaseGateProjectFor(undefined)).toBeNull();
    expect(releaseGateProjectFor("")).toBeNull();
    expect(releaseGateProjectFor(" release-gate-phone ")).toBe("release-gate-phone");
    expect(() => releaseGateProjectFor("release-gate-tablet")).toThrow(/WARD_RELEASE_GATE_PROJECT/);
    expect(RELEASE_GATE_PROJECTS).toEqual(["release-gate-desktop", "release-gate-phone"]);
    for (const project of RELEASE_GATE_PROJECTS) {
      const leg = releaseGateCases(true, project);
      expect(leg.filter((entry) => entry.file !== "release-gate-axe-sweep.spec.ts")).toHaveLength(7);
      expect(new Set(leg.map((entry) => entry.project))).toEqual(new Set([project]));
      expect(leg).toEqual(releaseGateCases(true).filter((entry) => entry.project === project));
    }
    expect(releaseGateCases(false, "release-gate-phone")).toEqual([]);
    expect(() => releaseGateCases(true, "chromium")).toThrow(/WARD_RELEASE_GATE_PROJECT/);
  });

  it("splits each device leg into two parts that run every release-gate file exactly once", () => {
    const specs = readdirSync("tests").filter((name) => /^release-gate-.*\.spec\.ts$/u.test(name));
    const parts = Object.values(RELEASE_GATE_PARTS).flat();
    expect(new Set(parts).size).toBe(parts.length);
    expect([...parts].sort()).toEqual([...specs].sort());
    expect(releaseGatePartFor(undefined)).toBeNull();
    expect(releaseGatePartFor(" checks ")).toBe("checks");
    expect(() => releaseGatePartFor("smoke")).toThrow(/WARD_RELEASE_GATE_PART/);
    for (const project of RELEASE_GATE_PROJECTS) {
      const journeys = releaseGateCases(true, project, "journeys");
      const referrals = releaseGateCases(true, project, "referrals");
      expect(journeys.map((entry) => entry.title.split(":")[0])).toEqual([
        "ED referral to bed offer",
        "Morning bed meeting",
        "Transfer with transport",
        "Discharge with bed release",
      ]);
      expect(referrals.map((entry) => entry.title.split(":")[0])).toEqual([
        "Inpatient transfer",
        "Community referral",
        "Legal form",
      ]);
      // Together the parts still require all seven journeys on each device, each exactly once.
      expect([...journeys, ...referrals, ...releaseGateCases(true, project, "checks")]).toEqual(
        releaseGateCases(true, project),
      );
      expect(releaseGateCases(true, project, "checks")).toEqual(releaseGateCheckCases(project));
    }
    expect(() => releaseGateCases(true, "release-gate-phone", "smoke")).toThrow(/WARD_RELEASE_GATE_PART/);
  });

  it("lets a release-gate part run only the whole part, never a file filter or test selection", () => {
    const preset = ["--project=release-gate-phone"];
    expect(releaseGatePartArgsProblem(preset)).toBeNull();
    expect(releaseGatePartArgsProblem([...preset, "--reporter=line", "-x"])).toBeNull();
    expect(releaseGatePartArgsProblem([...preset, "release-gate-axe-sweep.spec.ts"])).toMatch(/file filters/);
    for (const option of ["--grep=header", "-g", "--grep-invert=x", "--last-failed", "--only-changed", "--shard=1/2"])
      expect(releaseGatePartArgsProblem([...preset, option]), option).toMatch(/test-selection option/);
  });

  it("keeps the six shared journeys and requires four new recovery journeys on desktop and phone", () => {
    const cases = sharedModeCases();
    expect(cases).toHaveLength(14);
    for (const entry of cases)
      expect(readFileSync(`tests/${entry.file}`, "utf8"), entry.title).toContain(JSON.stringify(entry.title));
    expect(cases.filter((entry) => entry.file === "ward-shared-mode.spec.ts")).toHaveLength(6);
    expect(cases.filter((entry) => entry.project === "ward-shared-mode")).toHaveLength(10);
    const phone = cases.filter((entry) => entry.project === "ward-shared-phone");
    expect(phone).toHaveLength(4);
    expect(phone.map((entry) => entry.title.split(":")[0])).toEqual([
      "offline recovery",
      "stale board",
      "Activity Undo",
      "sign-out return",
    ]);
    const config = readFileSync("playwright.config.ts", "utf8");
    expect(config).toMatch(/name: "ward-shared-phone",\s+testMatch: sharedPhoneSpecPattern/u);
    const runner = readFileSync("tests/support/ward-shared-mode-run.mjs", "utf8");
    expect(runner).toContain('"--project=ward-shared-phone"');
  });

  it("adds the CSRF project and file only to the first CI group without changing its Ward selection", () => {
    const args = ["--project=chromium-mockups", "ui-ward-roles.spec.ts"];
    expect(includeGroupCsrf(args, "1/3")).toEqual([...args, "--project=chromium", "api-csrf-proxy.spec.ts"]);
    expect(includeGroupCsrf(args, "2/3")).toEqual(args);
    expect(includeGroupCsrf(args, undefined)).toEqual(args);
    expect(args).toEqual(["--project=chromium-mockups", "ui-ward-roles.spec.ts"]);
    expect(() => includeGroupCsrf(["--project=firefox"], "1/3")).toThrow(/chromium-mockups/);
  });
});
