"use client";

import { CommunityMovementsRedesign } from "./community-movements-redesign";

/**
 * As community clinician: the Movements mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The board
 * is a fork of the coordinator's redesign with each community difference written as a role branch.
 */
export function AsCommunityMovementsPage() {
  return <CommunityMovementsRedesign />;
}
