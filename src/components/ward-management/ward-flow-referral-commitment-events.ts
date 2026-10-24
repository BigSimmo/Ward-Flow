import type { AuditDecision } from "./ward-audit";
import type { WardFlowEvent } from "./ward-flow-events";
import type { findReferral, reject, replaceReferral, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { ReferralCommitmentEntry } from "./referrals/referral-commitments";
import { REFERRAL_COMMITMENT_STEP_IDS, WARD_COMMITMENT_STEPS } from "./referrals/referral-commitments";
import {
  awaitingWardAnswer,
  commitmentEntriesFor,
  commitmentStatus,
  commitmentStepRank,
  wardCopyFor,
} from "./referrals/referral-commitments-model";
import { referralClosedForFollowUp } from "./referrals/referral-owner-and-calls-model";

/**
 * RESPONSE COMMITMENTS (closing-the-loop package A, Josh, 24 Oct 2026): what a ward agreed to do
 * about a referral waiting on its answer, and when the coordinator means to ring again. Records
 * only: destinations' `state`, `decidedAt` and the decision clock are never touched, and nothing
 * here acts on a time when it passes. See `referrals/referral-commitments.ts`.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type ReferralCommitmentEvent = Extract<WardFlowEvent, { type: "RECORD_REFERRAL_COMMITMENT" }>;

export type ReferralCommitmentHelpers = {
  findReferral: typeof findReferral;
  reject: typeof reject;
  replaceReferral: typeof replaceReferral;
};

const finiteTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function reduceReferralCommitmentEvent(
  state: WardFlowState,
  event: ReferralCommitmentEvent,
  decision: AuditDecision,
  { findReferral, reject, replaceReferral }: ReferralCommitmentHelpers,
): WardFlowState {
  const referral = findReferral(state, event.referralId);
  if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
  if (!Number.isFinite(event.now)) return reject(state, event, `${event.type} requires a finite current time`);
  if (!state.units.some((unit) => unit.id === event.unitId)) {
    return reject(state, event, `${event.type} names no ward with that id`);
  }
  if (event.role === "ward" && event.actingUnitId !== event.unitId) {
    return reject(state, event, `${event.type} refused: a ward records commitments only on its own referrals`);
  }
  const closed = referralClosedForFollowUp(referral);
  if (closed) return reject(state, event, `${event.type} refused: ${closed}`);
  const addressing = wardCopyFor(referral, event.unitId);
  if (!addressing) return reject(state, event, `referral ${referral.id} was not sent to that ward`);
  if (!awaitingWardAnswer(addressing)) {
    return reject(state, event, `referral ${referral.id} is no longer waiting on this ward's answer`);
  }

  const { step, promisedFor, nextCallbackAt } = event;
  if (step === undefined && nextCallbackAt === undefined) {
    return reject(state, event, `${event.type} needs a step, a next callback time or both`);
  }
  if (step !== undefined && !REFERRAL_COMMITMENT_STEP_IDS.includes(step)) {
    return reject(state, event, `${event.type} step must be chosen from REFERRAL_COMMITMENT_STEPS`);
  }
  if (event.role === "ward" && (step === undefined || !WARD_COMMITMENT_STEPS.includes(step))) {
    return reject(state, event, `${event.type} refused: a ward records only that it acknowledged or promised`);
  }
  if (step === "promised") {
    if (!finiteTime(promisedFor) || promisedFor < event.now) {
      return reject(state, event, `${event.type} needs a promised time from now on`);
    }
  } else if (promisedFor !== undefined) {
    return reject(state, event, `${event.type} records a promised time only with the promised step`);
  }
  if (nextCallbackAt !== undefined && (!finiteTime(nextCallbackAt) || nextCallbackAt < event.now)) {
    return reject(state, event, `${event.type} needs a next callback time from now on`);
  }

  const current = commitmentStatus(commitmentEntriesFor(addressing, event.unitId));
  if (current.step?.step === "resolved") {
    return reject(state, event, `the commitment on referral ${referral.id} is already resolved`);
  }
  if (step !== undefined) {
    const from = commitmentStepRank(current.step?.step);
    const to = commitmentStepRank(step);
    // Forward only. Asking again and re-promising a new time are the two repeats allowed.
    const repeatAllowed = step === "response_requested" || step === "promised";
    if (to < from || (to === from && !repeatAllowed)) {
      return reject(state, event, `${event.type} refused: the commitment is already past that step`);
    }
  }

  // Rebuilt from the checked fields alone, so nothing else a client sent reaches the record.
  const entry: ReferralCommitmentEntry = {
    unitId: event.unitId,
    ...(step !== undefined ? { step } : {}),
    ...(step === "promised" ? { promisedFor } : {}),
    ...(nextCallbackAt !== undefined ? { nextCallbackAt } : {}),
    at: event.now,
    by: WARD_FLOW_ROLE_LABELS[event.role],
  };
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return replaceReferral(state, referral.id, {
    ...referral,
    destinations: referral.destinations.map((candidate) =>
      candidate === addressing ? { ...addressing, commitments: [...(addressing.commitments ?? []), entry] } : candidate,
    ),
  });
}
