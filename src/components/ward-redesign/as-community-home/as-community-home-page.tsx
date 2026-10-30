"use client";

import { CommunityTeamRedesign } from "./community-team-redesign";

/**
 * As community clinician: the Community team mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The page is
 * a fork of the coordinator's redesign; its community branches sit in the forked hero and phone files.
 */
export function AsCommunityHomePage() {
  return <CommunityTeamRedesign teamId="midland" />;
}
