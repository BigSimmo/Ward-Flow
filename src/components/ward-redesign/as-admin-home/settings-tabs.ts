// Split from settings-screen.tsx (this folder) to keep that file under the line limit; unchanged.
import { Bell, Clock, Database, KeyRound, Palette, UserRound } from "lucide-react";

import { SETTINGS_TABS, type SettingsTab } from "@/components/ward-management/settings/settings-search-index";

/** The redesign's tab list: Profile and shift joins Display. */
export const REDESIGN_TABS: readonly { readonly id: SettingsTab; readonly label: string }[] = SETTINGS_TABS.filter(
  (item) => item.id !== "profile",
).map((item) => (item.id === "display" ? { ...item, label: "Display and profile" } : item));

export const TAB_ICONS = {
  rules: Clock,
  alerts: Bell,
  display: Palette,
  profile: UserRound,
  data: Database,
  access: KeyRound,
} as const;
