import { CLINICAL_VALUES } from "../ward-clinical-values";
import { formatInstantWithDay, splitDuration, type Instant } from "../ward-clock";
import type { Movement, Referral } from "../ward-model";
import { recordedMovementMedicalClearance } from "../ward-medical-clearance";

/**
 * Medical clearance tracker (Josh sign-off, 9 Nov 2026). The clinician still records cleared yes or
 * no; this module never infers clearance. It only says how long a recorded answer took, or how long
 * a patient has been in the department with none, counted from arrival (the movement's `openedAt`).
 *
 * Elapsed time only, never a countdown (D-93 holds countdowns off legal times; this is not a legal
 * time either). Nothing here scores, ranks or re-sorts the ED queue (never-build list, Clinical
 * Safety Case section 2.3): the amber flag sits on the one patient's own clearance line.
 */

/** Amber from this many minutes after arrival with no clearance recorded (`edClearanceNotRecorded`). */
export const ED_CLEARANCE_FLAG_MINUTES = CLINICAL_VALUES.edClearanceNotRecorded.value * 60;

/** What the amber flag means, for a screen reader beside the glyph. */
export const ED_CLEARANCE_FLAG_WORDS = `${CLINICAL_VALUES.edClearanceNotRecorded.value} hours or more since arrival with no clearance recorded`;

/** Fewer recorded clearances than this and the median reads "Too few". */
export const CLEARANCE_MEDIAN_MIN_JOURNEYS = 5;

export type EdClearanceTime =
  | { readonly kind: "not_recorded"; readonly words: string; readonly flagged: boolean }
  | { readonly kind: "not_cleared"; readonly words: string; readonly flagged: false }
  | { readonly kind: "cleared"; readonly words: string; readonly flagged: false; readonly minutes: number }
  | { readonly kind: "cleared_on_arrival"; readonly words: string; readonly flagged: false; readonly minutes: 0 };

type RecordedClearance = { readonly cleared: boolean; readonly at: Instant };

/** One patient's clearance line: "Not cleared · 3h 40m since arrival", "Cleared in 2h 15m" and so on. */
export function edClearanceTime(
  arrivedAt: Instant,
  clearance: RecordedClearance | undefined,
  now: Instant,
): EdClearanceTime {
  if (clearance === undefined) {
    const elapsed = Math.max(now - arrivedAt, 0);
    return {
      kind: "not_recorded",
      words: `Not cleared · ${splitDuration(elapsed)} since arrival`,
      flagged: elapsed >= ED_CLEARANCE_FLAG_MINUTES,
    };
  }
  if (!clearance.cleared)
    return {
      kind: "not_cleared",
      words: `Not cleared (recorded ${formatInstantWithDay(clearance.at, now)})`,
      flagged: false,
    };
  if (clearance.at <= arrivedAt)
    return { kind: "cleared_on_arrival", words: "Cleared on arrival", flagged: false, minutes: 0 };
  const minutes = clearance.at - arrivedAt;
  return { kind: "cleared", words: `Cleared in ${splitDuration(minutes)}`, flagged: false, minutes };
}

export type EdClearanceMedian = {
  /** Journeys with a recorded "cleared" answer: the count the median is based on. */
  readonly count: number;
  /** Minutes from arrival to recorded clearance, or `null` under `CLEARANCE_MEDIAN_MIN_JOURNEYS`. */
  readonly medianMinutes: number | null;
};

/** The median of minutes from arrival to recorded clearance; `null` ("Too few") under five. */
export function clearanceMedian(minutes: readonly number[]): EdClearanceMedian {
  const count = minutes.length;
  if (count < CLEARANCE_MEDIAN_MIN_JOURNEYS) return { count, medianMinutes: null };
  const sorted = [...minutes].sort((a, b) => a - b);
  const middle = Math.floor(count / 2);
  return {
    count,
    medianMinutes: count % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2,
  };
}

/**
 * The department's median time to medical clearance, over the journeys given (the ED statistics
 * screen passes every ED-origin journey from this department, open or closed) that recorded
 * "cleared". A clearance recorded before arrival counts as nought minutes.
 */
export function edClearanceMedian(
  journeys: readonly Movement[],
  referrals: readonly Referral[],
  now: Instant,
): EdClearanceMedian {
  const minutes = journeys.flatMap((movement) => {
    const time = edClearanceTime(movement.openedAt, recordedMovementMedicalClearance(movement, referrals), now);
    return time.kind === "cleared" || time.kind === "cleared_on_arrival" ? [time.minutes] : [];
  });
  return clearanceMedian(minutes);
}
