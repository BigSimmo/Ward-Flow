import * as z from "zod/mini";
import { isObservation, type Observation } from "./ward-observation";
import type { Admission } from "./ward-admissions";
import type { WardFlowState } from "./ward-flow-reducer";

/** Restore receives groups from the approved identity fence; this helper reads placement facts only. */
export function storedPlacementInvariants(
  state: WardFlowState,
  patientStays: readonly (readonly Pick<Admission, "id" | "unitId" | "state">[])[],
): boolean {
  const onLeave = new Set(state.leaveBeds.map((row) => row.admissionId));
  const active = state.admissions.filter((row) => row.state === "occupied" || row.state === "pulled");
  for (const stay of state.admissions) {
    // Departure retains this timestamp as history; only simultaneous live absence claims conflict.
    if (stay.awayAtEmergencyDepartmentSince !== null && onLeave.has(stay.id)) return false;
  }
  for (const stays of patientStays) {
    if (stays.length < 2) continue;
    if (stays.length !== 2) return false;
    // A recorded transfer holds the sending bed until destination arrival atomically departs it.
    const source = stays.find((row) => row.state === "occupied");
    const destination = stays.find((row) => row.state === "pulled");
    if (!source || !destination || source.unitId === destination.unitId) return false;
    const movement = state.movements.find((row) => row.admissionId === destination.id);
    if (!movement || movement.closure !== undefined || movement.acceptedUnitId !== destination.unitId) return false;
    const pinnedSource = movement.sourceAdmissionId ?? movement.referralSourceAdmissionId;
    if (pinnedSource !== undefined) {
      if (pinnedSource !== source.id) return false;
    } else {
      const referral = state.referrals.find((row) => row.id === movement.referralId);
      if (referral?.source !== "psychiatric_ward" || referral.originUnitId !== source.unitId) return false;
    }
  }

  // Linked movement/referral/admission copies are one owner; unrelated owners cannot share a number.
  const claims = new Map<string, string>();
  const units = new Map(state.units.map((row) => [row.id, row]));
  const claim = (unitId: string, bed: number, owner: string): boolean => {
    const unit = units.get(unitId);
    if (!unit || !Number.isSafeInteger(bed) || bed < 1 || bed > unit.beds) return false;
    const key = `${unitId}:${bed}`;
    const previous = claims.get(key);
    if (previous !== undefined && previous !== owner) return false;
    claims.set(key, owner);
    return true;
  };
  const movementOwner = (movement: WardFlowState["movements"][number]) => {
    const stay = active.find((row) => row.id === movement.admissionId || row.movementId === movement.id);
    return stay ? `admission:${stay.id}` : `movement:${movement.id}`;
  };
  for (const stay of active) {
    if (stay.bedNumber !== undefined && !claim(stay.unitId, stay.bedNumber, `admission:${stay.id}`)) return false;
  }
  for (const movement of state.movements) {
    if (movement.closure !== undefined || movement.heldBedNumber === undefined) continue;
    if (
      movement.acceptedUnitId === undefined ||
      !claim(movement.acceptedUnitId, movement.heldBedNumber, movementOwner(movement))
    )
      return false;
  }
  for (const referral of state.referrals) {
    for (const arm of referral.destinations) {
      if (arm.state !== "accepted" || arm.heldBedNumber === undefined || arm.destination.kind !== "psychiatric_ward")
        continue;
      const unitId = arm.acceptedUnitId ?? arm.destination.unitId;
      if (unitId === undefined) return false;
      if (
        state.movements.some(
          (row) => row.referralId === referral.id && row.stage === "arrived" && row.acceptedUnitId === unitId,
        )
      )
        continue;
      const movement = state.movements.find(
        (row) => row.referralId === referral.id && row.closure === undefined && row.acceptedUnitId === unitId,
      );
      const stay = active.find((row) => row.referralId === referral.id && row.unitId === unitId);
      const owner = movement ? movementOwner(movement) : stay ? `admission:${stay.id}` : `referral:${referral.id}`;
      if (!claim(unitId, arm.heldBedNumber, owner)) return false;
    }
  }
  return true;
}

/** Stored observation history shares the command validation and retains accepted-operation order. */
export const observationRule = z.custom<Observation>(isObservation);
export const observationChangeRule = z.strictObject({
  at: z.number(),
  from: observationRule,
  to: observationRule,
  sequence: z.optional(z.int().check(z.gte(1), z.lte(Number.MAX_SAFE_INTEGER))),
});
