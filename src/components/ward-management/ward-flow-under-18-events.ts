import type { Instant } from "./ward-clock";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowRole } from "./ward-flow-roles";

/**
 * Feature item 4 (Josh, 11 Nov 2026): records when the Chief Psychiatrist was notified that a person
 * under 18 is on an adult ward. `notifiedAt` is the time a person typed (D-93), never pre-filled.
 * A record of what a person says happened: it decides nothing, computes no deadline and blocks no
 * bed offer. A new record replaces the stay's previous one, so a mistyped time can be corrected.
 * It carries no typed text. Kept here for the events file's line cap.
 */
export type ChiefPsychiatristNotifiedEvent = {
  type: "RECORD_CHIEF_PSYCHIATRIST_NOTIFIED";
  role: WardFlowRole;
  now: Instant;
  actingUnitId?: string;
  admissionId: string;
  notifiedAt: Instant;
};

export function reduceChiefPsychiatristNotified(
  state: WardFlowState,
  event: ChiefPsychiatristNotifiedEvent,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  const admission = state.admissions.find((candidate) => candidate.id === event.admissionId);
  if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
  // Same claim-not-proof discipline as RECORD_WARD_DIAGNOSIS: a ward may only touch its own stay.
  if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
    return reject(
      state,
      event,
      `RECORD_CHIEF_PSYCHIATRIST_NOTIFIED was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
    );
  }
  if (admission.state !== "pulled" && admission.state !== "occupied") {
    return reject(state, event, "RECORD_CHIEF_PSYCHIATRIST_NOTIFIED needs a current stay");
  }
  if (!Number.isFinite(event.now) || !Number.isFinite(event.notifiedAt)) {
    return reject(state, event, "RECORD_CHIEF_PSYCHIATRIST_NOTIFIED time is invalid");
  }
  if (event.notifiedAt > event.now) {
    return reject(state, event, "The notified time is later than now");
  }
  const notice = { notifiedAt: event.notifiedAt, at: event.now, by: event.role };
  return {
    ...state,
    admissions: state.admissions.map((candidate) =>
      candidate.id === admission.id ? { ...candidate, chiefPsychiatristNotice: notice } : candidate,
    ),
  };
}
