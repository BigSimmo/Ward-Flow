import { clockZoneLabel, type ClockZoneLabel } from "../ward-clock";
import { formatReferralIntakeTime, referralIntakeExpected } from "../ward-referral-seed-time";

/**
 * An expected time from a referral letter (medical clearance) on the board clock, with "(passed)"
 * once it is earlier than `now`, so a pending clearance whose expected time has gone by does not
 * read as still ahead (time audit G6, 13 Nov 2026). The time itself is unchanged; without a board
 * clock there is no now to compare with, so the plain time is shown. The comparison is the shared
 * `referralIntakeExpected`, so the referral summary sheet and these lines can never disagree.
 */
export function referralExpectedTime(
  raw: string | undefined,
  target: { syntheticTimelineBase?: string },
  dayZero: Date | undefined,
  now: number | undefined,
  /** The board's clock words (`useClockZoneLabel`, F-113): "AWST" signed in, "demo time" in the demo. */
  zone: ClockZoneLabel = clockZoneLabel(false),
): string {
  if (now === undefined) return formatReferralIntakeTime(raw, target, dayZero, now, zone);
  return referralIntakeExpected(raw, target, dayZero, now, zone);
}
