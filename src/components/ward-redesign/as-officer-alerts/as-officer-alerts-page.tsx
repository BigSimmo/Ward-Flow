"use client";

import { AsOfficerAlertsRedesign } from "./alerts-redesign";

/**
 * As transport officer: the Alerts mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The forks
 * beside this file carry the officer's changes as commented `officer` branches.
 */
export function AsOfficerAlertsPage() {
  return <AsOfficerAlertsRedesign />;
}
