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
};

/** Forms that authorise an inpatient stay already: nothing to move on to. */
const INPATIENT_ORDER_CODES: readonly string[] = ["6A", "6B", "6C", "5A", "5B"];

export function formProgression(movement: Movement | undefined): FormProgression | undefined {
  const code = movement?.legalForm?.code;
  if (!movement || code === undefined || INPATIENT_ORDER_CODES.includes(code)) return undefined;
  if (movement.legalStatus === "Voluntary") return undefined;
  if (movement.closure?.outcome === "arrived") return { endedCode: code, endedWhen: "at arrival", nextCode: "6A" };
  if (movement.examination?.outcome === "inpatient_order")
    return { endedCode: code, endedWhen: "at the examination", nextCode: "6A" };
  return undefined;
}

/** The finite recorded expiry still in force; ended forms retain their expiry only as history. */
export function currentLegalDueAt(movement: Movement): Instant | undefined {
  if (formProgression(movement) !== undefined) return undefined;
  const dueAt = movement.legalForm?.dueAt;
  // Restored null times must stay unwritten, never become midnight through arithmetic coercion.
  return typeof dueAt === "number" && Number.isFinite(dueAt) ? dueAt : undefined;
}
