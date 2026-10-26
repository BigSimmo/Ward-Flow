import type { AuditDecision } from "./ward-audit";
import type { WardFlowEvent } from "./ward-flow-events";
import type { findReferral, reject, replaceReferral, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "./ward-flow-roles";
import type { Referral, ReferralAddressing } from "./ward-model";
import { REFERRAL_INFORMATION_NEED_IDS, openInformationNeeds } from "./referrals/referral-information-needs";

/**
 * REFERRAL FOLLOW-UP (smart features ideas 3 and 4, 19 Oct 2026): the "opened by the ward" receipt
 * and the "what we still need" list on a front-door referral's ward copy. None of these events
 * answers the referral: `state`, `decidedAt` and the decision clock are never touched.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type ReferralFollowUpEvent = Extract<
  WardFlowEvent,
  { type: "MARK_REFERRAL_OPENED" | "REQUEST_REFERRAL_INFORMATION" | "MARK_REFERRAL_INFORMATION_MET" }
>;

export type ReferralFollowUpHelpers = {
  findReferral: typeof findReferral;
  reject: typeof reject;
  replaceReferral: typeof replaceReferral;
};

/**
 * This referral's copy for `unitId`: the one named for that ward, else an unnamed ward copy (open to
 * any ward), the same addressing rule `DECLINE_REFERRAL` uses.
 */
function wardCopy(referral: Referral, unitId: string): ReferralAddressing | undefined {
  const wardCopies = referral.destinations.filter((addressing) => addressing.destination.kind === "psychiatric_ward");
  return (
    wardCopies.find(
      (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.destination.unitId === unitId,
    ) ??
    wardCopies.find(
      (addressing) => addressing.destination.kind === "psychiatric_ward" && addressing.destination.unitId === undefined,
    )
  );
}

/** Still waiting on this ward's answer: queued, not withdrawn. */
function awaitingAnswer(addressing: ReferralAddressing): boolean {
  return addressing.state === "queued" && addressing.withdrawnAt === undefined;
}

export function reduceReferralFollowUpEvent(
  state: WardFlowState,
  event: ReferralFollowUpEvent,
  decision: AuditDecision,
  { findReferral, reject, replaceReferral }: ReferralFollowUpHelpers,
): WardFlowState {
  const referral = findReferral(state, event.referralId);
  if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
  if (event.type === "MARK_REFERRAL_INFORMATION_MET") {
    const all = event.allRequestingWards !== undefined;
    const named = event.wardUnitId !== undefined;
    if (
      all === named ||
      (all && event.allRequestingWards !== true) ||
      (named && (typeof event.wardUnitId !== "string" || event.wardUnitId.length === 0)) ||
      !REFERRAL_INFORMATION_NEED_IDS.includes(event.need)
    )
      return reject(state, event, "Choose one information request target and a listed item.");
    // The shared command boundary independently verifies this desk against the stored sender.
    // Keep the existing ward-source restriction for both target shapes.
    if (event.role === "ward" && referral.source !== "psychiatric_ward")
      return reject(state, event, `only the desk that sent referral ${referral.id} ticks its items off`);
    if (all) {
      let changed = false;
      const destinations = referral.destinations.map((arm) => {
        if (arm.destination.kind !== "psychiatric_ward" || !awaitingAnswer(arm)) return arm;
        const needs = arm.informationNeeds;
        if (!needs?.some((entry) => entry.need === event.need && entry.metAt === undefined)) return arm;
        changed = true;
        return {
          ...arm,
          informationNeeds: needs.map((entry) =>
            entry.need === event.need && entry.metAt === undefined
              ? { ...entry, metAt: event.now, metBy: WARD_FLOW_ROLE_LABELS[event.role] }
              : entry,
          ),
        };
      });
      if (!changed) return reject(state, event, "No current request is waiting on that item.");
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return replaceReferral(state, referral.id, { ...referral, destinations });
    }
  }
  const unitId = event.type === "MARK_REFERRAL_INFORMATION_MET" ? event.wardUnitId : event.unitId;
  if (typeof unitId !== "string") return reject(state, event, "Choose an information request target.");
  const addressing = wardCopy(referral, unitId);
  if (!addressing) return reject(state, event, `referral ${referral.id} was not sent to unit ${unitId}`);
  const update = (next: ReferralAddressing) =>
    replaceReferral(state, referral.id, {
      ...referral,
      destinations: referral.destinations.map((candidate) => (candidate === addressing ? next : candidate)),
    });

  switch (event.type) {
    case "MARK_REFERRAL_OPENED": {
      if (event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `${event.type} was raised acting as unit ${event.actingUnitId} but names unit ${event.unitId}; a ward opens only its own referrals`,
        );
      }
      if (addressing.openedAt !== undefined) {
        return reject(state, event, `referral ${referral.id} is already marked as opened by this ward`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return update({ ...addressing, openedAt: event.now });
    }

    case "REQUEST_REFERRAL_INFORMATION": {
      if (event.role === "ward" && event.actingUnitId !== event.unitId) {
        return reject(
          state,
          event,
          `${event.type} was raised acting as unit ${event.actingUnitId ?? "no named ward"} but names unit ${event.unitId}; a ward asks only on its own referrals`,
        );
      }
      if (!awaitingAnswer(addressing)) {
        return reject(state, event, `referral ${referral.id} is no longer waiting on this ward's answer`);
      }
      if (event.needs.length === 0) return reject(state, event, `${event.type} needs at least one item`);
      if (!event.needs.every((need) => REFERRAL_INFORMATION_NEED_IDS.includes(need))) {
        return reject(state, event, `${event.type} items must all be chosen from REFERRAL_INFORMATION_NEEDS`);
      }
      const open = new Set(openInformationNeeds(addressing.informationNeeds).map((entry) => entry.need));
      const added = [...new Set(event.needs)].filter((need) => !open.has(need));
      if (added.length === 0) return reject(state, event, "Every item asked for is already waiting on the referrer");
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const by = WARD_FLOW_ROLE_LABELS[event.role];
      return update({
        ...addressing,
        informationNeeds: [
          ...(addressing.informationNeeds ?? []),
          ...added.map((need) => ({ need, at: event.now, by })),
        ],
      });
    }

    case "MARK_REFERRAL_INFORMATION_MET": {
      // D-80: a ward ticks off only what a ward sent, never the copy it is answering.
      if (event.role === "ward" && referral.source !== "psychiatric_ward") {
        return reject(state, event, `only the desk that sent referral ${referral.id} ticks its items off`);
      }
      // Once the ward has answered, or the referrer has withdrawn, the ask is closed, as for raising one.
      if (!awaitingAnswer(addressing)) {
        return reject(state, event, `referral ${referral.id} is no longer waiting on this ward's answer`);
      }
      const index = (addressing.informationNeeds ?? []).findIndex(
        (entry) => entry.need === event.need && entry.metAt === undefined,
      );
      if (index < 0) return reject(state, event, `nothing on referral ${referral.id} is waiting on that item`);
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const metBy = WARD_FLOW_ROLE_LABELS[event.role];
      return update({
        ...addressing,
        informationNeeds: (addressing.informationNeeds ?? []).map((entry, at) =>
          at === index ? { ...entry, metAt: event.now, metBy } : entry,
        ),
      });
    }
  }
}
