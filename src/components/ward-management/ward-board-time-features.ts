/**
 * Board-clock time features that use times the record already holds.
 *
 * Pull holds use `pullExpiresAt`. Transport uses a typed `estimatedAt`. The handover open-work
 * list uses those same moments against the end of the current shift, as the sidebar countdown
 * does. Nothing here invents a Mental Health Act limit or a night curfew.
 */

import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import {
  formatRemaining,
  minuteOfDay,
  minutesUntil,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, Movement } from "@/components/ward-management/ward-model";

/** Day shift ends at 15:00 on the board clock — same boundary as the sidebar handover countdown. */
export const DAY_SHIFT_END_MINUTE = 15 * 60;

/** The shift `now` falls in, on the one shift pattern every screen uses (night wraps midnight). */
export function currentShift(now: Instant): (typeof SHIFT_PATTERN)[number] {
  const minute = minuteOfDay(now);
  return (
    SHIFT_PATTERN.find(({ startMinute, endMinute }) =>
      endMinute <= startMinute
        ? minute >= startMinute || minute < endMinute
        : minute >= startMinute && minute < endMinute,
    ) ?? SHIFT_PATTERN[SHIFT_PATTERN.length - 1]
  );
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

type OpenWorkBeforeShiftEndKind = "pull_hold" | "typed_form";

export type OpenWorkBeforeShiftEndItem = {
  movement: Movement;
  kind: OpenWorkBeforeShiftEndKind;
  at: Instant;
};

/**
 * Open work that falls before 15:00 board time: a pull hold or a typed form due time earlier
 * than that day's shift end. Sorted soonest first. Still-open items whose moment has already
 * passed stay on the list — they are the incoming shift's unfinished work.
 */
export function openWorkBeforeShiftEnd(movements: readonly Movement[], now: Instant): OpenWorkBeforeShiftEndItem[] {
  const shiftEnd = shiftEndInstant(now);
  const items: OpenWorkBeforeShiftEndItem[] = [];

  for (const movement of movements) {
    if (!isOpen(movement)) continue;

    const pullExpiresAt = movement.pullExpiresAt;
    if (pullExpiresAt !== undefined && pullExpiresAt < shiftEnd) {
      items.push({ movement, kind: "pull_hold", at: pullExpiresAt });
    }

    const dueAt = currentLegalDueAt(movement);
    if (dueAt !== undefined && dueAt < shiftEnd) {
      items.push({ movement, kind: "typed_form", at: dueAt });
    }
  }

  return items.toSorted((a, b) => {
    if (a.at !== b.at) return a.at - b.at;
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.movement.id < b.movement.id ? -1 : a.movement.id > b.movement.id ? 1 : 0;
  });
}

export function openWorkBeforeShiftEndLabel(item: OpenWorkBeforeShiftEndItem, now: Instant): string {
  const remaining = pullHoldRemainingLabel(item.at, now);
  if (item.kind === "pull_hold") return `Bed pull · ${remaining}`;
  const code = item.movement.legalForm?.code;
  return code !== undefined ? `Form ${code} · ${remaining}` : `Typed form time · ${remaining}`;
}
