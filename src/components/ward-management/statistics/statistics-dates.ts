import { calendarDateOf, dayOf, perthCalendarDay } from "@/components/ward-management/ward-clock";
import { MONTH_SHORT } from "@/components/ward-management/ward-month-names";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = MONTH_SHORT;

/** "Thu", the weekday an instant falls on. */
export function weekdayOf(instant: number, dayZero: Date): string {
  return WEEKDAYS[perthCalendarDay(calendarDateOf(instant, dayZero)).weekday]!;
}

/** "Thu 3 Sep", the calendar day an instant falls on. */
export function dateOf(instant: number, dayZero: Date): string {
  const date = perthCalendarDay(calendarDateOf(instant, dayZero));
  return `${WEEKDAYS[date.weekday]} ${date.day} ${MONTHS[date.monthIndex]}`;
}

/**
 * True when a planned date's day is before today: the person is still here past it, so the date is
 * marked (amber dot, "past date") rather than shown as an ordinary date (audit stats-12).
 */
export function isPastDate(instant: number, now: number): boolean {
  return dayOf(instant) < dayOf(now);
}

/**
 * True when a planned date falls on today or one of the next `days - 1` calendar days: the "due"
 * bucket, by Perth calendar day like `isPastDate`, so a date earlier today is due today rather
 * than in neither bucket, and a 7-day window ends at midnight, not at this time next week (time
 * audit T2, 13 Nov 2026).
 */
export function isDueWithinDays(instant: number, now: number, days: number): boolean {
  const offset = dayOf(instant) - dayOf(now);
  return offset >= 0 && offset < days;
}

/** "in 2d", "today" or "3d ago": how far an instant's day is from today. */
export function fromToday(instant: number, now: number): string {
  const days = dayOf(instant) - dayOf(now);
  if (days === 0) return "today";
  return days > 0 ? `in ${days}d` : `${-days}d ago`;
}
