"use client";

import { DischargesPage } from "@/components/ward-redesign/discharges/discharges-page";

/**
 * As site bed manager: the Discharges mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsBedManagerDischargesPage() {
  return <DischargesPage />;
}
