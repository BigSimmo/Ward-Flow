import type { Admission } from "../ward-admissions";
import type { Movement, Referral, Unit } from "../ward-model";
import { acceptedAddressing } from "../ward-referrals";

/**
 * S-9 (audit 13 Oct 2026): accepting a referral into a ward pulls no bed and creates no movement
 * (`ACCEPT_REFERRAL`, by design), so the referral and the patient record both read as a dead end.
 * This names the ward that accepted, so both can show the next step: hold the bed on that ward.
 * Callers build the link to that ward themselves.
 */
export function acceptedWardOf(
  referral: Referral,
  units: readonly Pick<Unit, "id" | "name">[],
): { unitId: string; unitName: string } | undefined {
  const accepted = acceptedAddressing(referral);
  if (!accepted) return undefined;
  const unitId =
    accepted.acceptedUnitId ??
    (accepted.destination.kind === "psychiatric_ward" ? accepted.destination.unitId : undefined);
  if (unitId === undefined) return undefined;
  const unitName = units.find((unit) => unit.id === unitId)?.name ?? "the accepting ward";
  return { unitId, unitName };
}

/**
 * The newest referral for this person that a ward has accepted and that still waits on the ward's
 * next step: no bed held on the accepted arm yet, and no movement or admission raised from it. An
 * acceptance with a held bed, or one whose placement already happened (even a stay that has since
 * ended), is not "accepted, no bed held".
 */
export function acceptedWardReferralFor(
  patientId: string | undefined,
  referrals: readonly Referral[],
  units: readonly Pick<Unit, "id" | "name">[],
  placements: {
    movements?: readonly Pick<Movement, "referralId">[];
    admissions?: readonly Pick<Admission, "referralId">[];
  } = {},
): ({ referral: Referral } & NonNullable<ReturnType<typeof acceptedWardOf>>) | undefined {
  if (patientId === undefined) return undefined;
  for (let index = referrals.length - 1; index >= 0; index -= 1) {
    const referral = referrals[index]!;
    if (referral.patientId !== patientId) continue;
    const ward = acceptedWardOf(referral, units);
    if (!ward) continue;
    if (acceptedAddressing(referral)?.heldBedNumber !== undefined) return undefined;
    const placed =
      placements.movements?.some((movement) => movement.referralId === referral.id) === true ||
      placements.admissions?.some((admission) => admission.referralId === referral.id) === true;
    return placed ? undefined : { referral, ...ward };
  }
  return undefined;
}
