import type { Instant } from "./ward-clock";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { WardFlowRole } from "./ward-flow-roles";
import { sameWeekend } from "./discharges/discharge-weekend-review";
import { WEEKEND_REVIEW_REACH_MINUTES } from "./ward-operational-defaults";

/**
 * Feature 14 (Josh, 9 Nov 2026): a ward or the coordinator ticks a weekend discharge as reviewed.
 * `weekendStart` is that weekend's first midnight (`upcomingWeekendWindow`), so the tick belongs to
 * one weekend and the next week starts unticked. Records that a desk looked, with the time; it
 * changes no date, no bed and no plan. Kept in its own file for the events file's line cap.
 */
export type MarkWeekendDischargeReviewedEvent = {
  type: "MARK_WEEKEND_DISCHARGE_REVIEWED";
  role: WardFlowRole;
  now: Instant;
  actingUnitId?: string;
  admissionId: string;
  weekendStart: Instant;
};

export function reduceWeekendDischargeReview(
  state: WardFlowState,
  event: MarkWeekendDischargeReviewedEvent,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  const admission = state.admissions.find((candidate) => candidate.id === event.admissionId);
  if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
  // Same claim-not-proof discipline as RECORD_WARD_DIAGNOSIS: a ward may only touch its own stay.
  if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
    return reject(
      state,
      event,
      `MARK_WEEKEND_DISCHARGE_REVIEWED was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
    );
  }
  if (admission.state !== "pulled" && admission.state !== "occupied") {
    return reject(state, event, "MARK_WEEKEND_DISCHARGE_REVIEWED needs a current inpatient stay");
  }
  if (
    !Number.isFinite(event.weekendStart) ||
    event.weekendStart > event.now + WEEKEND_REVIEW_REACH_MINUTES ||
    event.weekendStart < event.now - WEEKEND_REVIEW_REACH_MINUTES
  ) {
    return reject(state, event, "MARK_WEEKEND_DISCHARGE_REVIEWED weekend is not this week's");
  }
  if (
    (admission.weekendDischargeReviews ?? []).some((review) => sameWeekend(review.weekendStart, event.weekendStart))
  ) {
    return reject(state, event, "MARK_WEEKEND_DISCHARGE_REVIEWED is already recorded for this weekend");
  }
  const review = { weekendStart: event.weekendStart, at: event.now, by: event.role };
  return {
    ...state,
    admissions: state.admissions.map((candidate) =>
      candidate.id === admission.id
        ? { ...candidate, weekendDischargeReviews: [...(candidate.weekendDischargeReviews ?? []), review] }
        : candidate,
    ),
  };
}
