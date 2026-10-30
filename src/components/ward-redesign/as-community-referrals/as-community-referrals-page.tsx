"use client";

import { ReferralsRedesign } from "@/components/ward-redesign/referrals/referrals-redesign";

/**
 * As community clinician: the Referrals mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsCommunityReferralsPage() {
  return <ReferralsRedesign />;
}
