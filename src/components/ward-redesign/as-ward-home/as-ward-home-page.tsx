"use client";

import { WardRedesign } from "@/components/ward-redesign/ward/ward-redesign";

/**
 * As nurse in charge: the My ward mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsWardHomePage() {
  return <WardRedesign />;
}
