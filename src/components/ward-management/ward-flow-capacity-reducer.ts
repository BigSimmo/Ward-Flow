import { WARD_INTAKE_CONSTRAINTS } from "./ward-change-reasons";
import { WARD_BUZZ_MESSAGES, type WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Unit } from "./ward-model";

type CapacityEvent = Extract<
  WardFlowEvent,
  {
    type:
      | "CONFIRM_CAPACITY"
      | "RECORD_WARD_INTAKE_CONSTRAINTS"
      | "REQUEST_CAPACITY_REFRESH"
      | "CONFIRM_MORNING_ROLLUP"
      | "SEND_WARD_BUZZ";
  }
>;
type CapacityOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findUnit: (state: WardFlowState, unitId: string) => Unit | undefined;
  replaceUnit: (state: WardFlowState, unitId: string, next: Unit) => WardFlowState;
};

/** Called after the main reducer's role check. Resource revisions and audit appending
 * remain at that entry point; refresh requests record an in-app request only. */
export function reduceCapacityEvent(
  state: WardFlowState,
  event: CapacityEvent,
  operations: CapacityOperations,
): WardFlowState {
  switch (event.type) {
    case "CONFIRM_CAPACITY":
      return confirmCapacity(state, event, operations);
    case "RECORD_WARD_INTAKE_CONSTRAINTS":
      return recordIntakeConstraints(state, event, operations);
    case "REQUEST_CAPACITY_REFRESH":
      return requestRefresh(state, event, operations);
    case "CONFIRM_MORNING_ROLLUP":
      return confirmMorningRollup(state, event, operations);
    case "SEND_WARD_BUZZ":
      return sendWardBuzz(state, event, operations);
  }
}
function confirmCapacity(
  state: WardFlowState,
  event: Extract<CapacityEvent, { type: "CONFIRM_CAPACITY" }>,
  operations: CapacityOperations,
): WardFlowState {
  // The main reducer's role check only proves *a* ward raised this. It does not say *which* ward, so
  // before this a ward user on unit A could restate unit B's allocatable count.
  //
  // What this check does: it compares the unit the caller said it was acting as against the
  // unit being written to, and refuses the event when they differ. What it does not do: prove
  // the claim. `actingUnitId` is whatever the call site put on the event — the ward screen
  // reads it from its own `/mockups/ward-flow/ward/[unitId]` route, but nothing here verifies
  // that, and this prototype carries no authenticated actor identity to verify it against.
  // This is a recorded assertion by the caller, not an authorisation decision, and must not
  // be described or extended as one.
  if (event.actingUnitId !== event.unitId) {
    return operations.reject(
      state,
      event,
      `CONFIRM_CAPACITY was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
    );
  }

  const unit = operations.findUnit(state, event.unitId);

  if (!unit) return operations.reject(state, event, `no unit found for id ${event.unitId}`);

  // The ward screen already bounds its own input (`min={0} max={unit.beds}`), but a screen
  // check is bypassed by every other call site and by every hand-built event, and this reducer
  // is the trust boundary. Without this a ward could restate more allocatable beds than the
  // building has, and the figure would render as that ward's own confirmed claim.
  //
  // ⚠️ THE BOUND IS `unit.beds`, NEVER `empty.value`. A ward restating what it can allocate is
  // ALLOWED to disagree with a stale feed figure — that is what a ward confirmation is for, and
  // `tests/ward-flow-reducer.test.ts`'s "arrival capacity floor" depends on it, restating 5
  // against a seeded empty of 2 to prove `PATIENT_ARRIVED` still refuses once physically empty
  // beds run out. Beds are a fact about the building; empty is a claim about right now.
  //
  // ⚠️ AND IT REFUSES RATHER THAN CLAMPING. Clamping 30 to 20 would record a number the ward
  // never said and read back to them as agreement. A refusal names both figures and leaves the
  // previous confirmation untouched, stamp included.
  if (!Number.isInteger(event.value) || event.value < 0) {
    return operations.reject(
      state,
      event,
      `CONFIRM_CAPACITY on unit ${unit.id} was given ${event.value}, which is not a whole number of beds`,
    );
  }

  if (event.value > unit.beds) {
    return operations.reject(
      state,
      event,
      `CONFIRM_CAPACITY says unit ${unit.id} can allocate ${event.value} beds, which is more than the ${unit.beds} beds it has`,
    );
  }

  // WF-08 optimistic-concurrency: a caller that read revision N and now writes must be told
  // when any resource change has since landed, rather than silently overwriting it.
  if (!Number.isSafeInteger(event.expectedRevision) || (unit.allocatable.revision ?? 0) !== event.expectedRevision) {
    return operations.reject(
      state,
      event,
      `CONFIRM_CAPACITY on unit ${unit.id} is stale: expected revision ${event.expectedRevision}, current ${unit.allocatable.revision ?? 0}`,
    );
  }

  const updatedUnit: Unit = {
    ...unit,
    allocatable: {
      ...unit.allocatable,
      value: event.value,
      source: "ward",
      confirmedAt: event.now,
      revision: (unit.allocatable.revision ?? 0) + 1,
    },
  };

  return operations.replaceUnit(state, unit.id, updatedUnit);
}

function recordIntakeConstraints(
  state: WardFlowState,
  event: Extract<CapacityEvent, { type: "RECORD_WARD_INTAKE_CONSTRAINTS" }>,
  operations: CapacityOperations,
): WardFlowState {
  // Same claim-not-proof discipline as CONFIRM_CAPACITY immediately above (see that case's own
  // comment in full).
  if (event.actingUnitId !== event.unitId) {
    return operations.reject(
      state,
      event,
      `RECORD_WARD_INTAKE_CONSTRAINTS was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
    );
  }

  const constrainedUnit = operations.findUnit(state, event.unitId);

  if (!constrainedUnit) return operations.reject(state, event, `no unit found for id ${event.unitId}`);

  // Chosen, never typed: a typed caller cannot construct this event with a code outside
  // `WARD_INTAKE_CONSTRAINTS` (a required union-member array, not a plain `string[]`), and this
  // check is the runtime half of that discipline for an untyped caller, the same pattern
  // `FLAG_BED_RELEASE`'s `blocker` membership check uses below.
  if (event.codes.some((code) => !WARD_INTAKE_CONSTRAINTS.includes(code))) {
    return operations.reject(
      state,
      event,
      "RECORD_WARD_INTAKE_CONSTRAINTS codes must all be chosen from WARD_INTAKE_CONSTRAINTS",
    );
  }

  const updatedConstrainedUnit: Unit = { ...constrainedUnit, intakeConstraints: event.codes };

  return operations.replaceUnit(state, constrainedUnit.id, updatedConstrainedUnit);
}

function requestRefresh(
  state: WardFlowState,
  event: Extract<CapacityEvent, { type: "REQUEST_CAPACITY_REFRESH" }>,
  operations: CapacityOperations,
): WardFlowState {
  // Spec D12: the one thing a coordinator may do to a ward's bed data. This changes no
  // number at all — no field on any unit, release or leave bed is read or written below — it
  // only records that somebody asked, with the time and the requesting role. Nothing leaves
  // the sandbox and no message is sent.
  const unit = operations.findUnit(state, event.unitId);

  if (!unit) return operations.reject(state, event, `no unit found for id ${event.unitId}`);

  return {
    ...state,
    refreshRequests: [...state.refreshRequests, { unitId: unit.id, at: event.now, byRole: event.role }],
  };
}

function confirmMorningRollup(
  state: WardFlowState,
  event: Extract<CapacityEvent, { type: "CONFIRM_MORNING_ROLLUP" }>,
  operations: CapacityOperations,
): WardFlowState {
  const unit = operations.findUnit(state, event.unitId);

  if (!unit) return operations.reject(state, event, `no unit found for id ${event.unitId}`);

  // Same claim-not-proof discipline as CONFIRM_CAPACITY: a caller stating a different unit than
  // the one being written to is refused, so one ward cannot confirm another ward's morning count.
  if (
    (event.role === "ward" && event.actingUnitId === undefined) ||
    (event.actingUnitId !== undefined && event.actingUnitId !== event.unitId)
  ) {
    return operations.reject(
      state,
      event,
      `CONFIRM_MORNING_ROLLUP was raised acting as unit ${event.actingUnitId} but targets unit ${event.unitId}`,
    );
  }

  if (!Number.isSafeInteger(event.expectedDischarges) || event.expectedDischarges < 0) {
    return operations.reject(state, event, "expectedDischarges must be a finite, non-negative whole number");
  }

  return {
    ...state,
    morningRollupConfirmations: {
      ...state.morningRollupConfirmations,
      [event.unitId]: {
        confirmedAt: event.now,
        confirmedByRole: event.role,
        expectedDischarges: event.expectedDischarges,
      },
    },
  };
}

function sendWardBuzz(
  state: WardFlowState,
  event: Extract<CapacityEvent, { type: "SEND_WARD_BUZZ" }>,
  operations: CapacityOperations,
): WardFlowState {
  if (!WARD_BUZZ_MESSAGES.includes(event.message) || (event.urgent !== undefined && typeof event.urgent !== "boolean"))
    return operations.reject(state, event, "Choose a valid ward refresh message.");

  const unit = operations.findUnit(state, event.unitId);

  if (!unit) return operations.reject(state, event, `no unit found for id ${event.unitId}`);

  return {
    ...state,
    refreshRequests: [
      ...state.refreshRequests,
      {
        unitId: unit.id,
        at: event.now,
        byRole: event.role,
        message: event.message,
        urgent: event.urgent,
      },
    ],
  };
}
