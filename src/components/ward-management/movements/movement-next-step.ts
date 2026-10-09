import { transportLeg, transportNeedState } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * Movements overhaul (9 Oct 2026, option A): the one next step for an open movement and who owns
 * it, read only from the record's own stage, referrals, declines, escalation and transport leg.
 *
 * `kind` says what the Movements page may do about it. Only the coordinator's own steps carry an
 * action, and each opens the Patient page, where the pull (with its gate checks and override
 * reason), referral and escalation forms already live. Every other step belongs to
 * another team (ED, the receiving ward or transport), so the page names the owner and offers
 * nothing it is not allowed to record. "Chase the ward" stays out (owner ruling, 12 Sep 2026).
 */
export type MovementNextStep = {
  label: string;
  owner: string;
  kind: "refer" | "escalate" | "pull" | "wait";
};

export const COORDINATOR_OWNER = "Coordinator";

export function movementNextStep(movement: Movement): MovementNextStep | null {
  if (movement.closure !== undefined) return null;
  switch (movement.stage) {
    case "placement_requested":
      return { label: "Refer to wards", owner: COORDINATOR_OWNER, kind: "refer" };
    case "destination_review": {
      if (movement.escalation !== undefined) {
        return { label: "Escalated", owner: movement.escalation.contact, kind: "wait" };
      }
      // Only live referrals can still owe an answer. Historical declines must not be
      // compared with a later referral cycle (or with an empty live list).
      const asked = movement.referredUnitIds.length;
      if (asked === 0) {
        return movement.declines.length > 0
          ? { label: "Escalate", owner: COORDINATOR_OWNER, kind: "escalate" }
          : { label: "Refer to wards", owner: COORDINATOR_OWNER, kind: "refer" };
      }
      return { label: "Ward answer", owner: "Receiving ward", kind: "wait" };
    }
    case "accepted_awaiting_bed":
      return movement.acceptedUnitId === undefined
        ? { label: "Ward answer", owner: "Receiving ward", kind: "wait" }
        : { label: "Pull bed", owner: COORDINATOR_OWNER, kind: "pull" };
    case "pulled":
      return { label: "Handover", owner: "ED team", kind: "wait" };
    case "handover_ready": {
      const leg = transportLeg(movement.transport);
      if (leg === undefined) {
        return transportNeedState(movement) === "not_needed"
          ? { label: "Arrival", owner: "Receiving ward", kind: "wait" }
          : { label: "Book transport", owner: "ED or ward", kind: "wait" };
      }
      if (leg === "Requested") return { label: "Transport accept", owner: movement.transport!.provider, kind: "wait" };
      if (leg === "Accepted") return { label: "Crew en route", owner: "Transport", kind: "wait" };
      if (leg === "En route") return { label: "Collect", owner: "Transport", kind: "wait" };
      if (leg === "Cancelled") return { label: "Rebook transport", owner: "ED or ward", kind: "wait" };
      return { label: "Arrival", owner: "Receiving ward", kind: "wait" };
    }
    case "moving":
      return { label: "Confirm arrival", owner: "Receiving ward", kind: "wait" };
    case "arrived":
      return null;
  }
}

/** True when the next step is the coordinator's own, so it belongs in "Next in my queue". */
export function isCoordinatorStep(step: MovementNextStep | null): step is MovementNextStep {
  return step !== null && step.owner === COORDINATOR_OWNER;
}
