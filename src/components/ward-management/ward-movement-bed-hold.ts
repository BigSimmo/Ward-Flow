import { bedIsOccupied, type Admission } from "./ward-admissions";
import { numberedBedKind } from "./ward-bed-designation";
import { activeClosedBeds } from "./ward-ready-beds";
import type { Movement, Referral, Unit } from "./ward-model";
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

/** Exclusive numbered claims consume capacity before an admission exists. Linked movement and
 * referral copies count once, and an active admission already accounts for its own claim. Plain
 * acceptance holds no number and remains waitlisting. Exclude both owners when using one's hold. */
export function pendingNumberedReservations(
  unit: Unit,
  state: { movements: readonly Movement[]; referrals: readonly Referral[]; admissions: readonly Admission[] },
  exceptMovementId?: string,
  exceptReferralId?: string,
): { total: number; locked: number; open: number } {
  const admissions = state.admissions.filter((a) => a.unitId === unit.id && bedIsOccupied(a));
  const unavailable = new Set([
    ...admissions.map((a) => a.bedNumber),
    ...activeClosedBeds(unit).map((mark) => mark.bedNumber),
  ]);
  const numbers = new Set<number>();
  const add = (number: number | undefined) => {
    if (number !== undefined && numberedBedKind(unit, number) !== undefined && !unavailable.has(number))
      numbers.add(number);
  };
  for (const movement of state.movements) {
    if (
      movement.id === exceptMovementId ||
      (exceptReferralId !== undefined && movement.referralId === exceptReferralId) ||
      movement.closure !== undefined ||
      movement.acceptedUnitId !== unit.id
    )
      continue;
    if (admissions.some((a) => a.movementId === movement.id || a.id === movement.admissionId)) continue;
    add(movement.heldBedNumber);
  }
  for (const referral of state.referrals) {
    if (referral.id === exceptReferralId) continue;
    if (admissions.some((a) => a.referralId === referral.id)) continue;
    if (
      state.movements.some((m) => m.referralId === referral.id && m.stage === "arrived" && m.acceptedUnitId === unit.id)
    )
      continue;
    for (const arm of referral.destinations) {
      if (
        arm.state === "accepted" &&
        arm.destination.kind === "psychiatric_ward" &&
        (arm.acceptedUnitId ?? arm.destination.unitId) === unit.id
      )
        add(arm.heldBedNumber);
    }
  }
  const locked = [...numbers].filter((number) => numberedBedKind(unit, number) === "locked").length;
  return { total: numbers.size, locked, open: numbers.size - locked };
}
