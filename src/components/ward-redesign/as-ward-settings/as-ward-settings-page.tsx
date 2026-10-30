"use client";

import { SettingsRedesign } from "@/components/ward-redesign/as-ward-settings/settings-screen";

/**
 * As nurse in charge: the Settings mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`). The screen is a fork of the coordinator's with the ward's
 * differences as commented `desk.role === "ward"` branches: it opens on the desk's own display and
 * profile, and the coordinator's rules read as read only, with no save bar.
 */
export function AsWardSettingsPage() {
  return <SettingsRedesign />;
}
