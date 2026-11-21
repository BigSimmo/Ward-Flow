import { describe, expect, it } from "vitest";

import { pilotSteps } from "@/components/ward-management/reports/pilot-measures";
import { reportWeek } from "@/components/ward-management/reports/weekly-report";
import {
  REPLAYED_JOURNEY_DAYS,
  replayedJourneyMovements,
} from "@/components/ward-management/reports/weekly-replayed-journeys";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { MINIMUM_EFFECTIVENESS_SAMPLE } from "@/components/ward-management/ward-derivations-records";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// D-273 (Josh, 21 Nov 2026): Weekly's steps read journeys replayed through the real reducer, kept
// apart from the plain seed, which still never backfills a stage change.
describe("Weekly replayed sample journeys (D-273)", () => {
  it("walks one journey a day through every stage, with times the reducer recorded", () => {
    const journeys = replayedJourneyMovements(NOW_ANCHOR);
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
      expect(journey.transport?.arrivedAt).toBeLessThan(Math.floor(NOW_ANCHOR / MINUTES_PER_DAY) * MINUTES_PER_DAY);
    }
  });

  it("leaves the plain seed alone", () => {
    replayedJourneyMovements(NOW_ANCHOR);
    const seed = seedWardFlowState();
    expect(seed.movements.every((movement) => movement.stageChanges.length === 0)).toBe(true);
    const replayedIds = new Set(replayedJourneyMovements(NOW_ANCHOR).map((journey) => journey.openedAt));
    expect(seed.movements.some((movement) => replayedIds.has(movement.openedAt))).toBe(false);
  });

  it("gives every step a published typical time in last week, whatever weekday today is", () => {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const now = NOW_ANCHOR + weekday * MINUTES_PER_DAY;
      const dayZero = new Date("2026-11-16T00:00:00+08:00");
      const week = reportWeek(0, now, dayZero);
      const steps = pilotSteps(replayedJourneyMovements(now), week);
      for (const step of steps) {
        expect(step.summary.sampleSize, `${step.id} on weekday ${weekday}`).toBe(7);
        expect(step.summary.sampleSize).toBeGreaterThanOrEqual(MINIMUM_EFFECTIVENESS_SAMPLE);
        expect(step.summary.median).toBeGreaterThan(0);
      }
    }
  });

  it("moves with the clock by whole days only", () => {
    const today = replayedJourneyMovements(NOW_ANCHOR);
    const later = replayedJourneyMovements(NOW_ANCHOR + 90);
    const tomorrow = replayedJourneyMovements(NOW_ANCHOR + MINUTES_PER_DAY);
    expect(later.map((journey) => journey.openedAt)).toEqual(today.map((journey) => journey.openedAt));
    expect(tomorrow.map((journey) => journey.openedAt)).toEqual(
      today.map((journey) => journey.openedAt + MINUTES_PER_DAY),
    );
  });
});
