import type { Admission } from "./ward-admissions";
import type { Movement, Referral } from "./ward-model";
import { movementPatientIdentityMatchesRecord } from "./ward-patient-resolver";

/** Pull and arrival must consume the same numbered reservation. A movement's own number wins;
 * otherwise arrival has always used the accepted, named referral arm at this ward. */
export function movementBedReservation(movement: Movement, referrals: readonly Referral[], unitId: string) {
  const referralArm =
    movement.referralId === undefined
      ? undefined
      : referrals
          .find((referral) => referral.id === movement.referralId)
          ?.destinations.find(
            (arm) =>
              arm.state === "accepted" &&
              arm.heldBedNumber !== undefined &&
              arm.destination.kind === "psychiatric_ward" &&
              (arm.acceptedUnitId ?? arm.destination.unitId) === unitId,
          );
  return { referralArm, bedNumber: movement.heldBedNumber ?? referralArm?.heldBedNumber };
}

/** The same bounded join accepted by arrival and restore: authored seed admissions may lack
 * a movement backpointer; runtime AD-ARR records may not. Acceptance alone is never a hold. */
export function movementHasBedHold(movement: Movement, admissions: readonly Admission[]): boolean {
  if (movement.closure !== undefined || movement.acceptedUnitId === undefined) return false;
  if (movement.admissionId !== undefined) {
    return admissions.some(
      (admission) =>
        admission.id === movement.admissionId &&
        admission.state === "pulled" &&
        admission.unitId === movement.acceptedUnitId &&
        movementPatientIdentityMatchesRecord(movement, admission) &&
        (admission.movementId === movement.id ||
          (admission.movementId === null && !admission.id.startsWith("AD-ARR-"))),
    );
  }
  // Older authored movements have explicit pulled/later stages but no linked admission id.
  // Preserve that documented seed contract rather than fabricating a new admission.
  return ["pulled", "handover_ready", "moving"].includes(movement.stage);
}
