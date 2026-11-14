import { dayOf, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";

/**
 * Item 13 (Josh, 14 Nov 2026): times on screen read am/pm, "11:05 am", "12:59 am", "12:00 pm".
 * Printed legal times stay 24-hour (`formatInstant`, `formatSheetMoment`); this file is for screens.
 *
 * A new file rather than an edit to `ward-clock.ts` while PR A changes that file's clock setting
 * (build brief phase 1). Lower-case, a space before am/pm and no leading zero on the hour, as the
 * figures spec writes them ("8:00 am", "12:00 am to now").
 */
export function formatClockAmPm(instant: Instant): string {
  const minute = minuteOfDay(instant);
  const hours24 = Math.floor(minute / 60);
  const minutes = minute % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${hours24 < 12 ? "am" : "pm"}`;
}

/**
 * An am/pm time with its day said whenever it is not `now`'s day: "12:59 am tomorrow",
 * "11:05 pm yesterday", "9:00 am, 2 days ago". The day words are `formatInstantWithDay`'s, word for
 * word (a test holds the two equal), so only the clock face differs.
 */
export function formatClockAmPmWithDay(instant: Instant, now: Instant): string {
  const clockFace = formatClockAmPm(instant);
  const dayDifference = dayOf(instant) - dayOf(now);
  if (dayDifference === 0) return clockFace;
  if (dayDifference === -1) return `${clockFace} yesterday`;
  if (dayDifference === 1) return `${clockFace} tomorrow`;
  if (dayDifference < -1) return `${clockFace}, ${Math.abs(dayDifference)} days ago`;
  return `${clockFace}, in ${dayDifference} days`;
}
