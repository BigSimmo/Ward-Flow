import { MINUTES_PER_DAY, minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";

/**
 * When the downtime pack is retaken (fix plan item 9, Josh 21 Oct 2026, "yes to all"): every hour on
 * the hour and at every shift change, so the copy printed or saved before an outage is never more
 * than an hour old and a fresh one is ready at each handover. The pack stays in this tab's memory
 * only (D-18); the person prints it or saves it as a PDF. Nothing here writes to the device.
 */
const MINUTES_PER_HOUR = 60;

/** The shift changes on the one shift pattern every screen uses: 07:00, 15:00 and 23:00. */
const SHIFT_CHANGE_MINUTES: readonly number[] = SHIFT_PATTERN.map((shift) => shift.startMinute);

/** The first shift change strictly after `instant`. */
function nextShiftChange(instant: Instant): Instant {
  const minute = minuteOfDay(instant);
  const gaps = SHIFT_CHANGE_MINUTES.map((start) => {
    const gap = (start - minute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return gap === 0 ? MINUTES_PER_DAY : gap;
  });
  return instant + Math.min(...gaps);
}

/** The first whole hour strictly after `instant`. */
function nextWholeHour(instant: Instant): Instant {
  return (Math.floor(instant / MINUTES_PER_HOUR) + 1) * MINUTES_PER_HOUR;
}

/** When a pack taken at `generatedAt` is replaced: the next whole hour or shift change, whichever is first. */
export function nextDowntimePackAt(generatedAt: Instant): Instant {
  return Math.min(nextWholeHour(generatedAt), nextShiftChange(generatedAt));
}

/**
 * True once a pack taken at `generatedAt` is due to be replaced. A pack stamped after `now` (the
 * demonstration clock was set back) no longer describes the board either.
 */
export function downtimePackDue(generatedAt: Instant, now: Instant): boolean {
  return now < generatedAt || now >= nextDowntimePackAt(generatedAt);
}

/**
 * The latest shift change after `from` and up to `to`, or null. A retake that runs late (a sleeping
 * tab woke at 15:02) still stands for the 15:00 handover, so the reason comes from the boundary
 * crossed, not from the moment the pack was taken.
 */
export function shiftChangeCrossed(from: Instant, to: Instant): Instant | null {
  let crossed: Instant | null = null;
  for (let next = nextShiftChange(from); next <= to; next = nextShiftChange(next)) crossed = next;
  return crossed;
}
