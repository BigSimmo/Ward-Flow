import type { Admission } from "../ward-admissions";
import type { Instant } from "../ward-clock";
import { isWaitingInEd } from "../ward-ed-presence";
import type { LegalStatus, Movement, Referral, Unit } from "../ward-model";
import type { Observation } from "../ward-observation";
import { acceptedAddressing } from "../ward-referrals";
import { SELECTABLE_LEGAL_FORMS } from "../ward-legal-forms";
import { allEmergencyDepartments } from "../ward-sites";

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

/** An accepted ward referral the coordinator can pull a bed for, with the ward that accepted it. */
export type AcceptedAwaitingPull = { referral: Referral; unitId: string; unitName: string };

/**
 * WS-02 (workflow speed audit, 26 Oct 2026): every referral a ward has accepted that still has no
 * bed pulled, oldest decision first. Only the referrals a journey can start from directly: an ED
 * referral or a community referral (D-76), accepted on a ward arm that its referrer has not
 * withdrawn, with no bed held on that arm and no live journey raised from it. A journey that closed
 * "did not proceed" does not count, as `RAISE_REFERRAL` allows a new one then.
 */
export function acceptedReferralsAwaitingPull(
  referrals: readonly Referral[],
  units: readonly Pick<Unit, "id" | "name">[],
  movements: readonly Pick<Movement, "referralId" | "closure">[],
): AcceptedAwaitingPull[] {
  return referrals
    .flatMap((referral) => {
      if (referral.source !== "ed_medical" && referral.source !== "community") return [];
      const accepted = acceptedAddressing(referral);
      if (!accepted || accepted.destination.kind !== "psychiatric_ward" || accepted.withdrawnAt !== undefined)
        return [];
      if (accepted.heldBedNumber !== undefined) return [];
      if (
        movements.some(
          (movement) => movement.referralId === referral.id && movement.closure?.outcome !== "did_not_proceed",
        )
      )
        return [];
      const ward = acceptedWardOf(referral, units);
      return ward ? [{ referral, ...ward, decidedAt: accepted.decidedAt ?? referral.raisedAt }] : [];
    })
    .sort((a, b) => a.decidedAt - b.decidedAt)
    .map(({ referral, unitId, unitName }) => ({ referral, unitId, unitName }));
}

/** What a one-step pull can reuse, and where each value came from. Absent means nothing recorded. */
export type RecordedPullDetails = {
  legalStatus?: LegalStatus;
  /** A form code, or `null` when the ED board records no form. Absent when there is no ED record. */
  legalFormCode?: string | null;
  /** The due time a person typed on the ED board's form. Carried, never computed. */
  legalFormDueAt?: Instant;
  observation?: Observation;
  /** Where the legal form and observation came from: the person's open journey on the ED board. */
  fromEdBoard: boolean;
};

/**
 * WS-03 (workflow speed audit, 26 Oct 2026): the legal details already recorded for this person,
 * so pulling the bed does not ask for them again. The person's open wait on the referring ED's
 * board is the newest record of legal status, form and observation level; the referral's own
 * recorded legal status is used when there is no such wait. Nothing is derived: a form is never
 * worked out from a status, and an observation level is never inferred.
 */
export function recordedPullDetails(referral: Referral, movements: readonly Movement[]): RecordedPullDetails {
  const ed = allEmergencyDepartments().find((place) => place.siteCode === referral.originSiteCode);
  const edWait =
    referral.patientId === undefined || referral.source !== "ed_medical" || !ed
      ? undefined
      : movements
          .filter(
            (movement) =>
              movement.patientId === referral.patientId &&
              movement.originEdId === ed.id &&
              movement.referralId !== referral.id &&
              isWaitingInEd(movement),
          )
          .sort((a, b) => b.openedAt - a.openedAt)[0];
  const referralStatus = LEGAL_STATUSES.find((status) => status === referral.intake?.legalStatus);
  // WT-06 (walk-through, 26 Oct 2026): the referral's one Legal status answer is either Voluntary or
  // the form the referrer chose ("Form 1A"). A chosen form is carried as that form; no status is
  // worked out from it, and no form from a status.
  const referralForm = SELECTABLE_LEGAL_FORMS.find((form) => referral.intake?.legalStatus === `Form ${form.code}`);
  if (!edWait)
    return {
      ...(referralStatus ? { legalStatus: referralStatus } : {}),
      ...(referralForm ? { legalFormCode: referralForm.code } : {}),
      fromEdBoard: false,
    };
  return {
    legalStatus: edWait.legalStatus,
    legalFormCode: edWait.legalForm?.code ?? null,
    ...(edWait.legalForm?.dueAt === undefined ? {} : { legalFormDueAt: edWait.legalForm.dueAt }),
    observation: edWait.observation,
    fromEdBoard: true,
  };
}

/** Every `LegalStatus`, in the order the pickers list them. */
export const LEGAL_STATUSES: readonly LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];
