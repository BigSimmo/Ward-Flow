import type { Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * THE FORM MOVES ON AFTER THE EXAMINATION OR THE ARRIVAL (audit S-6, 13 Oct 2026).
 *
 * The engine changes a form only when a clinician records one (`RECORD_EXAMINATION` keeps the 1A,
 * by owner ruling). So once an inpatient treatment order is recorded at the examination, or a
 * person on an order arrives on the ward, the referral, detention or transport form on the
 * movement no longer describes their authority. This reads that from the record and names the one
 * form to record next. Josh's default (13 Oct 2026): a single "Record Form 6A" prompt, with the old
 * form shown as ended. It computes no legal time and cites no section.
 */
export type FormProgression = {
  /** The form now ended, "4C". */
  endedCode: string;
  /** When it ended, in words: "at arrival" or "at the examination". */
  endedWhen: string;
  /** The form to record next. */
  nextCode: "6A";
  /**
   * Whether the record shows the form ended. A community treatment order (5A, 5B) is not shown as
   * ended at arrival: arrival alone does not end it, so screens use neutral wording (D-127).
   */
  ended: boolean;
};

const COMMUNITY_ORDER_CODES: readonly string[] = ["5A", "5B"];

/** "Form 4C ended at arrival", or for a community treatment order "On Form 5A at arrival" (D-127). */
export function formProgressionPhrase(progression: FormProgression): string {
  return progression.ended
    ? `Form ${progression.endedCode} ended ${progression.endedWhen}`
    : `On Form ${progression.endedCode} ${progression.endedWhen}`;
}

/** The short form of the same: "Ended at arrival", or "On this form at arrival" (D-127). */
export function formProgressionShort(progression: FormProgression): string {
  return progression.ended ? `Ended ${progression.endedWhen}` : `On this form ${progression.endedWhen}`;
}

/**
 * Forms that authorise an inpatient stay already: nothing to move on to. Forms 5A and 5B are
 * community treatment orders in the register, not inpatient orders, so a person on one who
 * arrives on the ward still gets the "Record Form 6A" prompt (M117, D-123).
 */
const INPATIENT_ORDER_CODES: readonly string[] = ["6A", "6B", "6C"];

export function formProgression(movement: Movement | undefined): FormProgression | undefined {
  const code = movement?.legalForm?.code;
  if (!movement || code === undefined || INPATIENT_ORDER_CODES.includes(code)) return undefined;
  if (movement.legalStatus === "Voluntary") return undefined;
  if (movement.examination?.outcome === "inpatient_order")
    return { endedCode: code, endedWhen: "at the examination", nextCode: "6A", ended: true };
  if (movement.closure?.outcome === "arrived")
    return { endedCode: code, endedWhen: "at arrival", nextCode: "6A", ended: !COMMUNITY_ORDER_CODES.includes(code) };
  return undefined;
}

// The ended-form words live at the ward root so screens share them without importing each other.
export { FORM_RECORDED_ENDED, formRecordedEnded } from "@/components/ward-management/ward-legal-form-ended";

/** The finite recorded expiry still in force; ended forms retain their expiry only as history. */
export function currentLegalDueAt(movement: Movement): Instant | undefined {
  if (formProgression(movement) !== undefined) return undefined;
  // Gap list item 5: a form a person recorded as ended keeps its typed expiry as history only.
  if (movement.legalForm?.endedBy !== undefined) return undefined;
  const dueAt = movement.legalForm?.dueAt;
  // Restored null times must stay unwritten, never become midnight through arithmetic coercion.
  return typeof dueAt === "number" && Number.isFinite(dueAt) ? dueAt : undefined;
}
