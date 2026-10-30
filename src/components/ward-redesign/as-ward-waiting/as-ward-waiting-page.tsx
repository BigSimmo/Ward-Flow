"use client";

import { WaitingRedesign } from "@/components/ward-redesign/waiting/waiting-redesign";

/**
 * As nurse in charge: the Waiting mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsWardWaitingPage() {
  return <WaitingRedesign />;
}
