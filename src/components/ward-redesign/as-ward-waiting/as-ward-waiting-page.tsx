"use client";

import { WaitingRedesign } from "@/components/ward-redesign/as-ward-waiting/waiting-redesign";

/**
 * As nurse in charge: the Waiting mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The board
 * is a fork of the coordinator's with the ward's differences as commented `access.role === "ward"`
 * branches: the title names the ward, "Waiting on you" reads as the coordinator's move, and a
 * short list opens every band.
 */
export function AsWardWaitingPage() {
  return <WaitingRedesign />;
}
