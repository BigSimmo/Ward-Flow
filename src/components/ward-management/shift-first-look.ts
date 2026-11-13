/**
 * Night shift on the morning look (item 11). A coordinator's first look in a new shift reads from
 * the start of the shift before, so the day coordinator's first look after the morning handover
 * covers the whole night. A later look in the same shift covers that shift only.
 *
 * Home's Activity panel counts a look as a review ("Mark reviewed", explicit by design); the Shift
 * digest counts each time it is read. Nothing here stores anything: callers pass the last look.
 */
import { currentShift, currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";

/** When the shift before the one `now` falls in began (23:00 last night, at 07:05). */
export function previousShiftStartInstant(now: Instant): Instant {
  return currentShiftStartInstant(currentShiftStartInstant(now) - 1);
}

/** Whether `lookedAt` was a look in the shift `now` falls in. */
export function lookedThisShift(lookedAt: Instant | null | undefined, now: Instant): boolean {
  return lookedAt !== null && lookedAt !== undefined && lookedAt >= currentShiftStartInstant(now) && lookedAt <= now;
}

/**
 * Where a look's window starts: the previous shift's start on the first look of a shift, otherwise
 * the current shift's start.
 */
export function shiftLookWindowStart(lookedAt: Instant | null | undefined, now: Instant): Instant {
  return lookedThisShift(lookedAt, now) ? currentShiftStartInstant(now) : previousShiftStartInstant(now);
}

/** "Since last night at 23:00", "Since 07:00, the start of the day shift" or "…, the start of your shift". */
export function shiftLookLabel(since: Instant, now: Instant): string {
  if (since === currentShiftStartInstant(now))
    return `Since ${formatInstantWithDay(since, now)}, the start of your shift`;
  const shift = currentShift(since);
  const lastNightStart = previousShiftStartInstant(now);
  // "last night" names the day, so the clock face alone is right here (ward-instant-display guard).
  if (since === lastNightStart && shift.name === "Night Shift")
    return `Since last night at ${formatInstant(lastNightStart)}`;
  return `Since ${formatInstantWithDay(since, now)}, the start of the ${shift.name.toLowerCase()}`;
}
