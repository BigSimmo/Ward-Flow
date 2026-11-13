import {
  dayOf,
  formatInstant,
  type Instant,
  isClockBreached,
  perthDayLabel,
} from "@/components/ward-management/ward-clock";
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
 * formatters, and the relative `formatInstantWithDay`, away from legal times across
 * `src/components/ward-management/`.
 *
 * Every helper takes the board's `dayZero` (passed in, never read from a module) so a typed time on
 * another day prints the Perth calendar date the form carries: "Ended Tue 10 Nov 15:42 as typed",
 * never "15:42, 3 days ago" (time audit D1, 13 Nov 2026; D-93). Without a `dayZero` it says only
 * "on an earlier day" or "on a later day", still never an age.
 */

/**
 * "15:42", "15:42 yesterday", "15:42 tomorrow" or "Tue 10 Nov 15:42": the typed clock time, with the
 * day when not today. Day names for the next and previous day, the calendar date for any other day.
 */
export function typedClock(dueAt: Instant, now: Instant, dayZero: Date | undefined): string {
  const { clock, day, dayFirst } = typedClockParts(dueAt, now, dayZero);
  if (!day) return clock;
  return dayFirst ? `${day} ${clock}` : `${clock} ${day}`;
}

/**
 * The same typed time in two parts, for a screen that sets the clock face large with its day beside
 * it: `day` is "", "yesterday", "tomorrow", "Tue 10 Nov" (`dayFirst`) or "on an earlier day".
 */
export function typedClockParts(
  typedAt: Instant,
  now: Instant,
  dayZero: Date | undefined,
): { clock: string; day: string; dayFirst: boolean } {
  // The day is always said beside this clock face when it is not today, so it never asserts today.
  const clock = formatInstant(typedAt);
  const days = dayOf(typedAt) - dayOf(now);
  if (days === 0) return { clock, day: "", dayFirst: false };
  if (days === -1 || days === 1) return { clock, day: days < 0 ? "yesterday" : "tomorrow", dayFirst: false };
  if (dayZero) return { clock, day: perthDayLabel(typedAt, dayZero), dayFirst: true };
  return { clock, day: `on ${days < 0 ? "an earlier" : "a later"} day`, dayFirst: false };
}

/** "Ends 15:42 as typed", or "Ended 15:42 as typed" once the typed time has gone by. */
export function typedTimeLine(dueAt: Instant, now: Instant, dayZero: Date | undefined): string {
  return `${isClockBreached(dueAt, now) ? "Ended" : "Ends"} ${typedClock(dueAt, now, dayZero)} as typed`;
}

/** The same words for the middle of a sentence: "ends 15:42 as typed" or "ended 15:42 as typed". */
export function typedTimePhrase(dueAt: Instant, now: Instant, dayZero: Date | undefined): string {
  return `${isClockBreached(dueAt, now) ? "ended" : "ends"} ${typedClock(dueAt, now, dayZero)} as typed`;
}

/**
 * "Form 4C (Transfer order) · ends 15:42 as typed", or "· no expiry recorded from the form" when
 * none was typed. The full form name, never a shortened code on its own.
 */
export function formTimeAsTyped(legalForm: LegalForm, now: Instant, dayZero: Date | undefined): string {
  if (legalForm.dueAt === undefined) return `${legalFormName(legalForm)} · no expiry recorded from the form`;
  return `${legalFormName(legalForm)} · ${typedTimePhrase(legalForm.dueAt, now, dayZero)}`;
}

/**
 * The one key line a page carries near a list of typed legal times, word for word wherever it shows
 * (Josh, 30 Oct 2026): the colour compares the typed time with the clock and is not a legal check.
 */
export const TYPED_TIME_KEY = "Colours compare the time as typed with the clock. Not legally checked.";
