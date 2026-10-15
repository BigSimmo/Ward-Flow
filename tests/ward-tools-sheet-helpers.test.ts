import { describe, expect, it } from "vitest";

import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
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

describe("Tools sheet, Find a bed", () => {
  it("lists only open wards of the chosen age group that have a free bed", () => {
    const matches = findBeds(seed.units, bedReleases, DEFAULT_BED_FINDER_FILTERS);
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.unit.cohort).toBe("Adult");
      expect(match.unit.isClosed).not.toBe(true);
      expect(match.free).toBeGreaterThan(0);
    }
  });

  it("keeps involuntary patients to authorised wards and locked requests to free locked beds", () => {
    const matches = findBeds(seed.units, bedReleases, {
      ...DEFAULT_BED_FINDER_FILTERS,
      involuntary: true,
      bed: "locked",
    });
    for (const match of matches) {
      expect(match.unit.authorised).toBe(true);
      expect(match.free).toBe(lockedBedsFree(match.unit));
    }
  });

  it("puts wards in the home service first", () => {
    const home = unitHealthService(seed.units[0]!)!;
    const matches = findBeds(seed.units, bedReleases, { ...DEFAULT_BED_FINDER_FILTERS, home });
    const firstAway = matches.findIndex((match) => !match.home);
    if (firstAway >= 0) expect(matches.slice(firstAway).every((match) => !match.home)).toBe(true);
  });
});
