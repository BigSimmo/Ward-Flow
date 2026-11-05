// Settings by role (Josh, 3 Nov 2026, ST1, "yes to all"): the sections of the one page, their icons,
// and Find a setting's index. Everyone has You, Display and (where alerts reach the desk) Alerts. The
// coordinator also has Rules; the access admin has Access and Data. Demo tools show only on the demo
// site. Help, the tour and shortcuts live in Help, so Settings no longer repeats them. The index is
// settings-search-index.ts with the rows it could not find, and each row is found only on a desk
// whose page has its section.
import { Bell, Clock, Database, KeyRound, Palette, UserRound, Wrench } from "lucide-react";

import {
  SETTINGS_SEARCH_ENTRIES,
  type SettingsSearchEntry,
} from "@/components/ward-management/settings/settings-search-index";

import { RULES } from "./settings-rule-catalogue";

/** The sections of the one Settings page. Each desk sees only the ones it uses. */
export type SettingsSection = "rules" | "alerts" | "display" | "access" | "data" | "you" | "demo";

export const SECTION_LABELS: Record<SettingsSection, string> = {
  rules: "Rules",
  alerts: "Alerts",
  display: "Display",
  access: "Access",
  data: "Data",
  you: "You",
  demo: "Demo tools",
};

export const SECTION_ICONS = {
  rules: Clock,
  alerts: Bell,
  display: Palette,
  access: KeyRound,
  data: Database,
  you: UserRound,
  demo: Wrench,
} as const;

/** Rows Help owns now (Help, the tour, shortcuts): Find a setting no longer offers them. */
const IN_HELP: ReadonlySet<string> = new Set(["help", "help-screen", "tour", "shortcuts"]);
/** Builder and demonstration rows: Demo tools, on the demo site only. */
const DEMO_ROWS: ReadonlySet<string> = new Set(["clear-session", "feature-flags", "demo-tools"]);
/** Rule rows that sit with the coordinator's rule editor: the rules file and the reference tables. */
const RULE_FILE_ROWS: ReadonlySet<string> = new Set([
  "export",
  "import",
  "thresholds",
  "fixed-defaults",
  "clinical-values",
]);

/** Rows the access admin's Data holds, which Demo tools carries on a desk without Data. */
const DATA_OR_DEMO: ReadonlySet<string> = new Set(["copy-diagnostics", "about"]);

/** What decides where a row sits on this desk. */
export type SectionContext = { readonly editsRules: boolean; readonly sections: readonly SettingsSection[] };

/**
 * Which section a Find a setting row lives in on this desk, or `null` when Settings no longer holds
 * it. The coordinator keeps the rules file and reference tables with the rule editor; elsewhere they
 * are the access admin's Data.
 */
export function sectionForEntry(
  entry: SettingsSearchEntry,
  context: SectionContext = { editsRules: false, sections: [] },
): SettingsSection | null {
  if (IN_HELP.has(entry.id)) return null;
  // Help lives in Help now; Find still answers someone who looks for it here.
  if (entry.id === "open-help") return context.sections[0] ?? "display";
  if (entry.id === "go-to-desk") return "you";
  if (entry.id === "restore" || entry.id === "help-tips") return "display";
  if (DEMO_ROWS.has(entry.id)) return "demo";
  if (RULE_FILE_ROWS.has(entry.id)) return context.editsRules ? "rules" : "data";
  if (DATA_OR_DEMO.has(entry.id)) return context.sections.includes("data") ? "data" : "demo";
  switch (entry.tab) {
    case "rules":
      return "rules";
    case "alerts":
      return "alerts";
    case "display":
      return "display";
    case "profile":
      return "you";
    case "access":
      // A ward, ED or coordinator desk asks for cover from You; only the access admin has Access.
      return !context.sections.includes("access") && context.sections.includes("you") ? "you" : "access";
    case "data":
      return "data";
  }
}

const FROM_OLD_NAME: Record<string, SettingsSection> = {
  rules: "rules",
  alerts: "alerts",
  display: "display",
  device: "display",
  profile: "you",
  data: "data",
  access: "access",
};

/** The section named in the address: a section (#display) or an old name (#device, #profile). */
export function sectionFromHash(): SettingsSection | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  if (Object.hasOwn(SECTION_LABELS, hash)) return hash as SettingsSection;
  return Object.hasOwn(FROM_OLD_NAME, hash) ? FROM_OLD_NAME[hash] : null;
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
  "go-to-desk": { tab: "profile", label: "Try another desk (demo)" },
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
  {
    id: "copy-diagnostics",
    label: "Copy details for a bug report",
    tab: "data",
    keywords: "diagnostics fault report support bug",
  },
  { id: "clinical-values", label: "Clinical values", tab: "data", keywords: "signed reference clinical" },
  { id: "access", label: "Access", tab: "access", keywords: "roles cover grant give remove admin" },
  { id: "who-can", label: "Who can change what", tab: "access", keywords: "permissions roles rules cover" },
  { id: "demo-tools", label: "Demo tools", tab: "data", keywords: "developer feature switches flags reset demo" },
  { id: "help-tips", label: "Page tips", tab: "display", keywords: "help hints first time tip" },
  {
    id: "open-help",
    label: "Open Help",
    tab: "display",
    keywords: "help tour glossary shortcuts keys how guide training",
  },
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
  editsRules = false,
): SettingsSearchEntry[] {
  const context = { editsRules, sections };
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = INDEX.filter((entry) => {
    const section = sectionForEntry(entry, context);
    if (section === null || !sections.includes(section)) return false;
    const haystack = `${entry.label} ${entry.keywords}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const inName = (entry: SettingsSearchEntry) =>
    words.every((word) => entry.label.toLowerCase().includes(word)) ? 0 : 1;
  return [...matches].sort((a, b) => inName(a) - inName(b)).slice(0, limit);
}
