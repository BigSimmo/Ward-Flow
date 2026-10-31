"use client";

import { SettingsRedesign } from "@/components/ward-redesign/settings/settings-screen";

/**
 * As access admin: the Settings mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`), so the page shows only what the role may open. Round 3:
 * the one Settings component serves this desk, its differences marked `ROLE BRANCH (admin)` there;
 * the Access panel stays this folder's round 2 copy (access-settings.tsx).
 */
export function AsAdminHomePage() {
  return <SettingsRedesign />;
}
