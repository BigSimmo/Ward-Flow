import type { Instant } from "@/components/ward-management/ward-clock";
import { openRequestsByPerson, type OpenRequest } from "@/components/ward-management/coordinator/missed-requests-check";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";

/**
 * TWO ACTIVE BED REQUESTS FOR ONE PERSON — audit F-19 (19 Oct 2026).
 *
 * Success measure 2 (`product-brief.md`) counts "the same patient with two active bed requests at
 * once". What counts as an open request, and whose it is, comes from `openRequestsByPerson`, the one
 * matcher the daily "nobody missed" check also uses, so this row and that check always agree: an
 * open bed request, or a ward or ED referral still awaiting an answer, counted once when a bed
 * request was raised from it.
 *
 * 🔴 COORDINATOR ONLY (Josh, 19 Oct 2026). A ward must not learn where else a person has been
 * referred (FD-23, D-14), so these rows reach the bed coordinator's task list and nothing on a
 * ward, ED or team screen. A first version on the ward screen was withdrawn for exactly that.
 *
 * A signal for a person to weigh, never a refusal: a second request can be right.
 *
 * ⚠️ The person is the recorded person the shared resolver finds: a request with nobody on file is
 * never anyone's duplicate, and no name or record number is ever compared.
 */
type Records = {
  movements: readonly Movement[];
  referrals: readonly Referral[];
  patients: readonly Patient[];
};

/** Each person with more than one open request, oldest request first within each. */
export function duplicateBedRequests(
  records: Records,
): { personId: string; requests: OpenRequest[]; since: Instant }[] {
  return [...openRequestsByPerson(records)].flatMap(([personId, requests]) => {
    const second = requests[1];
    return second ? [{ personId, requests, since: second.openedAt }] : [];
  });
}

/**
 * When this person's duplicate began (the second open request's time), or undefined when they no
 * longer have two. The row's id names the person, so the reducer reads this to decide whether the
 * row exists and which snooze or owner applies to this occurrence.
 */
export function duplicateBedRequestSince(records: Records, patientId: string): Instant | undefined {
  return openRequestsByPerson(records).get(patientId)?.[1]?.openedAt;
}
