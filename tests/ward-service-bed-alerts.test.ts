import { describe, expect, it } from "vitest";

import {
  deriveServiceBedAlerts,
  METRO_HEALTH_SERVICES,
  occupancyTone,
} from "@/components/ward-management/shell/ward-service-bed-alerts";
import { computeShiftProgress } from "@/components/ward-management/shell/ward-rail";
import type { BedRelease, Site, Unit } from "@/components/ward-management/ward-model";
import { openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { allUnits, wardSites } from "@/components/ward-management/ward-sites";

function unitStub(overrides: Partial<Unit> & Pick<Unit, "id" | "siteCode" | "beds">): Unit {
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

describe("deriveServiceBedAlerts", () => {
  it("header free count equals the sum of service rows", () => {
    const summary = deriveServiceBedAlerts(allUnits(), []);
    const rowSum = summary.services.reduce((sum, row) => sum + row.freeBeds, 0);
    expect(summary.totalFreeBeds).toBe(rowSum);
    expect(summary.services.length).toBeGreaterThan(0);
  });

  it("metro percentage uses only the three metro services", () => {
    const sites: Site[] = [
      {
        code: "NM",
        name: "North Site",
        service: "North Metro",
        units: [],
      },
      {
        code: "SM",
        name: "South Site",
        service: "South Metro",
        units: [],
      },
      {
        code: "EM",
        name: "East Site",
        service: "East Metro",
        units: [],
      },
      {
        code: "WA",
        name: "Country Site",
        service: "WACHS",
        units: [],
      },
      {
        code: "PV",
        name: "Private Site",
        service: "Private",
        units: [],
      },
    ];

    const units: Unit[] = [
      // Metro: 9 occupied of 10 → 90%
      unitStub({
        id: "n1",
        siteCode: "NM",
        beds: 10,
        empty: { value: 1, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
        allocatable: { value: 1, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
      }),
      unitStub({
        id: "s1",
        siteCode: "SM",
        beds: 10,
        empty: { value: 0, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
        allocatable: { value: 0, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
      }),
      unitStub({
        id: "e1",
        siteCode: "EM",
        beds: 10,
        empty: { value: 0, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
        allocatable: { value: 0, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
      }),
      // Non-metro: all free — if included, metro % would drop hard
      unitStub({
        id: "w1",
        siteCode: "WA",
        beds: 100,
        empty: { value: 100, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
        allocatable: { value: 100, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
      }),
      unitStub({
        id: "p1",
        siteCode: "PV",
        beds: 100,
        empty: { value: 100, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
        allocatable: { value: 100, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
      }),
    ];

    const summary = deriveServiceBedAlerts(units, [], sites);
    expect(METRO_HEALTH_SERVICES).toEqual(["North Metro", "South Metro", "East Metro"]);

    const metroRows = summary.services.filter((row) =>
      (METRO_HEALTH_SERVICES as readonly string[]).includes(row.shortName),
    );
    const metroOccupied = metroRows.reduce((sum, row) => sum + row.occupiedBeds, 0);
    const metroTotal = metroRows.reduce((sum, row) => sum + row.totalBeds, 0);
    expect(metroTotal).toBe(30);
    expect(metroOccupied).toBe(29);
    expect(summary.metroOccupancyPercent).toBe(Math.round((29 / 30) * 1000) / 10);

    const wachs = summary.services.find((row) => row.shortName === "WACHS");
    expect(wachs?.freeBeds).toBe(100);
    expect(wachs?.occupancyPercent).toBe(0);
    // Including WACHS+Private free beds would dilute metro occupancy below this figure.
    expect(summary.metroOccupancyPercent).toBeGreaterThan(90);
  });

  it("uses openBedsNow for free beds and site names for facilities", () => {
    const unit = allUnits()[0];
    const site = wardSites.find((candidate) => candidate.code === unit.siteCode);
    if (!site) throw new Error("seed unit missing site");

    const releases: BedRelease[] = [];
    const summary = deriveServiceBedAlerts([unit], releases, [site]);
    const row = summary.services[0];
    expect(row.freeBeds).toBe(openBedsNow(unit, releases));
    expect(row.totalBeds).toBe(unit.beds);
    // The board's occupied bucket, not total minus free (Josh, 25 Sept 2026: the rail matches the board).
    expect(row.occupiedBeds).toBe(unitCapacity(unit, releases).occupied);
    expect(row.facilities).toBe(site.name);
    expect(row.escalation).toBe(`${row.freeBeds} free · ${row.occupiedBeds} occupied`);
  });

  it("omits a health service that has no wards", () => {
    const sites: Site[] = [
      { code: "NM", name: "North Only", service: "North Metro", units: [] },
      { code: "SM", name: "South Empty", service: "South Metro", units: [] },
    ];
    const units = [
      unitStub({
        id: "n1",
        siteCode: "NM",
        beds: 5,
        empty: { value: 2, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
        allocatable: { value: 2, source: "ward", confirmedAt: 0, staleAfterMinutes: 90 },
      }),
    ];
    const summary = deriveServiceBedAlerts(units, [], sites);
    expect(summary.services.map((row) => row.shortName)).toEqual(["North Metro"]);
  });
});

describe("occupancyTone", () => {
  it("labels the badge with the occupancy percent, not a clinical code name", () => {
    expect(occupancyTone(98.4).codeLabel).toBe("98.4%");
    expect(occupancyTone(98.4).code).toBe("red");
    expect(occupancyTone(92).code).toBe("yellow");
    expect(occupancyTone(80).code).toBe("green");
  });
});

describe("computeShiftProgress handover display", () => {
  it('returns "Handover Due" during shift changeover window and never the literal "3h 38m"', () => {
    // 14:55 AWST (minute 895) is in Day shift handover window (within 15m of 15:00)
    const dayHandover = computeShiftProgress(895);
    expect(dayHandover.countdownStr).toBe("Handover Due");
    expect(dayHandover.countdownStr).not.toBe("3h 38m");

    // Same boundary via AWST Date: 14:55 AWST = 06:55 UTC
    const fromDate = computeShiftProgress(new Date("2026-09-17T06:55:00Z"));
    expect(fromDate.countdownStr).toBe("Handover Due");
    expect(fromDate.countdownStr).not.toContain("3h 38m");

    // 16:00 AWST (minute 960) is now in Evening Shift (15:00–23:00) with 7h remaining
    const eveningShift = computeShiftProgress(960);
    expect(eveningShift.shiftTitle).toBe("Evening Shift (15:00–23:00)");
    expect(eveningShift.countdownStr).toBe("7h 0m");
  });
});
