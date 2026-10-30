"use client";

import { WardsPage } from "@/components/ward-redesign/wards/wards-page";

/**
 * As site bed manager: the All wards mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsBedManagerWardsPage() {
  return <WardsPage />;
}
