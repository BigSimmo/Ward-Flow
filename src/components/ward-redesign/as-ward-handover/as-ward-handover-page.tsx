"use client";

import { HandoverRedesign } from "@/components/ward-redesign/as-ward-handover/handover-redesign";

/**
 * As nurse in charge: the Handover mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`); the fork beside this file holds the ward-desk branches.
 */
export function AsWardHandoverPage() {
  return <HandoverRedesign />;
}
