import type { Instant } from "../ward-clock";
import type { Movement } from "../ward-model";
import { lastRecordedActivity } from "./delays-derivations";
import { legalDeadlineMinutes, type DelayCause } from "./delays-derivations";
import { edHealthService } from "../ward-service-scope";
import { HEALTH_SERVICES, type HealthService } from "../ward-model";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  ED_SEVERE_PRESSURE_WAIT_MINUTES,
  LONG_WAIT_MINUTES,
} from "../ward-operational-defaults";

export type DelayRecord = { movement: Movement; cause: DelayCause };
export type CatchmentOrigin = HealthService | "unrecorded";
export type RadarBand = "breached" | "imminent" | "severe" | "routine";

/** Origin is exclusive. Destination/referral membership never adds a second person. */
export function delayCatchments(records: readonly DelayRecord[], now: Instant) {
  const primary: HealthService[] = ["North Metro", "East Metro", "South Metro", "WACHS"];
  const origins = [
    ...primary,
    ...HEALTH_SERVICES.filter((service) => !primary.includes(service)),
    "unrecorded",
  ] as CatchmentOrigin[];
  return origins
    .map((origin) => {
      const people = records.filter(
        ({ movement }) => (edHealthService(movement.originEdId) ?? "unrecorded") === origin,
      );
      return {
        origin,
        people,
        total: people.length,
        over8: people.filter(({ movement }) => now - movement.openedAt >= ED_SEVERE_PRESSURE_WAIT_MINUTES).length,
        over24: people.filter(({ movement }) => now - movement.openedAt >= LONG_WAIT_MINUTES).length,
      };
    })
    .filter((entry) => primary.includes(entry.origin as HealthService) || entry.total > 0);
}

/** Preserve the screen's existing recorded-deadline precedence; no inferred legal time. */
export function delayRadarBand(movement: Movement, now: Instant): RadarBand {
  const due = legalDeadlineMinutes(movement, now);
  if (due !== undefined)
    return due < 0
      ? "breached"
      : due <= DUE_SOON_URGENT_MINUTES
        ? "imminent"
        : due <= DUE_SOON_MINUTES
          ? "severe"
          : "routine";
  return movement.urgency === 1 ? "severe" : "routine";
}

/** Inclusive window end, exclusive interval ends except the final bin. No clamped outliers. */
export function delayRadarGroups(records: readonly DelayRecord[], now: Instant, windowMinutes = LONG_WAIT_MINUTES) {
  const interval = 240;
  const bands: RadarBand[] = ["breached", "imminent", "severe", "routine"];
  const wait = ({ movement }: DelayRecord) => Math.max(0, now - movement.openedAt);
  const visible = records.filter((record) => wait(record) <= windowMinutes);
  const beyond = records
    .filter((record) => wait(record) > windowMinutes)
    .sort((a, b) => a.movement.openedAt - b.movement.openedAt);
  const lanes = bands.map((band) => {
    const all = records.filter(({ movement }) => delayRadarBand(movement, now) === band);
    const inView = visible.filter(({ movement }) => delayRadarBand(movement, now) === band);
    const bins = Array.from({ length: Math.ceil(windowMinutes / interval) }, (_, index) => {
      const start = index * interval;
      const end = Math.min(windowMinutes, start + interval);
      return {
        start,
        end,
        people: inView.filter(
          (record) => wait(record) >= start && (wait(record) < end || (end === windowMinutes && wait(record) === end)),
        ),
      };
    }).filter((bin) => bin.people.length > 0);
    return { band, all, inView, bins };
  });
  return { lanes, visible, beyond, interval };
}

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
