"use client";

import { AsAdminSettingsRedesign } from "./settings-screen";

/**
 * As access admin: the Settings mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. The fork
 * beside this file carries the admin's changes as commented `admin` branches.
 */
export function AsAdminHomePage() {
  return <AsAdminSettingsRedesign />;
}
