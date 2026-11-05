import { describe, expect, it } from "vitest";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 5;

function accepted(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const next = wardFlowReducer(state, event);
  expect(next.rejections.length, next.rejections.at(-1)?.reason).toBe(state.rejections.length);
  return next;
}

function arrival() {
  const seed = seedWardFlowState();
  const movement = seed.movements.find((row) => row.id === "WF-011")!;
  const before: WardFlowState = {
    ...seed,
    movements: seed.movements.map((row) =>
      row === movement ? { ...row, transportNeed: { needed: false, at: NOW } } : row,
    ),
  };
  const arrived = accepted(before, { type: "PATIENT_ARRIVED", role: "coordinator", now: NOW, movementId: movement.id });
  const admission = arrived.admissions.find((row) => row.id === movement.admissionId)!;
  expect(admission.state).toBe("occupied");
  const undo: WardFlowEvent = { type: "UNDO_TRANSPORT_STEP", role: "coordinator", now: NOW, movementId: movement.id };
  return { before, arrived, admission, undo };
}

function recordLeave(state: WardFlowState, admissionId: string, unitId: string) {
  return accepted(state, {
    type: "RECORD_LEAVE_BED",
    role: "ward",
    now: NOW,
    admissionId,
    unitId,
    actingUnitId: unitId,
    expectedReturn: NOW + 60,
  });
}

function expectAtomicRefusal(before: WardFlowState, undo: WardFlowEvent) {
  const after = wardFlowReducer(before, undo);
  expect(after.rejections.length).toBe(before.rejections.length + 1);
  for (const key of ["admissions", "leaveBeds", "movements", "patients", "units", "undoRecords"] as const) {
    expect(after[key], key).toEqual(before[key]);
  }
  expect(after.auditEvents.at(-1)?.outcome).toBe("denied");
}

describe("Undo validates newer leave dependencies against the complete proposed result", () => {
  it("refuses arrival Undo after this stay goes on leave in the same minute", () => {
    const { arrived, admission, undo } = arrival();
    expectAtomicRefusal(recordLeave(arrived, admission.id, admission.unitId), undo);
  });

  it("refuses arrival Undo after this stay is recorded absent in the same minute", () => {
    const { arrived, admission, undo } = arrival();
    const absent = accepted(arrived, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
    });
    expectAtomicRefusal(absent, undo);
  });

  it("still refuses arrival Undo after a later emergency department trip", () => {
    const { arrived, admission, undo } = arrival();
    const away = accepted(arrived, {
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: "ward",
      now: NOW,
      admissionId: admission.id,
      actingUnitId: admission.unitId,
    });
    expectAtomicRefusal(away, undo);
  });

  it("preserves immediate arrival Undo", () => {
    const { arrived, admission, undo } = arrival();
    const undone = accepted(arrived, undo);
    expect(undone.admissions.find((row) => row.id === admission.id)?.state).toBe("pulled");
  });

  it("permits arrival Undo when leave belongs to an unrelated occupied stay", () => {
    const { arrived, admission, undo } = arrival();
    const other = arrived.admissions.find(
      (row) =>
        row.id !== admission.id &&
        row.state === "occupied" &&
        row.awayAtEmergencyDepartmentSince === null &&
        !arrived.leaveBeds.some((leave) => leave.admissionId === row.id),
    )!;
    expect(other).toBeDefined();
    const onLeave = recordLeave(arrived, other.id, other.unitId);
    const undone = accepted(onLeave, undo);
    expect(undone.leaveBeds).toEqual(onLeave.leaveBeds);
    expect(undone.admissions.find((row) => row.id === admission.id)?.state).toBe("pulled");
  });

  it("permits arrival Undo once this stay's leave has ended", () => {
    const { arrived, admission, undo } = arrival();
    const onLeave = recordLeave(arrived, admission.id, admission.unitId);
    const leave = onLeave.leaveBeds.find((row) => row.admissionId === admission.id)!;
    const returned = accepted(onLeave, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: leave.id,
      actingUnitId: leave.unitId,
    });
    const undone = accepted(returned, undo);
    expect(undone.admissions.find((row) => row.id === admission.id)?.state).toBe("pulled");
  });

  it("refuses Undo of an old return when another leave now belongs to that stay", () => {
    const state = seedWardFlowState();
    const leave = state.leaveBeds[0]!;
    const returned = accepted(state, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: leave.id,
      actingUnitId: leave.unitId,
    });
    const onLeaveAgain = recordLeave(returned, leave.admissionId, leave.unitId);
    expectAtomicRefusal(onLeaveAgain, {
      type: "UNDO_BED_STEP",
      role: "ward",
      now: NOW,
      leaveBedId: leave.id,
      actingUnitId: leave.unitId,
    });
  });
});
