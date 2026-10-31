import { calendarDateOf, perthCalendarDay, type Instant } from "@/components/ward-management/ward-clock";

/** The `<input type="date">` value for the Perth day an instant falls on, counted from `dayZero`. */
export function dateInputFor(instant: Instant, dayZero: Date): string {
  const day = perthCalendarDay(calendarDateOf(instant, dayZero));
  return `${day.year}-${String(day.monthIndex + 1).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
}

/** The same Perth day as typed into the kit's DD/MM/YYYY date box (`DateField`). */
export function typedDateFor(instant: Instant, dayZero: Date): string {
  const [year, month, day] = dateInputFor(instant, dayZero).split("-");
  return `${day}/${month}/${year}`;
}
