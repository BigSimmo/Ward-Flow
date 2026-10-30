"use client";

import { WardRedesign } from "@/components/ward-redesign/ward/ward-redesign";

/**
 * As nurse in charge: the My ward mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`). The ward-desk differences are commented role branches in
 * the one My ward fork (`ward-redesign/ward/`), so the coordinator and this desk share a component.
 */
export function AsWardHomePage() {
  return <WardRedesign />;
}
