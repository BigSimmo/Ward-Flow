import { describe, expect, it } from "vitest";

import {
  ED_CLEARANCE_FLAG_MINUTES,
  clearanceMedian,
  edClearanceMedian,
  edClearanceTime,
} from "../src/components/ward-management/ed/ed-clearance-time";
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";
import { formatInstantWithDay } from "../src/components/ward-management/ward-clock";
import type { Movement } from "../src/components/ward-management/ward-model";

// Synthetic instants only (minutes). Arrival at 1000, read at 1220: 3h 40m in the department.
const ARRIVED = 1000;
const NOW = ARRIVED + 3 * 60 + 40;

describe("medical clearance tracker, one patient (Josh sign-off, 9 Nov 2026)", () => {
  it("shows elapsed time since arrival when no clearance is recorded, never a countdown", () => {
    expect(edClearanceTime(ARRIVED, undefined, NOW)).toEqual({
      kind: "not_recorded",
      words: "Not cleared · 3h 40m since arrival",
      flagged: false,
    });
  });

  it("names a recorded 'No' with the time it was recorded, not an elapsed figure", () => {
    const at = ARRIVED + 90;
    expect(edClearanceTime(ARRIVED, { cleared: false, at }, NOW)).toEqual({
      kind: "not_cleared",
      words: `Not cleared (recorded ${formatInstantWithDay(at, NOW)})`,
      flagged: false,
    });
  });

  it("says how long a recorded clearance took from arrival", () => {
    const time = edClearanceTime(ARRIVED, { cleared: true, at: ARRIVED + 135 }, NOW);
    expect(time).toEqual({ kind: "cleared", words: "Cleared in 2h 15m", flagged: false, minutes: 135 });
  });

  it("reads a clearance recorded before (or at) arrival as cleared on arrival", () => {
    for (const at of [ARRIVED - 30, ARRIVED]) {
      expect(edClearanceTime(ARRIVED, { cleared: true, at }, NOW)).toEqual({
        kind: "cleared_on_arrival",
        words: "Cleared on arrival",
        flagged: false,
        minutes: 0,
      });
    }
  });

  it("flags amber at exactly six hours with none recorded, and not a minute before", () => {
    expect(ED_CLEARANCE_FLAG_MINUTES).toBe(CLINICAL_VALUES.edClearanceNotRecorded.value * 60);
    expect(CLINICAL_VALUES.edClearanceNotRecorded).toMatchObject({ value: 6, unit: "hours", status: "signed" });
    expect(edClearanceTime(ARRIVED, undefined, ARRIVED + 6 * 60 - 1).flagged).toBe(false);
    const atSix = edClearanceTime(ARRIVED, undefined, ARRIVED + 6 * 60);
    expect(atSix.flagged).toBe(true);
    expect(atSix.words).toBe("Not cleared · 6h 00m since arrival");
    // A recorded answer is never flagged by the tracker: the clinician has spoken.
    expect(edClearanceTime(ARRIVED, { cleared: false, at: ARRIVED + 10 }, ARRIVED + 600).flagged).toBe(false);
  });

  it("never counts a future arrival as negative time", () => {
    expect(edClearanceTime(NOW + 5, undefined, NOW).words).toBe("Not cleared · 0m since arrival");
  });
});

describe("median time to medical clearance, per ED", () => {
  it("is 'Too few' (null) under five recorded clearances, with the count kept", () => {
    expect(clearanceMedian([])).toEqual({ count: 0, medianMinutes: null });
    expect(clearanceMedian([10, 20, 30, 40])).toEqual({ count: 4, medianMinutes: null });
  });

  it("takes the middle value for an odd count and the mean of the two middles for an even one", () => {
    expect(clearanceMedian([300, 60, 120, 0, 90])).toEqual({ count: 5, medianMinutes: 90 });
    expect(clearanceMedian([300, 60, 120, 0, 90, 600])).toEqual({ count: 6, medianMinutes: 105 });
  });

  it("counts only journeys that recorded 'cleared', and clearance before arrival as nought", () => {
    const journey = (id: string, clearance?: { cleared: boolean; at: number }) =>
      ({ id, openedAt: ARRIVED, medicalClearance: clearance }) as unknown as Movement;
    const journeys = [
      journey("WF-A", { cleared: true, at: ARRIVED - 15 }),
      journey("WF-B", { cleared: true, at: ARRIVED + 60 }),
      journey("WF-C", { cleared: true, at: ARRIVED + 120 }),
      journey("WF-D", { cleared: true, at: ARRIVED + 180 }),
      journey("WF-E", { cleared: true, at: ARRIVED + 240 }),
      journey("WF-F", { cleared: false, at: ARRIVED + 30 }),
      journey("WF-G"),
    ];
    expect(edClearanceMedian(journeys, [], NOW)).toEqual({ count: 5, medianMinutes: 120 });
    expect(edClearanceMedian(journeys.slice(1), [], NOW)).toEqual({ count: 4, medianMinutes: null });
  });
});
