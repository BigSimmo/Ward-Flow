"use client";

import { calendarDateOf, formatInstant, type Instant } from "@/components/ward-management/ward-clock";

/**
 * Parts shared by the report pages (downtime pack and patient chronology). The hero chips, the
 * fact grid and the phone query moved to `@/components/wf` in v10 pass 2; import them from there.
 */

/**
 * "Sat 10 Oct", the report date form (no commas). Read in the browser's own time zone, the zone
 * `demoDayZero` took its midnight in: reading it in a fixed zone moved an arrival at 19:27 the
 * evening before onto the pack's own day, after its 10:42 freeze (device audit 11 Oct 2026).
 */
export function reportDay(instant: Instant, dayZero: Date): string {
  const date = calendarDateOf(instant, dayZero);
  const weekday = date.toLocaleDateString("en-AU", { weekday: "short" });
  const day = date.toLocaleDateString("en-AU", { day: "numeric" });
  const month = date.toLocaleDateString("en-AU", { month: "short" });
  return `${weekday} ${day} ${month}`;
}

/** "Sat 10 Oct 10:42". */
export function reportMoment(instant: Instant, dayZero: Date): string {
  return `${reportDay(instant, dayZero)} ${formatInstant(instant)}`;
}
