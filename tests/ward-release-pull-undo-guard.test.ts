import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Audit 24-7 (CT-06): the "Bed pulled" toast's Undo names the pull it was offered for. If that pull
 * was released and a new bed pulled for the same journey meanwhile, Undo is refused and the new pull
 * stands. A release that names no expected pull behaves as before. Synthetic seed data only.
 */
const NOW = NOW_ANCHOR;
const MOVEMENT_ID = "WF-009";
const UNIT_ID = "rph-adult-secure";

function acceptedAwaitingBed(): WardFlowState {
  let state: WardFlowState = seedWardFlowState();
  for (const event of [
    { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [UNIT_ID] },
    { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: UNIT_ID },
  ] as const) {
    state = wardFlowReducer(state, { ...event, now: NOW, movementId: MOVEMENT_ID } as never);
  }
  expect(state.rejections).toEqual([]);
  return state;
}

const movementOf = (state: WardFlowState) => state.movements.find((m) => m.id === MOVEMENT_ID)!;

function pull(state: WardFlowState, at = NOW): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: at,
    movementId: MOVEMENT_ID,
    unitId: UNIT_ID,
    // A re-pull after a release is a fresh placement against changed capacity, so it states why.
    overrideReason: "The bed information is known to be out of date",
  });
}

function undoPull(state: WardFlowState, expectedPull?: { unitId: string; stageIndex: number }): WardFlowState {
  return wardFlowReducer(state, {
    type: "RELEASE_PULL",
    role: "ward",
    now: NOW + 60_000,
    movementId: MOVEMENT_ID,
    reason: "pull_made_in_error",
    actingUnitId: UNIT_ID,
    ...(expectedPull ? { expectedPull } : {}),
  });
}

describe("RELEASE_PULL from an Undo releases only the pull it was offered for (CT-06)", () => {
  it("releases the pull when it is still the one the Undo names", () => {
    const before = acceptedAwaitingBed();
    const expectedPull = { unitId: UNIT_ID, stageIndex: movementOf(before).stageChanges.length };
    const state = undoPull(pull(before), expectedPull);
    expect(state.rejections).toEqual([]);
    expect(movementOf(state).stage).toBe("accepted_awaiting_bed");
  });

  it("refuses, and keeps the newer pull, once that pull was released and another made", () => {
    const before = acceptedAwaitingBed();
    const expectedPull = { unitId: UNIT_ID, stageIndex: movementOf(before).stageChanges.length };
    let state = pull(before);
    state = undoPull(state); // released by someone else, with no expectation
    state = pull(state, NOW + 30_000); // and a different pull made for the same journey
    const newPull = movementOf(state).admissionId;
    expect(movementOf(state).stage).toBe("pulled");

    const after = undoPull(state, expectedPull);
    expect(after.rejections.length).toBe(state.rejections.length + 1);
    expect(after.rejections.at(-1)?.reason).toMatch(/since been released or replaced/);
    expect(movementOf(after).stage).toBe("pulled");
    expect(movementOf(after).admissionId).toBe(newPull);
  });

  it("keeps the existing behaviour for a release that names no expected pull", () => {
    let state = pull(acceptedAwaitingBed());
    state = undoPull(state);
    state = pull(state, NOW + 30_000);
    expect(state.rejections).toEqual([]);
    const after = undoPull(state);
    expect(after.rejections).toEqual([]);
    expect(movementOf(after).stage).toBe("accepted_awaiting_bed");
  });
});
