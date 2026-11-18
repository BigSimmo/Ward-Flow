import { WARD_CLOSURE_REASONS, wardClosureReasonLabel, type WardClosureReason } from "./capacity/ward-closure";

/** Re-exported for the bed's History and closure controls, so the ward screen reads closure words through one file. */
export { WARD_CLOSURE_REASONS, wardClosureReasonLabel, type WardClosureReason };

/**
 * D-148 (Josh, 11 Nov 2026) gave a closing bed an optional reason from the same list a ward closure
 * uses (`WARD_CLOSURE_REASONS`), and nothing typed is ever stored. A14-19 (Josh, 18 Nov 2026, D-263):
 * the reason is asked as the bed closes, with Not given, so it stays two taps. The close then
 * carries its reason in one `SET_BED_CLOSED` step with the normal Undo; the toast no longer offers
 * "Add a reason". A bed closed with Not given can still have one added from its drawer (R-BEDS-4).
 */

/** "Bed 07": the bed's number as the drawer writes it, so a toast and the drawer agree (R-BEDS-4). */
export const bedLabel = (bedNumber: number) => `Bed ${String(bedNumber).padStart(2, "0")}`;
