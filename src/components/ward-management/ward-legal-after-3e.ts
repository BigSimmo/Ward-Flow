/**
 * FORMS AFTER A FORM 3E (D-226, Josh, 14 Nov 2026).
 *
 * A recorded Form 3E ("Order that person cannot continue to be detained") ends the order before it
 * for counts and screens (R-LEGAL-12). On top of that, a continuation-type form recorded after a 3E
 * is refused, because there is no order left for it to continue. A form that starts a new order is
 * accepted. A coordinator may still record it by picking a reason from a fixed list (never typed
 * text on a legal record); the reason shows in History.
 *
 * A continuation-type form with no earlier order on file is not covered here: it stays a warning
 * only (`followOnFormWarning`), as someone may arrive with a paper from another hospital.
 *
 * Synthetic prototype. Labels only, not legal advice.
 */
import type { LegalClockFormCode } from "@/components/ward-management/ward-legal-clock";
import {
  currentLegalPosition,
  ORDER_ENDING_FORM_CODE,
  type LegalPositionSource,
} from "@/components/ward-management/ward-legal-form-progression";

/** The continuation-type forms refused after a Form 3E. Every other recognised code starts a new order. */
export const FORMS_REFUSED_AFTER_3E: readonly LegalClockFormCode[] = ["3C", "5B", "6C", "6D"];

/** The reasons a coordinator may pick to record a refused form after a 3E, with their History words. */
export const AFTER_3E_REASONS = {
  new_order_made: "Paper checked: new order made",
  form_3e_in_error: "Form 3E recorded in error",
  other_see_paper: "Other, see paper",
} as const;

export type After3EReason = keyof typeof AFTER_3E_REASONS;

export function isAfter3EReason(value: unknown): value is After3EReason {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(AFTER_3E_REASONS, value);
}

/** The words shown when a form is refused after a 3E. */
export const AFTER_3E_REFUSAL = "Form 3E is recorded. Record the form that starts a new order.";

/**
 * Whether recording `code` now would be refused because the form on file is a Form 3E. Reads the
 * one current legal position (`currentLegalPosition`).
 */
export function refusedAfter3E(movement: LegalPositionSource | undefined, code: string): boolean {
  return (
    currentLegalPosition(movement).form?.code === ORDER_ENDING_FORM_CODE &&
    (FORMS_REFUSED_AFTER_3E as readonly string[]).includes(code)
  );
}
