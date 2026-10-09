import { BellRing } from "lucide-react";

import type { Admission } from "./ward-admissions";
import { MINUTES_PER_DAY, type Instant } from "./ward-clock";
import type { InboxItem } from "./ward-derivations";
import type { WardFlowRole } from "./ward-flow-roles";
import { INBOX_CATEGORIES } from "./ward-inbox-reducer";
import { SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES } from "./ward-operational-defaults";
import type { Movement, Referral, Unit } from "./ward-model";
import { createPatientResolver } from "./ward-patient-resolver";
import type { Patient } from "./ward-patients";

/**
 * Carer, personal support person and Mental Health Advocacy Service notification checklist.
 *
 * ADVISORY ONLY. When an involuntary patient is admitted, transferred or discharged, the ward or
 * coordinator can record that each of the three was told (who and when), or that it does not
 * apply (with a reason). Nothing here computes a deadline, decides whether a notice is required
 * by law, or blocks a move: the checklist records what a person says happened.
 *
 * `RECORD_SUPPORT_NOTIFICATION` appends to `WardFlowState.supportNotifications`; the latest record
 * for a party on an occasion is the one shown. `who` and `reason` are typed text, so the event is
 * on the typed-text persistence list and a session that records one stops saving (D-18).
 */

export const SUPPORT_NOTIFICATION_PARTIES = ["carer", "personal_support_person", "mhas"] as const;
export type SupportNotificationParty = (typeof SUPPORT_NOTIFICATION_PARTIES)[number];

export const SUPPORT_NOTIFICATION_PARTY_LABELS: Record<SupportNotificationParty, string> = {
  carer: "Carer",
  personal_support_person: "Personal support person",
  mhas: "Mental Health Advocacy Service",
};

/** Short labels for dense rows. */
export const SUPPORT_NOTIFICATION_PARTY_SHORT: Record<SupportNotificationParty, string> = {
  carer: "Carer",
  personal_support_person: "PSP",
  mhas: "MHAS",
};

export const SUPPORT_NOTIFICATION_OCCASIONS = ["admission", "transfer", "discharge"] as const;
export type SupportNotificationOccasion = (typeof SUPPORT_NOTIFICATION_OCCASIONS)[number];

export const SUPPORT_NOTIFICATION_OCCASION_LABELS: Record<SupportNotificationOccasion, string> = {
  admission: "Admission",
  transfer: "Transfer",
  discharge: "Discharge",
};

export const SUPPORT_NOTIFICATION_OUTCOMES = ["told", "not_applicable"] as const;
export type SupportNotificationOutcome = (typeof SUPPORT_NOTIFICATION_OUTCOMES)[number];

/** Refused, never shortened, over these lengths. */
export const SUPPORT_NOTIFICATION_WHO_MAX_CHARACTERS = 80;
export const SUPPORT_NOTIFICATION_REASON_MAX_CHARACTERS = 160;

/** Re-exported so callers keep one import; the value lives with the other labelled defaults. */
export { SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES };

export type SupportNotificationRecord = {
  id: string;
  occasion: SupportNotificationOccasion;
  /** The movement for an admission or transfer; the admission for a discharge. */
  subjectId: string;
  party: SupportNotificationParty;
  outcome: SupportNotificationOutcome;
  /** Who was told, as typed. Present only when `outcome` is `told`. */
  who?: string;
  /** When they were told, as recorded. Present only when `outcome` is `told`. */
  contactedAt?: Instant;
  /** Why it does not apply, as typed. Present only when `outcome` is `not_applicable`. */
  reason?: string;
  /** When the record was made. */
  at: Instant;
  by: WardFlowRole;
};

/** One completed move of an involuntary patient that the checklist applies to. */
export type SupportNotificationSubject = {
  occasion: SupportNotificationOccasion;
  subjectId: string;
  completedAt: Instant;
  /** The movement to open for this move, when there is one. */
  movementId?: string;
  admissionId?: string;
  /** The ward the person arrived on (admission, transfer) or left (discharge). */
  unitId?: string;
};

export type SupportNotificationChecklist = Record<SupportNotificationParty, SupportNotificationRecord | undefined>;

type NotificationRecords = {
  movements: readonly Movement[];
  admissions: readonly Admission[];
  patients: readonly Patient[];
  referrals: readonly Referral[];
};

/**
 * Whether a patient record's free-text legal status is involuntary. Kept identical to the
 * reducer's discharge guard (`patientRecordIsInvoluntary` in `ward-flow-reducer.ts`): anything
 * starting "Involuntary", plus "Detained awaiting examination".
 */
export function legalStatusTextIsInvoluntary(legalStatus: string | undefined): boolean {
  if (legalStatus === undefined) return false;
  return /^involuntary\b/i.test(legalStatus.trim()) || legalStatus === "Detained awaiting examination";
}

/**
 * Whether a movement's closed legal-status vocabulary is involuntary for this checklist.
 * "Referred for psychiatric examination" is not — only detained / involuntary inpatient.
 */
export function movementLegalStatusIsInvoluntary(legalStatus: Movement["legalStatus"]): boolean {
  return legalStatus === "Detained awaiting examination" || legalStatus === "Involuntary inpatient";
}

function movementArrivedAt(movement: Movement): Instant | undefined {
  if (movement.closure?.outcome === "arrived") return movement.closure.at;
  if (movement.stage === "arrived") return movement.transport?.arrivedAt ?? movement.closure?.at;
  return undefined;
}

function movementOccasion(movement: Movement, referrals: readonly Referral[]): SupportNotificationOccasion {
  if (movement.sourceAdmissionId !== undefined) return "transfer";
  const referral = movement.referralId
    ? referrals.find((candidate) => candidate.id === movement.referralId)
    : undefined;
  if (referral?.source === "psychiatric_ward") return "transfer";
  return "admission";
}

/** The arrival this checklist covers, for one movement, or undefined when it does not apply. */
export function movementSupportNotificationSubject(
  movement: Movement,
  records: Pick<NotificationRecords, "referrals"> = { referrals: [] },
): SupportNotificationSubject | undefined {
  if (!movementLegalStatusIsInvoluntary(movement.legalStatus)) return undefined;
  const completedAt = movementArrivedAt(movement);
  if (completedAt === undefined) return undefined;
  return {
    occasion: movementOccasion(movement, records.referrals),
    subjectId: movement.id,
    completedAt,
    movementId: movement.id,
    admissionId: movement.admissionId,
    unitId: movement.acceptedUnitId,
  };
}

/** The discharge this checklist covers, for one admission, or undefined when it does not apply. */
export function admissionSupportNotificationSubject(
  admission: Admission,
  records: NotificationRecords,
): SupportNotificationSubject | undefined {
  if (admission.state !== "departed" || admission.leftAt === null) return undefined;
  // A ward-to-ward transfer is recorded on the receiving movement, not as a discharge.
  if (admission.leavingDestination === "transferred-to-another-psychiatric-ward") return undefined;
  const linked =
    (admission.movementId ? records.movements.find((movement) => movement.id === admission.movementId) : undefined) ??
    records.movements.find((movement) => movement.admissionId === admission.id);
  const patient = createPatientResolver(records)(admission).patient;
  const involuntary =
    legalStatusTextIsInvoluntary(patient?.legalStatus) ||
    (linked !== undefined && movementLegalStatusIsInvoluntary(linked.legalStatus));
  if (!involuntary) return undefined;
  return {
    occasion: "discharge",
    subjectId: admission.id,
    completedAt: admission.leftAt,
    movementId: linked?.id,
    admissionId: admission.id,
    unitId: admission.unitId,
  };
}

/** Every completed move the checklist applies to, newest first. */
export function supportNotificationSubjects(records: NotificationRecords): SupportNotificationSubject[] {
  const subjects: SupportNotificationSubject[] = [];
  for (const movement of records.movements) {
    const subject = movementSupportNotificationSubject(movement, records);
    if (subject) subjects.push(subject);
  }
  for (const admission of records.admissions) {
    const subject = admissionSupportNotificationSubject(admission, records);
    if (subject) subjects.push(subject);
  }
  return subjects.sort((a, b) => b.completedAt - a.completedAt);
}

/**
 * The most recent instant, at or before `now`, whose clock time is the typed `HH:MM`: today's if
 * that has passed, otherwise yesterday's. Null for anything that is not a 24-hour clock time.
 */
export function clockTextToInstantNotAfter(text: string, now: Instant): Instant | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  if (!match) return null;
  const typed = Number(match[1]) * 60 + Number(match[2]);
  const nowOfDay = ((Math.floor(now) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const candidate = Math.floor(now) - nowOfDay + typed;
  return (candidate > now ? candidate - MINUTES_PER_DAY : candidate) as Instant;
}

/** The latest record for each party on one move. */
export function supportNotificationChecklist(
  records: readonly SupportNotificationRecord[] | undefined,
  occasion: SupportNotificationOccasion,
  subjectId: string,
): SupportNotificationChecklist {
  const checklist: SupportNotificationChecklist = {
    carer: undefined,
    personal_support_person: undefined,
    mhas: undefined,
  };
  for (const record of records ?? []) {
    if (record.occasion === occasion && record.subjectId === subjectId) checklist[record.party] = record;
  }
  return checklist;
}

/** Parties with nothing recorded yet, in checklist order. */
export function outstandingSupportParties(checklist: SupportNotificationChecklist): SupportNotificationParty[] {
  return SUPPORT_NOTIFICATION_PARTIES.filter((party) => checklist[party] === undefined);
}

function taskCategory(occasion: SupportNotificationOccasion) {
  return occasion === "discharge"
    ? INBOX_CATEGORIES.support_notification_discharge
    : INBOX_CATEGORIES.support_notification_arrival;
}

/**
 * The id of the Tasks row for one move: a category prefix and the movement id, the shape
 * `ACKNOWLEDGE_INBOX_ITEM` checks. One movement has at most one arrival and one linked discharge,
 * so the two prefixes keep the ids distinct.
 */
export function supportNotificationTaskId(occasion: SupportNotificationOccasion, movementId: string): string {
  return `${taskCategory(occasion).idPrefix}${movementId}`;
}

/**
 * One Tasks row per recent move (within the lookback) that still has a party with nothing recorded.
 * Moves without a movement to open are left to the discharges board, where the checklist sits.
 */
export function supportNotificationInboxItems(
  records: NotificationRecords & {
    units: readonly Unit[];
    supportNotifications?: readonly SupportNotificationRecord[];
  },
  now: Instant,
): InboxItem[] {
  const items: InboxItem[] = [];
  for (const subject of supportNotificationSubjects(records)) {
    if (subject.completedAt > now || now - subject.completedAt > SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES) continue;
    if (subject.movementId === undefined) continue;
    const missing = outstandingSupportParties(
      supportNotificationChecklist(records.supportNotifications, subject.occasion, subject.subjectId),
    );
    if (missing.length === 0) continue;
    const unit = subject.unitId ? records.units.find((candidate) => candidate.id === subject.unitId) : undefined;
    items.push({
      id: supportNotificationTaskId(subject.occasion, subject.movementId),
      kind: taskCategory(subject.occasion).kind,
      tone: "warning",
      icon: BellRing,
      title: `${SUPPORT_NOTIFICATION_OCCASION_LABELS[subject.occasion]} notifications to record`,
      // No record id in the text: the drawer names the person through the patient resolver.
      detail: `${missing.map((party) => SUPPORT_NOTIFICATION_PARTY_SHORT[party]).join(", ")} not recorded${unit ? ` · ${unit.name}` : ""}`,
      owner: "Ward",
      movementId: subject.movementId,
    });
  }
  return items;
}
