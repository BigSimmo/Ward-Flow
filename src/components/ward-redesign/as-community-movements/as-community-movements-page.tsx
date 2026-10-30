"use client";

import { MovementsRedesign } from "@/components/ward-redesign/movements/movements-redesign";

/**
 * As community clinician: the Movements mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsCommunityMovementsPage() {
  return <MovementsRedesign />;
}
