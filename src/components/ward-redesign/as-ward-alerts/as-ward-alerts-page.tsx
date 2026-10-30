"use client";

import { AlertsRedesign } from "@/components/ward-redesign/alerts/alerts-redesign";

/**
 * As nurse in charge: the Alerts mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsWardAlertsPage() {
  return <AlertsRedesign />;
}
