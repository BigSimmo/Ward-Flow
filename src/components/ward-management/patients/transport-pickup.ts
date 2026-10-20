import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * THE PICKUP SITE A TRANSPORT BOOKING OPENS WITH (smart features idea 9, overall review 20 Oct
 * 2026): where the referral says the person is, so the person booking does not type it again. A
 * suggestion only: the booking form must let them choose another site, and it is a synthetic site
 * code from the site list, never an address or typed text.
 *
 * Read order: the referral's own origin site, else the bed request's origin ED. `undefined` when
 * neither names a known site, so the form opens blank rather than guessing.
 *
 * Not wired yet: `BOOK_TRANSPORT` has no pickup field and both booking forms are held by other
 * threads (see the overall review fixes report).
 */
export function defaultPickupSiteCode(
  movement: Pick<Movement, "referralId" | "originEdId">,
  referrals: readonly Pick<Referral, "id" | "originSiteCode">[],
): string | undefined {
  const referral = movement.referralId
    ? referrals.find((candidate) => candidate.id === movement.referralId)
    : undefined;
  for (const code of [referral?.originSiteCode, edById(movement.originEdId)?.siteCode]) {
    if (code && siteByCode(code)) return code;
  }
  return undefined;
}
