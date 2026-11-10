import {
  formatInstant,
  minuteOfDay,
  minuteOfDayFromClockText,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import type { Unit, WardIntakeWindow } from "@/components/ward-management/ward-model";
import { REMINDER_MORNING_SHIFT_START_MINUTE } from "@/components/ward-management/ward-operational-defaults";

/**
 * OVERNIGHT INTAKE WINDOW (feature item 13, 10 Nov 2026): the hours tonight a ward's nurse in
 * charge says it can take an admission, so night staff stop ringing wards that cannot take anyone.
 * Information only: it never blocks a referral, and never sorts, filters or ranks wards.
 *
 * It clears itself each morning by being read, not by being deleted: a window counts only when it
 * was set since the most recent 07:00 day start. Not the current shift start, because a window set
 * at 23:30 sits in the night shift and must still show at 03:00.
 */

/** The most recent 07:00 day start at or before `now`. */
export function intakeDayStart(now: Instant): Instant {
  const start = REMINDER_MORNING_SHIFT_START_MINUTE;
  return now - ((minuteOfDay(now) - start + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

/** This ward's window for tonight, or `null` when none was set since this morning's day start. */
export function tonightIntakeWindow(unit: Pick<Unit, "intakeWindow">, now: Instant): WardIntakeWindow | null {
  const intake = unit.intakeWindow;
  if (!intake) return null;
  return intake.at >= intakeDayStart(now) && intake.at <= now ? intake : null;
}

/**
 * Two typed clock times read to instants in the day that started at the latest 07:00 (D-72's typed
 * time pattern). A "to" at or before "from" crosses midnight: 21:00 to 02:00 ends the next morning.
 * `undefined` for a half-typed time, or a window that starts and ends at the same minute.
 */
export function intakeWindowFromClockText(
  fromText: string,
  toText: string,
  now: Instant,
): { from: Instant; to: Instant } | undefined {
  const fromMinute = minuteOfDayFromClockText(fromText);
  const toMinute = minuteOfDayFromClockText(toText);
  if (fromMinute === undefined || toMinute === undefined || fromMinute === toMinute) return undefined;
  const from =
    intakeDayStart(now) + ((fromMinute - REMINDER_MORNING_SHIFT_START_MINUTE + MINUTES_PER_DAY) % MINUTES_PER_DAY);
  return { from, to: from + ((toMinute - fromMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY) };
}

/** Why a window would be refused, or `null`: it starts within today's day and is under a day long. */
export function intakeWindowProblem(intake: { from: Instant; to: Instant }, now: Instant): string | null {
  const { from, to } = intake;
  if (![from, to].every((value) => Number.isInteger(value))) return "The times must be whole minutes";
  const dayStart = intakeDayStart(now);
  if (from < dayStart || from >= dayStart + MINUTES_PER_DAY) return "The start must be within today's day";
  if (to <= from || to - from >= MINUTES_PER_DAY) return "The end must be after the start, within a day";
  return null;
}

/** "Tonight: admit 21:00 to 02:00", or "Tonight: not set". */
export function intakeWindowLine(intake: WardIntakeWindow | null): string {
  return intake ? `Tonight: admit ${formatInstant(intake.from)} to ${formatInstant(intake.to)}` : "Tonight: not set";
}
