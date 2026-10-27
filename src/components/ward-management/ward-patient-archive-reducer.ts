import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowEvent } from "./ward-flow-events";
import { isPatientArchiveReason } from "./ward-patient-archive";
import type { AuditDecision } from "./ward-audit";

/**
 * Why this patient record cannot be archived, or undefined when it can (#816). Archiving is for a
 * record added in error, so a record anything else names (a journey, referral, stay, form or bed
 * record) is refused: that person has care recorded against them. The search reads every list in
 * the state except the record itself and the refusal log, so a list added later is covered too.
 */
export function patientArchiveProblem(state: WardFlowState, patientId: string): string | undefined {
  const record = state.patients.find((patient) => patient.id === patientId);
  if (!record) return "ARCHIVE_PATIENT names no patient record";
  const refused = `ARCHIVE_PATIENT refused: patient ${patientId} has care recorded against them, so the record stays`;
  // A fact recorded on the person themselves (a treatment order, alerts, a preferred name) is
  // something beyond what Add patient wrote, so the record stays.
  if (Object.keys(record).some((key) => !REGISTRATION_FIELDS.has(key))) return refused;
  const quoted = JSON.stringify(patientId);
  const { patients: _patients, rejections: _rejections, auditEvents, ...rest } = state;
  void _patients;
  void _rejections;
  // An earlier archive attempt's own audit row names the record but is not care.
  const audit = (auditEvents ?? []).filter((entry) => entry.action !== "ARCHIVE_PATIENT");
  if (JSON.stringify(rest).includes(quoted) || JSON.stringify(audit).includes(quoted)) return refused;
  return undefined;
}

/** The fields ADD_PATIENT writes. Any other field on the record was recorded later. */
const REGISTRATION_FIELDS: ReadonlySet<string> = new Set([
  "id",
  "umrn",
  "givenName",
  "familyName",
  "dateOfBirth",
  "gender",
  "sex",
  "suburb",
  "addedAt",
  "registrationScope",
]);

/** Archive mutation; the reducer's event permission and audit wrapper remain authoritative. */
export function reducePatientArchive(
  state: WardFlowState,
  event: Extract<WardFlowEvent, { type: "ARCHIVE_PATIENT" }>,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
  decision: AuditDecision,
): WardFlowState {
  if (!isPatientArchiveReason(event.reason))
    return reject(state, event, "ARCHIVE_PATIENT needs a reason from the list");
  const problem = patientArchiveProblem(state, event.patientId);
  if (problem !== undefined) return reject(state, event, problem);
  // The record leaves the lists. Its ADD_PATIENT and this event stay in the audit trail, and the
  // patient sequence is kept, so no later record reuses the id.
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return { ...state, patients: state.patients.filter((patient) => patient.id !== event.patientId) };
}
