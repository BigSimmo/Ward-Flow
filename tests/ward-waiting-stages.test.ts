import { describe, expect, it } from "vitest";

import { WAITING_STAGES, waitingStages } from "@/components/ward-management/reports/waiting-stages";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

function seeded(id: string): Movement {
  const movement = seedWardFlowState().movements.find((each) => each.id === id);
  if (!movement) throw new Error(`seed has no ${id}`);
  return movement;
}

function rowOf(movements: readonly Movement[], id: (typeof WAITING_STAGES)[number]["id"]) {
  const row = waitingStages(movements).find((each) => each.id === id);
  if (!row) throw new Error(`no stage ${id}`);
  return row;
}

describe("waitingStages", () => {
  it("keeps the four stages in journey order", () => {
    expect(waitingStages([]).map((row) => row.label)).toEqual([
      "Awaiting ward response",
      "Accepted, awaiting bed",
      "Departure awaiting bed preparation",
      "Awaiting transport",
    ]);
  });

  it("times a stage from recorded stage changes only", () => {
    const movement: Movement = {
      ...seeded("WF-007"),
      stageChanges: [
        { at: 100, from: "placement_requested", to: "destination_review", by: "coordinator" },
        { at: 160, from: "destination_review", to: "accepted_awaiting_bed", by: "ward" },
        { at: 200, from: "accepted_awaiting_bed", to: "pulled", by: "coordinator" },
        { at: 230, from: "pulled", to: "handover_ready", by: "ed" },
        { at: 300, from: "handover_ready", to: "moving", by: "officer" },
        { at: 340, from: "moving", to: "arrived", by: "ward" },
      ],
    };
    const minutes = waitingStages([movement]).map((row) => row.recorded[0]?.minutes);
    expect(minutes).toEqual([60, 40, 30, 70]);
  });

  it("counts a passed stage without both times as not recorded, never guessed", () => {
    const movement: Movement = { ...seeded("WF-007"), stageChanges: [], transport: undefined };
    const preparation = rowOf([movement], "awaiting_bed_preparation");
    expect(preparation.recorded).toEqual([]);
    expect(preparation.notRecorded.map((journey) => journey.movement.id)).toEqual(["WF-007"]);
    expect(preparation.notRecorded[0]?.minutes).toBeUndefined();
  });

  it("lists open journeys in a stage separately and leaves them out of the typical time", () => {
    const movement: Movement = { ...seeded("WF-003"), stageChanges: [] };
    const row = rowOf([movement], "accepted_awaiting_bed");
    expect(row.inStageNow.map((journey) => journey.movement.id)).toEqual(["WF-003"]);
    expect(row.summary.sampleSize).toBe(0);
    expect(row.summary.population).toBe(0);
  });

  it("does not count a journey that has not reached the stage", () => {
    const movement: Movement = { ...seeded("WF-001"), stageChanges: [] };
    const rows = waitingStages([movement]);
    expect(rows.every((row) => row.recorded.length + row.notRecorded.length === 0)).toBe(true);
  });

  it("on the demo seed, times the ward response and counts later stages as not recorded", () => {
    // Seeded journeys carry no stage changes (never backfilled), so only the referral and
    // acceptance times are on record; later stages honestly read "not recorded".
    const rows = waitingStages(seedWardFlowState().movements);
    expect(rows[0]!.summary.median).toBeTypeOf("number");
    for (const row of rows.slice(1)) {
      expect(row.recorded).toEqual([]);
      expect(row.notRecorded.length).toBeGreaterThan(0);
    }
  });
});
