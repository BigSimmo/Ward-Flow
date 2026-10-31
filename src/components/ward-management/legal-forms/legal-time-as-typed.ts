import { formatInstantWithDay, type Instant, isClockBreached } from "@/components/ward-management/ward-clock";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { LegalForm } from "@/components/ward-management/ward-model";

/**
 * LEGAL FORM TIMES ONLY AS TYPED (Josh, 31 Oct 2026; replaces D-71 item 5; D5 and D-70 hold).
 *
 * A legal form's time is shown only as the clock time a person typed from the form: "Ends 15:42
 * as typed" or, once that time has gone by, "Ended 15:42 as typed". It is never turned into a
 * running figure: no "3h 20m left", "due in 2h", "passed 1h 05m ago", "1h 15m overdue", age since
 * the typed time, or bar filling towards it. Staff read the typed time against the paper form, so
 * a figure worked out from it is a second, unchecked number beside the legal one.
 *
 * Colour stays: a typed time may carry the user's own warning settings ("within 1h", "within 3h",
 * "passed"), always as words beside the colour, never as a count. Bed pull limits, transport waits
 * and decision targets are not legal times and keep their own wording.
 *
 * The colour words come from `typedTimeStanding` in ./legal-forms-view. Every screen reads these
 * helpers, and `tests/ward-legal-as-typed-guard.test.ts` keeps duration
 * formatters away from legal times across `src/components/ward-management/`.
 */

/** "15:42", "15:42 yesterday" or "15:42 tomorrow": the typed clock time, with the day when not today. */
export function typedClock(dueAt: Instant, now: Instant): string {
  return formatInstantWithDay(dueAt, now);
}

/** "Ends 15:42 as typed", or "Ended 15:42 as typed" once the typed time has gone by. */
export function typedTimeLine(dueAt: Instant, now: Instant): string {
  return `${isClockBreached(dueAt, now) ? "Ended" : "Ends"} ${typedClock(dueAt, now)} as typed`;
}

/** The same words for the middle of a sentence: "ends 15:42 as typed" or "ended 15:42 as typed". */
export function typedTimePhrase(dueAt: Instant, now: Instant): string {
  return `${isClockBreached(dueAt, now) ? "ended" : "ends"} ${typedClock(dueAt, now)} as typed`;
}

/**
 * "Form 4C (Transfer order) · ends 15:42 as typed", or "· no expiry recorded from the form" when
 * none was typed. The full form name, never a shortened code on its own.
 */
export function formTimeAsTyped(legalForm: LegalForm, now: Instant): string {
  if (legalForm.dueAt === undefined) return `${legalFormName(legalForm)} · no expiry recorded from the form`;
  return `${legalFormName(legalForm)} · ${typedTimePhrase(legalForm.dueAt, now)}`;
}
