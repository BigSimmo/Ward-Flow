import { describe, expect, it } from "vitest";

import { pilotSteps } from "@/components/ward-management/reports/pilot-measures";
import { reportWeek } from "@/components/ward-management/reports/weekly-report";
import {
  REPLAYED_JOURNEY_DAYS,
  replayedJourneyMovements,
  replayedJourneyWeek,
} from "@/components/ward-management/reports/weekly-replayed-journeys";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { MINIMUM_EFFECTIVENESS_SAMPLE } from "@/components/ward-management/ward-derivations-records";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// D-273 (Josh, 21 Nov 2026): Weekly's steps read journeys replayed through the real reducer, kept
// apart from the plain seed, which still never backfills a stage change.
describe("Weekly replayed example journeys (D-273)", () => {
  it("walks one journey a day before the seed's day, through every stage, in reducer order", () => {
    // The walk's own day is day 0, the plain seed's.
    expect(Math.floor(NOW_ANCHOR / MINUTES_PER_DAY)).toBe(0);
    const journeys = replayedJourneyMovements();
    expect(journeys).toHaveLength(REPLAYED_JOURNEY_DAYS);
    for (const journey of journeys) {
      expect(journey.stage).toBe("arrived");
      expect(journey.stageChanges.map((change) => change.to)).toEqual([
        "placement_requested",
        "destination_review",
        "accepted_awaiting_bed",
        "pulled",
        "handover_ready",
        "moving",
        "arrived",
      ]);
      expect(journey.transport?.arrivedAt).toBeLessThan(0);
    }
  });

  it("leaves the plain seed alone", () => {
    const replayedAt = new Set(replayedJourneyMovements().map((journey) => journey.openedAt));
    const seed = seedWardFlowState();
    expect(seed.movements.every((movement) => movement.stageChanges.length === 0)).toBe(true);
    expect(seed.movements.some((movement) => replayedAt.has(movement.openedAt))).toBe(false);
  });

  it("gives every step a published typical time in last week, whatever the day and weekday", () => {
    const dayZero = new Date("2026-11-16T00:00:00+08:00");
    for (const day of [0, 1, 2, 3, 4, 5, 6, 9, 30]) {
      const now = NOW_ANCHOR + day * MINUTES_PER_DAY;
      const week = reportWeek(0, now, dayZero);
      const steps = pilotSteps([], week, [
        { movements: replayedJourneyMovements(), week: replayedJourneyWeek(week, now) },
      ]);
      for (const step of steps) {
        expect(step.summary.sampleSize, `${step.id} on day ${day}`).toBe(7);
        expect(step.summary.sampleSize).toBeGreaterThanOrEqual(MINIMUM_EFFECTIVENESS_SAMPLE);
        expect(step.summary.median).toBeGreaterThan(0);
      }
    }
  });

  it("moves the counted week back by whole days only", () => {
    const week = reportWeek(0, NOW_ANCHOR + 3 * MINUTES_PER_DAY + 90, new Date("2026-11-16T00:00:00+08:00"));
    const moved = replayedJourneyWeek(week, NOW_ANCHOR + 3 * MINUTES_PER_DAY + 90);
    expect(week.start - moved.start).toBe(3 * MINUTES_PER_DAY);
    expect(week.end - moved.end).toBe(3 * MINUTES_PER_DAY);
  });
});
