import { closedToAdmissionsRefusal } from "./capacity/ward-closure";
import type { AuditDecision } from "./ward-audit";
import type { Instant } from "./ward-clock";
import { candidateReason, referralEligibility } from "./ward-eligibility";
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
  // One prefix for every refusal keeps this shared reducer code small (phone script budget).
  const refuse = (why: string) => reject(state, event, `ASK_MORE_WARDS refused: ${why}`);
  const referral = findReferral(state, event.referralId);
  if (!referral) return refuse("no such referral");
  if (referral.source !== "community") return refuse("only a community referral can ask more wards");
  const closed = referralClosedForFollowUp(referral) ?? (referralWithdrawn(referral) ? "It was withdrawn." : undefined);
  if (closed) return refuse(closed);
  const { unitIds } = event;
  if (!Array.isArray(unitIds) || unitIds.length === 0) return refuse("name at least one ward");
  if (new Set(unitIds).size !== unitIds.length) return refuse("it names a ward twice");

  const wardArms = referral.destinations.filter(
    (addressing): addressing is ReferralAddressing & { destination: WardDestination } =>
      addressing.destination.kind === "psychiatric_ward",
  );
  // The bed questions come from the referrer's own ward request; a broad "any ward" request names
  // no ward, so adding named wards beside it would ask the same ward twice.
  const template = wardArms[0]?.destination;
  if (!template || wardArms.some((addressing) => addressing.destination.unitId === undefined)) {
    return refuse("no named ward request to copy the bed questions from");
  }
  for (const unitId of unitIds) {
    const unit = findUnit(state, unitId);
    if (!unit) return refuse(`no ward ${unitId}`);
    if (wardArms.some((addressing) => addressing.destination.unitId === unitId)) {
      return refuse(`${unit.name} has already been asked`);
    }
    // Checked against the state now, since a bed or a gate can change after the list was opened.
    const verdict = referralEligibility(referral, { ...template, unitId }, unit, event.now);
    const why =
      closedToAdmissionsRefusal(unit) ??
      (verdict.eligible ? null : `${unit.name} does not fit this referral now: ${candidateReason(verdict)}`);
    if (why) return refuse(why);
  }
  const cap = state.configuration.parallelReferralCap;
  if (wardArms.filter((addressing) => isAwaitingAnswer(addressing)).length + unitIds.length > cap) {
    return refuse(`no more than ${cap} wards may wait at once`);
  }

  const addedBy = WARD_FLOW_ROLE_LABELS[event.role];
  const added: ReferralAddressing[] = unitIds.map((unitId) => ({
    destination: { ...template, unitId },
    state: "queued",
    referredAt: event.now,
    addedBy,
  }));
  decision.outcome = "accepted";
  decision.reasonCode = "none";
  return replaceReferral(state, referral.id, { ...referral, destinations: [...referral.destinations, ...added] });
}
