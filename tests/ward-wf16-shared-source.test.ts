import { describe, expect, it } from "vitest";

import {
  bedKindGaps,
  bedsFreeingTodayTotal,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { occupiedBeds } from "@/components/ward-management/statistics/statistics-occupancy";
import { bedIsOccupied } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { dayOf } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  IN_USE_NOUN,
  OCCUPIED_NOUN,
  ON_THE_WARD_NOUN,
  wardBedUseFigures,
  wardBedsInUse,
  wardOccupiedBeds,
} from "@/components/ward-management/ward-occupancy";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WF-16 remainder: discharges-due vs forecast, ready vs spare that fit, and Occupied vs In use
 * each have one shared calculation. Labels already tell the pairs apart; these pins keep the
 * numbers on the same source.
 */
describe("WF-16 shared figure sources", () => {
  const seed = seedWardFlowState();
  const { units, admissions, bedReleases, leaveBeds, movements } = seed;
  const now = NOW_ANCHOR;

  it("Occupied / On the ward / In use nouns stay distinct and Occupied equals On the ward", () => {
    expect(OCCUPIED_NOUN).toBe("Occupied");
    expect(ON_THE_WARD_NOUN).toBe("On the ward");
    expect(IN_USE_NOUN).toBe("In use");
    expect(OCCUPIED_NOUN).not.toBe(IN_USE_NOUN);
  });

  it("wardBedUseFigures matches bedStates and wardBedsInUse / wardOccupiedBeds", () => {
    for (const unit of units.slice(0, 8)) {
      const states = bedStates(unit, admissions, [...bedReleases], [], []);
      const figures = wardBedUseFigures(unit, admissions, bedReleases);
      expect(figures.occupied).toBe(states.occupied);
      expect(figures.pulled).toBe(states.pulled);
      expect(figures.inUse).toBe(states.occupied + states.pulled);
      expect(wardOccupiedBeds(unit, admissions, bedReleases)).toBe(figures.occupied);
      expect(wardBedsInUse(unit, admissions, bedReleases)).toBe(figures.inUse);
    }
  });

  it("Statistics occupiedBeds In use equals Occupied + Pulled from the same boxes", () => {
    const figure = occupiedBeds(units, admissions, [...bedReleases], leaveBeds);
    expect(figure.inUse).toBe(figure.occupied + figure.pulled);
    const manual = units.reduce(
      (sum, unit) => {
        const f = wardBedUseFigures(unit, admissions, bedReleases);
        return { occupied: sum.occupied + f.occupied, inUse: sum.inUse + f.inUse };
      },
      { occupied: 0, inUse: 0 },
    );
    // Leave does not change Occupied/Pulled boxes; only the onLeave marker.
    expect(figure.occupied).toBe(manual.occupied);
    expect(figure.inUse).toBe(manual.inUse);
  });

  it("Beds freeing today counts today's open discharge plans, the same figure as the ward cards", () => {
    // Worked out here from the records, not through the helper under test. A16-05: a time already
    // passed is overdue, not freeing, so it is left out as Discharges counts it.
    const open = bedReleases.filter(
      (release) =>
        release.state !== "discharged" && release.expectedAt >= now && dayOf(release.expectedAt) === dayOf(now),
    );
    expect(open.length, "the seed has discharges planned today").toBeGreaterThan(0);
    expect(bedsFreeingTodayTotal(bedReleases, now)).toBe(open.length);
    const someUnits = new Set(units.slice(0, 5).map((unit) => unit.id));
    expect(bedsFreeingTodayTotal(bedReleases, now, someUnits)).toBe(
      open.filter((release) => someUnits.has(release.unitId)).length,
    );
    expect(bedsFreeingTodayTotal(undefined, now)).toBeUndefined();

    const rows = networkWardRows(units, now, bedReleases, admissions, leaveBeds);
    const rowFreeing = rows.map((row) => row.freeing).filter((value): value is number => value !== undefined);
    expect(rowFreeing.reduce((a, b) => a + b, 0)).toBe(open.length);

    // Admissions due today are a different record and are not forced to agree with the plans.
    const due = admissions.filter(
      (admission) =>
        bedIsOccupied(admission) &&
        admission.expectedDischargeAt !== null &&
        dayOf(admission.expectedDischargeAt) === dayOf(now),
    ).length;
    expect(rows.reduce((sum, row) => sum + (row.dischargesDueToday ?? 0), 0)).toBe(due);
  });

  it("spare that fit is bedsThatFit - waiting from bedKindGaps (not all ready beds)", () => {
    const gaps = bedKindGaps([...movements], [...units], now, admissions);
    for (const row of gaps) {
      expect(row.gap).toBe(row.bedsThatFit - row.waiting);
    }
    const readyAll = units.reduce((sum, unit) => sum + bedStates(unit, admissions, [...bedReleases], [], []).ready, 0);
    const fitTotal = gaps.reduce((sum, row) => sum + row.bedsThatFit, 0);
    // Ready-that-fit is at most all ready; often stricter.
    expect(fitTotal).toBeLessThanOrEqual(readyAll);
  });
});
