"use client";

import { SettingsPage } from "@/components/ward-redesign/settings/settings-page";

/**
 * As access admin: the Settings mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open.
 */
export function AsAdminHomePage() {
  return <SettingsPage />;
}
