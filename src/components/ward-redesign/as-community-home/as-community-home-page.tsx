"use client";

import { CommunityTeamPage } from "@/components/ward-redesign/community-team/community-team-page";

/**
 * As community clinician: the Community team mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsCommunityHomePage() {
  return <CommunityTeamPage />;
}
