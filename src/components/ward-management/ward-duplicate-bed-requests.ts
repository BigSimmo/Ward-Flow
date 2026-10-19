import type { Instant } from "@/components/ward-management/ward-clock";
import type { Referral } from "@/components/ward-management/ward-model";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";

/**
 * TWO ACTIVE BED REQUESTS FOR ONE PERSON — audit F-19 (19 Oct 2026).
 *
 * Success measure 2 (`product-brief.md`) counts "the same patient with two active bed requests at
 * once". An active bed request is a referral for that person with a ward or ED arm still awaiting
 * an answer (`isAwaitingAnswer`), the same test `referralState` uses for "still open".
 *
 * 🔴 COORDINATOR ONLY (Josh, 19 Oct 2026). A ward must not learn where else a person has been
 * referred (FD-23, D-14), so these rows reach the bed coordinator's task list and nothing on a
 * ward, ED or team screen. A first version on the ward screen was withdrawn for exactly that.
 *
 * A signal for a person to weigh, never a refusal: a second request can be right.
 *
 * ⚠️ It matches on `patientId` with `===` only: a referral with nobody on file is never anyone's
 * duplicate, and no name or record number is ever compared.
 */
export function activeBedRequestsFor(referrals: readonly Referral[], patientId: string): Referral[] {
  return referrals
    .filter(
      (referral) =>
        referral.patientId === patientId &&
        referral.destinations.some(
          (addressing) => addressing.destination.kind !== "community_team" && isAwaitingAnswer(addressing),
        ),
    )
    .sort((a, b) => a.raisedAt - b.raisedAt || a.id.localeCompare(b.id));
}

/** Each person with more than one active bed request, oldest request first within each. */
export function duplicateBedRequests(
  referrals: readonly Referral[],
): { patientId: string; requests: Referral[]; since: Instant }[] {
  const patientIds = [...new Set(referrals.flatMap((referral) => (referral.patientId ? [referral.patientId] : [])))];
  return patientIds.flatMap((patientId) => {
    const requests = activeBedRequestsFor(referrals, patientId);
    const second = requests[1];
    return second ? [{ patientId, requests, since: second.raisedAt }] : [];
  });
}

/**
 * When this person's duplicate began (the second active request's raised time), or undefined when
 * they no longer have two. The row's id names the person, so the reducer reads this to decide
 * whether the row exists and which snooze or owner applies to this occurrence.
 */
export function duplicateBedRequestSince(referrals: readonly Referral[], patientId: string): Instant | undefined {
  return activeBedRequestsFor(referrals, patientId)[1]?.raisedAt;
}
