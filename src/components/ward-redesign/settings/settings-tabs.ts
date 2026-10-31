// Settings round 3 (mock-up, 30 Oct 2026): the tab list, its icons and Find a setting's index.
// Tabs, each one job: Rules · Alerts · Display and profile · Help and data · Access. Help, the tour
// and Shortcuts move out of Display; "Data and about" becomes Help and data. The index is today's
// (src/components/ward-management/settings/settings-search-index.ts) moved to the new tabs, with
// rows today's cannot find: each reply target and forecast alert, clinical values, the alerts check,
// Copy diagnostics, Show changed only, Access and the two new browser settings.
import { Bell, CircleHelp, Clock, KeyRound, Palette, UserRound } from "lucide-react";

import {
  SETTINGS_SEARCH_ENTRIES,
  type SettingsSearchEntry,
  type SettingsTab,
} from "@/components/ward-management/settings/settings-search-index";

import { RULES } from "./settings-rule-catalogue";

export const REDESIGN_TABS: readonly { readonly id: SettingsTab; readonly label: string }[] = [
  { id: "rules", label: "Rules" },
  { id: "alerts", label: "Alerts" },
  { id: "display", label: "Display and profile" },
  { id: "data", label: "Help and data" },
  { id: "access", label: "Access" },
];

export const TAB_ICONS = {
  rules: Clock,
  alerts: Bell,
  display: Palette,
  profile: UserRound,
  data: CircleHelp,
  access: KeyRound,
} as const;

/** Today's entries on the new tabs, with today's names where the row's words changed. */
const MOVED: Partial<Record<string, Partial<SettingsSearchEntry>>> = {
  shortcuts: { tab: "data" },
  help: { tab: "data" },
  role: { tab: "display" },
  "go-to-desk": { tab: "display" },
  service: { tab: "display" },
  export: { label: "Download rules file" },
  import: { label: "Load rules file" },
  restore: { label: "Restore defaults" },
  "recent-changes": { label: "Last rule change" },
  "decision-targets": { label: "Deadlines and reply targets" },
};

const ADDED: readonly SettingsSearchEntry[] = [
  ...RULES.filter((entry) => entry.group === "Deadlines and reply targets" || entry.group === "Forecast alerts")
    .filter((entry) => entry.key !== "morning")
    .map((entry) => ({
      id: entry.setting,
      label: entry.label,
      tab: "rules" as const,
      keywords: entry.group.toLowerCase(),
    })),
  { id: "changed-only", label: "Show changed only", tab: "rules", keywords: "default differ filter changed" },
  { id: "alerts-check", label: "Will alerts reach you here?", tab: "alerts", keywords: "ready check notifications" },
  { id: "test-alert", label: "Send a test alert", tab: "alerts", keywords: "test notification try" },
  { id: "copy-diagnostics", label: "Copy diagnostics", tab: "data", keywords: "fault report support bug" },
  { id: "clinical-values", label: "Clinical values", tab: "data", keywords: "signed reference clinical" },
  { id: "access", label: "Access", tab: "access", keywords: "roles cover grant give remove admin" },
  { id: "who-can", label: "Who can change what", tab: "access", keywords: "permissions roles rules cover" },
  { id: "start-page", label: "Open Ward Flow on", tab: "display", keywords: "start page first home" },
  { id: "text-size", label: "Text size", tab: "display", keywords: "larger font bigger accessibility" },
];

const INDEX: readonly SettingsSearchEntry[] = [
  ...SETTINGS_SEARCH_ENTRIES.map((entry) => {
    const moved = { ...entry, ...MOVED[entry.id] };
    return moved.tab === "profile" ? { ...moved, tab: "display" as const } : moved;
  }),
  ...ADDED,
];

/** Every word typed must appear in the name or keywords; only rows on this desk's tabs; names first. */
export function findRedesignSettings(query: string, tabs: readonly SettingsTab[], limit = 7): SettingsSearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = INDEX.filter((entry) => {
    if (entry.id !== "go-to-desk" && !tabs.includes(entry.tab)) return false;
    const haystack = `${entry.label} ${entry.keywords}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const inName = (entry: SettingsSearchEntry) =>
    words.every((word) => entry.label.toLowerCase().includes(word)) ? 0 : 1;
  return [...matches].sort((a, b) => inName(a) - inName(b)).slice(0, limit);
}
