/**
 * Mental Health Act legal-form facts for Ward Flow: the form codes the engine recognises, the
 * not-legally-checked notice, and the operational (non-statutory) timing constants below.
 *
 * Owner rulings 2026-09-25: Ward Flow computes no legal time limit. A form's expiry is only ever
 * the time typed from the paper form, shown as not legally checked. The duration, extension and
 * reminder arithmetic that used to live here had no callers and carried wrong durations; it was
 * removed and is kept on branch backup/2026-09-25-legal-clock-arithmetic.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  EXPECT_FLAG_INVOLUNTARY_MINUTES,
  EXPECT_FLAG_VOLUNTARY_MINUTES,
  LATE_ARRIVAL_GRACE_MINUTES,
  LEAVE_BED_OPEN_WARNING_HOURS,
} from "@/components/ward-management/ward-operational-defaults";

export type LegalClockBasis = "written" | "received" | "made" | "continuation";

export type LegalClockRegion = "metro" | "country";

export type LegalClockAgeBand = "adult" | "under_18";

export type LegalClockKind = "examination" | "detention" | "order";

export type LegalClock = {
  code: string;
  kind?: LegalClockKind;
  startedAt: Instant;
  expiresAt: Instant;
  /** How the start instant was entered. */
  basis: LegalClockBasis;
  region?: LegalClockRegion;
  ageBand?: LegalClockAgeBand;
  /** Legacy field from saved sessions; never set by the engine. */
  extended?: boolean;
};

/**
 * Owner decision, 25 September 2026: every statutory time limit in Ward Flow is typed in and has not
 * been checked by anyone with legal knowledge, so each screen that shows one says so, in these words,
 * until the WA legal review on the "before any real patient" list has happened.
 */
export const LEGAL_LIMITS_NOT_CHECKED_NOTICE =
  "Not legally checked: these Mental Health Act time limits are typed in and have not been checked against the Act by anyone with legal knowledge. Do not rely on them.";

/** Minutes past estimated arrival before late notices fire: the named default, one rule not two. */
export const ARRIVAL_LATE_AFTER_MINUTES = LATE_ARRIVAL_GRACE_MINUTES;

/**
 * How long a leave bed may stay open before Ward Flow warns, in hours: the ward's own operational
 * figure. It is unrelated to the Mental Health Act, and to the emergency department medical figure
 * in ward-model.ts that happens to be the same number.
 */

/** Leave bed open warning, in minutes: warn; a person still opens the bed. */
export const LEAVE_BED_OPEN_WARNING_MINUTES = LEAVE_BED_OPEN_WARNING_HOURS * 60;

/** Expect flags: voluntary past 48h, involuntary past 7 days (named defaults). */
export { EXPECT_FLAG_INVOLUNTARY_MINUTES, EXPECT_FLAG_VOLUNTARY_MINUTES };

/**
 * Decline reason that must never end a referral — gender designation only filters which bed can
 * be offered. Matches `DECLINE_REASONS` member `sex_mix`.
 */
export const GENDER_MISMATCH_DECLINE_REASON = "sex_mix" as const;

/**
 * Decline reasons that waitlist at the ward instead of ending the referral.
 * Cap is `PARALLEL_REFERRAL_CAP` (three). First pull drops the others.
 */
export const WAITLIST_INSTEAD_OF_DECLINE_REASONS = ["no_bed", "bed_pulled_for_earlier_referral"] as const;

/** Legal form codes the engine recognises. */
export const LEGAL_CLOCK_FORM_CODES = ["1A", "3A", "3C", "3D", "5A", "5B", "6A", "6B", "6C"] as const;

export type LegalClockFormCode = (typeof LEGAL_CLOCK_FORM_CODES)[number];

export function isLegalClockFormCode(code: string): code is LegalClockFormCode {
  return (LEGAL_CLOCK_FORM_CODES as readonly string[]).includes(code);
}

/** Form 3C is refused when the person arrived on a Form 3D. */
export function form3CRefusedAfter3D(previousCode?: string): boolean {
  return previousCode === "3D";
}

export function isArrivalLate(
  estimatedArrivalAt: Instant | undefined,
  stage: string | undefined,
  now: Instant,
): boolean {
  if (estimatedArrivalAt === undefined) return false;
  if (stage === "arrived") return false;
  return now > estimatedArrivalAt + ARRIVAL_LATE_AFTER_MINUTES;
}

export function leaveBedNeedsOpenWarning(
  confirmedAt: Instant,
  openWarningAt: Instant | undefined,
  now: Instant,
): boolean {
  if (openWarningAt !== undefined) return false;
  return now - confirmedAt >= LEAVE_BED_OPEN_WARNING_MINUTES;
}

/**
 * Handover completion flag windows (local minutes from midnight). Engine data for screens —
 * 07:00–15:00 and 15:00–00:00 only.
 */
export const HANDOVER_COMPLETION_WINDOWS = [
  { id: "day", startMinute: 7 * 60, endMinute: 15 * 60 },
  { id: "evening", startMinute: 15 * 60, endMinute: 24 * 60 },
] as const;
