import { closedToAdmissionsRefusal } from "./capacity/ward-closure";
import type { AuditDecision } from "./ward-audit";
import type { Instant } from "./ward-clock";
import type { findReferral, findUnit, reject, replaceReferral, WardFlowState } from "./ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "./ward-flow-roles";
import type { ReferralAddressing, ReferralDestination } from "./ward-model";
import { isAwaitingAnswer, referralWithdrawn } from "./ward-referrals";
import { referralClosedForFollowUp } from "./referrals/referral-owner-and-calls-model";

/**
 * ASK MORE WARDS (fix plan item 16, D-76, Josh, 21 Oct 2026): the coordinator asks further wards
 * about an open community referral, without the referrer raising it again. Each ward added is its
 * own addressing with when it was asked (`referredAt`) and who asked (`addedBy`, a role). No more
 * than `parallelReferralCap` wards wait at once; a ward that declined or was withdrawn does not
 * count. Nothing here ranks or suggests a ward (D-71): the coordinator names them.
 *
 * The bed questions (sex, gender, security, legal and acuity needs) are the referral's own answers,
 * copied from the ward request the referrer already made, so a new ward is asked the same thing.
 *
 * The reducer passes its helpers in, since this file may not import the reducer at run time.
 */
export type ReferralAskEvent = {
  type: "ASK_MORE_WARDS";
  role: WardFlowRole;
  now: Instant;
  referralId: string;
  /** The wards to ask, named by the coordinator. Never ranked or suggested (D-71). */
  unitIds: string[];
};

export type ReferralAskHelpers = {
  findReferral: typeof findReferral;
  findUnit: typeof findUnit;
  reject: typeof reject;
  replaceReferral: typeof replaceReferral;
};

type WardDestination = Extract<ReferralDestination, { kind: "psychiatric_ward" }>;

export function reduceReferralAskEvent(
  state: WardFlowState,
  event: ReferralAskEvent,
  decision: AuditDecision,
  { findReferral, findUnit, reject, replaceReferral }: ReferralAskHelpers,
): WardFlowState {
  const referral = findReferral(state, event.referralId);
  if (!referral) return reject(state, event, `no referral found for id ${event.referralId}`);
  if (referral.source !== "community") {
    return reject(state, event, `${event.type} is for a community referral; this one came from ${referral.source}`);
  }
  const closed = referralClosedForFollowUp(referral) ?? (referralWithdrawn(referral) ? "It was withdrawn." : undefined);
  if (closed) return reject(state, event, `${event.type} refused: ${closed}`);
  if (!Number.isFinite(event.now)) return reject(state, event, `${event.type} requires a finite current time`);
  const unitIds = event.unitIds as unknown;
  if (!Array.isArray(unitIds) || unitIds.length === 0 || !unitIds.every((id) => typeof id === "string")) {
    return reject(state, event, `${event.type} needs at least one ward`);
  }
  if (new Set(unitIds).size !== unitIds.length) return reject(state, event, `${event.type} names a ward twice`);

  const wardArms = referral.destinations.filter(
    (addressing): addressing is ReferralAddressing & { destination: WardDestination } =>
      addressing.destination.kind === "psychiatric_ward",
  );
  // The bed questions come from the referrer's own ward request; a broad "any ward" request names
  // no ward, so adding named wards beside it would ask the same ward twice.
  const template = wardArms[0]?.destination;
  if (!template) return reject(state, event, `${event.type} needs the referral's own ward request to copy from`);
  if (wardArms.some((addressing) => addressing.destination.unitId === undefined)) {
    return reject(state, event, `${event.type} cannot add wards to a referral sent to any ward`);
  }
  const asked = new Set(wardArms.map((addressing) => addressing.destination.unitId));
  for (const unitId of unitIds as string[]) {
    const unit = findUnit(state, unitId);
    if (!unit) return reject(state, event, `${event.type} names no ward with id ${unitId}`);
    if (asked.has(unitId)) return reject(state, event, `${unit.name} has already been asked about this referral`);
    const closedRefusal = closedToAdmissionsRefusal(unit);
    if (closedRefusal) return reject(state, event, closedRefusal);
  }
  const waiting = wardArms.filter((addressing) => isAwaitingAnswer(addressing)).length;
  const cap = state.configuration.parallelReferralCap;
  if (waiting + unitIds.length > cap) {
    return reject(
      state,
      event,
      `${event.type} would leave ${waiting + unitIds.length} wards waiting; no more than ${cap} may wait at once`,
    );
  }

  const addedBy = WARD_FLOW_ROLE_LABELS[event.role];
  const added: ReferralAddressing[] = (unitIds as string[]).map((unitId) => ({
    destination: {
      kind: "psychiatric_ward",
      unitId,
      sex: template.sex,
      ...(template.gender !== undefined ? { gender: template.gender } : {}),
      secureBedNeeded: template.secureBedNeeded,
      involuntaryBedNeeded: template.involuntaryBedNeeded,
      highAcuityNursingNeeded: template.highAcuityNursingNeeded,
    },
    state: "queued",
    referredAt: event.now,
    addedBy,
  }));
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return replaceReferral(state, referral.id, { ...referral, destinations: [...referral.destinations, ...added] });
}
