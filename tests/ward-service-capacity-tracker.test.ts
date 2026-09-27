import { describe, expect, it } from "vitest";

import {
  deriveBedCapacityTone,
  deriveEdWarning,
  evaluateCompoundEscalation,
  trackServiceBedCapacity,
  WA_ED_EXTENDED_WAIT_MINUTES,
  METRO_HEALTH_SERVICES,
} from "@/components/ward-management/capacity/service-capacity-tracker";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { allUnits, wardSites } from "@/components/ward-management/ward-sites";
import type { Movement, Site, Unit } from "@/components/ward-management/ward-model";

function createUnitStub(overrides: Partial<Unit> & Pick<Unit, "id" | "siteCode" | "beds">): Unit {
  return {
    name: overrides.id,
    cohort: "Adult",
    lockedBeds: 0,
    authorised: true,
    empty: { value: overrides.beds, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
    allocatable: { value: overrides.beds, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
    allocatableLocked: 0,
    held: 0,
    blocked: 0,
    sexMix: { Female: 0, Male: 0 },
    speciallingCapacity: 0,
    highAcuityCapacity: 0,
    sexDesignation: "Undesignated",
    forensic: false,
    ...overrides,
  };
}

function createMovementStub(overrides: Partial<Movement> & { id: `WF-${string}`; originEdId: string }): Movement {
  return {
    stage: "accepted_awaiting_bed",
    openedAt: 100,
    patientId: "PT-001",
    cohort: "Adult",
    legalStatus: "Voluntary",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    flaggedUrgent: false,
    urgency: 1,
    statusChanges: [],
    urgencyChanges: [],
    overrides: [],
    owner: "ED mental health team",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    withdrawnReferrals: [],
    unwinds: [],
    stageChanges: [],
    ...overrides,
  };
}

describe("service-capacity-tracker: deriveBedCapacityTone", () => {
  it("classifies Green when remaining capacity > 10% (occupancy < 90%)", () => {
    // 80 occupied of 100 -> 20 remaining (20%), 80% occupancy -> green
    const tone = deriveBedCapacityTone(100, 20);
    expect(tone.code).toBe("green");
    expect(tone.remainingPercent).toBe(20);
    expect(tone.occupancyPercent).toBe(80);
    expect(tone.label).toBe("80%");
  });

  it("classifies Yellow when occupancy is between 90% and 94.9%", () => {
    // 92 occupied of 100 -> 8 remaining (8%), 92% occupancy -> yellow
    const tone = deriveBedCapacityTone(100, 8);
    expect(tone.code).toBe("yellow");
    expect(tone.remainingPercent).toBe(8);
    expect(tone.occupancyPercent).toBe(92);
  });

  it("classifies Red when occupancy is between 95% and 97.9%", () => {
    // 96 occupied of 100 -> 4 remaining (4%), 96% occupancy -> red
    const tone = deriveBedCapacityTone(100, 4);
    expect(tone.code).toBe("red");
    expect(tone.remainingPercent).toBe(4);
    expect(tone.occupancyPercent).toBe(96);
  });

  it("classifies Black when occupancy is >= 98% or free beds <= 1", () => {
    // 99 occupied of 100 -> 1 remaining -> black
    const tone1 = deriveBedCapacityTone(100, 1);
    expect(tone1.code).toBe("black");

    // 0 remaining beds -> black
    const tone2 = deriveBedCapacityTone(50, 0);
    expect(tone2.code).toBe("black");
    expect(tone2.remainingPercent).toBe(0);
    expect(tone2.occupancyPercent).toBe(100);
  });

  it("handles 0 total beds cleanly", () => {
    const tone = deriveBedCapacityTone(0, 0);
    expect(tone.code).toBe("green");
    expect(tone.label).toBe("No Inpatient Beds");
    expect(tone.remainingPercent).toBe(0);
    expect(tone.occupancyPercent).toBe(0);
  });
});

describe("service-capacity-tracker: deriveEdWarning", () => {
  it("returns Green when 0 patients are waiting", () => {
    const warning = deriveEdWarning(0, 0, 0, 0, 0, 10);
    expect(warning.code).toBe("green");
    expect(warning.label).toBe("Normal Flow");
  });

  it("returns Green when 1-2 patients waiting under 3 hours with no target breaches", () => {
    const warning = deriveEdWarning(2, 120, 0, 0, 0, 5);
    expect(warning.code).toBe("green");
    expect(warning.label).toBe("Flow Manageable");
  });

  it("returns Yellow when 3 or more patients waiting or longest wait >= 180m", () => {
    const warning = deriveEdWarning(3, 100, 0, 0, 0, 5);
    expect(warning.code).toBe("yellow");
    expect(warning.label).toBe("Elevated Pressure");
  });

  it("counts nobody past a target that is not configured, and says so (Josh, question 2)", () => {
    const warning = deriveEdWarning(2, 260, 0, 1, 0, 5);
    expect(warning.message).toContain("access target not recorded");
    expect(warning.message).not.toMatch(/past \d+h target/);
    const movements: Movement[] = [
      createMovementStub({ id: "WF-001", originEdId: "scgh-ed", openedAt: 100, legalStatus: "Voluntary" }),
    ];
    const report = trackServiceBedCapacity(allUnits(), [], movements, 5000);
    const northMetro = report.services.find((s) => s.service === "North Metro");
    expect(northMetro?.edSummary.totalPastAccessTarget).toBe(0);
  });

  it("returns Red when any patient is past the 4-hour access target", () => {
    // 1 patient past the 240m access target
    // A configured 4-hour target, passed in as the rail passes Settings' value.
    const warning = deriveEdWarning(2, 260, 0, 1, 0, 5, 240);
    expect(warning.code).toBe("red");
    expect(warning.label).toBe("Past access target");
    expect(warning.message).toContain("past 4h target");
  });

  // Owner ruling 26 September 2026 (decisions.md D-22): a recorded statutory transport/transfer
  // deadline no longer drives this tone on its own — that trigger claimed a legal limit this
  // function cannot verify, and was taken out. `statutoryBreachCount` is still accepted (some
  // callers still compute it) but no longer changes the result.
  it("no longer elevates tone from a statutory deadline alone", () => {
    const warning = deriveEdWarning(1, 60, 0, 0, 1, 5);
    expect(warning.code).toBe("green");
    expect(warning.label).toBe("Flow Manageable");
  });

  it("returns Black when wait time exceeds extended threshold (8h / 480m)", () => {
    const warning = deriveEdWarning(4, WA_ED_EXTENDED_WAIT_MINUTES + 30, 1, 3, 0, 2);
    expect(warning.code).toBe("black");
    expect(warning.label).toBe("Critical Bed Block");
    expect(warning.message).toContain("Severe ED access block");
  });

  it("returns Black when multiple patients past target and service has zero free beds", () => {
    const warning = deriveEdWarning(3, 270, 2, 2, 0, 0);
    expect(warning.code).toBe("black");
    expect(warning.label).toBe("Critical Bed Block");
  });
});

describe("service-capacity-tracker: evaluateCompoundEscalation", () => {
  it("evaluates Level 1 Standard when both bed capacity and ED are green", () => {
    const alert = evaluateCompoundEscalation("South Metro", "green", 15, 20, {
      departmentsCount: 2,
      totalWaiting: 1,
      longestWaitMinutes: 60,
      totalDetained: 0,
      totalPastAccessTarget: 0,
      totalDetainedAndPastAccessTarget: 0,
      totalStatutoryBreaches: 0,
      warningLevel: "green",
      warningLabel: "Normal Flow",
      clinicalAdvisory: "Flow manageable",
    });
    expect(alert.level).toBe("green");
    expect(alert.protocolTier).toBe("Level 1 (Standard)");
    expect(alert.actionRequired).toBe(false);
  });

  it("evaluates Level 3 Red Escalation when ED is Red even if bed capacity is Yellow", () => {
    const alert = evaluateCompoundEscalation("East Metro", "yellow", 5, 8, {
      departmentsCount: 3,
      totalWaiting: 4,
      longestWaitMinutes: 260,
      totalDetained: 1,
      totalPastAccessTarget: 1,
      totalDetainedAndPastAccessTarget: 1,
      totalStatutoryBreaches: 0,
      warningLevel: "red",
      warningLabel: "Access Target Breach",
      clinicalAdvisory: "1 past 4h target",
    });
    expect(alert.level).toBe("red");
    expect(alert.protocolTier).toBe("Level 3 (Red Escalation)");
    expect(alert.actionRequired).toBe(true);
  });

  it("evaluates Level 4 Black Gridlock when both Inpatient and ED are Red", () => {
    const alert = evaluateCompoundEscalation("North Metro", "red", 2, 3.1, {
      departmentsCount: 2,
      totalWaiting: 5,
      longestWaitMinutes: 290,
      totalDetained: 2,
      totalPastAccessTarget: 2,
      totalDetainedAndPastAccessTarget: 1,
      totalStatutoryBreaches: 0,
      warningLevel: "red",
      warningLabel: "Access Target Breach",
      clinicalAdvisory: "2 past target",
    });
    expect(alert.level).toBe("black");
    expect(alert.protocolTier).toBe("Level 4 (Black Gridlock)");
    expect(alert.actionRequired).toBe(true);
  });
});

describe("service-capacity-tracker: trackServiceBedCapacity", () => {
  // Josh, 25 Sept 2026: "make the side rail's bed counts match the board". The rail's occupancy was
  // total minus free, which counted held, blocked and being-cleaned beds as occupied (North Metro
  // read 93.8% on the rail and about 86% on All wards). It is now the board's own occupied bucket.
  it("counts each service's occupied beds exactly as the board does", () => {
    const units = allUnits();
    const report = trackServiceBedCapacity(units, []);
    for (const service of report.services) {
      const codes = new Set(wardSites.filter((site) => site.service === service.service).map((site) => site.code));
      const boardOccupied = units
        .filter((unit) => codes.has(unit.siteCode))
        .reduce((sum, unit) => sum + unitCapacity(unit, []).occupied, 0);
      expect(service.occupiedBeds, service.service).toBe(boardOccupied);
    }
  });

  it("tracks hospital codes across each service accurately", () => {
    const report = trackServiceBedCapacity(allUnits(), []);
    expect(report.services.length).toBeGreaterThanOrEqual(4);

    const northMetro = report.services.find((s) => s.service === "North Metro");
    expect(northMetro).toBeDefined();
    // North Metro hospital codes: SCGH, KEMH, JHC, GRY. Perth Children's is under the Child and
    // Adolescent Health Service (owner ruling 2026-09-25), not North Metro.
    expect(northMetro?.hospitalCodes).toContain("SCGH");
    expect(northMetro?.hospitalCodes).toContain("GRY");
    expect(northMetro?.hospitalCodes).toContain("KEMH");
    expect(northMetro?.hospitalCodes).not.toContain("PCH");
    expect(northMetro?.hospitalCodes).toContain("JHC");
    // CAHS holds no mental health ward in the sample network, so the bed tracker has no CAHS row.
    expect(report.services.find((s) => s.service === "CAHS")).toBeUndefined();

    const southMetro = report.services.find((s) => s.service === "South Metro");
    expect(southMetro).toBeDefined();
    // South Metro hospital codes: FSH, RGH, PEEL, FRE
    expect(southMetro?.hospitalCodes).toContain("FSH");
    expect(southMetro?.hospitalCodes).toContain("RGH");
    expect(southMetro?.hospitalCodes).toContain("PEEL");
    expect(southMetro?.hospitalCodes).toContain("FRE");

    const eastMetro = report.services.find((s) => s.service === "East Metro");
    expect(eastMetro).toBeDefined();
    // East Metro hospital codes: RPH, ARM, SJGM, BTY
    expect(eastMetro?.hospitalCodes).toContain("RPH");
    expect(eastMetro?.hospitalCodes).toContain("ARM");
    expect(eastMetro?.hospitalCodes).toContain("SJGM");
    expect(eastMetro?.hospitalCodes).toContain("BTY");
  });

  it("calculates remaining capacity in numbers and percentage for every service", () => {
    const report = trackServiceBedCapacity(allUnits(), []);
    for (const service of report.services) {
      // Held and blocked beds are in neither bucket since the rail matched the board (25 Sept 2026),
      // so occupied plus free is at most the total, not equal to it.
      expect(service.occupiedBeds + service.remainingBeds).toBeLessThanOrEqual(service.totalBeds);
      if (service.totalBeds > 0) {
        const expectedPercent = Math.round((service.remainingBeds / service.totalBeds) * 1000) / 10;
        expect(service.remainingCapacityPercent).toBe(expectedPercent);
        const expectedOccPercent = Math.round((service.occupiedBeds / service.totalBeds) * 1000) / 10;
        expect(service.occupancyPercent).toBe(expectedOccPercent);
      }
    }
  });

  it("flags ED capacity warnings when movements contain waiting patients and WEAT breaches", () => {
    // Seed an ED movement at SCGH ED (scgh-ed) past the 4-hour target (openedAt 100, now 380 -> 280 min wait)
    const movements: Movement[] = [
      createMovementStub({
        id: "WF-001",
        originEdId: "scgh-ed",
        openedAt: 100,
        legalStatus: "Detained awaiting examination",
      }),
      createMovementStub({
        id: "WF-002",
        originEdId: "fsh-ed",
        openedAt: 300,
        legalStatus: "Voluntary",
      }),
    ];
    const now = 380; // 280 min wait for m1 -> breaches 240 min WEAT target

    const report = trackServiceBedCapacity(allUnits(), [], movements, now, wardSites, 240);

    const northMetro = report.services.find((s) => s.service === "North Metro");
    expect(northMetro?.edSummary.totalWaiting).toBe(1);
    expect(northMetro?.edSummary.longestWaitMinutes).toBe(280);
    expect(northMetro?.edSummary.totalPastAccessTarget).toBe(1);
    expect(northMetro?.edSummary.totalDetained).toBe(1);
    expect(northMetro?.edSummary.warningLevel).toBe("red");
    expect(northMetro?.edSummary.warningLabel).toBe("Past access target");

    const southMetro = report.services.find((s) => s.service === "South Metro");
    expect(southMetro?.edSummary.totalWaiting).toBe(1);
    expect(southMetro?.edSummary.longestWaitMinutes).toBe(80); // 380 - 300 = 80 min
    expect(southMetro?.edSummary.totalPastAccessTarget).toBe(0);
    expect(southMetro?.edSummary.warningLevel).toBe("green");
  });

  it("calculates statewide and metro aggregates accurately", () => {
    const report = trackServiceBedCapacity(allUnits(), []);
    const sumServiceFree = report.services.reduce((sum, s) => sum + s.remainingBeds, 0);
    expect(report.totalFreeBeds).toBe(sumServiceFree);

    const metroServices = report.services.filter((s) =>
      (METRO_HEALTH_SERVICES as readonly string[]).includes(s.service),
    );
    const sumMetroTotal = metroServices.reduce((sum, s) => sum + s.totalBeds, 0);
    const sumMetroOccupied = metroServices.reduce((sum, s) => sum + s.occupiedBeds, 0);
    const sumMetroFree = metroServices.reduce((sum, s) => sum + s.remainingBeds, 0);

    expect(report.metroTotalBeds).toBe(sumMetroTotal);
    expect(report.metroOccupiedBeds).toBe(sumMetroOccupied);
    expect(report.metroFreeBeds).toBe(sumMetroFree);
    expect(report.metroOccupancyPercent).toBe(Math.round((sumMetroOccupied / sumMetroTotal) * 1000) / 10);
    expect(report.metroRemainingCapacityPercent).toBe(Math.round((sumMetroFree / sumMetroTotal) * 1000) / 10);
  });
});
