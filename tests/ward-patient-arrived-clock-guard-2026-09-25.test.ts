import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

// Same specimen ward-arrival-divergence.test.ts uses: hand-authored in the seed as far as
// `moving` with transport collected, so PATIENT_ARRIVED can fire against it directly.
const HAND_AUTHORED = "WF-014";

function arrive(state: WardFlowState, now: number): WardFlowState {
  return wardFlowReducer(state, {
    type: "PATIENT_ARRIVED",
    role: "officer",
    now,
    movementId: HAND_AUTHORED,
  } as Parameters<typeof wardFlowReducer>[1]);
}

function movement(state: WardFlowState, id: string) {
  const found = state.movements.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`no movement ${id} in seeded state`);
  return found;
}

describe("PATIENT_ARRIVED refuses a non-finite now (audit follow-up 2026-09-25)", () => {
  it("refuses NaN instead of writing it into the movement's closure/arrival timestamps", () => {
    const seeded = seedWardFlowState("standard");
    const next = arrive(seeded, Number.NaN);
    expect(movement(next, HAND_AUTHORED).stage).toBe(movement(seeded, HAND_AUTHORED).stage);
    expect(next.rejections.length).toBeGreaterThan(seeded.rejections.length);
  });

  it("still accepts a genuine finite now", () => {
    const seeded = seedWardFlowState("standard");
    const next = arrive(seeded, NOW);
    expect(movement(next, HAND_AUTHORED).stage).toBe("arrived");
  });
});
