import type { Instant } from "./ward-clock";
import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowRole } from "./ward-flow-roles";
import type { PatientId } from "./ward-patients";
import type { Referral } from "./ward-model";
import { UNDO_WINDOW_MINUTES } from "./ward-operational-defaults";

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
 * Why this patient record cannot be archived, or undefined when it can (#816, D-149). Archiving is
 * for a record added in error, so a record anything else names (a journey, open or answered
 * referral, stay, form or bed record) is refused: that person has care recorded against them. The
 * search reads every list in the state except the record itself and the refusal log, so a list added
 * later is covered too. Kept outside the reducer slice so the archive panel can ask without loading
 * the slice.
 *
 * D-149 (Josh, 11 Nov 2026): three kinds of link are not care, so they no longer keep the record.
 * - A front-door referral that was only ever withdrawn or cancelled: no destination answered it.
 * - Audit rows, which keep the record's history after it is archived.
 * - An Undo record older than the Undo window, which can no longer be used. One still inside the
 *   window could bring a referral back, so it keeps the record until the window ends. Without
 *   `now` every Undo record counts.
 */
export function patientArchiveProblem(state: WardFlowState, patientId: string, now?: Instant): string | undefined {
  const record = state.patients.find((patient) => patient.id === patientId);
  if (!record) return "ARCHIVE_PATIENT names no patient record";
  // A fact recorded on the person themselves (a treatment order, alerts, a preferred name) is
  // something beyond what Add patient wrote, so the record stays.
  if (Object.keys(record).some((key) => !REGISTRATION_FIELDS.has(key)))
    return "This record has details recorded after it was added, so it has care recorded against them and stays.";
  const quoted = JSON.stringify(patientId);
  const { patients: _patients, rejections: _rejections, auditEvents: _audit, referrals, undoRecords, ...rest } = state;
  void _patients;
  void _rejections;
  void _audit;
  const live = (referrals ?? []).filter((referral) => !referralOnlyWithdrawn(referral));
  if (live.some((referral) => JSON.stringify(referral).includes(quoted)))
    return "This record has an open or answered referral, so it has care recorded against them and stays.";
  if (JSON.stringify(rest).includes(quoted))
    return "Something else on the board names this record, so it has care recorded against them and stays.";
  // Same window as Undo's own check (`undoWindowRefusal`): a step stamped after `now`, which a clock
  // step back can leave, cannot be undone either, so it does not hold the record.
  const usable = (undoRecords ?? []).filter(
    (entry) => now === undefined || (now >= entry.at && now - entry.at <= UNDO_WINDOW_MINUTES),
  );
  if (JSON.stringify(usable).includes(quoted))
    return `A step on this record can still be undone. Archive it once ${UNDO_WINDOW_MINUTES} minutes have passed.`;
  return undefined;
}

/** A referral nobody answered: every destination was withdrawn by the referrer or cancelled. */
function referralOnlyWithdrawn(referral: Referral): boolean {
  return (
    referral.destinations.length > 0 &&
    referral.destinations.every(
      (addressing) =>
        addressing.state === "cancelled" || (addressing.state === "queued" && addressing.withdrawnAt !== undefined),
    )
  );
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
  // RF7 (3 Nov 2026): the optional details Add patient can now record at registration.
  "preferredName",
  "address",
  "generalPractitioner",
  "catchmentCommunityTeam",
  "interpreterLanguage",
  // Note 3 (8 Nov 2026): the optional administrative details.
  "mobilePhone",
  "otherPhone",
  "email",
  "postcode",
  "nextOfKinName",
  "nextOfKinRelationship",
  "nextOfKinPhone",
  "supportPersonRole",
  "supportPersonName",
  "supportPersonPhone",
  "medicareNumber",
  "medicareReference",
  "medicareExpiry",
  "dvaFileNumber",
  "healthFund",
  "concessionCard",
  "gpPhone",
  "countryOfBirth",
  "interpreterRequired",
  "maritalStatus",
  "advanceHealthDirective",
  "enduringGuardian",
  "addedAt",
  "registrationScope",
  "aboriginalOrTorresStraitIslanderStatus",
]);
