"use client";

import { AlertsRedesign } from "@/components/ward-redesign/as-ward-alerts/alerts-redesign";

/**
 * As nurse in charge: the Alerts mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so only this ward's alerts are listed. The screen is a fork
 * of the coordinator's with the ward's differences as commented role branches: the title names the
 * ward, and a quiet ward's side panel opens on what is checked for it (`ward-desk-alerts.tsx`).
 */
export function AsWardAlertsPage() {
  return <AlertsRedesign />;
}
