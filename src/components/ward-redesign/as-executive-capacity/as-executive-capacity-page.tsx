"use client";

import { AsExecutiveCapacityRedesign } from "./capacity-redesign";

/**
 * As executive: the Capacity mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The forks
 * beside this file carry the executive's changes as commented `executive` branches.
 */
export function AsExecutiveCapacityPage() {
  return <AsExecutiveCapacityRedesign />;
}
