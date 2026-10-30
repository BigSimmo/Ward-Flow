"use client";

import { CapacityRedesign } from "@/components/ward-redesign/capacity/capacity-redesign";

/**
 * As executive: the Capacity mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsExecutiveCapacityPage() {
  return <CapacityRedesign />;
}
