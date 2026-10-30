"use client";

import { CommunityReferralsRedesign } from "./community-referrals-redesign";

/**
 * As community clinician: the Referrals mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The board
 * is a fork of the coordinator's redesign with each community difference written as a role branch.
 */
export function AsCommunityReferralsPage() {
  return <CommunityReferralsRedesign />;
}
