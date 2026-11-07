import { describe, expect, it } from "vitest";

import { journeyStages } from "@/components/ward-management/statistics/statistics-journey-view";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  OCCUPIED_CAPTION,
  ON_THE_WARD_NOUN,
  wardBedUseFigures,
  wardOccupiedBeds,
} from "@/components/ward-management/ward-occupancy";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * WF-16 follow-up: paired figures either share one source or are labelled so a reader can tell
 * them apart. These pin what each label counts on the synthetic seed, not just the words.
 */
describe("WF-16 figure labels", () => {
  const seed = seedWardFlowState();
  const { units, admissions, bedReleases, leaveBeds, movements } = seed;
  const totals = units.reduce(
    (sum, unit) => {
      const states = bedStates(unit, admissions, [...bedReleases], leaveBeds);
      const figures = wardBedUseFigures(unit, admissions, bedReleases);
      return {
        occupied: sum.occupied + wardOccupiedBeds(unit, admissions, bedReleases),
        inUse: sum.inUse + figures.inUse,
        pulled: sum.pulled + figures.pulled,
        onLeave: sum.onLeave + states.onLeave,
      };
    },
    { occupied: 0, inUse: 0, pulled: 0, onLeave: 0 },
  );

  it("Statistics' On the ward stage counts Occupied, leave included, under its caption", () => {
    const stage = journeyStages({ units, admissions, bedReleases, leaveBeds, movements, now: NOW_ANCHOR }).find(
      (candidate) => candidate.id === "ward",
    );
    expect(stage?.label).toBe(ON_THE_WARD_NOUN);
    expect(stage?.caption).toBe(OCCUPIED_CAPTION);
    expect(stage?.count).toBe(totals.occupied);
    // "Leave included": the seed has people on leave, and they sit inside Occupied.
    expect(totals.onLeave).toBeGreaterThan(0);
    expect(stage?.breakdown.find((part) => part.label === "On leave")?.value).toBe(totals.onLeave);
  });

  it("In use is Occupied plus Pulled, so it differs from Occupied wherever a bed is pulled", () => {
    expect(totals.pulled).toBeGreaterThan(0);
    expect(totals.inUse).toBe(totals.occupied + totals.pulled);
    expect(totals.inUse).not.toBe(totals.occupied);
  });
});
