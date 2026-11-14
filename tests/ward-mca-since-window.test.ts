// Mechanics and clock audit (14 Nov 2026), L4, D-MCA (Josh, 14 Nov 2026): Home's "since" banner and
// the Activity panel read one stored review, so they take it or set it aside by one test
// (`lookIsUsable`) and count from one window (`shiftLookWindowStart`). Synthetic data only.
import { describe, expect, it } from "vitest";

import {
  changesForStoredLook,
  changesSinceInstant,
  lookIsUsable,
  takeLastLookSnapshot,
  type LastLookWorld,
} from "@/components/ward-management/coordinator/since-last-look";
import { previousShiftStartInstant, shiftLookWindowStart } from "@/components/ward-management/shift-first-look";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const world: LastLookWorld = {
  scenario: "standard",
  userId: "synthetic-coordinator",
  worldGeneration: 1,
  referrals: seed.referrals,
  movements: seed.movements,
  units: seed.units,
  bedReleases: seed.bedReleases,
  admissions: seed.admissions,
};
const now = NOW_ANCHOR;
const shiftStart = currentShiftStartInstant(now);
const snap = (at: number, overrides: Partial<LastLookWorld> = {}) =>
  takeLastLookSnapshot({ ...world, ...overrides }, at, DEFAULT_DUE_SOON_THRESHOLDS);
const current = snap(now);

describe("one window rule for the since banner and the Activity panel", () => {
  it("takes a review from this shift and sets aside one from an earlier shift, account or world", () => {
    expect(lookIsUsable(snap(shiftStart + 5), current, now)).toBe(true);
    expect(lookIsUsable(snap(shiftStart), current, now)).toBe(true);
    expect(lookIsUsable(snap(shiftStart - 1), current, now)).toBe(false);
    expect(lookIsUsable(snap(now + 1), current, now)).toBe(false);
    expect(lookIsUsable(snap(shiftStart + 5, { userId: "someone-else" }), current, now)).toBe(false);
    expect(lookIsUsable(snap(shiftStart + 5, { worldGeneration: 2 }), current, now)).toBe(false);
    expect(lookIsUsable(snap(shiftStart + 5, { scenario: "other" }), current, now)).toBe(false);
    expect(lookIsUsable(undefined, current, now)).toBe(false);
  });

  it("counts from the previous shift's start when the review is not usable, as Activity does", () => {
    const window = shiftLookWindowStart(undefined, now);
    expect(window).toBe(previousShiftStartInstant(now));
    for (const previous of [undefined, snap(shiftStart - 1)]) {
      const changes = changesForStoredLook(previous, current, world, now);
      expect(changes.basis).toBe("shift");
      expect(changes.since).toBe(window);
      expect(changes).toEqual(changesSinceInstant(world, window, now));
    }
  });

  it("compares with a usable review from this shift", () => {
    const review = snap(shiftStart + 5);
    const changes = changesForStoredLook(review, current, world, now);
    expect(changes.basis).not.toBe("shift");
    expect(changes.since).toBe(review.at);
  });
});
