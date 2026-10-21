import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { isTentativeDiagnosisBlock } from "./ward-diagnosis";

/**
 * FD-10 (owner, 29 Aug 2026): the ward records its own tentative diagnosis block beside the
 * referrer's. `tentativeDiagnosis` (the referrer's, carried from the referral) is never touched
 * here, which is the whole ruling: two assessments by two clinicians at two moments, not one fact
 * recorded twice. A ward may record only for a stay on its own unit, and only a listed block. The coordinator may
 * act for a ward, as on every ward action (Josh, 10 Oct 2026).
 */
export function reduceWardDiagnosis(
  state: WardFlowState,
  event: Extract<WardFlowEvent, { type: "RECORD_WARD_DIAGNOSIS" }>,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  const admission = state.admissions.find((candidate) => candidate.id === event.admissionId);
  if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
  // Same claim-not-proof discipline as SET_STEP_DOWN_CANDIDATE: a ward may only touch its own stay.
  if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
    return reject(
      state,
      event,
      `RECORD_WARD_DIAGNOSIS was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
    );
  }
  if (admission.state === "departed") return reject(state, event, "RECORD_WARD_DIAGNOSIS needs a current stay");
  if (!isTentativeDiagnosisBlock(event.block)) return reject(state, event, "RECORD_WARD_DIAGNOSIS block is not listed");
  if (admission.wardDiagnosis?.block === event.block) {
    return reject(state, event, "RECORD_WARD_DIAGNOSIS block is already recorded");
  }
  const wardDiagnosis = { block: event.block, recordedAt: event.now, recordedBy: event.role };
  return {
    ...state,
    admissions: state.admissions.map((candidate) =>
      candidate.id === admission.id ? { ...candidate, wardDiagnosis } : candidate,
    ),
  };
}
