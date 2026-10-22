import { describe, expect, it } from "vitest";
import { bedIsOccupied } from "../src/components/ward-management/ward-admissions";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";
import { GENERAL_OBSERVATION } from "../src/components/ward-management/ward-observation";

const NOW = NOW_ANCHOR;
const UNIT = "rph-adult-secure";

function send(state: WardFlowState, event: WardFlowEvent) {
  const next = wardFlowReducer(state, event);
  expect(next.rejections).toEqual(state.rejections);
  return next;
}

function departure() {
  let state = seedWardFlowStateAt(0);
  const [a, b] = state.admissions.filter((row) => row.unitId === UNIT && row.state === "occupied");
  expect(a).toBeDefined();
  expect(b).toBeDefined();
  for (const [admission, bedNumber] of [
    [a, 1],
    [b, 2],
  ] as const) {
    state = send(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId: admission.id,
      actingUnitId: UNIT,
      bedNumber,
    });
  }
  state = send(state, {
    type: "RECORD_LEAVING",
    role: "ward",
    now: NOW,
    admissionId: a.id,
    actingUnitId: UNIT,
    leavingDestination: "discharged-to-the-community",
  });
  return { state, a, b };
}

function undo(state: WardFlowState, admissionId: string) {
  return wardFlowReducer(state, { type: "UNDO_DEPARTURE", role: "ward", now: NOW, admissionId, actingUnitId: UNIT });
}

function transferArrival() {
  let state = seedWardFlowStateAt(0);
  const [a, b] = state.admissions.filter((row) => row.unitId === UNIT && row.state === "occupied");
  for (const [admission, bedNumber] of [
    [a, 1],
    [b, 2],
  ] as const)
    state = send(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId: admission.id,
      actingUnitId: UNIT,
      bedNumber,
    });
  const destination = "scgh-adult-open";
  const movement: Movement = {
    ...state.movements[0],
    id: "WF-UNDO-TRANSFER",
    patientId: a.patientId ?? undefined,
    sourceAdmissionId: a.id,
    referralId: undefined,
    admissionId: undefined,
    closure: undefined,
    gender: a.gender,
    sex: a.sex,
    cohort: "Adult",
    security: "Open",
    legalStatus: "Voluntary",
    highAcuity: false,
    observation: GENERAL_OBSERVATION,
    transport: undefined,
    examination: undefined,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: destination,
    referredUnitIds: [destination],
  };
  state = { ...state, movements: [...state.movements, movement] };
  state = send(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now: NOW,
    movementId: movement.id,
    unitId: destination,
    actingUnitId: destination,
  });
  state = send(state, {
    type: "RECORD_TRANSPORT_NEED",
    role: "coordinator",
    now: NOW,
    movementId: movement.id,
    needed: false,
  });
  state = send(state, {
    type: "PATIENT_ARRIVED",
    role: "ward",
    now: NOW,
    movementId: movement.id,
    actingUnitId: destination,
  });
  expect(state.admissions.find((row) => row.id === a.id)?.state).toBe("departed");
  return { state, a, b, movementId: movement.id, destination };
}

describe("departure Undo checks later bed ownership", () => {
  it("refuses to restore an occupant over a later numbered occupant without changing either record", () => {
    const { state, a, b } = departure();
    const moved = send(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId: b.id,
      actingUnitId: UNIT,
      bedNumber: 1,
    });
    const refused = undo(moved, a.id);
    expect(refused.rejections.length).toBe(moved.rejections.length + 1);
    expect(refused.admissions === moved.admissions).toBe(true);
    expect(refused.units === moved.units).toBe(true);
    expect(refused.bedReleases === moved.bedReleases).toBe(true);
    expect(
      refused.admissions.filter((row) => row.unitId === UNIT && row.bedNumber === 1 && bedIsOccupied(row)),
    ).toHaveLength(1);
  });

  it("refuses restoration over a later held reservation", () => {
    const { state, a } = departure();
    const base = state.movements.find((row) => row.cohort === "Adult")!;
    const queued: WardFlowState = {
      ...state,
      movements: [
        ...state.movements,
        {
          ...base,
          id: "WF-UNDO-RESERVATION",
          acceptedUnitId: undefined,
          heldBedNumber: undefined,
          closure: undefined,
          admissionId: undefined,
          stage: "destination_review" as const,
          referredUnitIds: [UNIT],
          highAcuity: false,
          observation: GENERAL_OBSERVATION,
          legalStatus: "Voluntary" as const,
          security: "Open" as const,
          gender: "Male" as const,
          sex: "Male" as const,
        },
      ],
    };
    const reserved = send(queued, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      now: NOW,
      movementId: "WF-UNDO-RESERVATION",
      unitId: UNIT,
      actingUnitId: UNIT,
      bedNumber: 1,
    });
    const refused = undo(reserved, a.id);
    expect(refused.rejections.length).toBe(reserved.rejections.length + 1);
    expect(refused.admissions === reserved.admissions).toBe(true);
    expect(refused.movements === reserved.movements).toBe(true);
    expect(refused.units === reserved.units).toBe(true);
  });

  it("still restores an unchanged departure when no later bed ownership conflicts", () => {
    const { state, a } = departure();
    const restored = undo(state, a.id);
    expect(restored.rejections).toEqual(state.rejections);
    expect(restored.admissions.find((row) => row.id === a.id)?.state).toBe("occupied");
  });

  it("refuses arrival Undo when its source bed has acquired another occupant", () => {
    const { state, a, b, movementId, destination } = transferArrival();
    const moved = send(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId: b.id,
      actingUnitId: UNIT,
      bedNumber: 1,
    });
    const refused = wardFlowReducer(moved, {
      type: "UNDO_TRANSPORT_STEP",
      role: "ward",
      now: NOW,
      movementId,
      actingUnitId: destination,
    });
    expect(refused.rejections.length).toBe(moved.rejections.length + 1);
    expect(refused.admissions === moved.admissions).toBe(true);
    expect(refused.movements === moved.movements).toBe(true);
    expect(refused.units === moved.units).toBe(true);
    expect(refused.bedReleases === moved.bedReleases).toBe(true);
    expect(refused.admissions.find((row) => row.id === a.id)?.state).toBe("departed");
  });

  it("still undoes transfer arrival when the source bed remains free", () => {
    const { state, a, movementId, destination } = transferArrival();
    const restored = send(state, {
      type: "UNDO_TRANSPORT_STEP",
      role: "ward",
      now: NOW,
      movementId,
      actingUnitId: destination,
    });
    expect(restored.admissions.find((row) => row.id === a.id)?.state).toBe("occupied");
    expect(restored.movements.find((row) => row.id === movementId)?.stage).toBe("pulled");
  });
});
