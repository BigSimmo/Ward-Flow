import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowEvent } from "./ward-flow-events";
import { isPatientArchiveReason } from "./ward-patient-archive";

/**
 * Why this patient record cannot be archived, or undefined when it can (#816). Archiving is for a
 * record added in error, so a record anything else names (a journey, referral, stay, form or bed
 * record) is refused: that person has care recorded against them. The search reads every list in
 * the state except the record itself and the refusal log, so a list added later is covered too.
 */
export function patientArchiveProblem(state: WardFlowState, patientId: string): string | undefined {
  if (!state.patients.some((patient) => patient.id === patientId)) return "ARCHIVE_PATIENT names no patient record";
  const quoted = JSON.stringify(patientId);
  const { patients: _patients, rejections: _rejections, ...rest } = state;
  void _patients;
  void _rejections;
  if (JSON.stringify(rest).includes(quoted))
    return `ARCHIVE_PATIENT refused: patient ${patientId} has care recorded against them, so the record stays`;
  return undefined;
}

/** Archive mutation; the reducer's event permission and audit wrapper remain authoritative. */
export function reducePatientArchive(
  state: WardFlowState,
  event: Extract<WardFlowEvent, { type: "ARCHIVE_PATIENT" }>,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  if (!isPatientArchiveReason(event.reason))
    return reject(state, event, "ARCHIVE_PATIENT needs a reason from the list");
  const problem = patientArchiveProblem(state, event.patientId);
  if (problem !== undefined) return reject(state, event, problem);
  // The record leaves the lists. Its ADD_PATIENT and this event stay in the audit trail, and the
  // patient sequence is kept, so no later record reuses the id.
  return { ...state, patients: state.patients.filter((patient) => patient.id !== event.patientId) };
}
