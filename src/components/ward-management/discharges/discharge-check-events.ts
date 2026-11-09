import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { DischargeDependencyEvent } from "./discharge-dependency-events";
import {
  admissionBelongsToTeam,
  communityTeamById,
} from "@/components/ward-management/community/community-derivations";
import {
  isDischargeCheckItem,
  isDischargeCheckState,
  isFollowUpDeclineReason,
  isFollowUpReplyState,
  type DischargeCheckItem,
  type DischargeCheckState,
  type FollowUpDeclineReason,
  type FollowUpReply,
  type FollowUpReplyState,
} from "@/components/ward-management/ward-discharge-checklist";

/**
 * The discharge desk's events in one union, so the shared event file (at its line cap) names them
 * once: package B's dependencies and plan changes, and the checklist and follow-up reply below.
 */
export type DischargeDeskEvent = DischargeDependencyEvent | DischargeCheckEvent;

/**
 * Feature 37 and feature 13 (9 Nov 2026): the two recorded events behind the discharge checklist
 * and the community team's follow-up reply. Declared here beside their reducer so the shared event
 * file stays small. Neither carries typed text, and neither changes a discharge, a release or any
 * bed figure: the checklist is advisory and never blocks a departure.
 */
export type DischargeCheckEvent =
  | {
      /** Tick one checklist item done, not needed or outstanding. Ward-scoped: a ward ticks its own stays. */
      type: "RECORD_DISCHARGE_CHECK";
      role: WardFlowRole;
      now: Instant;
      actingUnitId?: string;
      admissionId: string;
      item: DischargeCheckItem;
      state: DischargeCheckState;
    }
  | {
      /**
       * The community team's reply to following this person up after discharge. Team-scoped: a
       * community desk replies only for a stay referred to its own team. `declineReason` is
       * required with `declined` and refused with anything else.
       */
      type: "RECORD_FOLLOW_UP_REPLY";
      role: WardFlowRole;
      now: Instant;
      actingTeamId?: string;
      admissionId: string;
      reply: FollowUpReplyState;
      declineReason?: FollowUpDeclineReason;
    };

export function reduceDischargeCheckEvent(
  state: WardFlowState,
  event: DischargeCheckEvent,
  reject: (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState,
): WardFlowState {
  const admission = state.admissions.find((candidate) => candidate.id === event.admissionId);
  if (!admission) return reject(state, event, `no admission found for id ${event.admissionId}`);
  if (admission.state === "waitlisted") return reject(state, event, `${event.type} needs a stay with a bed`);

  if (event.type === "RECORD_DISCHARGE_CHECK") {
    // Claim, not proof, as RECORD_WARD_DIAGNOSIS: a ward ticks only its own stay.
    if (event.role === "ward" && event.actingUnitId !== admission.unitId) {
      return reject(
        state,
        event,
        `RECORD_DISCHARGE_CHECK was raised acting as unit ${event.actingUnitId} but admission ${admission.id} is at ${admission.unitId}`,
      );
    }
    // Chosen, never typed: the runtime half of the union checks, for an untyped caller.
    if (!isDischargeCheckItem(event.item)) return reject(state, event, "RECORD_DISCHARGE_CHECK item is not listed");
    if (!isDischargeCheckState(event.state)) return reject(state, event, "RECORD_DISCHARGE_CHECK state is not listed");
    if (admission.dischargeChecks?.[event.item]?.state === event.state) {
      return reject(state, event, "RECORD_DISCHARGE_CHECK: this item already has that state");
    }
    const dischargeChecks = {
      ...admission.dischargeChecks,
      [event.item]: { state: event.state, at: event.now, by: event.role },
    };
    return {
      ...state,
      admissions: state.admissions.map((candidate) =>
        candidate.id === admission.id ? { ...candidate, dischargeChecks } : candidate,
      ),
    };
  }

  if (event.role === "community") {
    const team = event.actingTeamId ? communityTeamById(event.actingTeamId) : null;
    if (!team) return reject(state, event, "RECORD_FOLLOW_UP_REPLY needs the community team it is acting as");
    if (!admissionBelongsToTeam(admission, team, state.referrals)) {
      return reject(state, event, `RECORD_FOLLOW_UP_REPLY: admission ${admission.id} was not referred to ${team.name}`);
    }
  }
  if (!isFollowUpReplyState(event.reply)) return reject(state, event, "RECORD_FOLLOW_UP_REPLY reply is not listed");
  if (event.reply === "declined" ? !isFollowUpDeclineReason(event.declineReason) : event.declineReason !== undefined) {
    return reject(state, event, "RECORD_FOLLOW_UP_REPLY: a decline needs a listed reason, and only a decline has one");
  }
  const current = admission.followUpReply;
  if (current?.state === event.reply && current.reason === event.declineReason) {
    return reject(state, event, "RECORD_FOLLOW_UP_REPLY: this reply is already recorded");
  }
  const followUpReply: FollowUpReply = {
    state: event.reply,
    ...(event.reply === "declined" && event.declineReason ? { reason: event.declineReason } : {}),
    at: event.now,
    by: event.role,
  };
  return {
    ...state,
    admissions: state.admissions.map((candidate) =>
      candidate.id === admission.id ? { ...candidate, followUpReply } : candidate,
    ),
  };
}
