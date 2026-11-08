/**
 * The see-by time (Josh approved, 9 Nov 2026): once the clinician picks an urgency, the clock time
 * the person needs to be seen by, counted from the reviewed time with the tier's window. Arithmetic
 * only: it never suggests a tier, and F (recontact) and G (no action) have no time. Synthetic data.
 */
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

import type { Tier } from "./triage-record";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Each tier's window in milliseconds; A is immediate; F and G have none. */
const WINDOW: Readonly<Partial<Record<Tier, number>>> = {
  A: 0,
  B: CLINICAL_VALUES.triageUrgencyB.value * HOUR,
  C: CLINICAL_VALUES.triageUrgencyC.value * HOUR,
  D: CLINICAL_VALUES.triageUrgencyD.value * HOUR,
  E: CLINICAL_VALUES.triageUrgencyE.value * DAY,
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "DD/MM/YYYY HH:MM" as a wall-clock time held in UTC fields, or null when it is not a whole, real
 * date and time. UTC has no daylight saving, so the same review gives the same see-by time on every
 * device, whatever its timezone.
 */
function parseStamp(text: string): Date | null {
  const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!match) return null;
  const [day, month, year, hour, minute] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (hour > 23 || minute > 59 || date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;
  return date;
}

const sameDay = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type SeeBy = {
  /** "12:42 today", "09:15 tomorrow", "Mon 23 Nov 10:42" or "Now". */
  when: string;
  /** "B, within 2 hours of review at 10:42". */
  basis: string;
};

/**
 * The see-by time for an urgency and a reviewed time ("DD/MM/YYYY HH:MM", wall clock). `today` is
 * the board's wall-clock now, for "today" and "tomorrow". Null when there is no urgency, the tier
 * has no window, or the reviewed time is not set.
 */
export function seeBy(urgency: Tier | null, reviewed: string, today: Date, long: string): SeeBy | null {
  if (!urgency) return null;
  const window = WINDOW[urgency];
  if (window === undefined) return null;
  if (window === 0) return { when: "Now", basis: `A, ${long.toLowerCase()}` };
  const start = parseStamp(reviewed);
  if (!start) return null;
  const at = new Date(start.getTime() + window);
  const two = (n: number) => String(n).padStart(2, "0");
  const clock = `${two(at.getUTCHours())}:${two(at.getUTCMinutes())}`;
  // `today` is the board's wall clock as a local Date; carry its fields into the same UTC frame.
  const todayWall = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const tomorrow = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  const day = sameDay(at, todayWall)
    ? `${clock} today`
    : sameDay(at, tomorrow)
      ? `${clock} tomorrow`
      : `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${clock}`;
  const reviewedClock = `${two(start.getUTCHours())}:${two(start.getUTCMinutes())}`;
  return { when: day, basis: `${urgency}, ${long.toLowerCase()} of review at ${reviewedClock}` };
}
