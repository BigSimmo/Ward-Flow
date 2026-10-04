import type { Instant } from "../ward-clock";
import type { Movement } from "../ward-model";
import { lastRecordedActivity } from "./delays-derivations";

/** A linear time scale shared by every visible timeline row. All values are minutes. */
export function delayTimelineScale(movements: readonly Movement[], now: Instant): number {
  const longest = movements.reduce((max, movement) => Math.max(max, now - movement.openedAt), 0);
  const tickMinutes =
    [180, 240, 480, 720, 1440, 2880, 4320, 10080].find((tick) => tick * 4 >= longest) ??
    Math.ceil(longest / (4 * 10080)) * 10080;
  return tickMinutes * 4;
}

export function delayTimelineSegments(movement: Movement, now: Instant, scaleMinutes: number) {
  const waiting = Math.max(0, now - movement.openedAt);
  const latest = lastRecordedActivity(movement, now);
  // Opening the journey is the arrival baseline, not a later update.
  const activity = latest?.what === "the journey opened" ? undefined : latest;
  // Records before arrival or after the current demo time cannot extend the drawn wait.
  const beforeUpdate = activity === undefined ? 0 : Math.min(waiting, Math.max(0, activity.at - movement.openedAt));
  const width = (minutes: number) => (Math.min(minutes, scaleMinutes) / scaleMinutes) * 100;
  return {
    waiting,
    activity,
    quiet: waiting - beforeUpdate,
    totalWidth: width(waiting),
    beforeWidth: width(beforeUpdate),
    quietWidth: width(waiting) - width(beforeUpdate),
  };
}
