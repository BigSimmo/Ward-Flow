import { calendarDateOf, dayOf, perthCalendarDay } from "@/components/ward-management/ward-clock";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

/** "in 2d", "today" or "3d ago": how far an instant's day is from today. */
export function fromToday(instant: number, now: number): string {
  const days = dayOf(instant) - dayOf(now);
  if (days === 0) return "today";
  return days > 0 ? `in ${days}d` : `${-days}d ago`;
}
