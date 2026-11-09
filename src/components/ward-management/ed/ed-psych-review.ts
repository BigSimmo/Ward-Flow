import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * PSYCHIATRY REVIEW TRACKER (Josh, 9 Nov 2026): where a person on the ED "Awaiting review" list
 * stands, from the times recorded on `Movement.psychReview`. Words and elapsed time only: it never
 * scores, ranks or re-orders anyone, and the list keeps its own order.
 */
export type PsychReviewStage = {
  /** "Registrar review asked 09:10", "Registrar seen · consultant pending", or "Review not yet asked for". */
  line: string;
  /** Minutes since the review was asked for, or since arrival when it has not been. */
  waitedMinutes: number;
  /** What the minutes count from, for the column and screen readers. */
  from: "request" | "arrival";
  /** The next one-tap step, if any: ask, or record who has seen the person. */
  next: readonly ("ask" | "registrar" | "consultant")[];
};

export function psychReviewStage(movement: Movement, now: Instant, minutesInDepartment: number): PsychReviewStage {
  const review = movement.psychReview;
  if (!review)
    return {
      line: "Review not yet asked for",
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
      line: `Registrar seen · consultant pending · waiting ${splitDuration(waitedMinutes)}`,
      waitedMinutes,
      from: "request",
      next: ["consultant"],
    };
  return {
    line: `Registrar review asked ${formatInstantWithDay(review.requestedAt, now)} · waiting ${splitDuration(waitedMinutes)}`,
    waitedMinutes,
    from: "request",
    next: ["registrar", "consultant"],
  };
}
