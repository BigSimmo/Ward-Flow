import type { Instant } from "./ward-clock";
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
