"use client";

import { SettingsRedesign } from "@/components/ward-redesign/settings/settings-screen";

/**
 * As executive: the Settings mock-up as this role sees it (round 3). The preview takes the executive
 * desk first (`role` in `screens.ts`), so the screen reads the executive report's public rules: Rules
 * read as read only with no save bar, record counts and the audit say they are unavailable, and the
 * live-impact lines are left out because this desk holds no individual records.
 */
export function AsExecutiveSettingsPage() {
  return <SettingsRedesign />;
}
