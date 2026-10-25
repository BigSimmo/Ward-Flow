import { describe, expect, it } from "vitest";

import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
import { activeWardNetwork, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { boundedBedAvailability, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { lockedBedsFree } from "@/components/ward-management/ward-bed-designation";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { bedSummaryText } from "@/components/ward-management/tools/ward-bed-summary";
import { DEFAULT_BED_FINDER_FILTERS, findBeds } from "@/components/ward-management/tools/ward-bed-finder";

const seed = {
  units: allUnits(),
  admissions: wardAdmissions,
  movements: wardMovements,
  bedReleases,
  leaveBeds,
  now: NOW_ANCHOR,
  thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
  network: activeWardNetwork(),
};

describe("Tools sheet, Copy bed summary", () => {
  it("states the same ready count as the capacity derivation, with total beds", () => {
    const ready = seed.units.reduce(
      (sum, unit) => sum + capacityBreakdown(unit, bedReleases, leaveBeds, NOW_ANCHOR).availableNow,
      0,
    );
    const beds = seed.units.reduce((sum, unit) => sum + unit.beds, 0);
    expect(bedSummaryText(seed)).toContain(`Ready beds: ${ready} of ${beds}`);
  });

  it("is plain text a record system accepts and says it is synthetic", () => {
    const text = bedSummaryText(seed);
    expect(text).not.toMatch(/[;→←⇒—]/u);
    expect(text.split("\n").at(-1)).toBe("Synthetic prototype data. Not for clinical use.");
  });
});

// Audit 24-1 decision 1: legal status has no default, so each call below chooses one.
const VOLUNTARY = { ...DEFAULT_BED_FINDER_FILTERS, legalStatus: "voluntary" } as const;

describe("Tools sheet, Find a bed", () => {
  it("lists nothing until a legal status is chosen", () => {
    expect(DEFAULT_BED_FINDER_FILTERS.legalStatus).toBeUndefined();
    expect(findBeds(seed.units, bedReleases, DEFAULT_BED_FINDER_FILTERS)).toEqual([]);
  });

  it("lists every open ward of the chosen age group, with its Ready count and recorded time", () => {
    const matches = findBeds(seed.units, bedReleases, VOLUNTARY);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches).toHaveLength(seed.units.filter((unit) => !unit.isClosed && unit.cohort === "Adult").length);
    for (const match of matches) {
      expect(match.unit.cohort).toBe("Adult");
      expect(match.unit.isClosed).not.toBe(true);
      expect(match.free).toBe(boundedBedAvailability(match.unit).available);
      expect(match.recordedAt).toBe(match.unit.allocatable.confirmedAt);
    }
  });

  it("keeps involuntary patients to authorised wards and locked requests to free locked beds", () => {
    const matches = findBeds(seed.units, bedReleases, {
      ...DEFAULT_BED_FINDER_FILTERS,
      legalStatus: "involuntary",
      bed: "locked",
    });
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.unit.authorised).toBe(true);
      expect(match.free).toBe(Math.min(lockedBedsFree(match.unit), boundedBedAvailability(match.unit).available));
    }
  });

  it("never shows more beds than the board's Ready figure", () => {
    const ward = seed.units.find((unit) => !unit.isClosed && unit.cohort === "Adult" && unit.allocatable.value > 1)!;
    const crowded = { ...ward, empty: { ...ward.empty, value: 1 } };
    const [match] = findBeds([crowded], bedReleases, VOLUNTARY);
    expect(match?.free).toBe(1);
    const mixed = {
      ...ward,
      allocatable: { ...ward.allocatable, value: 4 },
      allocatableLocked: 2,
      empty: { ...ward.empty, value: 2 },
    };
    expect(findBeds([mixed], bedReleases, { ...VOLUNTARY, bed: "open" })[0]?.free).toBe(2);
    // Every ward in scope is listed, so a ward with no Ready bed shows 0 rather than dropping out.
    const none = { ...ward, empty: { ...ward.empty, value: 0 } };
    expect(findBeds([none], bedReleases, VOLUNTARY)[0]?.free).toBe(0);
  });

  it("labels wards in the home service without moving them up the list", () => {
    const home = unitHealthService(seed.units[0]!)!;
    const matches = findBeds(seed.units, bedReleases, { ...VOLUNTARY, home });
    expect(matches.some((match) => match.home)).toBe(true);
    for (const match of matches) expect(match.home).toBe(match.service === home);
    const names = matches.map((match) => match.unit.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en-AU")));
    expect(matches.map((match) => match.unit.id)).toEqual(
      findBeds(seed.units, bedReleases, VOLUNTARY).map((match) => match.unit.id),
    );
  });
});
