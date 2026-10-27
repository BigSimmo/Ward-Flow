/**
 * H-0839 (wording audit WL-47): what a person reads when the workflow refuses a change.
 *
 * The reducer's reasons and the event types it records stay exactly as they are: tests, the audit
 * trail and the engine read them. Some of them are written for developers ("RECORD_REPATRIATION
 * mode must be chosen from REPATRIATION_MODES", "CONFIRM_CAPACITY on unit X is stale: expected
 * revision 4, current 5"). Screens pass a reason and an event type through these two functions, so
 * no event code, field name or revision number reaches the screen.
 */

/** An event type or a constant's name, such as `CONFIRM_CAPACITY` or `REPATRIATION_MODES`. */
const CODE_NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;
/** A field name, such as `homeHospital` or `inboxItemId`. */
const FIELD_NAME = /\b[a-z]+[A-Z][A-Za-z0-9]*\b/;
/** The event type the engine puts at the start of many reasons. */
const LEADING_CODE = /^\s*[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b[\s:]*/;
/** A save that lost a race: "is stale: expected revision 4, current 5". */
const STALE = /\bis stale\b|\bexpected revision\b/i;

/** Said in place of a reason that someone else's change overtook. */
export const REFUSAL_CHANGED_FIRST = "Someone else changed this first. Check the board and try again";
/** Said in place of a reason written for developers. */
export const REFUSAL_NOT_RECORDABLE = "Ward Flow could not record this change. Check the board and try again";

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A refusal reason with no event code, field name or revision number. A plain reason keeps its own
 * words and case; a screen that starts a sentence with it capitalises it there.
 */
export function refusalReasonText(reason: string): string {
  if (STALE.test(reason)) return REFUSAL_CHANGED_FIRST;
  const rest = reason.replace(LEADING_CODE, "");
  if (rest.trim() === "" || CODE_NAME.test(rest) || FIELD_NAME.test(rest)) return REFUSAL_NOT_RECORDABLE;
  return rest;
}

/** The refused action in words: `CONFIRM_CAPACITY` reads "Confirm capacity". */
export function refusedActionText(attempted: string): string {
  if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(attempted)) return attempted;
  return capitalised(attempted.toLowerCase().split("_").join(" "));
}
