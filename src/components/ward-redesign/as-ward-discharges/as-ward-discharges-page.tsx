"use client";

import { DischargesRedesign } from "@/components/ward-redesign/as-ward-discharges/discharges-redesign";

/**
 * As nurse in charge: the Discharges mock-up as this role sees it, with nothing chosen. The preview
 * takes the role's desk before drawing (`role` in `screens.ts`); the fork beside this file holds the
 * ward-desk branches.
 */
export function AsWardDischargesPage() {
  return <DischargesRedesign />;
}
