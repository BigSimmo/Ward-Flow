// Settings by login (Josh, 31 Oct 2026): the sections of the one page, their icons, and Find a
// setting's index. The index is settings-search-index.ts with the rows it could not find (each reply
// target and forecast alert, clinical values, the alerts check, Copy diagnostics, Show changed only,
// Access), and each row is found only on a desk whose page has its section.
import { CircleHelp, Clock, KeyRound, Palette, UserRound, Wrench } from "lucide-react";

import {
  SETTINGS_SEARCH_ENTRIES,
  type SettingsSearchEntry,
} from "@/components/ward-management/settings/settings-search-index";

import { RULES } from "./settings-rule-catalogue";

/** The sections of the one Settings page (Josh, 31 Oct 2026). Each desk sees only the ones it uses. */
export type SettingsSection = "rules" | "device" | "access" | "you" | "help" | "demo";

export const SECTION_LABELS: Record<SettingsSection, string> = {
  rules: "Rules",
  device: "This device",
  access: "Access",
  you: "You",
  help: "Help",
  demo: "Demo tools",
};

export const SECTION_ICONS = {
  rules: Clock,
  device: Palette,
  access: KeyRound,
  you: UserRound,
  help: CircleHelp,
  demo: Wrench,
} as const;

/** Rows of the old "Help and data" tab that belong to the Help section; the rest are Demo tools. */
const HELP_ROWS: ReadonlySet<string> = new Set(["help", "help-screen", "tour", "shortcuts"]);

/** Which section a Find a setting row lives in. */
export function sectionForEntry(entry: SettingsSearchEntry): SettingsSection {
  if (entry.id === "go-to-desk") return "you";
  if (entry.id === "restore") return "device";
  switch (entry.tab) {
    case "rules":
      return "rules";
    case "alerts":
    case "display":
      return "device";
    case "profile":
      return "you";
    case "access":
      return "access";
    case "data":
      return HELP_ROWS.has(entry.id) ? "help" : "demo";
  }
}

const FROM_OLD_TAB: Record<string, SettingsSection> = {
  rules: "rules",
  alerts: "device",
  display: "device",
  profile: "you",
  data: "help",
  access: "access",
};

/** The section named in the address: a section (#device) or an old tab (#alerts, #profile, #data). */
export function sectionFromHash(): SettingsSection | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  if (Object.hasOwn(SECTION_LABELS, hash)) return hash as SettingsSection;
  return Object.hasOwn(FROM_OLD_TAB, hash) ? FROM_OLD_TAB[hash] : null;
}

/** Today's entries on the new tabs, with today's names where the row's words changed. */
const MOVED: Partial<Record<string, Partial<SettingsSearchEntry>>> = {
  shortcuts: { tab: "data" },
  help: { tab: "data" },
  service: { tab: "profile" },
  export: { label: "Save the rules as a file" },
  import: { label: "Load a rules file" },
  restore: { label: "Restore defaults" },
  "clear-session": { label: "Reset the demo in this tab" },
  "copy-diagnostics": { label: "Copy details for a bug report" },
  role: { tab: "profile", label: "You" },
  "go-to-desk": { tab: "profile", label: "Switch login (demo)" },
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
  { id: "demo-tools", label: "Demo tools", tab: "data", keywords: "developer feature switches flags reset demo" },
];

const INDEX: readonly SettingsSearchEntry[] = [
  ...SETTINGS_SEARCH_ENTRIES.map((entry) => ({ ...entry, ...MOVED[entry.id] })),
  ...ADDED,
];

/** Every word typed must appear in the name or keywords; only rows in this desk's sections; names first. */
export function findRedesignSettings(
  query: string,
  sections: readonly SettingsSection[],
  limit = 7,
): SettingsSearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = INDEX.filter((entry) => {
    if (!sections.includes(sectionForEntry(entry))) return false;
    const haystack = `${entry.label} ${entry.keywords}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const inName = (entry: SettingsSearchEntry) =>
    words.every((word) => entry.label.toLowerCase().includes(word)) ? 0 : 1;
  return [...matches].sort((a, b) => inName(a) - inName(b)).slice(0, limit);
}
