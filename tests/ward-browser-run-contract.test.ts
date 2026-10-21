import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { includeGroupCsrf, releaseGateCases, sharedModeCases } from "../scripts/ward-flow/browser-run-contract.mjs";

describe("complete release gate and shared-build browser selection", () => {
  it("requires all six operational journeys on both device projects only for the full preset", () => {
    expect(releaseGateCases(false)).toEqual([]);
    const cases = releaseGateCases(true);
    expect(cases).toHaveLength(12);
    for (const project of ["release-gate-desktop", "release-gate-phone"]) {
      expect(cases.filter((entry) => entry.project === project).map((entry) => entry.title.split(":")[0])).toEqual([
        "ED referral to bed offer",
        "Morning bed meeting",
        "Transfer with transport",
        "Discharge with bed release",
        "Inpatient transfer",
        "Community referral",
      ]);
    }
    for (const entry of cases) {
      const source = readFileSync(`tests/${entry.file}`, "utf8");
      expect(source, entry.title).toContain(JSON.stringify(entry.title));
    }
  });

  it("requires all six production shared-mode journeys", () => {
    const cases = sharedModeCases();
    expect(cases).toHaveLength(6);
    const source = readFileSync("tests/ward-shared-mode.spec.ts", "utf8");
    for (const entry of cases) expect(source).toContain(JSON.stringify(entry.title));
    expect(new Set(cases.map((entry) => entry.project))).toEqual(new Set(["ward-shared-mode"]));
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
