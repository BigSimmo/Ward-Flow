"use client";

import { HandoverRedesign } from "@/components/ward-redesign/handover/handover-redesign";

/**
 * As ED clinician: the Handover mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsEdHandoverPage() {
  return <HandoverRedesign />;
}
