import type { Instant } from "@/components/ward-management/ward-clock";
import type { LeaveBed, Referral, Unit } from "@/components/ward-management/ward-model";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import { referralNoReplyWaits, type NoReplyWait } from "@/components/ward-management/referrals/referral-no-reply";
import {
  LEAVE_BED_OPEN_WARNING_MINUTES,
  SILENT_WARD_SECOND_REMINDER_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";

/**
 * THE TIMED REMINDERS ON THE SHARED ALERT LIST (R-HOME-10, design pack, 14 Nov 2026).
 * The 4 hour no-reply reminder and the 24 hour leave bed prompt were on their own boards only. They
 * are now rows on the one task list the bell, Home's Act now area and Alerts all read. The timings are
 * the signed ones (`SILENT_WARD_SECOND_REMINDER_MINUTES`, `LEAVE_BED_OPEN_WARNING_MINUTES`); this
 * file only decides whether a row exists and when its occurrence began. Pure, ids and times only.
 */

/** The longest wait at a place that has not replied, once it reaches the second (4 hour) reminder. */
export function silentWardReminderWait(
  referral: Referral,
  now: Instant,
  configuration: Pick<WardConfiguration, "referralDecisionTargetMinutes">,
  units: readonly Pick<Unit, "id" | "name">[],
): NoReplyWait | undefined {
  const due = referralNoReplyWaits(referral, now, configuration, units).filter(
    (wait) => wait.waitedMinutes >= SILENT_WARD_SECOND_REMINDER_MINUTES,
  );
  return due.length === 0 ? undefined : due.reduce((a, b) => (b.waitedMinutes > a.waitedMinutes ? b : a));
}

/** When the leave bed reaches the 24 hour prompt. */
export function leaveBedReminderAt(leaveBed: Pick<LeaveBed, "confirmedAt">): Instant {
  return leaveBed.confirmedAt + LEAVE_BED_OPEN_WARNING_MINUTES;
}

/** Whether the leave bed is at or past the 24 hour prompt and still held (an absence has its own row). */
export function leaveBedReminderDue(leaveBed: LeaveBed, now: Instant): boolean {
  return leaveBed.absentWithoutLeave === undefined && now >= leaveBedReminderAt(leaveBed);
}

/**
 * When the longest-silent place was asked, for a reply still owed; the row's occurrence starts at
 * this plus the 4 hour reminder. Independent of the clock, so the reducer can read it without `now`.
 */
export function silentWardAskedAt(
  referral: Referral,
  configuration: Pick<WardConfiguration, "referralDecisionTargetMinutes">,
  units: readonly Pick<Unit, "id" | "name">[],
): Instant | undefined {
  const asked = referralNoReplyWaits(referral, 0, configuration, units).map((wait) => wait.askedAt);
  return asked.length === 0 ? undefined : Math.min(...asked);
}
