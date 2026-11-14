import { describe, expect, it } from "vitest";

import {
  PULL_RECORDED_TIME_SLACK_MINUTES,
  pullStageIndex,
  type PulledBed,
} from "@/components/ward-management/pull-bed-facts";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * A shared save stamps the pull with the server's minute, not the screen's, so the kept row's Undo
 * must still find its pull when the two differ by a minute or two. Synthetic shapes only.
 */
function movementPulledAt(at: number, by = "coordinator"): Movement {
  return {
    stage: "pulled",
    stageChanges: [
      { from: "accepted", to: "awaiting_bed", at: 100, by },
      { from: "awaiting_bed", to: "pulled", at, by },
    ],
  } as unknown as Movement;
}

const pulled = { desk: "coordinator", at: 600 } as unknown as PulledBed;

describe("pullStageIndex", () => {
  it("finds the pull at the screen's own minute", () => {
    expect(pullStageIndex(movementPulledAt(600), pulled)).toBe(1);
  });

  it("finds the pull when the server recorded a later minute", () => {
    expect(pullStageIndex(movementPulledAt(601), pulled)).toBe(1);
    expect(pullStageIndex(movementPulledAt(600 + PULL_RECORDED_TIME_SLACK_MINUTES), pulled)).toBe(1);
  });

  it("does not take a pull from another desk or long after", () => {
    expect(pullStageIndex(movementPulledAt(600, "ward"), pulled)).toBeUndefined();
    expect(pullStageIndex(movementPulledAt(600 + PULL_RECORDED_TIME_SLACK_MINUTES + 1), pulled)).toBeUndefined();
  });
});
