"use client";

import { TransportRedesign } from "@/components/ward-redesign/transport/transport-redesign";

/**
 * As transport officer: the Transport desk mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsOfficerHomePage() {
  return <TransportRedesign />;
}
