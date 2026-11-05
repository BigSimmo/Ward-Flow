import { describe, expect, it } from "vitest";
import { DEFAULT_DUE_SOON_THRESHOLDS, splitDuration } from "@/components/ward-management/ward-clock";
import { leaveBeds } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { wardLiveFormAlerts } from "@/components/ward-management/ward/ward-screen-derivations";

/**
 * Audit W2 (S1, 5 Nov 2026): the leave-bed alert showed elapsed time through the countdown
 * formatter, so a bed held for a patient on leave read "5h 10m left", like a deadline. It is time
 * since the bed was recorded, so it reads "Open 5h 10m", with no "left", "overdue" or "waiting".
 */
describe("a leave bed's open time is elapsed time, not a countdown", () => {
  it('reads "Open 5h 10m"', () => {
    const leaveBed = { ...leaveBeds[0]!, confirmedAt: NOW_ANCHOR - (5 * 60 + 10) };
    const unit = allUnits().find((candidate) => candidate.id === leaveBed.unitId)!;
    const { liveFormAlerts } = wardLiveFormAlerts({
      resolvePatientIdentity: () => {
        throw new Error("no movement is passed, so no name is resolved");
      },
      accepted: [],
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      overdueLeaveBeds: [leaveBed],
      unit,
    });
    expect(liveFormAlerts).toHaveLength(1);
    expect(liveFormAlerts[0]!.countdown).toBe("Open 5h 10m");
    expect(liveFormAlerts[0]!.countdown).not.toMatch(/left|overdue|waiting/);
  });
});

describe("splitDuration rounds a fractional minute count (audit C1)", () => {
  it("rounds before splitting, so an average never prints its decimals", () => {
    // The measured case: Statistics "Pull to arrival" printed "4h 57.88659793814435m".
    expect(splitDuration(297.88659793814435)).toBe("4h 58m");
    expect(splitDuration(59.6), "rounding first gives an hour, never 60m").toBe("1h 00m");
    expect(splitDuration(0.4)).toBe("0m");
    expect(splitDuration(24 * 60 - 0.4), "just under a day rounds to a day").toBe("1d");
  });
});
