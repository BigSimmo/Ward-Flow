import { communityTeamById } from "@/components/ward-management/community/community-derivations";

import type { AuditDecision } from "./ward-audit";
import type { WardFlowEvent } from "./ward-flow-events";
import type { findReferral, reject, replaceReferral, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import {
  REFERRAL_CONTACT_OUTCOME_IDS,
  REFERRAL_CONTACT_TARGET_KINDS,
  REFERRAL_OWNER_DESKS,
} from "./referrals/referral-owner-and-calls";
import { currentReferralOwner, referralClosedForFollowUp } from "./referrals/referral-owner-and-calls-model";

/**
 * REFERRAL OWNER AND CALL LOG (fix plan item 4, Josh, 21 Oct 2026): who is chasing a front-door
 * referral, and the calls made about it. Neither event answers the referral: destinations, `state`
 * and the decision clock are never touched. See `referrals/referral-owner-and-calls.ts`.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type ReferralOwnerEvent = Extract<WardFlowEvent, { type: "ASSIGN_REFERRAL" | "LOG_REFERRAL_CONTACT" }>;

export type ReferralOwnerHelpers = {
  findReferral: typeof findReferral;
  reject: typeof reject;
  replaceReferral: typeof replaceReferral;
};

export function reduceReferralOwnerEvent(
  state: WardFlowState,
  event: ReferralOwnerEvent,
  decision: AuditDecision,
  { findReferral, reject, replaceReferral }: ReferralOwnerHelpers,
): WardFlowState {
  const referral = findReferral(state, event.referralId);
  if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
  const closed = referralClosedForFollowUp(referral);
  if (closed) return reject(state, event, `${event.type} refused: ${closed}`);
  const by = WARD_FLOW_ROLE_LABELS[event.role];

  switch (event.type) {
    case "ASSIGN_REFERRAL": {
      if (!REFERRAL_OWNER_DESKS.includes(event.owner)) {
        return reject(state, event, `${event.type} owner must be chosen from REFERRAL_OWNER_DESKS`);
      }
      // The coordinator hands a referral to any listed desk; every other desk takes it for itself.
      if (event.role !== "coordinator" && event.owner !== event.role) {
        return reject(
          state,
          event,
          `${by} may take a referral only for its own desk; the bed coordinator assigns it to another desk`,
        );
      }
      if (currentReferralOwner(referral)?.owner === event.owner) {
        return reject(state, event, `referral ${referral.id} is already assigned to that desk`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceReferral(state, referral.id, {
        ...referral,
        ownerHistory: [...(referral.ownerHistory ?? []), { owner: event.owner, at: event.now, by }],
      });
    }

    case "LOG_REFERRAL_CONTACT": {
      const contact = event.contact as unknown;
      const kind = typeof contact === "object" && contact !== null ? (contact as { kind?: unknown }).kind : undefined;
      if (!(REFERRAL_CONTACT_TARGET_KINDS as readonly unknown[]).includes(kind)) {
        return reject(state, event, `${event.type} contact must be a ward, a community team or the referrer`);
      }
      if (!REFERRAL_CONTACT_OUTCOME_IDS.includes(event.outcome)) {
        return reject(state, event, `${event.type} outcome must be chosen from REFERRAL_CONTACT_OUTCOMES`);
      }
      // Rebuilt from the checked fields alone, so nothing else a client sent reaches the record.
      let recorded: typeof event.contact;
      switch (event.contact.kind) {
        case "psychiatric_ward": {
          const { unitId } = event.contact;
          if (!state.units.some((unit) => unit.id === unitId)) {
            return reject(state, event, `${event.type} names no ward with id ${String(unitId)}`);
          }
          recorded = { kind: "psychiatric_ward", unitId };
          break;
        }
        case "community_team": {
          const team = typeof event.contact.teamId === "string" ? communityTeamById(event.contact.teamId) : null;
          if (!team) return reject(state, event, `${event.type} names no community team with that id`);
          recorded = { kind: "community_team", teamId: team.id };
          break;
        }
        case "referrer":
          recorded = { kind: "referrer" };
          break;
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceReferral(state, referral.id, {
        ...referral,
        contactLog: [...(referral.contactLog ?? []), { contact: recorded, outcome: event.outcome, at: event.now, by }],
      });
    }
  }
}
