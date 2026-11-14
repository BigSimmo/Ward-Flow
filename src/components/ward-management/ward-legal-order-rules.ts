/**
 * THE LEGAL ORDER RULES, IN ONE PLACE (D-186 item 5, D-187 item 6, D-189 items 9(c) and 9(g); Q5
 * and Q27 of the clinical sign-off sitting, 13 Nov 2026).
 *
 * Legal pairing and out-of-order problems are warnings, never blocks (Josh, 27 Oct 2026). The record
 * actions and the sample-data check both read `legalRecordWarnings`, so one rule says what warns.
 *
 * - The pairing warning is today's (`legalFormStatusWarning` in `ward-legal-form-fit.ts`): a form
 *   chosen for a Voluntary status, or no form for a status that rests on one. Which other pairings
 *   warn stays open (Q27).
 * - The follow-on warning (D-187 item 6): a form recorded through the app's own continuation action
 *   while no form is on file. For now only that action counts as a follow-on (D-189 item 9(c));
 *   which form codes count as follow-on is Josh's legal call and stays open. No code list is held.
 *
 * Not covered here, and still blocks (D-189 item 9(g)): the typed-time checks ("written later than
 * now", "expiry before written") and the transport chain (book, then handover, then collect). They
 * check data entry and the workflow, not legal order.
 *
 * Synthetic prototype. Labels only, not legal advice.
 */
import { legalFormStatusWarning } from "@/components/ward-management/ward-legal-form-fit";
import { ORDER_ENDING_FORM_CODE } from "@/components/ward-management/ward-legal-form-progression";
import type { Movement } from "@/components/ward-management/ward-model";

export const FOLLOW_ON_WITH_NO_EARLIER_FORM = "A follow-on form is recorded with no earlier form on file";

/** A form about to be recorded through the continuation action (`RECORD_LEGAL_FORM_CONTINUATION`). */
export type PendingContinuation = { continuationFormCode: string };

/**
 * D-187 item 6: a continuation recorded while no form is on file (no current form, so no earlier
 * forms either) warns. Never a refusal: the engine accepts the continuation.
 */
export function followOnFormWarning(
  movement: Pick<Movement, "legalForm">,
  pending: PendingContinuation | undefined,
): string | null {
  if (pending === undefined || pending.continuationFormCode === "") return null;
  // Earlier forms are kept on the current form (`earlierForms`), so no current form means none on file.
  return movement.legalForm !== undefined ? null : FOLLOW_ON_WITH_NO_EARLIER_FORM;
}

/**
 * R-LEGAL-11 (Josh, 14 Nov 2026; AK-L-14, warn and never block): a form about to be recorded while
 * the form on file is a Form 3E, which ended the order before it. Warns in plain words as soon as
 * the form type is chosen; the save still goes ahead. Record a form and the continuation action
 * both read this. Recording a second Form 3E says nothing here.
 */
export function afterEndedOrderWarning(
  movement: Pick<Movement, "legalForm"> | undefined,
  nextFormCode: string | undefined,
): string | null {
  if (!nextFormCode || nextFormCode === ORDER_ENDING_FORM_CODE) return null;
  if (movement?.legalForm?.code !== ORDER_ENDING_FORM_CODE) return null;
  return `Form 3E is already recorded for this person. Check the paper. If Form ${nextFormCode} is right, save it.`;
}

/**
 * Every legal order warning for a movement, in a fixed order: the pairing warning, the follow-on
 * warning, then the after-Form-3E warning. With `pending`, the form about to be recorded is read as
 * the movement's form.
 */
export function legalRecordWarnings(
  movement: Pick<Movement, "legalStatus" | "legalForm">,
  pending?: PendingContinuation,
): string[] {
  const formCode = pending?.continuationFormCode || movement.legalForm?.code || null;
  return [
    legalFormStatusWarning(movement.legalStatus, formCode),
    followOnFormWarning(movement, pending),
    afterEndedOrderWarning(movement, pending?.continuationFormCode),
  ].filter((warning): warning is string => warning !== null);
}
