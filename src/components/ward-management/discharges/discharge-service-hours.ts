import {
  MINUTES_PER_DAY,
  calendarDateOf,
  dayOf,
  minuteOfDay,
  perthCalendarDay,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { WA_PUBLIC_HOLIDAYS } from "@/components/ward-management/wa-public-holidays";
import type { DischargeDependencyOwner } from "./discharge-dependencies";

/**
 * ⚠️ **REFERENCE DATA TO CHECK — NOT A LIVE TIMETABLE.** Closing-the-loop package B (24 Oct 2026).
 *
 * The opening hours below are SYNTHETIC: invented, plausible hours for a prototype, not any real
 * hospital's. The public holiday dates are public facts for Western Australia, kept in
 * `wa-public-holidays.ts`.
 *
 * Used only to say, on the discharges board, which outstanding items belong to a service that is
 * about to close over a weekend or public holiday. It decides nothing and changes no order.
 */

/** Opening hours for one weekday, as minutes after midnight (Perth time). `null` means closed. */
type DayHours = { readonly opens: number; readonly closes: number } | null;

/** Sunday first, as `Date.getUTCDay()` counts. */
type WeeklyHours = readonly [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

const weekdays = (opens: number, closes: number, saturday: DayHours = null): WeeklyHours => [
  null,
  { opens, closes },
  { opens, closes },
  { opens, closes },
  { opens, closes },
  { opens, closes },
  saturday,
];

/** Synthetic hours. `"always"` is a service that never closes (the ward team). */
const SYNTHETIC_SERVICE_HOURS: Record<DischargeDependencyOwner, WeeklyHours | "always"> = {
  ward: "always",
  pharmacy: weekdays(8 * 60 + 30, 17 * 60, { opens: 9 * 60, closes: 12 * 60 }),
  patient_transport: weekdays(7 * 60, 19 * 60, { opens: 8 * 60, closes: 14 * 60 }),
  social_work: weekdays(8 * 60 + 30, 16 * 60 + 30),
  community_team: weekdays(8 * 60 + 30, 17 * 60),
};

/** The Perth calendar date and weekday of a whole demo day (`dayOf` numbering). */
function calendarOfDay(day: number, dayZero: Date) {
  const {
    year,
    monthIndex,
    day: date,
    weekday,
  } = perthCalendarDay(calendarDateOf(day * MINUTES_PER_DAY + MINUTES_PER_DAY / 2, dayZero));
  const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
  return { iso, weekday };
}

/** Why a whole day has no hours: a public holiday's name, or "Weekend". `null` when it has hours. */
function closedDayReason(owner: DischargeDependencyOwner, day: number, dayZero: Date): string | null {
  const hours = SYNTHETIC_SERVICE_HOURS[owner];
  if (hours === "always") return null;
  const { iso, weekday } = calendarOfDay(day, dayZero);
  const holiday = WA_PUBLIC_HOLIDAYS.find((entry) => entry.date === iso);
  if (holiday) return holiday.name;
  return hours[weekday] === null ? "Weekend" : null;
}

function hoursOn(owner: DischargeDependencyOwner, day: number, dayZero: Date): DayHours {
  const hours = SYNTHETIC_SERVICE_HOURS[owner];
  if (hours === "always" || closedDayReason(owner, day, dayZero) !== null) return null;
  return hours[calendarOfDay(day, dayZero).weekday] ?? null;
}

export type ServiceClosure = {
  readonly owner: DischargeDependencyOwner;
  /** When it closes, or `null` when it is already closed. */
  readonly closesAt: Instant | null;
  /** When it next opens. */
  readonly reopensAt: Instant;
  /** The closed days in between, in order: "Weekend", or a holiday's name. Never empty. */
  readonly closedFor: readonly string[];
};

/** How far ahead the board looks for the next weekend or holiday closure. */
const CLOSURE_LOOKAHEAD_DAYS = 7;

/**
 * The service's next closure that runs over at least one whole closed day (a weekend or a public
 * holiday), within `CLOSURE_LOOKAHEAD_DAYS`. `null` for a service that never closes, or when no such
 * closure falls in that time. An ordinary overnight closure is not one.
 */
export function nextNonWorkingClosure(
  owner: DischargeDependencyOwner,
  now: Instant,
  dayZero: Date,
): ServiceClosure | null {
  if (SYNTHETIC_SERVICE_HOURS[owner] === "always") return null;
  const today = dayOf(now);
  const nowMinute = minuteOfDay(now);
  const todayHours = hoursOn(owner, today, dayZero);
  // The day the closed period starts on, and when it starts (null when it has already started).
  let startDay = today;
  let closesAt: Instant | null = null;
  if (todayHours !== null && nowMinute < todayHours.closes) {
    closesAt = today * MINUTES_PER_DAY + todayHours.closes;
  }
  for (let guard = 0; guard <= CLOSURE_LOOKAHEAD_DAYS; guard += 1) {
    // Find the next day it opens after `startDay`.
    let reopenDay = startDay + 1;
    while (hoursOn(owner, reopenDay, dayZero) === null && reopenDay - today < CLOSURE_LOOKAHEAD_DAYS + 7) {
      reopenDay += 1;
    }
    const reopenHours = hoursOn(owner, reopenDay, dayZero);
    if (reopenHours === null) return null;
    const closedFor: string[] = [];
    // Already closed today on a closed day counts that day too.
    if (closesAt === null && startDay === today && todayHours === null) {
      const reason = closedDayReason(owner, today, dayZero);
      if (reason) closedFor.push(reason);
    }
    for (let day = startDay + 1; day < reopenDay; day += 1) {
      const reason = closedDayReason(owner, day, dayZero);
      if (reason && !closedFor.includes(reason)) closedFor.push(reason);
    }
    if (closedFor.length > 0) {
      return { owner, closesAt, reopensAt: reopenDay * MINUTES_PER_DAY + reopenHours.opens, closedFor };
    }
    // An ordinary overnight closure: move on to the close of the day it reopens.
    if (reopenDay - today > CLOSURE_LOOKAHEAD_DAYS) return null;
    startDay = reopenDay;
    closesAt = reopenDay * MINUTES_PER_DAY + reopenHours.closes;
  }
  return null;
}
