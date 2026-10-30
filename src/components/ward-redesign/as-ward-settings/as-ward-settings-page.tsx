"use client";

import { SettingsPage } from "@/components/ward-redesign/settings/settings-page";

/**
 * As nurse in charge: the Settings mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsWardSettingsPage() {
  return <SettingsPage />;
}
