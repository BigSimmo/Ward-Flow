"use client";

import { GovernancePage } from "@/components/ward-redesign/governance/governance-page";

/**
 * As access admin: the Governance mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsAdminGovernancePage() {
  return <GovernancePage />;
}
