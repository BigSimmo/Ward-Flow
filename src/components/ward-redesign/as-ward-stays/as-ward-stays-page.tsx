"use client";

import { StaysPage } from "@/components/ward-redesign/stays/stays-page";

/**
 * As nurse in charge: the Stays and discharges mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsWardStaysPage() {
  return <StaysPage />;
}
