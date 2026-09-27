import { MINUTES_PER_DAY, dayOf, type Instant } from "@/components/ward-management/ward-clock";

/**
 * Task F1 (owner answer 32): a bed-release or leave-bed time is typed with a Today/Tomorrow
 * choice beside it, never with the day left implicit. "Tomorrow" means the next CALENDAR day —
 * the owner's own words — not "24 hours from now".
 */
export type ReleaseDay = "today" | "tomorrow";

/** Rendered in this fixed order; the chooser is exactly these two options, never free text. */
export const RELEASE_DAYS: readonly ReleaseDay[] = ["today", "tomorrow"];

/**
 * Parses an `<input type="time">`'s `HH:MM` value into a minute-of-day, 0-1439. Malformed or
 * empty text refuses rather than guesses — same discipline the function this replaces used.
 */
function parseTimeInputToMinuteOfDay(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * Resolves a typed `HH:MM` plus a Today/Tomorrow choice against the live clock into an `Instant`.
 *
 * ⚠️ **THE BUILD PLAN'S OWN FIGURES ASSUME "minutes since day zero's midnight", AND THAT IS NOT
 * WHAT "TODAY" MEANS HERE.** `Instant` (`ward-clock.ts`) already counts minutes from day zero's
 * midnight — `dayOf(instant) * MINUTES_PER_DAY + minuteOfDay`, with day zero the session's opening
 * day. A chooser that read "Today" as literally day zero would be correct only on the opening
 * day; the moment the demo clock rolls past midnight once, `dayOf(now)` is 1 and a "Today" release
 * flagged from THIS screen must land on day 1, not day 0 — otherwise it reads as a release that
 * already happened yesterday. So "today" is resolved against the clock's OWN current day,
 * `dayOf(now)`, and "tomorrow" is one calendar day past that — never a fixed day zero, and never
 * "now plus 24 hours" (a 09:00 pick 23 hours after a 10:00 "now" is still tomorrow, not today).
 *
 * The task brief's own worked example is the proof: clock on day 1 at 10:00 (`now = 2040`),
 * "Today" 14:00 must resolve to `1 * MINUTES_PER_DAY + 840 = 2280` — day 1, the clock's day, not
 * day 0 — and "Tomorrow" 09:00 to `2 * MINUTES_PER_DAY + 540 = 3420`.
 *
 * Returns `undefined` for an empty or malformed time, exactly like the function this replaces.
 */
export function parseReleaseDayInstant(now: Instant, day: ReleaseDay, value: string): Instant | undefined {
  const minuteOfDay = parseTimeInputToMinuteOfDay(value);
  if (minuteOfDay === undefined) return undefined;
  const targetDay = dayOf(now) + (day === "tomorrow" ? 1 : 0);
  return targetDay * MINUTES_PER_DAY + minuteOfDay;
}

/**
 * True when the typed time, resolved against `day`, already falls before `now` — the case the
 * release/leave forms warn about rather than silently accept ("That time has already passed
 * today, so this bed will show as due now."). Undefined/malformed input reports false: there is
 * nothing to warn about yet, and the submit itself still refuses via `parseReleaseDayInstant`.
 *
 * A "tomorrow" choice can never trip this: the earliest tomorrow instant (`dayOf(now) + 1` at
 * minute 0) is always later than `now`, whose minute-of-day is at most 1439 on `dayOf(now)`.
 */
export function releaseTimeAlreadyPassed(now: Instant, day: ReleaseDay, value: string): boolean {
  const resolved = parseReleaseDayInstant(now, day, value);
  return resolved !== undefined && resolved < now;
}
