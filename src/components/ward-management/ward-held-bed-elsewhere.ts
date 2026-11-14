import type { Instant } from "./ward-clock";
import type { Admission } from "./ward-admissions";
import type { Movement, Referral, ReferralAddressing } from "./ward-model";
import type { Patient } from "./ward-patients";
import { resolveSubjectPatient } from "./ward-patient-resolver";

/**
 * M11 and owner question 8 (mechanics and clock audit, D-210 (Josh, 14 Nov 2026)): a bed held for
 * an accepted referral is not tied to the person. A ward accepts a referral and holds a numbered
 * bed (`HOLD_REFERRAL_BED`, or an acceptance that names a bed); the person is then pulled into, or
 * arrives at, a ward on another journey, and the held bed stays held with nothing said. The ruling
 * is to flag it and offer to release the bed, never to block the admission.
 *
 * Read by the coordinator's Home row (`bed_held_elsewhere`), the duplicate request matcher
 * (`openRequestsByPerson`) and the Referrals board's Release held bed. Pure, ids and bed numbers only.
 */

/**
 * The accepted ward arm of a referral that still holds a numbered bed, when no open bed request
 * was raised from it (an open journey carries its own hold, which the Pull refusal already reads).
 */
export function referralArmHoldingBed(
  referral: Referral,
  movements: readonly Movement[],
): (ReferralAddressing & { heldBedNumber: number }) | undefined {
  if (movements.some((movement) => movement.referralId === referral.id && movement.closure === undefined))
    return undefined;
  return referral.destinations.find(
    (arm): arm is ReferralAddressing & { heldBedNumber: number } =>
      arm.destination.kind === "psychiatric_ward" &&
      arm.state === "accepted" &&
      arm.withdrawnAt === undefined &&
      arm.heldBedNumber !== undefined,
  );
}

/** The ward an accepted arm holds its bed at. */
export function heldBedUnitId(arm: ReferralAddressing): string | undefined {
  return arm.destination.kind === "psychiatric_ward" ? (arm.acceptedUnitId ?? arm.destination.unitId) : undefined;
}

export type HeldBedElsewhere = {
  referralId: Referral["id"];
  personId: string;
  /** The ward and bed held for the referral. */
  unitId: string;
  bedNumber: number;
  /** The stay the person is in now: pulled or arrived, on another journey. */
  admissionId: Admission["id"];
  stayUnitId: string;
  /** When both were true: the later of the acceptance and the stay's pull or arrival. */
  since: Instant;
};

type Records = {
  admissions: readonly Admission[];
  referrals: readonly Referral[];
  movements: readonly Movement[];
  patients: readonly Patient[];
};

/**
 * Every bed held for an accepted referral whose person is pulled into, or occupies, a bed on another
 * journey. The person is the recorded person the shared resolver finds; a referral it cannot link is
 * left out, never matched by name or record number. Oldest first.
 */
export function heldBedsElsewhere(records: Records): HeldBedElsewhere[] {
  const found: HeldBedElsewhere[] = [];
  for (const referral of records.referrals) {
    const arm = referralArmHoldingBed(referral, records.movements);
    const unitId = arm ? heldBedUnitId(arm) : undefined;
    if (!arm || unitId === undefined) continue;
    const personId = resolveSubjectPatient(referral, records).patient?.id;
    if (personId === undefined) continue;
    const fromThisReferral = new Set(
      records.movements.filter((movement) => movement.referralId === referral.id).map((movement) => movement.id),
    );
    // The stay's person through the same resolver, never a raw link read (D-14 guard).
    const stay = records.admissions.find(
      (admission) =>
        resolveSubjectPatient(admission, records).patient?.id === personId &&
        (admission.state === "pulled" || admission.state === "occupied") &&
        admission.referralId !== referral.id &&
        (admission.movementId === null || !fromThisReferral.has(admission.movementId)),
    );
    if (!stay) continue;
    const stayStart = stay.arrivedAt ?? stay.pulledAt ?? 0;
    found.push({
      referralId: referral.id,
      personId,
      unitId,
      bedNumber: arm.heldBedNumber,
      admissionId: stay.id,
      stayUnitId: stay.unitId,
      since: Math.max(stayStart, arm.decidedAt ?? 0) as Instant,
    });
  }
  return found.sort((a, b) => a.since - b.since);
}

/** The flag for one referral, or undefined when it no longer holds a bed for someone in a bed elsewhere. */
export function heldBedElsewhereOf(records: Records, referralId: string): HeldBedElsewhere | undefined {
  return heldBedsElsewhere(records).find((held) => held.referralId === referralId);
}
