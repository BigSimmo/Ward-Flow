"use client";

import { SettingsRedesign } from "@/components/ward-redesign/settings/settings-screen";

/**
 * As nurse in charge: the Settings mock-up as this role sees it. The preview takes the role's desk
 * before drawing (`role` in `screens.ts`). Round 3: the one Settings component serves this desk, its
 * differences marked `ROLE BRANCH (ward)` there: it opens on the desk's own display and profile, and
 * the coordinator's rules read as read only, with no save bar.
 */
export function AsWardSettingsPage() {
  return <SettingsRedesign />;
}
