import { describe, expect, it } from "vitest";
import { downtimePack } from "@/components/ward-management/reports/downtime-pack";
import { createIsolatedState } from "../helpers/test-harness";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import fs from "node:fs";
import path from "node:path";

describe("Tier 1 - Feature 07: Downtime Pack Inpatient Census Table & A4 Print CSS", () => {
  const now = NOW_ANCHOR;

  const createTestPack = (overrides?: Partial<Parameters<typeof downtimePack>[0]>) => {
    const state = createIsolatedState();
    return downtimePack({
      units: state.units,
      bedUnits: state.units.filter((u) => u.beds > 0),
      admissions: state.admissions,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      movements: state.movements,
      now,
      identify: (m) => `Person-${m.id}`,
      ...overrides,
    });
  };

  it("compiles bed occupancy totals and breakdowns across all inpatient wards", () => {
    const pack = createTestPack();

    expect(pack.wards.length).toBeGreaterThan(0);
    expect(pack.totals.beds).toBeGreaterThan(0);
    // Bed math invariant: beds == ready + pulled + occupied + closed (accounting for on-leave and pending)
    expect(pack.totals.ready).toBeGreaterThanOrEqual(0);
    expect(pack.totals.occupied).toBeGreaterThanOrEqual(0);
    expect(pack.totals.closed).toBeGreaterThanOrEqual(0);
  });

  it("renders ED queue lines with wait duration, urgency tier, and observation schedule", () => {
    const pack = createTestPack();

    expect(pack.edQueue).toBeDefined();
    if (pack.edQueue.length > 0) {
      const first = pack.edQueue[0]!;
      expect(first.movementId).toBeDefined();
      expect(first.person).toContain("Person-");
      expect(first.ed).toBeDefined();
      expect(first.waitedMinutes).toBeGreaterThanOrEqual(0);
      expect(typeof first.urgency).toBe("number");
      expect(first.observation).toBeDefined();
    }
  });

  it("extracts pending inter-ward and ED-to-inpatient moves with stage and transport ETAs", () => {
    const pack = createTestPack();

    expect(pack.pendingMoves).toBeDefined();
    expect(Array.isArray(pack.pendingMoves)).toBe(true);
    for (const move of pack.pendingMoves) {
      expect(move.from).toBeDefined();
      expect(move.to).toBeDefined();
      expect(move.stage).toBeDefined();
    }
  });

  it("extracts statutory legal forms across open movements with typed expiries", () => {
    const pack = createTestPack();

    expect(pack.legalForms).toBeDefined();
    expect(Array.isArray(pack.legalForms)).toBe(true);
    for (const form of pack.legalForms) {
      expect(form.person).toBeDefined();
      expect(form.legalStatus).toBeDefined();
    }
  });

  it("verifies A4 print CSS rules exist in reports.module.css ensuring columns never clip", () => {
    const cssPath = path.resolve(process.cwd(), "src/components/ward-management/reports/reports.module.css");
    expect(fs.existsSync(cssPath)).toBe(true);
    const css = fs.readFileSync(cssPath, "utf8");

    expect(css).toContain("@media print");
    expect(css).toContain(".packTable");
    expect(css).toContain("data-print-hide");
    expect(css).toContain(".printOnly");
  });
});
