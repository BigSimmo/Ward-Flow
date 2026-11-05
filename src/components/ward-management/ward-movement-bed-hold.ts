import type { Admission } from "./ward-admissions";
import { numberedBedKind } from "./ward-bed-designation";
import { activeClosedBeds } from "./ward-ready-beds";
import type { WardReferralInboxEntry } from "./referrals/referral-inbox";
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

/** A referral, or one ward's inbox view of its own arm, as the bed counts read them. */
export type ReservationReferral = Referral | WardReferralInboxEntry;

const CONVERTED_STATES: readonly Admission["state"][] = ["pulled", "occupied", "departed"];

/**
 * The numbered beds at `unit` held by an exclusive claim that no admission has taken up yet: one
 * shared rule for the displayed bed states (WF-FIG-017) and the pull and planned-admission gates
 * (WF-CAP-001), so the figure and the refusal never disagree.
 *
 * - A movement's own number wins over its referral arm; each episode counts once.
 * - A claim already taken up by a pulled, occupied or departed stay, or by an arrived journey, is
 *   not counted again. Plain acceptance holds no number and stays waitlisting.
 * - A number that is outside the ward, closed, or already in a stay's bed is not a reservation.
 * - `except` leaves out the movement (and its referral) that is about to use its own hold.
 */
export function numberedReservationBeds(
  unit: Unit,
  admissions: readonly Admission[],
  movements: readonly Movement[],
  referrals: readonly ReservationReferral[],
  except: { movementId?: string; referralId?: string } = {},
): Map<number, "locked" | "open"> {
  const atUnit = admissions.filter((admission) => admission.unitId === unit.id);
  const unavailable = new Set<number | undefined>([
    ...atUnit
      .filter((admission) => admission.state === "pulled" || admission.state === "occupied")
      .map((admission) => admission.bedNumber),
    ...activeClosedBeds(unit).map((mark) => mark.bedNumber),
  ]);
  const converted = atUnit.filter((admission) => CONVERTED_STATES.includes(admission.state));
  const held = new Map<number, "locked" | "open">();
  const episodes = new Set<string>();
  const add = (bed: number | undefined) => {
    if (bed === undefined || unavailable.has(bed)) return false;
    const kind = numberedBedKind(unit, bed);
    if (kind === undefined) return false;
    held.set(bed, kind);
    return true;
  };
  for (const movement of movements) {
    if (
      movement.id === except.movementId ||
      (except.referralId !== undefined && movement.referralId === except.referralId) ||
      movement.closure !== undefined ||
      movement.stage === "arrived" ||
      movement.acceptedUnitId !== unit.id
    )
      continue;
    const episode = movement.referralId ?? movement.id;
    if (episodes.has(episode)) continue;
    if (
      converted.some(
        (admission) =>
          admission.movementId === movement.id ||
          admission.id === movement.admissionId ||
          (movement.referralId !== undefined && admission.referralId === movement.referralId),
      )
    )
      continue;
    if (add(movement.heldBedNumber)) episodes.add(episode);
  }
  for (const referral of referrals) {
    if (referral.id === except.referralId || episodes.has(referral.id)) continue;
    if (converted.some((admission) => admission.referralId === referral.id)) continue;
    if (movements.some((m) => m.referralId === referral.id && m.stage === "arrived" && m.acceptedUnitId === unit.id))
      continue;
    for (const arm of "destinations" in referral ? referral.destinations : [referral]) {
      if (
        arm.state !== "accepted" ||
        arm.withdrawnAt !== undefined ||
        arm.destination.kind !== "psychiatric_ward" ||
        (("acceptedUnitId" in arm ? arm.acceptedUnitId : undefined) ?? arm.destination.unitId) !== unit.id
      )
        continue;
      if (add(arm.heldBedNumber)) {
        episodes.add(referral.id);
        break;
      }
    }
  }
  return held;
}

/** `numberedReservationBeds` as the gates use it: how many, and how many of each bed kind. */
export function pendingNumberedReservations(
  unit: Unit,
  state: { movements: readonly Movement[]; referrals: readonly Referral[]; admissions: readonly Admission[] },
  exceptMovementId?: string,
  exceptReferralId?: string,
): { total: number; locked: number; open: number } {
  const held = numberedReservationBeds(unit, state.admissions, state.movements, state.referrals, {
    movementId: exceptMovementId,
    referralId: exceptReferralId,
  });
  const locked = [...held.values()].filter((kind) => kind === "locked").length;
  return { total: held.size, locked, open: held.size - locked };
}
