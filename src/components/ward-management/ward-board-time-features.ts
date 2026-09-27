/**
 * Board-clock time features that use times the record already holds.
 *
 * Pull holds use `pullExpiresAt`. Transport uses a typed `estimatedAt`. The handover open-work
 * list uses those same moments against the day-shift end (15:00 board time) the sidebar already
 * uses. Nothing here invents a Mental Health Act limit or a night curfew.
 */

import {
  dayOf,
  formatRemaining,
  minutesUntil,
  MINUTES_PER_DAY,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

/** Day shift ends at 15:00 on the board clock — same boundary as the sidebar handover countdown. */
export const DAY_SHIFT_END_MINUTE = 15 * 60;

/** Today's 15:00 as an Instant on the demonstration day that `now` sits on. */
export function dayShiftEndInstant(now: Instant): Instant {
  return dayOf(now) * MINUTES_PER_DAY + DAY_SHIFT_END_MINUTE;
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

export type OpenWorkBeforeShiftEndKind = "pull_hold" | "typed_form";

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
export function openWorkBeforeShiftEnd(
  movements: readonly Movement[],
  now: Instant,
): OpenWorkBeforeShiftEndItem[] {
  const shiftEnd = dayShiftEndInstant(now);
  const items: OpenWorkBeforeShiftEndItem[] = [];

  for (const movement of movements) {
    if (!isOpen(movement)) continue;

    const pullExpiresAt = movement.pullExpiresAt;
    if (pullExpiresAt !== undefined && pullExpiresAt < shiftEnd) {
      items.push({ movement, kind: "pull_hold", at: pullExpiresAt });
    }

    const dueAt = movement.legalForm?.dueAt;
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
