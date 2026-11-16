import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

/**
 * Item 13 (Josh, 14 Nov 2026): times on screen read am/pm, "11:05 am", "12:59 am", "12:00 pm".
 *
 * Phase 2b: the app's shared on-screen formatters (`formatInstant`, `formatInstantWithDay`,
 * `ward-clock.ts`) now read am/pm themselves, so these names are the same functions. Printed
 * times, legal ones included (D-254), keep the 24-hour face through `formatClock24` and `formatSheetMoment`.
 */
export function formatClockAmPm(instant: Instant): string {
  return formatInstant(instant);
}

/**
 * An am/pm time with its day said whenever it is not `now`'s day: "12:59 am tomorrow",
 * "11:05 pm yesterday", "9:00 am, 2 days ago".
 */
export function formatClockAmPmWithDay(instant: Instant, now: Instant): string {
  return formatInstantWithDay(instant, now);
}
