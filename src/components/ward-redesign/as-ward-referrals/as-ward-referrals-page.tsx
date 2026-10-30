"use client";

import { ReferralsRedesign } from "@/components/ward-redesign/as-ward-referrals/referrals-redesign";

/**
 * As nurse in charge: the Referrals mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the board holds only this ward's own incoming lines. The
 * board is a fork of the coordinator's with the ward's differences as commented `access.role === "ward"`
 * branches: the title names what the ward must answer, network lenses (destination-type pills, Refused
 * once, beds statewide) are left out, and an empty queue says what lands here.
 */
export function AsWardReferralsPage() {
  return <ReferralsRedesign />;
}
