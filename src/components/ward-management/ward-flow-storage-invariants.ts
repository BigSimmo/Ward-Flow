import type { Admission } from "./ward-admissions";
import { hasDuplicateRetainedUmrns } from "./ward-retained-umrn";
import type { WardFlowState } from "./ward-flow-reducer";

/** Plain words for a refused restore. Fixed text only: never the save's own content. */
const PLACEMENT_PROBLEMS = {
  leaveAndEd: "a patient is recorded both on leave and away at an emergency department",
  twoStays: "a patient has more than one active ward stay",
  sharedBed: "two records hold the same numbered bed",
} as const;

/** Each patient's active stays, grouped by the approved restore reader (identity stays there). */
export type PatientStays = readonly (readonly Pick<Admission, "id" | "unitId" | "state">[])[];

/** Restore's placement fence, beside the duplicate retained UMRN fence. */
export function storedPlacementInvariants(state: WardFlowState, patientStays: PatientStays): boolean {
  return placementInvariantProblem(state, patientStays) === null;
}

/** The first record-ownership rule a stored state breaks, in plain words, or null. */
export function restoreRuleProblem(state: WardFlowState, patientStays: PatientStays): string | null {
  if (hasDuplicateRetainedUmrns(state.patients)) return "two patients hold the same record number";
  return placementInvariantProblem(state, patientStays);
}

/** The first placement invariant a stored state breaks, in plain words, or null. */
function placementInvariantProblem(
  state: WardFlowState,
  patientStays: readonly (readonly Pick<Admission, "id" | "unitId" | "state">[])[],
): string | null {
  const onLeave = new Set(state.leaveBeds.map((row) => row.admissionId));
  const active = state.admissions.filter((row) => row.state === "occupied" || row.state === "pulled");
  for (const stay of state.admissions) {
    // Departure retains this timestamp as history; only simultaneous live absence claims conflict.
    if (stay.awayAtEmergencyDepartmentSince !== null && onLeave.has(stay.id)) return PLACEMENT_PROBLEMS.leaveAndEd;
  }
  for (const stays of patientStays) {
    if (stays.length < 2) continue;
    if (stays.length !== 2) return PLACEMENT_PROBLEMS.twoStays;
    // A recorded transfer holds the sending bed until destination arrival atomically departs it.
    const source = stays.find((row) => row.state === "occupied");
    const destination = stays.find((row) => row.state === "pulled");
    if (!source || !destination || source.unitId === destination.unitId) return PLACEMENT_PROBLEMS.twoStays;
    const movement = state.movements.find((row) => row.admissionId === destination.id);
    if (!movement || movement.closure !== undefined || movement.acceptedUnitId !== destination.unitId)
      return PLACEMENT_PROBLEMS.twoStays;
    const pinnedSource = movement.sourceAdmissionId ?? movement.referralSourceAdmissionId;
    if (pinnedSource !== undefined) {
      if (pinnedSource !== source.id) return PLACEMENT_PROBLEMS.twoStays;
    } else {
      const referral = state.referrals.find((row) => row.id === movement.referralId);
      if (referral?.source !== "psychiatric_ward" || referral.originUnitId !== source.unitId)
        return PLACEMENT_PROBLEMS.twoStays;
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
    if (stay.bedNumber !== undefined && !claim(stay.unitId, stay.bedNumber, `admission:${stay.id}`))
      return PLACEMENT_PROBLEMS.sharedBed;
  }
  for (const movement of state.movements) {
    if (movement.closure !== undefined || movement.heldBedNumber === undefined) continue;
    if (
      movement.acceptedUnitId === undefined ||
      !claim(movement.acceptedUnitId, movement.heldBedNumber, movementOwner(movement))
    )
      return PLACEMENT_PROBLEMS.sharedBed;
  }
  for (const referral of state.referrals) {
    for (const arm of referral.destinations) {
      if (arm.state !== "accepted" || arm.heldBedNumber === undefined || arm.destination.kind !== "psychiatric_ward")
        continue;
      const unitId = arm.acceptedUnitId ?? arm.destination.unitId;
      if (unitId === undefined) return PLACEMENT_PROBLEMS.sharedBed;
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
      if (!claim(unitId, arm.heldBedNumber, owner)) return PLACEMENT_PROBLEMS.sharedBed;
    }
  }
  return null;
}
