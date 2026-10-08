import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Unit, LeaveBed } from "./ward-model";
import type { Admission } from "./ward-admissions";
type LeaveBedEvent = Extract<WardFlowEvent, { type: "RECORD_LEAVE_BED" | "END_LEAVE_BED" }>;
type LeaveBedOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findUnit: (state: WardFlowState, id: string) => Unit | undefined;
  findAdmission: (state: WardFlowState, id: string) => Admission | undefined;
  findLeaveBed: (state: WardFlowState, id: string) => LeaveBed | undefined;
  nextLeaveBedId: (sequence: number) => string;
};
/** The main reducer retains permission, revision and audit guards. Leave records name
 * an occupied admission on the caller's unit; ending leave removes that record only. */
export function reduceLeaveBedEvent(
  state: WardFlowState,
  event: LeaveBedEvent,
  operations: LeaveBedOperations,
): WardFlowState {
  switch (event.type) {
    case "RECORD_LEAVE_BED":
      return recordLeaveBed(state, event, operations);
    case "END_LEAVE_BED":
      return endLeaveBed(state, event, operations);
  }
}
function recordLeaveBed(
  state: WardFlowState,
  event: Extract<LeaveBedEvent, { type: "RECORD_LEAVE_BED" }>,
  operations: LeaveBedOperations,
): WardFlowState {
  // Same claim-not-proof discipline as FLAG_BED_RELEASE's own field: this compares what the
  // caller SAID it was acting as against the unit the leave bed is being recorded against.
  if (event.actingUnitId !== event.unitId) {
    return operations.reject(
      state,
      event,
      `RECORD_LEAVE_BED was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
    );
  }

  const unit = operations.findUnit(state, event.unitId);

  if (!unit) return operations.reject(state, event, `no unit found for id ${event.unitId}`);

  // Owner ruling 2026-09-25: a leave bed names the stay it belongs to, never a guessed one.
  const onLeave = operations.findAdmission(state, event.admissionId);

  if (!onLeave) return operations.reject(state, event, `no admission found for id ${event.admissionId}`);

  if (onLeave.unitId !== event.unitId) {
    return operations.reject(
      state,
      event,
      `RECORD_LEAVE_BED names admission ${onLeave.id} on unit ${onLeave.unitId}, not unit ${event.unitId}`,
    );
  }

  if (onLeave.state !== "occupied") {
    return operations.reject(
      state,
      event,
      `admission ${onLeave.id} is ${onLeave.state}, and only somebody occupying a bed can be on leave from it`,
    );
  }

  const current = state.leaveBeds.find((bed) => bed.admissionId === onLeave.id);

  if (current) return operations.reject(state, event, `admission ${onLeave.id} is already on leave (${current.id})`);

  const sequence = state.leaveBedSequence + 1;

  const created: LeaveBed = {
    id: operations.nextLeaveBedId(sequence),
    unitId: unit.id,
    admissionId: onLeave.id,
    expectedReturn: event.expectedReturn,
    confirmedAt: event.now,
    confirmedBy: `NUM ${unit.name}`,
    kind: event.kind ?? "off_ward",
  };

  return { ...state, leaveBeds: [...state.leaveBeds, created], leaveBedSequence: sequence };
}

function endLeaveBed(
  state: WardFlowState,
  event: Extract<LeaveBedEvent, { type: "END_LEAVE_BED" }>,
  operations: LeaveBedOperations,
): WardFlowState {
  const leaveBed = operations.findLeaveBed(state, event.leaveBedId);

  if (!leaveBed) return operations.reject(state, event, `no leave bed found for id ${event.leaveBedId}`);

  if (event.actingUnitId !== leaveBed.unitId) {
    return operations.reject(
      state,
      event,
      `END_LEAVE_BED was raised acting as unit ${event.actingUnitId} but leave bed ${leaveBed.id} belongs to unit ${leaveBed.unitId}`,
    );
  }

  return { ...state, leaveBeds: state.leaveBeds.filter((candidate) => candidate.id !== leaveBed.id) };
}
