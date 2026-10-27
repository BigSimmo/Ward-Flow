import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowEvent } from "./ward-flow-events";
import { isPatientArchiveReason, patientArchiveProblem } from "./ward-patient-archive";
import type { AuditDecision } from "./ward-audit";
import { subjectId } from "./ward-flow-subject-id";

/** Archive mutation; the reducer's event permission and audit wrapper remain authoritative. */
export function reducePatientArchive(
  state: WardFlowState,
  event: Extract<WardFlowEvent, { type: "ARCHIVE_PATIENT" }>,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
  decision: AuditDecision,
): WardFlowState {
  if (!isPatientArchiveReason(event.reason))
    return reject(state, event, "ARCHIVE_PATIENT needs a reason from the list");
  // D-14: the event's patient is read through the allow-listed subjectId, not here.
  const patientId = subjectId(event);
  const problem = patientArchiveProblem(state, patientId);
  if (problem !== undefined) return reject(state, event, problem);
  // The record leaves the lists. Its ADD_PATIENT and this event stay in the audit trail, and the
  // patient sequence is kept, so no later record reuses the id.
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return { ...state, patients: state.patients.filter((patient) => patient.id !== patientId) };
}
