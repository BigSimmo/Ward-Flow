import { describe, expect, it } from "vitest";

import { observationEditingToken } from "../src/components/ward-management/ward-flow-observation-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { observationAt, type Observation } from "../src/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

/**
 * Audit F2, Option A (Josh, 26 Oct 2026): a RECORD_OBSERVATION_LEVEL without the editing token is
 * refused once the record already has observation changes; with no prior changes it stays allowed.
 */
const NOW = NOW_ANCHOR;

function openMovement(state: WardFlowState): Movement {
  return state.movements.find((m) => !m.closure && !m.admissionId)!;
}

function withHistory(state: WardFlowState, id: string): WardFlowState {
  return {
    ...state,
    movements: state.movements.map((m) =>
      m.id === id
        ? { ...m, observationChanges: [{ at: NOW - 30, from: observationAt("intermittent"), to: m.observation }] }
        : m,
    ),
  };
}

function record(state: WardFlowState, movementId: string, observation: Observation, expected?: string) {
  return wardFlowReducer(state, {
    type: "RECORD_OBSERVATION_LEVEL",
    role: "ed",
    now: NOW + 5,
    target: { kind: "movement", movementId },
    observation,
    ...(expected === undefined ? {} : { expected }),
  });
}

const tokenFor = (m: Movement) =>
  observationEditingToken("movement", m.id, m.observation, m.observationChanges?.length ?? 0);

const nextLevel = (m: Movement): Observation =>
  observationAt(m.observation.level === "within_sight" ? "two_staff" : "within_sight");

describe("RECORD_OBSERVATION_LEVEL without an editing token (audit F2, Option A)", () => {
  it("is refused when the record already has observation changes", () => {
    const seed = { ...seedWardFlowState(), rejections: [] };
    const id = openMovement(seed).id;
    const state = withHistory(seed, id);
    const before = state.movements.find((m) => m.id === id)!;
    const after = record(state, id, nextLevel(before));
    expect(after.rejections.at(-1)?.reason).toBe("Observation changed. Reopen it.");
    expect(after.movements.find((m) => m.id === id)).toEqual(before);
  });

  it("is still allowed when the record has no prior observation changes", () => {
    const seed = { ...seedWardFlowState(), rejections: [] };
    const movement = openMovement(seed);
    expect(movement.observationChanges ?? []).toHaveLength(0);
    const after = record(seed, movement.id, nextLevel(movement));
    expect(after.rejections).toEqual([]);
    expect(after.movements.find((m) => m.id === movement.id)?.observationChanges).toHaveLength(1);
  });

  it("with the correct token still records over prior changes", () => {
    const seed = { ...seedWardFlowState(), rejections: [] };
    const id = openMovement(seed).id;
    const state = withHistory(seed, id);
    const before = state.movements.find((m) => m.id === id)!;
    const after = record(state, id, nextLevel(before), tokenFor(before));
    expect(after.rejections).toEqual([]);
    expect(after.movements.find((m) => m.id === id)?.observationChanges).toHaveLength(2);
  });

  it("with a stale token is refused as before", () => {
    const seed = { ...seedWardFlowState(), rejections: [] };
    const id = openMovement(seed).id;
    const stale = tokenFor(openMovement(seed));
    const state = withHistory(seed, id);
    const after = record(state, id, nextLevel(state.movements.find((m) => m.id === id)!), stale);
    expect(after.rejections.at(-1)?.reason).toBe("Observation changed. Reopen it.");
  });
});
