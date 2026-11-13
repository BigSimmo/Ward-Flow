import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { ReferralSource } from "@/components/ward-management/ward-model";

/**
 * A16-20 (Audit 16, 13 Nov 2026; D-175 item 1, approved system fix): "the builders place planned
 * moves and community referrals inside working hours, and the check enforces it". The one sample
 * working day every sample builder reads: 08:00 to 17:00 Perth. It is a synthetic sample choice,
 * not a rule about when a move or a referral may happen on the signed-in site.
 *
 * Read by the Standard day's planned moves (`ward-demo-planned-moves.ts`) and by the demonstration
 * networks' referrals (`ward-demo-network.ts`). Synthetic data only.
 */
export const SAMPLE_WORKING_DAY_START = 8 * 60;
export const SAMPLE_WORKING_DAY_END = 17 * 60;

/** Minutes past Perth midnight for an instant (instants count minutes on the Perth day). */
function minuteOfDay(at: Instant): number {
  return ((at % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** The referrers who work office hours in the sample day: a GP and a community team. */
function referrerKeepsWorkingHours(source: ReferralSource): boolean {
  return source === "gp" || source === "community";
}

/**
 * When a sample referral was raised, kept inside the working day and never later than `at`. A time
 * inside the day is kept. A time before 08:00 moves to the previous afternoon, the same number of
 * minutes before 17:00 as it was before 08:00 (05:42 becomes 14:42 the day before). A time after
 * 17:00 moves back into the same afternoon, the same number of minutes before 17:00 as it was
 * after it. Either way the referral is older, so nothing derived from it moves into the future.
 */
function raisedInSampleWorkingHours(at: Instant): Instant {
  const minute = minuteOfDay(at);
  const dayStart = at - minute;
  if (minute < SAMPLE_WORKING_DAY_START) {
    return dayStart - MINUTES_PER_DAY + SAMPLE_WORKING_DAY_END - (SAMPLE_WORKING_DAY_START - minute);
  }
  if (minute > SAMPLE_WORKING_DAY_END) return dayStart + SAMPLE_WORKING_DAY_END - (minute - SAMPLE_WORKING_DAY_END);
  return at;
}

/** A sample referral's raised time: inside the working day for a GP or community team, else as given. */
export function sampleReferralRaisedAt(source: ReferralSource, at: Instant): Instant {
  return referrerKeepsWorkingHours(source) ? raisedInSampleWorkingHours(at) : at;
}
