import type { WfTone } from "@/components/wf";
import { formatInstantWithDay, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES,
  outstandingSupportParties,
  supportNotificationChecklist,
  supportNotificationSubjects,
  type SupportNotificationParty,
  type SupportNotificationRecord,
} from "@/components/ward-management/ward-support-notifications";
import { SELECTABLE_LEGAL_FORMS, legalFormName } from "@/components/ward-management/ward-legal-forms";
import { formTitleForCode } from "@/lib/form-register";

import { isLegalDeadlineBreached, legalExpiryReminderOf, reminderHours } from "./legal-forms-derivations";

/**
 * Small view helpers for the Forms page. Everything here reads what a person typed or recorded on
 * the movement. Nothing computes a legal limit (D5): an expiry exists only when it was typed.
 */

export const NOT_WIRED = "Not wired in this prototype.";

/** Form codes this page may mark written or received. Other catalogue entries stay read-only. */
export const OWNED_LEGAL_FORM_CODES = ["1A", "3A", "3C", "3D", "6A", "6B", "6C", "5A", "5B"] as const;
export type OwnedLegalFormCode = (typeof OWNED_LEGAL_FORM_CODES)[number];

export function isOwnedLegalFormCode(code: string | undefined): code is OwnedLegalFormCode {
  return code !== undefined && (OWNED_LEGAL_FORM_CODES as readonly string[]).includes(code);
}

/** `RECORD_LEGAL_FORM_RECEIVED` accepts the same codes this page may mark received. */
export function receiptEventAccepts(code: string | undefined): boolean {
  return isOwnedLegalFormCode(code);
}

function catalogFormLabel(code: string): string {
  const form = SELECTABLE_LEGAL_FORMS.find((entry) => entry.code === code);
  return form ? legalFormName(form) : legalFormName({ code });
}

/** The forms the requirements sheet lists, in register order. Titles come from the register. */
export type CatalogueEntry = { id: string; code: string; codes: string[]; title: string; tip: string };
export const CATALOGUE: CatalogueEntry[] = [
  { id: "1A", code: "1A", codes: ["1A"], title: formTitleForCode("1A") ?? "Form 1A", tip: catalogFormLabel("1A") },
  { id: "3A", code: "3A", codes: ["3A"], title: formTitleForCode("3A") ?? "Form 3A", tip: catalogFormLabel("3A") },
  { id: "3B", code: "3B", codes: ["3B"], title: formTitleForCode("3B") ?? "Form 3B", tip: catalogFormLabel("3B") },
  { id: "3C", code: "3C", codes: ["3C"], title: formTitleForCode("3C") ?? "Form 3C", tip: catalogFormLabel("3C") },
  { id: "3D", code: "3D", codes: ["3D"], title: formTitleForCode("3D") ?? "Form 3D", tip: catalogFormLabel("3D") },
  { id: "4A", code: "4A", codes: ["4A"], title: formTitleForCode("4A") ?? "Form 4A", tip: catalogFormLabel("4A") },
  { id: "4C", code: "4C", codes: ["4C"], title: formTitleForCode("4C") ?? "Form 4C", tip: catalogFormLabel("4C") },
  { id: "5A", code: "5A", codes: ["5A"], title: formTitleForCode("5A") ?? "Form 5A", tip: catalogFormLabel("5A") },
  { id: "5B", code: "5B", codes: ["5B"], title: formTitleForCode("5B") ?? "Form 5B", tip: catalogFormLabel("5B") },
  { id: "6A", code: "6A", codes: ["6A"], title: formTitleForCode("6A") ?? "Form 6A", tip: catalogFormLabel("6A") },
  { id: "6B", code: "6B", codes: ["6B"], title: formTitleForCode("6B") ?? "Form 6B", tip: catalogFormLabel("6B") },
  { id: "6C", code: "6C", codes: ["6C"], title: formTitleForCode("6C") ?? "Form 6C", tip: catalogFormLabel("6C") },
];

export function formTitle(code: string): string {
  return formTitleForCode(code) ?? `Form ${code}`;
}

/** Where a form stands against the warning windows. `none` when no expiry was typed. */
export type ClockStanding = "passed" | "urgent" | "soon" | "later" | "none";

export function clockStanding(movement: Movement, now: Instant): ClockStanding {
  if (movement.legalForm?.dueAt === undefined) return "none";
  if (isLegalDeadlineBreached(movement, now)) return "passed";
  const reminder = legalExpiryReminderOf(movement, now);
  if (reminder === "within-urgent") return "urgent";
  if (reminder === "within-soon") return "soon";
  return "later";
}

export const STANDING_TONE: Record<ClockStanding, WfTone> = {
  passed: "danger",
  urgent: "danger",
  soon: "warning",
  later: "neutral",
  none: "closed",
};

/** The short word beside a typed expiry: "Passed", "Within 1h", "Within 3h" or "Later". */
export function standingWord(standing: ClockStanding): string {
  if (standing === "passed") return "Passed";
  if (standing === "urgent") return `Within ${reminderHours("within-urgent")}h`;
  if (standing === "soon") return `Within ${reminderHours("within-soon")}h`;
  if (standing === "later") return "Later";
  return "No expiry typed";
}

/** Act now means passed or inside the first warning window. */
export function isActNow(standing: ClockStanding): boolean {
  return standing === "passed" || standing === "urgent";
}

/**
 * How much of the typed window has gone, from the written time (or when the move opened, when no
 * written time is recorded) to the typed expiry. 1 once the expiry has passed.
 */
export function elapsedFraction(movement: Movement, now: Instant): number {
  const dueAt = movement.legalForm?.dueAt;
  if (dueAt === undefined) return 0;
  const start = movement.formedAt ?? movement.openedAt;
  if (now >= dueAt) return 1;
  const span = dueAt - start;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - start) / span));
}

/**
 * Legal statuses that wait on a psychiatric examination. The examination itself is recorded on the
 * emergency department screen (`RECORD_EXAMINATION` is an ED event); this page only reads it.
 */
export function needsExamination(movement: Movement): boolean {
  return (
    movement.legalStatus === "Referred for psychiatric examination" ||
    movement.legalStatus === "Detained awaiting examination"
  );
}

export type RecordGap = "written" | "received" | "examination";

/** Whether a recorded fact is still missing on this movement's form. */
export function hasGap(movement: Movement, gap: RecordGap): boolean {
  if (gap === "written") return movement.formedAt === undefined;
  if (gap === "received")
    return receiptEventAccepts(movement.legalForm?.code) && movement.legalFormReceivedAt === undefined;
  return needsExamination(movement) && movement.examination === undefined;
}

/**
 * The recorded facts that apply to this movement, each done or not. The written time counts only
 * where Ward Flow can record it (the owned codes) or it is already recorded, so no screen shows a
 * gap nobody can close here.
 */
export function recordedFacts(movement: Movement): { gap: RecordGap; label: string; at?: Instant }[] {
  const facts: { gap: RecordGap; label: string; at?: Instant }[] = [];
  if (isOwnedLegalFormCode(movement.legalForm?.code) || movement.formedAt !== undefined) {
    facts.push({ gap: "written", label: "Time written", at: movement.formedAt });
  }
  if (receiptEventAccepts(movement.legalForm?.code)) {
    facts.push({ gap: "received", label: "Form received", at: movement.legalFormReceivedAt });
  }
  if (needsExamination(movement) || movement.examination !== undefined) {
    facts.push({ gap: "examination", label: "Examination", at: movement.examination?.at });
  }
  return facts;
}

/** Minutes as `1h 28m`, `58m`, `2d 22h`: the v6 duration format, minute precision. */
export function durText(minutes: number): string {
  const v = Math.max(0, Math.round(minutes));
  if (v < 60) return `${v}m`;
  if (v < 24 * 60) return `${Math.floor(v / 60)}h ${String(v % 60).padStart(2, "0")}m`;
  return `${Math.floor(v / (24 * 60))}d ${Math.floor((v % (24 * 60)) / 60)}h`;
}

/** "48m" left, or "37m ago" once passed. */
export function leftText(movement: Movement, now: Instant): string {
  const dueAt = movement.legalForm?.dueAt;
  if (dueAt === undefined) return "";
  const remaining = minutesUntil(dueAt, now);
  return remaining < 0 ? `${durText(-remaining)} ago` : durText(remaining);
}

export type FormEventItem = { id: string; sortAt: Instant; tone: WfTone; text: string };

/** Recorded legal-form facts on one movement, newest first: what the record holds and nothing more. */
export function formEvents(movement: Movement, edName: string): FormEventItem[] {
  const code = movement.legalForm?.code;
  if (code === undefined) return [];
  const items: FormEventItem[] = [
    { id: `${movement.id}-lodged`, sortAt: movement.openedAt, tone: "success", text: `Lodged on the move, ${edName}` },
  ];
  if (movement.formedAt !== undefined) {
    items.push({
      id: `${movement.id}-written`,
      sortAt: movement.formedAt,
      tone: "info",
      text: `Form ${code} made, time written on form`,
    });
  }
  if (movement.legalFormReceivedAt !== undefined) {
    items.push({
      id: `${movement.id}-received`,
      sortAt: movement.legalFormReceivedAt,
      tone: "success",
      text: `Form ${code} received`,
    });
  }
  if (movement.examination !== undefined) {
    items.push({
      id: `${movement.id}-examination`,
      sortAt: movement.examination.at,
      tone: "success",
      text: "Examination recorded",
    });
  }
  for (const [index, entry] of (movement.legalFormExpiryHistory ?? []).entries()) {
    items.push({
      id: `${movement.id}-expiry-${index}`,
      sortAt: entry.at,
      tone: "info",
      text: entry.basis === "extension" ? `Form ${code} extended` : `Expiry typed from form ${code}`,
    });
  }
  return items.sort((a, b) => b.sortAt - a.sortAt);
}

/** The handover lines for expiries in the next eight hours, soonest first. */
export function handoverLines(
  movements: Movement[],
  now: Instant,
  nameOf: (movement: Movement) => string,
  windowMinutes: number,
): string[] {
  return movements
    .filter((movement) => {
      const dueAt = movement.legalForm?.dueAt;
      if (dueAt === undefined) return false;
      const left = minutesUntil(dueAt, now);
      return left >= 0 && left <= windowMinutes;
    })
    .sort((a, b) => (a.legalForm?.dueAt ?? 0) - (b.legalForm?.dueAt ?? 0))
    .map(
      (movement) =>
        `${formatInstantWithDay(movement.legalForm!.dueAt!, now)} Form ${movement.legalForm!.code}, ${nameOf(movement)}`,
    );
}

/** Same HH:MM parser the ED legal-form panel uses. */
export function minutesFromTimeInput(value: string): number | undefined {
  const parts = value.split(":");
  if (parts.length !== 2) return undefined;
  const [rawHours, rawMinutes] = parts;
  if (rawHours?.length !== 2 || rawMinutes?.length !== 2) return undefined;
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/** Typed date and time to an Instant, counted from the provider's `dayZero`. No duration is added. */
export function instantFromDateAndTimeInputs(dateValue: string, timeValue: string, dayZero: Date): number | undefined {
  if (dateValue === "" || timeValue === "") return undefined;
  const minuteOfDayValue = minutesFromTimeInput(timeValue);
  if (minuteOfDayValue === undefined) return undefined;
  const dateParts = dateValue.split("-");
  if (dateParts.length !== 3) return undefined;
  const [rawYear, rawMonth, rawDay] = dateParts;
  if (rawYear?.length !== 4 || rawMonth?.length !== 2 || rawDay?.length !== 2) return undefined;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const typedDate = new Date(year, month - 1, day);
  if (typedDate.getFullYear() !== year || typedDate.getMonth() !== month - 1 || typedDate.getDate() !== day) {
    return undefined;
  }
  const dayOffsetMinutes = Math.round((typedDate.getTime() - dayZero.getTime()) / 60_000);
  return dayOffsetMinutes + minuteOfDayValue;
}

/** One recent move whose carer, PSP or MHAS record is still open. */
export type TellSubject = {
  key: string;
  occasion: "admission" | "transfer" | "discharge";
  movementId?: string;
  admissionId?: string;
  unitId?: string;
  completedAt: Instant;
  name: string;
  umrn: string;
  place: string;
  missing: SupportNotificationParty[];
  /** Parties the checklist covers for this move, done or not. */
  parties: SupportNotificationParty[];
};

/**
 * Carer, PSP and MHAS apply to completed moves of involuntary patients (PR #159): recent arrivals,
 * transfers and discharges inside the Tasks lookback, oldest first. `withOutstanding` keeps only
 * the moves with a party still to record.
 */
export function recentTellSubjects(
  records: {
    movements: readonly Movement[];
    admissions: readonly Admission[];
    patients: readonly Patient[];
    referrals: readonly Referral[];
    units: readonly Unit[];
    supportNotifications?: readonly SupportNotificationRecord[];
  },
  now: Instant,
  withOutstanding = true,
): TellSubject[] {
  return supportNotificationSubjects(records)
    .filter(
      (subject) =>
        subject.completedAt <= now && now - subject.completedAt <= SUPPORT_NOTIFICATION_TASK_LOOKBACK_MINUTES,
    )
    .map((subject) => {
      const missing = outstandingSupportParties(
        supportNotificationChecklist(records.supportNotifications, subject.occasion, subject.subjectId),
      );
      const record =
        subject.occasion === "discharge"
          ? records.admissions.find((admission) => admission.id === subject.admissionId)
          : records.movements.find((movement) => movement.id === subject.movementId);
      const person = record ? resolveSubjectPatient(record, records) : null;
      const unit = subject.unitId ? records.units.find((candidate) => candidate.id === subject.unitId) : undefined;
      return {
        key: `${subject.occasion}-${subject.subjectId}`,
        occasion: subject.occasion,
        movementId: subject.movementId,
        admissionId: subject.admissionId,
        unitId: subject.unitId,
        completedAt: subject.completedAt,
        name: person?.formalName ?? "Patient",
        umrn: person?.umrn ?? "UMRN not recorded",
        place: unit?.name ?? "Ward not recorded",
        missing,
        parties: ["carer", "personal_support_person", "mhas"] as SupportNotificationParty[],
      };
    })
    .filter((subject) => !withOutstanding || subject.missing.length > 0)
    .sort((a, b) => a.completedAt - b.completedAt);
}
