"use client";

import { StaysRedesign } from "@/components/ward-redesign/as-ward-stays/stays-redesign";

/**
 * As nurse in charge: Stays and discharges for the desk's own ward, as the app's own example
 * address does. The preview takes the role's desk before drawing (`role` in `screens.ts`); the fork
 * beside this file holds the ward-desk branch.
 */
export function AsWardStaysPage() {
  return <StaysRedesign unitId="rph-adult-secure" />;
}
