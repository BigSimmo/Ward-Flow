import type { Instant } from "@/components/ward-management/ward-clock";
import type { LegalForm, LegalFormEnding, Movement } from "@/components/ward-management/ward-model";

/**
 * THE NEXT FORM AFTER THE EXAMINATION OR THE ARRIVAL (audit S-6, 13 Oct 2026; D-170 item 1 and
 * clinical check pack A1, Josh 13 Nov 2026).
 *
 * The engine changes a form only when a clinician records one (`RECORD_EXAMINATION` keeps the old
 * form, by owner ruling). Once an inpatient treatment order is recorded at the examination, or a
 * person on a referral, detention, transport or community form arrives on the ward, the next form
 * is still to record. This reads that from the record and prompts "Next form to record", with no
 * form number: the app never names the next order (D-170 item 1 replaced the 13 Oct "Record Form
 * 6A" default).
 *
 * 🔴 It never says the old form ended. A form shows as recorded on every screen until a person
 * records that it ended (`LegalForm.endedBy`; check pack A1, Josh 13 Nov 2026, 4:09 pm, which
 * reversed D-168's "shown as ended"). The inference that a form ended at the examination or at
 * arrival is gone; only a person's recorded end is shown. It computes no legal time and cites no
 * section.
 *
 * It sits at the ward root (moved from `legal-forms/legal-form-progression.ts`, 13 Nov 2026) because
 * every screen reads the one current legal position, and screens share code through the ward root,
 * never by importing each other (`tests/ward-import-map-guard.test.ts`).
 */
export type FormProgression = {
  /** The form on record, as recorded: "4C". */
  formCode: string;
  /** What has happened since, in words: "at arrival" or "at the examination". */
  when: "at arrival" | "at the examination";
};

/** What the legal position reads from a stay: its form and status, and the examination and arrival. */
export type LegalPositionSource = Pick<Movement, "legalForm" | "legalStatus"> &
  Partial<Pick<Movement, "examination" | "closure">>;

/** D-170 item 1: the prompt, word for word, everywhere. No form number. */
export const NEXT_FORM_TO_RECORD = "Next form to record";

/** "On Form 4C at arrival" or "On Form 3B at the examination": the form as recorded, never "ended". */
export function formProgressionPhrase(progression: FormProgression): string {
  return `On Form ${progression.formCode} ${progression.when}`;
}

/** The short form of the same: "On this form at arrival" (D-127 wording, now for every form). */
export function formProgressionShort(progression: FormProgression): string {
  return `On this form ${progression.when}`;
}

/**
 * Forms that authorise an inpatient stay already: nothing to move on to. Forms 5A and 5B are
 * community treatment orders in the register, not inpatient orders, so a person on one who
 * arrives on the ward still gets the next form prompt (M117, D-123).
 */
const INPATIENT_ORDER_CODES: readonly string[] = ["6A", "6B", "6C"];

export function formProgression(movement: LegalPositionSource | undefined): FormProgression | undefined {
  const code = movement?.legalForm?.code;
  if (!movement || code === undefined || INPATIENT_ORDER_CODES.includes(code)) return undefined;
  if (movement.legalStatus === "Voluntary") return undefined;
  // A form a person recorded as ended asks for nothing more here; that end is shown instead.
  if (movement.legalForm?.endedBy !== undefined) return undefined;
  if (movement.examination?.outcome === "inpatient_order") return { formCode: code, when: "at the examination" };
  if (movement.closure?.outcome === "arrived") return { formCode: code, when: "at arrival" };
  return undefined;
}

// The ended-form words live at the ward root so screens share them without importing each other.
export { FORM_RECORDED_ENDED, formRecordedEnded } from "@/components/ward-management/ward-legal-form-ended";

/**
 * How a form's record stands beside its next step: a form a person recorded as ended (`recorded`),
 * else the next form still to record after the examination or arrival (`progressed`, with the form
 * shown as recorded). Never an inferred end (A1).
 */
export type LegalFormEnd = { kind: "progressed"; progression: FormProgression } | { kind: "recorded" };

export function legalFormEnd(movement: LegalPositionSource | undefined): LegalFormEnd | undefined {
  if (movement?.legalForm?.endedBy !== undefined) return { kind: "recorded" };
  const progression = formProgression(movement);
  return progression ? { kind: "progressed", progression } : undefined;
}

/**
 * The typed expiry still in force: the time typed from the form, until a person records the form
 * ended, when it stays only as history (gap list item 5). Never hidden by an inferred end (A1).
 */
export function currentLegalDueAt(movement: Pick<Movement, "legalForm">): Instant | undefined {
  if (movement.legalForm?.endedBy !== undefined) return undefined;
  const dueAt = movement.legalForm?.dueAt;
  // Restored null times must stay unwritten, never become midnight through arithmetic coercion.
  return typeof dueAt === "number" && Number.isFinite(dueAt) ? dueAt : undefined;
}

/**
 * THE CURRENT LEGAL POSITION (demo-data root causes 1.1, K1; clinical check pack A1, Josh 13 Nov
 * 2026). The one reading of a person's legal position that every screen, print and download takes:
 * the status, the form as recorded, whether and how a person recorded it ended, its typed end time
 * as typed, the typed end still in force, and whether a next form is to record.
 *
 * - The form shows as recorded until a person records that it ended. Nothing is inferred from the
 *   examination outcome or an arrival.
 * - The status is the open stay's (the movement's) status. The patient record's own status is read
 *   only when there is no stay: the stay is where the ED and the ward record a change, so it wins.
 *
 * `tests/ward-fix-D-legal-position-guard.test.ts` fails when a listed screen reads the stored form
 * (`legalForm.code`, `.dueAt` or `.endedBy`) instead of this.
 */
export type CurrentLegalPosition = {
  /** The legal status: the stay's, else the patient record's. Undefined when neither is recorded. */
  status: string | undefined;
  /** The form as recorded, or undefined when none is on file. */
  form: LegalForm | undefined;
  /** "Form 3B", or undefined when no form is on file. */
  formWords: string | undefined;
  /** Whether a person recorded the form as ended. Never inferred. */
  ended: boolean;
  /** How a person recorded it ended ("revoked", "form_3e" and so on), when they did. */
  endedBy: LegalFormEnding | undefined;
  /** The end time typed from the form, kept as typed, even after a recorded end (history only). */
  typedEndAt: Instant | undefined;
  /** The typed end time still in force: none once a person recorded the form ended. */
  dueAt: Instant | undefined;
  /** The next form is still to record after the examination or arrival ("Next form to record"). */
  nextForm: FormProgression | undefined;
};

export function currentLegalPosition(
  movement: LegalPositionSource | undefined,
  patientLegalStatus?: string,
): CurrentLegalPosition {
  const form = movement?.legalForm;
  const typed = form?.dueAt;
  return {
    status: movement?.legalStatus ?? patientLegalStatus,
    form,
    formWords: form ? `Form ${form.code}` : undefined,
    ended: form?.endedBy !== undefined,
    endedBy: form?.endedBy,
    typedEndAt: typeof typed === "number" && Number.isFinite(typed) ? typed : undefined,
    dueAt: movement ? currentLegalDueAt(movement) : undefined,
    nextForm: formProgression(movement),
  };
}

/**
 * The short form words every chip and row shares: "Form 3B", or "Form 3B ended" once a person
 * recorded its end, else undefined when no form is on file.
 */
export function legalFormNowWords(movement: LegalPositionSource | undefined): string | undefined {
  const position = currentLegalPosition(movement);
  if (!position.formWords) return undefined;
  return position.ended ? `${position.formWords} ended` : position.formWords;
}
