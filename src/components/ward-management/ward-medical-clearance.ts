import type { Movement, Referral } from "./ward-model";
import { movementPatientIdentityMatchesRecord } from "./ward-patient-resolver";

/** Read a recorded fact, never a screen-only clearance draft or an inferred status. */
export function recordedMovementMedicalClearance(movement: Movement, referrals: readonly Referral[]) {
  const linked =
    movement.referralId === undefined
      ? undefined
      : referrals.find(
          (referral) => referral.id === movement.referralId && movementPatientIdentityMatchesRecord(movement, referral),
        )?.medicalClearance;
  const own = movement.medicalClearance;
  if (own === undefined) return linked;
  if (linked === undefined || own.at >= linked.at) return own;
  return linked;
}
