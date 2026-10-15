import { DUE_SOON_MINUTES, DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

/**
 * Minutes elapsed since midnight on the synthetic operating day.
 *
 * The whole model stores durations rather than fixed times so the board can tick. This is
 * the ONLY module permitted to read the wall clock: everything else receives `now` as a
 * parameter, which is what keeps tests and screenshots deterministic.
 */
/**
 * A point on the demo's timeline, in minutes, counted from midnight at the start of the day the
 * demonstration opened.
 *
 * IT IS NOT A TIME OF DAY, and reading it as one is the defect this comment exists to stop. Day 0 is
 * the opening day, so 642 is 10:42 that morning; 2082 is 10:42 the NEXT morning; and -798 is 10:42
 * the morning BEFORE. `ward-admissions-seed.ts` has always relied on this - `arrivedAt` for someone
 * admitted four days ago is `ANCHOR - 4 * MINUTES_PER_DAY`, a large negative number - and
 * `daysInBed` divides the difference by `MINUTES_PER_DAY` to count days.
 *
 * The value therefore has TWO parts, and code that needs one must not read the other: `dayOf` for
 * which day, `minuteOfDay` for the clock face. Differences between two instants are plain
 * subtraction and are correct across any number of days.
 */
export type Instant = number;

export type ClockState = "breached" | "critical" | "due" | "clear";

/** Minutes in a day. `wallClockNow()` wraps to 0 at 24:00, so anything that measures elapsed
 * time across two of its readings has to know this to unwrap the rollover. */
export const MINUTES_PER_DAY = 24 * 60;

export function wallClockNow(): Instant {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * NO LONGER USED BY THE PROVIDER, and kept rather than removed on purpose.
 *
 * The provider now reads `absoluteWallClockMinutes()`, so elapsed time is a plain subtraction and the
 * midnight rollover this unwraps cannot arise there. What is left is still a correct utility for the
 * genuine minute-of-day case, and its tests pin the boundary behaviour that took a real defect to
 * find. Removing an exported symbol in this repository goes through `check:dead-code-candidate`
 * rather than through a judgement that nothing imports it - "nothing imports it" is necessary and
 * nowhere near sufficient here, and four survivors of one cleanup sweep had zero importers and were
 * all alive. Flagged for that gate rather than quietly taken out in a commit about clocks.
 */
/**
 * Minutes elapsed between two `wallClockNow()` readings — a mount instant and a later
 * reading, both already resolved by the caller. `wallClockNow()` wraps to 0 at 24:00: a
 * session mounted late in the day and read again after midnight sees `current < mountedAt`
 * even though real time moved forward, so a plain subtraction goes negative and, clamped at
 * zero, makes the clock look frozen. A negative difference here can only mean the day rolled
 * over exactly once, so add one day's worth of minutes back in. This function never reads the
 * wall clock itself — both instants are supplied by the caller.
 */
export function elapsedMinutesSinceMount(mountedAt: Instant, current: Instant): number {
  const raw = current - mountedAt;
  return raw < 0 ? raw + MINUTES_PER_DAY : raw;
}

/**
 * Minutes since the Unix epoch, counted in LOCAL wall-clock terms.
 *
 * `wallClockNow()` returns a minute of the day and throws the date away, which is why
 * `elapsedMinutesSinceMount` has to guess at midnight: two readings of a 0-1439 counter cannot say
 * how many days apart they are, so a negative difference is ASSUMED to mean exactly one rollover.
 * That assumption holds only because the provider re-reads every thirty seconds, and it is a patch
 * over a missing concept rather than a solution.
 *
 * This carries the date, so the difference between two readings is simply their difference, over any
 * span. Dividing by `MINUTES_PER_DAY` gives the local day, which is what makes "which day is this
 * instant on" answerable at all.
 *
 * Local rather than UTC deliberately: a ward's day starts at local midnight, and a demonstration in
 * Perth that rolled its day over at 08:00 because the epoch is UTC would be wrong in the one way
 * nobody would think to check. The daylight-saving jump is accepted - Western Australia does not
 * observe it, and an hour's discontinuity twice a year is not a risk this prototype carries.
 */
export function absoluteWallClockMinutes(): number {
  const now = new Date();
  return Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 60_000);
}

/** Perth is UTC+8 all year: Western Australia observes no daylight saving. */
export const PERTH_UTC_OFFSET_MINUTES = 8 * 60;
const PERTH_UTC_OFFSET_MS = PERTH_UTC_OFFSET_MINUTES * 60_000;
const MS_PER_DAY = MINUTES_PER_DAY * 60_000;

/**
 * The calendar date that the demo's day 0 falls on - Perth midnight of the Perth day a session opened.
 *
 * An `Instant` counts minutes from this moment, so it and this date together are a real point in
 * time. Held by the provider rather than derived per call: two components computing it separately
 * would disagree across midnight, which is the two-clocks-on-one-card failure a layer down.
 *
 * L7 (site review, 12 Oct 2026): Perth midnight, not the browser's. Every printed date is formatted
 * in Australia/Perth and every clock face is read as AWST, so a day 0 at the browser's own midnight
 * printed the wrong day outside Perth (a 01:00 Monday event read as Sunday under a Sydney clock).
 */
export function demoDayZero(openedAt: Date): Date {
  const perthMs = openedAt.getTime() + PERTH_UTC_OFFSET_MS;
  const perthMidnight = perthMs - (((perthMs % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY);
  return new Date(perthMidnight - PERTH_UTC_OFFSET_MS);
}

/** Perth midnight at the start of a Perth calendar day (`monthIndex` 0-11), as a real moment. */
export function perthMidnight(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day) - PERTH_UTC_OFFSET_MS);
}

/** The Perth calendar day (and weekday, 0 Sunday) a real moment falls on, whatever the browser's zone. */
export function perthCalendarDay(date: Date): { year: number; monthIndex: number; day: number; weekday: number } {
  const shifted = new Date(date.getTime() + PERTH_UTC_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * A `datetime-local` value ("2026-10-12T14:30") read as Perth wall time, or undefined when it is not
 * a well-formed, real date and time. `new Date(value)` reads it in the browser's zone instead (L7).
 */
export function perthDateTimeLocal(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [year, month, day, hours, minutes] = match.slice(1).map(Number) as [number, number, number, number, number];
  if (hours > 23 || minutes > 59) return undefined;
  const midnight = perthMidnight(year, month - 1, day);
  const read = perthCalendarDay(midnight);
  if (read.year !== year || read.monthIndex !== month - 1 || read.day !== day) return undefined;
  return new Date(midnight.getTime() + (hours * 60 + minutes) * 60_000);
}

/** The real calendar moment an instant refers to, given the day 0 the session opened on. */
export function calendarDateOf(instant: Instant, dayZero: Date): Date {
  return new Date(dayZero.getTime() + instant * 60_000);
}

/**
 * An instant, with its day said out loud whenever it is not today.
 *
 * `formatInstant` renders a bare clock face, which silently ASSERTS today - a patient who arrived
 * three days ago reads as "14:00" and looks like this morning. That is the defect: not the wrapping
 * itself, but a display making a claim about the day without checking it. Anything that may fall on
 * another day uses this.
 *
 * Relative wording rather than a date because the reader is oriented to now rather than to a
 * calendar. A date belongs only where somebody would say one aloud.
 */
/**
 * A moment written out in full — weekday, date and clock face — for something that will be PRINTED.
 *
 * `formatInstant` gives a bare clock face and `formatInstantWithDay` gives one relative to now
 * ("yesterday", "in 2 days"). Both are right on screen and both are wrong on paper: a sheet
 * outlives the day it was taken on, and "14:32" or "14:32 yesterday" on a printed handover cannot
 * say which day it means once it has been carried out of the room.
 *
 * Takes `dayZero` because an `Instant` is an offset, not a moment — see `calendarDateOf`.
 */
export function formatSheetMoment(instant: Instant, dayZero: Date): string {
  const date = calendarDateOf(instant, dayZero);
  const day = date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Perth",
  });
  return `${day}, ${formatInstant(instant)}`;
}

export function formatInstantWithDay(instant: Instant, now: Instant): string {
  const clockFace = formatInstant(instant);
  const dayDifference = dayOf(instant) - dayOf(now);
  if (dayDifference === 0) return clockFace;
  if (dayDifference === -1) return `${clockFace} yesterday`;
  if (dayDifference === 1) return `${clockFace} tomorrow`;
  if (dayDifference < -1) return `${clockFace}, ${Math.abs(dayDifference)} days ago`;
  return `${clockFace}, in ${dayDifference} days`;
}

export function minutesUntil(due: Instant, now: Instant) {
  return due - now;
}

/**
 * The two warnings before a recorded legal due time, in minutes. Josh's defaults (1 hour and 3
 * hours), changeable in Settings (26 Sept 2026, "All yes", question 3). `WardFlowProvider` applies
 * `state.configuration`'s values here whenever they change, so every screen and derivation that
 * calls `clockState` reads the same thresholds without each one threading the configuration
 * through. Outside a provider (unit tests of pure functions) the defaults hold.
 */
let dueSoonThresholds = { urgentMinutes: DUE_SOON_URGENT_MINUTES, soonMinutes: DUE_SOON_MINUTES };

export function applyDueSoonThresholds(urgentMinutes: number, soonMinutes: number): void {
  if (dueSoonThresholds.urgentMinutes === urgentMinutes && dueSoonThresholds.soonMinutes === soonMinutes) return;
  dueSoonThresholds = { urgentMinutes, soonMinutes };
}

export function currentDueSoonThresholds(): { urgentMinutes: number; soonMinutes: number } {
  return dueSoonThresholds;
}

export function clockState(due: Instant, now: Instant): ClockState {
  const remaining = minutesUntil(due, now);
  if (!Number.isFinite(remaining)) return "due";
  if (remaining < 0) return "breached";
  // The 1-hour and 3-hour warnings are Josh's defaults, not legal limits (26 Sept 2026 card).
  // Inclusive at each threshold (audit A3-4, 13 Oct 2026): exactly 60m left is act now on every
  // page, matching the Delays board's `dueTone`/`isDueSoon`, so Forms and Delays never disagree.
  if (remaining <= dueSoonThresholds.urgentMinutes) return "critical";
  if (remaining <= dueSoonThresholds.soonMinutes) return "due";
  return "clear";
}

/** Which day of the demo an instant falls on. 0 is the opening day, -1 the day before, 1 the next. */
export function dayOf(instant: Instant): number {
  return Math.floor(instant / MINUTES_PER_DAY);
}

/** The clock face of an instant, 0-1439, with the day discarded. */
export function minuteOfDay(instant: Instant): number {
  return ((instant % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Whole days from one instant to another, floored - the same count `daysInBed` produces. */
export function daysBetween(from: Instant, to: Instant): number {
  return Math.floor((to - from) / MINUTES_PER_DAY);
}

/**
 * A length of time, in the units a person would actually say it in.
 *
 * Under an hour: minutes. Under a day: hours and minutes. A day or more: DAYS and hours, because
 * beyond that scale minutes are noise nobody reads.
 *
 * The last part is a fix rather than a preference. This function used to return hours however large
 * the number got, and the out-of-area screen rendered seeded stays of one to two hundred days as
 * everything from `25h 30m` to `5041h 30m` - every figure correct, every figure unreadable, and the
 * whole suite green, because no assertion was ever about the format. That screen was repaired on its
 * own by switching to a day count; every other screen kept calling this and kept the defect. Fixing
 * it here is what makes a wait longer than a day readable everywhere at once.
 */
export function splitDuration(totalMinutes: number) {
  if (totalMinutes >= MINUTES_PER_DAY) {
    const days = Math.floor(totalMinutes / MINUTES_PER_DAY);
    const hours = Math.floor((totalMinutes % MINUTES_PER_DAY) / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function formatRemaining(minutes: number) {
  if (minutes < 0) return `${splitDuration(Math.abs(minutes))} overdue`;
  return `${splitDuration(minutes)} left`;
}

/**
 * Formats a duration that has already elapsed (e.g. time since a movement opened).
 * `formatRemaining` is a countdown formatter — "left"/"overdue" against a future deadline —
 * and must not be reused for elapsed time, which has no deadline to be overdue against.
 */
export function formatElapsed(minutes: number) {
  return `${splitDuration(Math.max(minutes, 0))} waiting`;
}

/**
 * A synthetic movement can be authored with a negative instant (e.g. `openedAt` computed
 * before the day began) — this must still render as a valid wall-clock time rather than
 * `-1:-14`, so wrap into the 0–1439 range before splitting into hours and minutes.
 */
export function formatInstant(instant: Instant) {
  const wrapped = ((instant % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * A typed 24-hour clock time as minutes since midnight (0 to 1439), or `undefined`.
 *
 * Takes "09:30" and "9:30", and four digits ("0930") too, because the iPhone number pad has no
 * ":" key. Digits only must be four: "143" could be 01:43 or a dropped digit from 14:30, so it is
 * refused like "14:3", "14", "24:00" and "9h30". A half-typed time never becomes a time nobody typed.
 */
export function minuteOfDayFromClockText(text: string): number | undefined {
  const match = /^(?:(\d{1,2}):(\d{2})|(\d{2})(\d{2}))$/.exec(text.trim());
  if (!match) return undefined;
  const hours = Number(match[1] ?? match[3]);
  const minutes = Number(match[2] ?? match[4]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}
