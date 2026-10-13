import type { Referral, Unit } from "../ward-model";
import { acceptedAddressing } from "../ward-referrals";

/**
 * S-9 (audit 13 Oct 2026): accepting a referral into a ward pulls no bed and creates no movement
 * (`ACCEPT_REFERRAL`, by design), so the referral and the patient record both read as a dead end.
 * This names the ward that accepted, so both can show the next step: hold the bed on that ward.
 */
export function acceptedWardOf(
  referral: Referral,
  units: readonly Pick<Unit, "id" | "name">[],
): { unitId: string; unitName: string; boardHref: string } | undefined {
  const accepted = acceptedAddressing(referral);
  if (!accepted) return undefined;
  const unitId =
    accepted.acceptedUnitId ??
    (accepted.destination.kind === "psychiatric_ward" ? accepted.destination.unitId : undefined);
  if (unitId === undefined) return undefined;
  const unitName = units.find((unit) => unit.id === unitId)?.name ?? "the accepting ward";
  return { unitId, unitName, boardHref: `/mockups/ward-flow/board/${encodeURIComponent(unitId)}` };
}

/** The newest referral for this person that a ward has accepted, and that ward. */
export function acceptedWardReferralFor(
  patientId: string | undefined,
  referrals: readonly Referral[],
  units: readonly Pick<Unit, "id" | "name">[],
): ({ referral: Referral } & NonNullable<ReturnType<typeof acceptedWardOf>>) | undefined {
  if (patientId === undefined) return undefined;
  for (let index = referrals.length - 1; index >= 0; index -= 1) {
    const referral = referrals[index]!;
    if (referral.patientId !== patientId) continue;
    const ward = acceptedWardOf(referral, units);
    if (ward) return { referral, ...ward };
  }
  return undefined;
}
