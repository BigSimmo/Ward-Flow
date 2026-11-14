"use client";

import { calendarDateOf, formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { WARD_TIME_ZONE } from "@/lib/ward-time-zone";

/**
 * Parts shared by the report pages (downtime pack and patient chronology). The hero chips, the
 * fact grid and the phone query moved to `@/components/wf` in v10 pass 2; import them from there.
 */

/** "Sat 10 Oct", the report date form (no commas). */
export function reportDay(instant: Instant, dayZero: Date): string {
  const date = calendarDateOf(instant, dayZero);
  const weekday = date.toLocaleDateString("en-AU", { weekday: "short", timeZone: WARD_TIME_ZONE });
  const day = date.toLocaleDateString("en-AU", { day: "numeric", timeZone: WARD_TIME_ZONE });
  const month = date.toLocaleDateString("en-AU", { month: "short", timeZone: WARD_TIME_ZONE });
  return `${weekday} ${day} ${month}`;
}

/** "Sat 10 Oct 10:42". */
export function reportMoment(instant: Instant, dayZero: Date): string {
  return `${reportDay(instant, dayZero)} ${formatInstant(instant)}`;
}
