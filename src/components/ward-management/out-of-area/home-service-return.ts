import { dayOf, MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import { siteByCode } from "@/components/ward-management/ward-sites";

/**
 * Closing-the-loop features (24 Oct 2026, package E): "Repatriation: asked vs agreed".
 *
 * A person away from home has a return plan. Asking the home health service to take them back and
 * that service agreeing are two different facts, recorded at two different times, often by phone a
 * day or more apart. This record keeps them apart: when the return was requested and by which desk,
 * then the home service's answer, the prerequisites it agreed to, and the next review date, each with
 * the desk and the time.
 *
 * 🔒 **IT RECORDS ONLY.** Nothing here books a bed, moves a person, raises a movement or sets a date
 * by itself. The review date is the one the coordinator chose. `RECORD_REPATRIATION` (transport
 * phone-log, unchanged) stays the separate step that queues the return movement.
 *
 * 🔒 **CLOSED LISTS AND ROLES ONLY.** No typed text, no names: `by` is the acting desk's role.
 */

export const HOME_SERVICE_ANSWERS = ["agreed", "not_yet_agreed", "declined"] as const;
export type HomeServiceAnswer = (typeof HOME_SERVICE_ANSWERS)[number];

export const HOME_SERVICE_ANSWER_LABELS: Record<HomeServiceAnswer, string> = {
  agreed: "Agreed",
  not_yet_agreed: "Not yet agreed",
  declined: "Declined",
};

/** What the home service said must be in place before the person returns. A closed list. */
export const RETURN_PREREQUISITES = [
  "home_bed_available",
  "transport_arranged",
  "legal_papers_sent",
  "medical_review_done",
  "community_team_follow_up",
  "family_or_carer_told",
] as const;
export type ReturnPrerequisite = (typeof RETURN_PREREQUISITES)[number];

export const RETURN_PREREQUISITE_LABELS: Record<ReturnPrerequisite, string> = {
  home_bed_available: "Bed free at the home service",
  transport_arranged: "Transport arranged",
  legal_papers_sent: "Legal papers sent",
  medical_review_done: "Medical review done",
  community_team_follow_up: "Community team follow-up set",
  family_or_carer_told: "Family or carer told",
};

/** How far ahead a review date can be chosen, in whole days from today. */
export const RETURN_REVIEW_DAY_CHOICES = [0, 1, 2, 3, 7, 14] as const;

/** One record per stay, kept as the latest answer. The audit log holds each step. */
export type HomeServiceReturnRecord = {
  admissionId: string;
  /** Site code of the home health service asked, from `wardSites`. */
  homeHospital: string;
  requestedAt: Instant;
  requestedBy: WardFlowRole;
  answer?: HomeServiceAnswer;
  answeredAt?: Instant;
  answeredBy?: WardFlowRole;
  /** The prerequisites the home service agreed to. Empty unless an answer is recorded. */
  prerequisites: ReturnPrerequisite[];
  /** Start of the chosen review day. */
  nextReviewAt?: Instant;
};

/**
 * One event, two steps. `requested` names the home service asked; `answered` records its answer and
 * the prerequisites it agreed to. Either may set the next review date.
 */
export type HomeServiceReturnEvent = {
  type: "RECORD_HOME_SERVICE_RETURN";
  role: WardFlowRole;
  /** The event clock (as every event carries), not a stored field, so not listed for re-anchoring. */
  now: number;
  admissionId: string;
  step: "requested" | "answered";
  /** `requested` only: site code of the home health service asked. */
  homeHospital?: string;
  /** `answered` only. */
  answer?: HomeServiceAnswer;
  /** `answered` only: the prerequisites agreed, from `RETURN_PREREQUISITES`. */
  prerequisites?: ReturnPrerequisite[];
  nextReviewAt?: Instant;
};

/** The start of the day `days` from today on the session clock. */
export function reviewDayInstant(now: Instant, days: number): Instant {
  return (dayOf(now) + days) * MINUTES_PER_DAY;
}

/** "Review today", "Review tomorrow", "Review in 3 days", "Review date passed 2 days ago". */
export function reviewDayText(at: Instant, now: Instant): string {
  const offset = dayOf(at) - dayOf(now);
  if (offset === 0) return "Review today";
  if (offset === 1) return "Review tomorrow";
  if (offset > 1) return `Review in ${offset} days`;
  return `Review date passed ${-offset} ${offset === -1 ? "day" : "days"} ago`;
}

export function homeServiceReturnOf(
  records: readonly HomeServiceReturnRecord[] | undefined,
  admissionId: string,
): HomeServiceReturnRecord | undefined {
  return records?.find((record) => record.admissionId === admissionId);
}

/** "Return requested" until the home service's answer is "agreed"; then "Home service agreed". */
export function homeServiceReturnStage(record: HomeServiceReturnRecord | undefined) {
  if (!record) return "none" as const;
  return record.answer === "agreed" ? ("agreed" as const) : ("requested" as const);
}

function validReview(at: unknown): boolean {
  return at === undefined || (typeof at === "number" && Number.isFinite(at));
}

export function reduceHomeServiceReturn(
  state: WardFlowState,
  event: HomeServiceReturnEvent,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  const admission = state.admissions.find((candidate) => candidate.id === event.admissionId);
  if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
  if (admission.state === "departed") return reject(state, event, "RECORD_HOME_SERVICE_RETURN needs a current stay");
  if (!validReview(event.nextReviewAt))
    return reject(state, event, "RECORD_HOME_SERVICE_RETURN review date is invalid");
  const records = state.homeServiceReturns ?? [];
  const existing = homeServiceReturnOf(records, admission.id);
  let next: HomeServiceReturnRecord;
  if (event.step === "requested") {
    if (event.homeHospital === undefined || !siteByCode(event.homeHospital)) {
      return reject(state, event, `RECORD_HOME_SERVICE_RETURN homeHospital ${event.homeHospital} is not a listed site`);
    }
    // A fresh request starts over: an earlier answer belonged to the earlier request.
    next = {
      admissionId: admission.id,
      homeHospital: event.homeHospital,
      requestedAt: event.now,
      requestedBy: event.role,
      prerequisites: [],
      ...(event.nextReviewAt !== undefined ? { nextReviewAt: event.nextReviewAt } : {}),
    };
  } else if (event.step === "answered") {
    if (!existing) return reject(state, event, "RECORD_HOME_SERVICE_RETURN answer needs a recorded request first");
    if (event.answer === undefined || !HOME_SERVICE_ANSWERS.includes(event.answer)) {
      return reject(state, event, "RECORD_HOME_SERVICE_RETURN answer must be chosen from the listed answers");
    }
    const prerequisites = Array.isArray(event.prerequisites) ? event.prerequisites : [];
    if (!prerequisites.every((item) => RETURN_PREREQUISITES.includes(item))) {
      return reject(state, event, "RECORD_HOME_SERVICE_RETURN prerequisites must be chosen from the listed kinds");
    }
    if (event.answer === "declined" && prerequisites.length > 0) {
      return reject(state, event, "RECORD_HOME_SERVICE_RETURN a declined answer carries no agreed prerequisites");
    }
    next = {
      ...existing,
      answer: event.answer,
      answeredAt: event.now,
      answeredBy: event.role,
      // Listed order, one of each, never the order they were ticked in.
      prerequisites: RETURN_PREREQUISITES.filter((item) => prerequisites.includes(item)),
      ...(event.nextReviewAt !== undefined ? { nextReviewAt: event.nextReviewAt } : {}),
    };
  } else {
    return reject(state, event, "RECORD_HOME_SERVICE_RETURN step must be requested or answered");
  }
  return {
    ...state,
    homeServiceReturns: existing
      ? records.map((record) => (record.admissionId === admission.id ? next : record))
      : [...records, next],
  };
}
