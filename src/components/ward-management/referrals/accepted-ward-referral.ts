import type { Admission } from "../ward-admissions";
import type { Instant } from "../ward-clock";
import { isWaitingInEd } from "../ward-ed-presence";
import type { LegalStatus, Movement, Referral, Unit } from "../ward-model";
import type { Observation } from "../ward-observation";
import { acceptedAddressing } from "../ward-referrals";
import { SELECTABLE_LEGAL_FORMS } from "../ward-legal-forms";
import { allEmergencyDepartments } from "../ward-sites";
import type { WardChromeRole } from "../ward-chrome-role";
import type { WardAccess } from "../ward-role-access";
import { acceptedWardOf, startsAcceptedJourneyAtEd } from "./accepted-awaiting-pull";

export { acceptedWardOf, acceptedReferralsAwaitingPull, type AcceptedAwaitingPull } from "./accepted-awaiting-pull";

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
    referral.patientId === undefined || !startsAcceptedJourneyAtEd(referral.source) || !ed
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

/** Read out when a desk other than the accepting ward or the coordinator opens Pull the bed. */
export const PULL_DESK_REFUSAL = "Only the ward that accepted or the bed coordinator can pull this bed";

/**
 * Who pulls an accepted referral's bed, and as which desk (D-191 build answers, settling D-188):
 * the ward-desk clinician of the ward that accepted, or the ward coordinator. There are no personal
 * sign-ins, so the pull is recorded under the desk's role (`Movement.stageChanges[].by`). A ward
 * desk always names its own ward, as `referral-match.tsx` does; the engine refuses any other
 * (`RAISE_REFERRAL` and `PULL_PATIENT` with `actingUnitId`).
 */
export function acceptedPullDesk(
  deskRole: WardChromeRole,
  access: WardAccess,
  unitId: string,
): { role: "coordinator" } | { role: "ward"; actingUnitId: string } | { refusal: string } {
  if (deskRole === "coordinator") return { role: "coordinator" };
  if (deskRole !== "ward") return { refusal: PULL_DESK_REFUSAL };
  // A demonstration ward desk with no ward scope acts as the ward that accepted.
  if (access.scope.kind === "ward" && !access.scope.unitIds.includes(unitId)) return { refusal: PULL_DESK_REFUSAL };
  return { role: "ward", actingUnitId: unitId };
}
