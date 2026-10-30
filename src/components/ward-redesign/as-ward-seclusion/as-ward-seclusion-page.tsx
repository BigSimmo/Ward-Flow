"use client";

import { SeclusionRedesign } from "@/components/ward-redesign/seclusion/seclusion-redesign";

/**
 * As nurse in charge: the Seclusion mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsWardSeclusionPage() {
  return <SeclusionRedesign />;
}
