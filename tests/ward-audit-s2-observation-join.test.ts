// tests/ward-audit-s2-observation-join.test.ts
//
// Fresh audit S-2 (26 Oct 2026): a seeded stay joined to its journey only by
// `movement.admissionId` still changes level with it, in both directions, and arrival never drops
// the level the journey recorded.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;
const ARMS_LENGTH = { level: "arms_length", intervalMinutes: null, reviewAt: null } as const;

function apply(state: WardFlowState, event: Record<string, unknown>) {
  return wardFlowReducer(state, { now: NOW, ...event } as never);
}

// A pulled stay whose own `movementId` is empty, joined only by its journey's `admissionId`.
function joinedOnlyByMovement(state: WardFlowState, movementId: string) {
  const movement = state.movements.find((candidate) => candidate.id === movementId)!;
  const admission = state.admissions.find((candidate) => candidate.id === movement.admissionId)!;
  expect(admission.state).toBe("pulled");
  expect(admission.movementId).toBeNull();
  return { movement, admission };
}

const levelOf = (state: WardFlowState, kind: "movements" | "admissions", id: string) =>
  state[kind].find((row) => row.id === id)?.observation.level;

describe("audit S-2: the journey and its held bed record one observation level", () => {
  it("a level recorded on the journey also changes the held bed", () => {
    const state = seedWardFlowState();
    const { movement, admission } = joinedOnlyByMovement(state, "WF-016");
    const next = apply(state, {
      type: "RECORD_OBSERVATION_LEVEL",
      role: "ed",
      target: { kind: "movement", movementId: movement.id },
      observation: ARMS_LENGTH,
    });
    expect(next.rejections.at(-1)?.reason).toBeUndefined();
    expect(levelOf(next, "movements", movement.id)).toBe("arms_length");
    expect(levelOf(next, "admissions", admission.id)).toBe("arms_length");
  });

  it("a level recorded on the held bed also changes the journey", () => {
    const state = seedWardFlowState();
    const { movement, admission } = joinedOnlyByMovement(state, "WF-016");
    const next = apply(state, {
      type: "RECORD_OBSERVATION_LEVEL",
      role: "ward",
      target: { kind: "admission", admissionId: admission.id, actingUnitId: admission.unitId },
      observation: ARMS_LENGTH,
    });
    expect(next.rejections.at(-1)?.reason).toBeUndefined();
    expect(levelOf(next, "admissions", admission.id)).toBe("arms_length");
    expect(levelOf(next, "movements", movement.id)).toBe("arms_length");
  });

  it("arrival carries the journey's level onto the stay when the two still differ", () => {
    const seeded = seedWardFlowState();
    const { movement, admission } = joinedOnlyByMovement(seeded, "WF-011");
    expect(movement.observation.level).not.toBe(admission.observation.level);
    const state: WardFlowState = {
      ...seeded,
      movements: seeded.movements.map((row) =>
        row.id === movement.id ? { ...row, transportNeed: { needed: false, at: NOW - 10 } } : row,
      ),
    };
    const arrived = apply(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      movementId: movement.id,
      actingUnitId: movement.acceptedUnitId,
    });
    const stay = arrived.admissions.find((row) => row.id === admission.id)!;
    expect(arrived.rejections.at(-1)?.reason ?? "").toBe(state.rejections.at(-1)?.reason ?? "");
    expect(stay.state).toBe("occupied");
    expect(stay.observation.level).toBe(movement.observation.level);
    expect(stay.observationChanges?.at(-1)).toMatchObject({
      from: admission.observation,
      to: movement.observation,
    });
  });
});
