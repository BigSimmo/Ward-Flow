import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { Admission } from "./ward-admissions";
type AdmissionAbsenceEvent = Extract<
  WardFlowEvent,
  { type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT" | "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT" }
>;
type AdmissionAbsenceOperations = {
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;
  findAdmission: (state: WardFlowState, id: string) => Admission | undefined;
  replaceAdmission: (state: WardFlowState, id: string, next: Admission) => WardFlowState;
};
/** These events record physical absence while the ward keeps the person's bed.
 * The facade retains permissions, audit and revisions; neither command changes capacity. */
export function reduceAdmissionAbsenceEvent(
  state: WardFlowState,
  event: AdmissionAbsenceEvent,
  operations: AdmissionAbsenceOperations,
): WardFlowState {
  switch (event.type) {
    case "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT":
      return recordAway(state, event, operations);
    case "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT":
      return recordReturn(state, event, operations);
  }
}

/**
 * AWAY AT AN EMERGENCY DEPARTMENT, AND BACK AGAIN — the two halves of one fact, written
 * together because half of it is the defect.
 *
 * `Admission.awayAtEmergencyDepartmentSince` shipped on 2026-08-30 with a renderer, a seed and
 * NO EVENT AT EITHER END. Nothing could set it and nothing could clear it, so the seeded rows
 * counted upward for as long as the demonstration ran and every occupant without the badge read
 * as physically in their bed.
 *
 * ⚠️ **NEITHER CASE TOUCHES A UNIT.** No `replaceUnit`, no `empty`, no `allocatable`, no
 * `sexMix` — deliberately, and it is the single most important property of both. The ward is
 * holding this bed because the person is coming back; `bedIsOccupied` counts them throughout
 * and no availability figure moves in either direction. A coordinator must never be offered
 * this bed. Pinned in `tests/ward-away-at-emergency-department.test.ts`.
 */
function recordAway(
  state: WardFlowState,
  event: Extract<AdmissionAbsenceEvent, { type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT" }>,
  operations: AdmissionAbsenceOperations,
): WardFlowState {
  const admission = operations.findAdmission(state, event.admissionId);

  if (!admission) return operations.reject(state, event, `no admission found for id ${event.admissionId}`);

  if (event.actingUnitId !== admission.unitId) {
    return operations.reject(
      state,
      event,
      `RECORD_AWAY_AT_EMERGENCY_DEPARTMENT was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
    );
  }

  // Only somebody actually IN a bed can leave the ward and still have it kept for them. A
  // `waitlisted` or `pulled` admission has never reached the ward — they are usually sitting in
  // an emergency department already, which is the mirror image of what this field means and
  // exactly the confusion `Admission.awayAtEmergencyDepartmentSince`'s own doc comment warns
  // about. A `departed` admission has no bed to hold at all.
  if (admission.state !== "occupied") {
    return operations.reject(
      state,
      event,
      `admission ${admission.id} is ${admission.state}, and only somebody occupying a bed can be away from it`,
    );
  }

  // Refused rather than treated as a no-op, the same reasoning `RECORD_LEAVING` uses for a
  // second discharge: overwriting the instant with a later one would silently SHORTEN the
  // recorded trip of somebody who has been in an emergency department for six hours, and the
  // board renders that number in words.
  if (admission.awayAtEmergencyDepartmentSince !== null) {
    return operations.reject(
      state,
      event,
      `admission ${admission.id} is already recorded as away at an emergency department`,
    );
  }

  return operations.replaceAdmission(state, admission.id, { ...admission, awayAtEmergencyDepartmentSince: event.now });
}

function recordReturn(
  state: WardFlowState,
  event: Extract<AdmissionAbsenceEvent, { type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT" }>,
  operations: AdmissionAbsenceOperations,
): WardFlowState {
  const admission = operations.findAdmission(state, event.admissionId);

  if (!admission) return operations.reject(state, event, `no admission found for id ${event.admissionId}`);

  if (event.actingUnitId !== admission.unitId) {
    return operations.reject(
      state,
      event,
      `RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT was raised acting as unit ${event.actingUnitId} but admission ${admission.id} belongs to unit ${admission.unitId}`,
    );
  }

  // Refused rather than silently written as `null`. `null` already means "on the ward", so a
  // return recorded for somebody who was never away would be indistinguishable from a no-op —
  // and a control that reports success for an act that did not happen is the one untruth this
  // prototype's own history names as mattering most.
  if (admission.awayAtEmergencyDepartmentSince === null) {
    return operations.reject(
      state,
      event,
      `admission ${admission.id} is not recorded as away at an emergency department`,
    );
  }

  // `state` is deliberately NOT checked here, unlike the event above. Somebody may only GO
  // while occupying a bed, but the guard directly above already proves this admission is away,
  // and refusing their return on a state check would strand the badge permanently if any future
  // path ever moved an away admission's state. A flag nobody can clear is the defect being
  // repaired, so the clearing half is guarded on the flag itself and nothing else.
  return operations.replaceAdmission(state, admission.id, { ...admission, awayAtEmergencyDepartmentSince: null });
}
