import type { Instant } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowRole } from "./ward-flow-roles";
import type { PatientId } from "./ward-patients";

/**
 * #816 (Josh, 26 Oct 2026: archive only, coordinator only): why a patient record added in error
 * leaves the lists. A closed list, chosen on screen, so the event carries no typed text.
 */
export const PATIENT_ARCHIVE_REASONS = ["duplicate", "test", "wrong_person"] as const;

export type PatientArchiveReason = (typeof PATIENT_ARCHIVE_REASONS)[number];

export const PATIENT_ARCHIVE_REASON_LABELS: Readonly<Record<PatientArchiveReason, string>> = {
  duplicate: "Duplicate of another record",
  test: "Test record",
  wrong_person: "Details belong to someone else",
};

export function isPatientArchiveReason(value: unknown): value is PatientArchiveReason {
  return typeof value === "string" && (PATIENT_ARCHIVE_REASONS as readonly string[]).includes(value);
}

/**
 * #816 (Josh, 26 Oct 2026: archive only, coordinator only): a record added in error leaves every
 * list. Only a record nothing else names can be archived, and nothing is destroyed: the record's
 * own ADD_PATIENT and this event stay in the audit trail. Kept here for the events file's line cap.
 */
export type ArchivePatientEvent = {
  type: "ARCHIVE_PATIENT";
  role: WardFlowRole;
  now: Instant;
  patientId: PatientId;
  reason: PatientArchiveReason;
};

/**
 * Why this patient record cannot be archived, or undefined when it can (#816). Archiving is for a
 * record added in error, so a record anything else names (a journey, referral, stay, form or bed
 * record) is refused: that person has care recorded against them. The search reads every list in
 * the state except the record itself and the refusal log, so a list added later is covered too.
 * Kept outside the reducer slice so the archive panel can ask without loading the slice.
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
