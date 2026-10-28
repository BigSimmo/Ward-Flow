/**
 * Board-clock time features that use times the record already holds.
 *
 * Pull holds use `pullExpiresAt`. Transport uses a typed `estimatedAt`. The shift boundaries
 * match the sidebar countdown. Nothing here invents a Mental Health Act limit or a night curfew.
 */

import {
  formatRemaining,
  minuteOfDay,
  minutesUntil,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";
import type { BedRelease } from "@/components/ward-management/ward-model";

/** Day shift end on the board clock, read from the one shift pattern (H-0759), as the sidebar countdown does. */
export const DAY_SHIFT_END_MINUTE = SHIFT_PATTERN[0].endMinute;

/** The shift a minute of the day (0 to 1439) falls in, on the one shift pattern (night wraps midnight). */
export function shiftAtMinute(minute: number): (typeof SHIFT_PATTERN)[number] {
  return (
    SHIFT_PATTERN.find(({ startMinute, endMinute }) =>
      endMinute <= startMinute
        ? minute >= startMinute || minute < endMinute
        : minute >= startMinute && minute < endMinute,
    ) ?? SHIFT_PATTERN[SHIFT_PATTERN.length - 1]
  );
}

/** The shift `now` falls in, on the one shift pattern every screen uses (night wraps midnight). */
export function currentShift(now: Instant): (typeof SHIFT_PATTERN)[number] {
  return shiftAtMinute(minuteOfDay(now));
}

/** When the shift `now` falls in began. */
export function currentShiftStartInstant(now: Instant): Instant {
  return now - ((minuteOfDay(now) - currentShift(now).startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

/**
 * When the shift `now` falls in ends: 15:00, 23:00, or 07:00 the next morning. Audit 2 E-14: this
 * replaced today's fixed 15:00, which named a time already past in the evening and overnight.
 */
export function shiftEndInstant(now: Instant): Instant {
  const shift = currentShift(now);
  return currentShiftStartInstant(now) + ((shift.endMinute - shift.startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

/**
 * This ward's discharges still to happen that are expected by the end of the current shift. The
 * one population behind the ward hero's "Ready by" figure, its bed filter and the Decisions
 * projection, so those numbers cannot drift apart.
 */
export function releasesDueByShiftEnd(bedReleases: readonly BedRelease[], unitId: string, now: Instant): BedRelease[] {
  const shiftEnd = shiftEndInstant(now);
  return bedReleases.filter(
    (release) => release.unitId === unitId && release.state !== "discharged" && release.expectedAt <= shiftEnd,
  );
}

/**
 * Time left on a pulled bed before the hold becomes an alert, or how long it has been overdue.
 * Uses only the stored `pullExpiresAt` — never invents a hold length.
 */
export function pullHoldRemainingLabel(pullExpiresAt: Instant, now: Instant): string {
  return formatRemaining(minutesUntil(pullExpiresAt, now));
}

/**
 * Time until a typed transport estimated moment, or that it is overdue / due once that moment
 * has passed. Uses only the stored `estimatedAt`.
 */
export function transportEtaRemainingLabel(estimatedAt: Instant, now: Instant): string {
  return formatRemaining(minutesUntil(estimatedAt, now));
}
