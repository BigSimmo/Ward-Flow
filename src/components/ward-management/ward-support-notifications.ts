import { BellRing, type LucideIcon } from "lucide-react";

import type { Admission } from "./ward-admissions";
import { MINUTES_PER_DAY, type Instant } from "./ward-clock";
import type { WardFlowRole } from "./ward-flow-roles";
import { INBOX_CATEGORIES, type InboxItemKind } from "./ward-inbox-reducer";
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
 * Whether a movement's closed legal-status vocabulary is involuntary for this checklist: detained
 * awaiting examination or an involuntary inpatient. "Referred for psychiatric examination" is not.
 */
export function movementLegalStatusIsInvoluntary(legalStatus: Movement["legalStatus"] | undefined): boolean {
  return legalStatus === "Detained awaiting examination" || legalStatus === "Involuntary inpatient";
}

function movementArrivedAt(movement: Movement): Instant | undefined {
  if (movement.closure?.outcome === "arrived") return movement.closure.at;
  if (movement.stage === "arrived") return movement.transport?.arrivedAt ?? movement.closure?.at;
  return undefined;
}

/**
 * A ward-to-ward move: a recorded sending stay, or a psychiatric-ward referral that names its
 * sending ward (the same two routes the reducer's `movementSourceAdmission` reads).
 */
function arrivalIsTransfer(movement: Movement, referrals: readonly Referral[]): boolean {
  if (movement.sourceAdmissionId !== undefined) return true;
  const referral = movement.referralId
    ? referrals.find((candidate) => candidate.id === movement.referralId)
    : undefined;
  return referral?.source === "psychiatric_ward" && Boolean(referral.originUnitId);
}

/** The arrival this checklist covers, for one movement, or undefined when it does not apply. */
export function movementSupportNotificationSubject(
  movement: Movement,
  referrals: readonly Referral[],
): SupportNotificationSubject | undefined {
  // Involuntary statuses only: "Referred for psychiatric examination" is not one.
  if (!movementLegalStatusIsInvoluntary(movement.legalStatus)) return undefined;
  const completedAt = movementArrivedAt(movement);
  if (completedAt === undefined) return undefined;
  return {
    occasion: arrivalIsTransfer(movement, referrals) ? "transfer" : "admission",
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
    legalStatusTextIsInvoluntary(patient?.legalStatus) || movementLegalStatusIsInvoluntary(linked?.legalStatus);
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
    const subject = movementSupportNotificationSubject(movement, records.referrals);
    if (subject) subjects.push(subject);
  }
  for (const admission of records.admissions) {
    const subject = admissionSupportNotificationSubject(admission, records);
    if (subject) subjects.push(subject);
  }
  return subjects.sort((a, b) => b.completedAt - a.completedAt);
}

/**
 * The instant for a typed `HH:MM` on the day `daysAgo` before `now`'s day (0 today, 1 yesterday,
 * 2 the day before). Null for anything that is not a 24-hour clock time or a whole day 0 to 2. May
 * be later than `now` (today, a time still to come); the caller says so rather than moving the day.
 */
export function clockTextOnDay(text: string, daysAgo: number, now: Instant): Instant | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  if (!match || !Number.isInteger(daysAgo) || daysAgo < 0 || daysAgo > 2) return null;
  const typed = Number(match[1]) * 60 + Number(match[2]);
  const nowOfDay = ((Math.floor(now) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return (Math.floor(now) - nowOfDay - daysAgo * MINUTES_PER_DAY + typed) as Instant;
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
 * The id of the Tasks row for one move: a category prefix and the record it is about, the shape
 * `ACKNOWLEDGE_INBOX_ITEM` checks. Admission and transfer rows name the movement; discharge rows
 * name the discharged stay's admission id.
 */
export function supportNotificationTaskId(occasion: SupportNotificationOccasion, recordId: string): string {
  return `${taskCategory(occasion).idPrefix}${recordId}`;
}

/**
 * The Tasks row this module builds. It has the shape of `InboxItem` (`ward-derivations.ts`),
 * which appends these rows, and is spelled out here so this module never imports
 * `ward-derivations` back (no import cycle). The compiler checks the fit where they are appended.
 */
export type SupportNotificationInboxRow = {
  id: string;
  kind: InboxItemKind;
  tone: "warning";
  icon: LucideIcon;
  title: string;
  detail: string;
  owner: string;
  movementId: string;
  admissionId?: string;
};

/**
 * One Tasks row per recent move (within the lookback) that still has a party with nothing recorded.
 * Admission and transfer rows are keyed and routed by their movement. Discharge rows are keyed by
 * the discharged stay (so a stay with no linked movement still gets one) and carry `admissionId`,
 * so the Tasks drawer opens the discharge checklist on the discharges board, not the movement page.
 */
export function supportNotificationInboxItems(
  records: NotificationRecords & {
    units: readonly Unit[];
    supportNotifications?: readonly SupportNotificationRecord[];
  },
  now: Instant,
): SupportNotificationInboxRow[] {
  const items: SupportNotificationInboxRow[] = [];
  for (const subject of supportNotificationSubjects(records)) {
    if (subject.completedAt > now || now - subject.completedAt > SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES) continue;
    const key = subject.occasion === "discharge" ? subject.admissionId : subject.movementId;
    if (key === undefined) continue;
    const missing = outstandingSupportParties(
      supportNotificationChecklist(records.supportNotifications, subject.occasion, subject.subjectId),
    );
    if (missing.length === 0) continue;
    const unit = subject.unitId ? records.units.find((candidate) => candidate.id === subject.unitId) : undefined;
    items.push({
      id: supportNotificationTaskId(subject.occasion, key),
      kind: taskCategory(subject.occasion).kind,
      tone: "warning",
      icon: BellRing,
      title: `${SUPPORT_NOTIFICATION_OCCASION_LABELS[subject.occasion]} notifications to record`,
      // No record id in the text: the drawer names the person through the patient resolver.
      detail: `${missing.map((party) => SUPPORT_NOTIFICATION_PARTY_SHORT[party]).join(", ")} not recorded${unit ? ` · ${unit.name}` : ""}`,
      owner: "Ward",
      // A discharge with no linked movement has none to name; the row opens by `admissionId`.
      movementId: subject.movementId ?? "",
      ...(subject.occasion === "discharge" ? { admissionId: key } : {}),
    });
  }
  return items;
}
