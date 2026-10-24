/**
 * Find a setting: one entry per row on the Settings workspaces. Typing in the band's search lists
 * the matches; choosing one opens its tab and highlights the row carrying `data-setting="<id>"`.
 * The query lives in React state only and is never written to browser storage.
 */

export type SettingsTab = "rules" | "alerts" | "display" | "profile" | "data" | "access";

export const SETTINGS_TABS: readonly { readonly id: SettingsTab; readonly label: string }[] = [
  { id: "rules", label: "Rules" },
  { id: "alerts", label: "Alerts" },
  { id: "display", label: "Display" },
  { id: "profile", label: "Profile and shift" },
  { id: "data", label: "Data and about" },
  // Shown only with the role-access flag on, to the desks that give access or cover.
  { id: "access", label: "Access" },
];

export interface SettingsSearchEntry {
  readonly id: string;
  readonly label: string;
  readonly tab: SettingsTab;
  readonly keywords: string;
}

export const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] = [
  { id: "ed-target", label: "ED wait target", tab: "rules", keywords: "emergency access wait timing" },
  { id: "wards-asked", label: "Wards asked at once", tab: "rules", keywords: "parallel referral cap enquiry" },
  { id: "pull-hold", label: "Pull hold", tab: "rules", keywords: "pulled held bed reservation return expires hold" },
  { id: "morning-count", label: "Morning count", tab: "rules", keywords: "rollup ward count deadline" },
  { id: "surge", label: "Standard or Surge timings", tab: "rules", keywords: "busy day preset surge" },
  { id: "second-warning", label: "Early warning", tab: "rules", keywords: "legal due time form due soon first" },
  { id: "first-warning", label: "Final warning", tab: "rules", keywords: "legal due time form urgent last" },
  {
    id: "decision-targets",
    label: "Decision targets",
    tab: "rules",
    keywords: "referral transfer acceptance transport booked overdue",
  },
  {
    id: "forecast-alerts",
    label: "Forecast alerts",
    tab: "rules",
    keywords: "forecast tomorrow short bed type ed access risk worse since looked",
  },
  { id: "recent-changes", label: "Recent changes", tab: "rules", keywords: "audit history saves" },
  {
    id: "browser-notifications",
    label: "Browser notifications",
    tab: "alerts",
    keywords: "act now red alert desktop notify",
  },
  {
    id: "phone-alerts",
    label: "Phone alerts",
    tab: "alerts",
    keywords: "push mobile lock screen after hours act now red alert notify",
  },
  { id: "buzz", label: "Buzz sound", tab: "alerts", keywords: "chime urgent audio sound test" },
  {
    id: "theme",
    label: "Theme",
    tab: "display",
    keywords: "appearance dark light night auto glare bright room sunlight contrast window",
  },
  { id: "sidebar", label: "Sidebar", tab: "display", keywords: "rail navigation icons full compact" },
  { id: "density", label: "Row density", tab: "display", keywords: "compact comfortable" },
  { id: "reduce-motion", label: "Reduce motion", tab: "display", keywords: "animation accessibility" },
  { id: "high-contrast", label: "High contrast", tab: "display", keywords: "accessibility edges ink" },
  {
    id: "discreet-names",
    label: "Discreet names on phone",
    tab: "display",
    keywords: "privacy initials umrn mobile hide name",
  },
  { id: "shortcuts", label: "Shortcuts", tab: "display", keywords: "keyboard keys" },
  { id: "help", label: "Help and tour", tab: "display", keywords: "help glossary tour guide words codes" },
  {
    id: "character-shortcuts",
    label: "Single-key shortcuts",
    tab: "display",
    keywords: "keyboard letters numbers punctuation accessibility disable",
  },
  { id: "role", label: "Role", tab: "profile", keywords: "profile sign in account" },
  // Audit settings-27: the desk drawer is findable here; choosing it opens the drawer.
  {
    id: "go-to-desk",
    label: "Go to a desk",
    tab: "profile",
    keywords: "switch workstation role desk change view ward emergency department transport",
  },
  { id: "service", label: "Service in view", tab: "profile", keywords: "default health service scope" },
  { id: "export", label: "Export rules", tab: "data", keywords: "download backup json" },
  { id: "import", label: "Import rules", tab: "data", keywords: "upload backup json" },
  { id: "clear-session", label: "Clear session", tab: "data", keywords: "cache drafts browser" },
  { id: "restore", label: "Restore all defaults", tab: "data", keywords: "reset baseline" },
  { id: "about", label: "About", tab: "data", keywords: "version synthetic medical device" },
  { id: "thresholds", label: "Thresholds", tab: "data", keywords: "reference triggers figures" },
  { id: "fixed-defaults", label: "Fixed defaults", tab: "data", keywords: "operational reference code" },
  {
    id: "feature-flags",
    label: "Feature flags",
    tab: "data",
    keywords: "unfinished preview experimental switch on off tv bed meeting demo reset",
  },
];

/** Every word typed must appear in the entry's name or keywords. Name matches rank first. */
export function findSettings(query: string, limit = 7): SettingsSearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = SETTINGS_SEARCH_ENTRIES.filter((entry) => {
    const haystack = `${entry.label} ${entry.keywords}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const inName = (entry: SettingsSearchEntry) =>
    words.every((word) => entry.label.toLowerCase().includes(word)) ? 0 : 1;
  return [...matches].sort((a, b) => inName(a) - inName(b)).slice(0, limit);
}
