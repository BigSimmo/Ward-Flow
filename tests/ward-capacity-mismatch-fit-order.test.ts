import { describe, expect, it } from "vitest";

import { bedKindBreakdown, type BedKindId } from "@/components/ward-management/capacity/capacity-derivations";
import { allUnits, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * D-126 (Josh, 10 Nov 2026), list 10: the Capacity Mismatch pop-up's "Ready beds that fit" list
 * runs in the fixed fit-list order D-71 and D-110 use, health service then ward name, never most
 * fitting beds first. Synthetic seed wards only.
 */
const KINDS: BedKindId[] = ["locked_adult", "open_adult", "older_adult", "youth"];
const serviceOf = (siteCode: string) => siteByCode(siteCode)?.service ?? "";

describe("Capacity Mismatch 'Ready beds that fit' order (D-126)", () => {
  it("lists every bed kind's fitting wards by health service, then ward name", () => {
    const units = allUnits();
    let checked = 0;
    for (const kind of KINDS) {
      const { wards } = bedKindBreakdown(kind, [], units);
      const keys = wards.map(({ unit }) => [serviceOf(unit.siteCode), unit.name] as const);
      const sorted = keys.toSorted((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
      expect(keys).toEqual(sorted);
      checked += wards.length;
    }
    expect(checked).toBeGreaterThan(1);
  });

  it("does not put a ward with more fitting beds first", () => {
    // In the synthetic seed, some ward with more fitting open adult beds sits after one with fewer.
    const { wards } = bedKindBreakdown("open_adult", [], allUnits());
    const inversion = wards.some((entry, index) => wards.slice(index + 1).some((later) => later.beds > entry.beds));
    expect(wards.length).toBeGreaterThan(1);
    expect(inversion).toBe(true);
  });
});
