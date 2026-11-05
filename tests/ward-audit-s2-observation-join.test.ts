// tests/ward-audit-s2-observation-join.test.ts
//
// Fresh audit S-2 (26 Oct 2026): a seeded stay joined to its journey only by
// `movement.admissionId` still changes level with it, in both directions, and arrival never drops
// the level the journey recorded.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";
import { journeyObservationWins, observationAt } from "@/components/ward-management/ward-observation";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
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

  it("an older pair that already differs can still be edited with a current token", () => {
    const state = seedWardFlowState();
    const { movement, admission } = joinedOnlyByMovement(state, "WF-011");
    expect(movement.observation.level).not.toBe(admission.observation.level);
    const next = apply(state, {
      type: "RECORD_OBSERVATION_LEVEL",
      role: "ed",
      target: { kind: "movement", movementId: movement.id },
      observation: ARMS_LENGTH,
      expected: observationEditingToken("movement", movement.id, movement.observation, 0),
    });
    expect(next.rejections.at(-1)?.reason).toBeUndefined();
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

describe("WF-DOM-001: accepted observation order survives legacy arrival", () => {
  it.each([
    [false, 0],
    [true, 0],
    [false, -1],
    [true, -1],
  ])("keeps accepted order (ward first: %s, clock offset: %s)", (wardFirst, clockOffset) => {
    let state = seedWardFlowState();
    const { movement, admission } = joinedOnlyByMovement(state, "WF-011");
    state = {
      ...state,
      movements: state.movements.map((row) =>
        row.id === movement.id ? { ...row, transportNeed: { needed: false, at: NOW - 10 } } : row,
      ),
    };
    const targets = {
      movement: { kind: "movement", movementId: movement.id },
      admission: { kind: "admission", admissionId: admission.id, actingUnitId: admission.unitId },
    };
    let clock = NOW;
    for (const kind of (wardFirst ? ["admission", "movement"] : ["movement", "admission"]) as (
      "movement" | "admission"
    )[]) {
      const row =
        kind === "movement"
          ? state.movements.find((r) => r.id === movement.id)!
          : state.admissions.find((r) => r.id === admission.id)!;
      const before = state;
      state = apply(state, {
        now: clock,
        type: "RECORD_OBSERVATION_LEVEL",
        role: kind === "movement" ? "ed" : "ward",
        target: targets[kind],
        observation: kind === "movement" ? { ...ARMS_LENGTH, level: "two_staff" } : ARMS_LENGTH,
        expected: observationEditingToken(kind, row.id, row.observation, row.observationChanges?.length ?? 0),
      });
      expect(state.rejections).toEqual(before.rejections);
      clock += clockOffset;
    }
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const arrived = apply(state, {
      type: "PATIENT_ARRIVED",
      role: "ward",
      movementId: movement.id,
      actingUnitId: admission.unitId,
    });
    expect(arrived.rejections).toEqual(state.rejections);
    expect(arrived.admissions.find((r) => r.id === admission.id)?.observation.level).toBe(
      wardFirst ? "two_staff" : "arms_length",
    );
  });
});

it("keeps legacy timestamp order and the documented fallback for an unknowable old tie", () => {
  const change = (at: number, sequence?: number) => ({
    at,
    from: observationAt("general"),
    to: ARMS_LENGTH,
    ...(sequence === undefined ? {} : { sequence }),
  });
  expect(journeyObservationWins([change(5)], [change(6)])).toBe(false);
  expect(journeyObservationWins([change(6)], [change(5)])).toBe(true);
  expect(journeyObservationWins([change(5)], [change(5)])).toBe(true);
  expect(journeyObservationWins(undefined, undefined)).toBe(true);
  expect(journeyObservationWins([change(99)], [change(1, 1)])).toBe(false);
  expect(journeyObservationWins([change(1, 1)], [change(99)])).toBe(true);
});
