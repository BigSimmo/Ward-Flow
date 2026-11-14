import type { Admission, PlannedAdmission } from "../ward-admissions";
import type { Instant } from "../ward-clock";
import type { Referral } from "../ward-model";
import { isAwaitingAnswer, referralState } from "../ward-referrals";
import { isOwnStay } from "./patient-now-adapter";

/**
 * Audit 16 A16-11 and root cause 6.2 (Josh approved, 13 Nov 2026): a person whose only open record
 * is a referral or a booked planned admission is not "Not active". The page's state used to come
 * from the journey and the ward stay alone, so a referral still awaiting an answer read "Not
 * active ... No open referral". These read the other open records so the page can say what is open.
 *
 * "Awaiting an answer" is the rule the Patients list already uses (`search/patient-census.ts`):
 * the referral is still queued and at least one arm is awaiting an answer (not withdrawn). An
 * accepted referral is read by `acceptedWardReferralFor`, which the page already uses.
 *
 * The patient link is read only through `isOwnStay`, the patient page's one approved reader for the
 * person in focus (archived D-14), so this file never reads the link itself.
 */
export type OpenReferral = {
  referralId: string;
  raisedAt: Instant;
  /** Arms still awaiting an answer from a psychiatric ward. */
  wards: number;
  /** Every arm still awaiting an answer, wards included. */
  places: number;
  /** True when every arm awaiting an answer is a community team (no bed is being asked for). */
  communityOnly: boolean;
};

/** The newest referral for this person that is still awaiting an answer, or undefined. */
export function openReferralFor(
  patientId: string | undefined,
  referrals: readonly Referral[],
): OpenReferral | undefined {
  if (patientId === undefined) return undefined;
  let newest: OpenReferral | undefined;
  for (const referral of referrals) {
    if (!isOwnStay(referral, patientId) || referralState(referral) !== "queued") continue;
    const awaiting = referral.destinations.filter(isAwaitingAnswer);
    if (awaiting.length === 0) continue;
    if (newest && newest.raisedAt >= referral.raisedAt) continue;
    newest = {
      referralId: referral.id,
      raisedAt: referral.raisedAt,
      wards: awaiting.filter((arm) => arm.destination.kind === "psychiatric_ward").length,
      places: awaiting.length,
      communityOnly: awaiting.every((arm) => arm.destination.kind === "community_team"),
    };
  }
  return newest;
}

/** The person's next planned admission that is still booked (not cancelled, not arrived), or undefined. */
export function bookedPlannedAdmissionFor(
  patientId: string | undefined,
  plannedAdmissions: readonly PlannedAdmission[] | undefined,
): PlannedAdmission | undefined {
  if (patientId === undefined || !plannedAdmissions) return undefined;
  return plannedAdmissions
    .filter((booking) => isOwnStay(booking, patientId) && booking.state === "booked" && booking.cancelledAt === null)
    .sort((a, b) => a.expectedArrivalAt - b.expectedArrivalAt)[0];
}

/** What a referral awaiting an answer was sent to, in the Patients list's words. */
export function openReferralSentTo(open: Pick<OpenReferral, "wards" | "places">): string {
  if (open.wards > 0 && open.wards === open.places)
    return `Sent to ${open.wards} ${open.wards === 1 ? "ward" : "wards"}`;
  return `Sent to ${open.places} ${open.places === 1 ? "place" : "places"}`;
}

/**
 * Lead-VM-1: a ward wait-list stay with no movement (state "waitlisted", person set, no movement)
 * is waiting for a bed at that ward, as Search and the ward board already say. It is not an open
 * movement and not an occupied stay, so patient mode reads "idle" for it; the page uses this to say
 * so instead of "Not active".
 */
export function waitlistedStayFor(
  patientId: string | undefined,
  admissions: readonly Admission[],
): Admission | undefined {
  if (patientId === undefined) return undefined;
  return admissions.find(
    (stay) => stay.state === "waitlisted" && stay.movementId == null && isOwnStay(stay, patientId),
  );
}
