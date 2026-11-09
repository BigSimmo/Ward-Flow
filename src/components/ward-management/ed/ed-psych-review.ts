import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * PSYCHIATRY REVIEW TRACKER (Josh, 9 Nov 2026): where a person on the ED "Awaiting review" list
 * stands, from the times recorded on `Movement.psychReview`. Words and elapsed time only: it never
 * scores, ranks or re-orders anyone, and the list keeps its own order.
 */
export type PsychReviewStage = {
  /** "Review asked 09:10 · 2h 05m", "Consultant pending · 2h 05m", or "Review not asked for". */
  line: string;
  /** Minutes since the review was asked for, or since arrival when it has not been. */
  waitedMinutes: number;
  /** What the minutes count from, for the column and screen readers. */
  from: "request" | "arrival";
  /** The next one-tap step, if any: ask, or record who has seen the person. */
  next: readonly ("ask" | "registrar" | "consultant")[];
};

/** `minutesInDepartment` is the wait shown only before a review is asked for; once asked, the wait runs from the request. */
export function psychReviewStage(movement: Movement, now: Instant, minutesInDepartment: number): PsychReviewStage {
  const review = movement.psychReview;
  if (!review)
    return {
      line: "Review not asked for",
      waitedMinutes: minutesInDepartment,
      from: "arrival",
      next: ["ask"],
    };
  const waitedMinutes = Math.max(0, now - review.requestedAt);
  if (review.consultantSeenAt !== undefined)
    return {
      line: `Consultant seen ${formatInstantWithDay(review.consultantSeenAt, now)}`,
      waitedMinutes,
      from: "request",
      next: [],
    };
  if (review.registrarSeenAt !== undefined)
    return {
      line: `Consultant pending${waitText(waitedMinutes)}`,
      waitedMinutes,
      from: "request",
      next: ["consultant"],
    };
  return {
    line: `Review asked ${formatInstantWithDay(review.requestedAt, now)}${waitText(waitedMinutes)}`,
    waitedMinutes,
    from: "request",
    next: ["registrar", "consultant"],
  };
}

/** " · 2h 05m" (kept on one line), or nothing in the first minute, so a fresh request never reads "waiting 0m". */
function waitText(minutes: number): string {
  return minutes < 1 ? "" : ` · ${splitDuration(minutes).replace(" ", "\u00a0")}`;
}
