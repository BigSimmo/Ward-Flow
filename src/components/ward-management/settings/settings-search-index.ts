/**
 * Find a setting: one entry per row on the Settings workspaces. Typing in the band's search lists
 * the matches; choosing one opens its tab and highlights the row carrying `data-setting="<id>"`.
 * The query lives in React state only and is never written to browser storage.
 */

import { showsUnwiredPreviews } from "@/components/ward-management/unwired-previews";

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
  /** A Preview setting: listed only where its row shows, in a local development build. */
  readonly preview?: true;
}

export const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] = [
  { id: "ed-target", label: "ED wait target", tab: "rules", keywords: "emergency access wait timing" },
  { id: "wards-asked", label: "Wards asked at once", tab: "rules", keywords: "parallel referral cap enquiry" },
  { id: "pull-hold", label: "Pull hold", tab: "rules", keywords: "pulled held bed reservation return expires hold" },
  { id: "morning-count", label: "Morning count", tab: "rules", keywords: "rollup ward count deadline" },
  { id: "surge", label: "Standard or Surge timings", tab: "rules", keywords: "busy day preset surge" },
  { id: "surge-ends", label: "Surge ends", tab: "rules", keywords: "busy day back to standard", preview: true },
  { id: "second-warning", label: "Early warning", tab: "rules", keywords: "legal due time form due soon first" },
  { id: "first-warning", label: "Final warning", tab: "rules", keywords: "legal due time form urgent last" },
  { id: "occupancy", label: "Occupancy alert", tab: "rules", keywords: "bed alerts threshold capacity", preview: true },
  { id: "tier-one", label: "Tier 1 overdue after", tab: "rules", keywords: "referral queue overdue", preview: true },
  { id: "ward-silent", label: "Ward not answering", tab: "rules", keywords: "reminder referral silent", preview: true },
  {
    id: "decision-targets",
    label: "Decision targets",
    tab: "rules",
    keywords: "referral transfer acceptance transport booked overdue",
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
  { id: "flash", label: "Flash on urgent", tab: "alerts", keywords: "visual pulse screen edge", preview: true },
  { id: "buzz-again", label: "Buzz again if not seen", tab: "alerts", keywords: "repeat acknowledge", preview: true },
  { id: "quiet-hours", label: "Quiet hours", tab: "alerts", keywords: "night mute silence", preview: true },
  {
    id: "shift-summary",
    label: "Summary at shift start",
    tab: "alerts",
    keywords: "what changed digest",
    preview: true,
  },
  { id: "snooze", label: "Snooze alerts", tab: "alerts", keywords: "quiet pause ward round", preview: true },
  { id: "notifications", label: "Notifications", tab: "alerts", keywords: "tell me when in app sound", preview: true },
  { id: "live-lists", label: "Live lists", tab: "alerts", keywords: "update pause idle", preview: true },
  { id: "timer-seconds", label: "Seconds on timers", tab: "alerts", keywords: "clock countdown", preview: true },
  { id: "wallboard", label: "Wallboard refresh", tab: "alerts", keywords: "board shared screen", preview: true },
  {
    id: "theme",
    label: "Theme",
    tab: "display",
    keywords: "appearance dark light night auto glare bright room sunlight contrast window",
  },
  { id: "sidebar", label: "Sidebar", tab: "display", keywords: "rail navigation icons full compact" },
  { id: "text-size", label: "Text size", tab: "display", keywords: "font larger smaller", preview: true },
  { id: "density", label: "Row density", tab: "display", keywords: "compact comfortable" },
  { id: "touch", label: "Touch mode", tab: "display", keywords: "tablet larger targets", preview: true },
  { id: "reduce-motion", label: "Reduce motion", tab: "display", keywords: "animation accessibility" },
  { id: "high-contrast", label: "High contrast", tab: "display", keywords: "accessibility edges ink" },
  {
    id: "discreet-names",
    label: "Discreet names on phone",
    tab: "display",
    keywords: "privacy initials umrn mobile hide name",
  },
  {
    id: "initials",
    label: "Initials only on shared screens",
    tab: "display",
    keywords: "privacy wallboard",
    preview: true,
  },
  { id: "lock-idle", label: "Lock after idle", tab: "display", keywords: "privacy timeout blank", preview: true },
  {
    id: "clear-on-close",
    label: "Clear session on close",
    tab: "display",
    keywords: "privacy tab drafts",
    preview: true,
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
  { id: "opens-on", label: "Opens on", tab: "profile", keywords: "start first screen home", preview: true },
  { id: "my-shift", label: "My shift", tab: "profile", keywords: "day evening night roster", preview: true },
  { id: "covering", label: "Covering for", tab: "profile", keywords: "cover desk alerts", preview: true },
  {
    id: "handover-sections",
    label: "Handover sheet sections",
    tab: "profile",
    keywords: "print handover",
    preview: true,
  },
  {
    id: "handover-reminder",
    label: "Remind me before shift end",
    tab: "profile",
    keywords: "handover reminder",
    preview: true,
  },
  { id: "handover-open", label: "Open handover at shift change", tab: "profile", keywords: "handover", preview: true },
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

/**
 * Every word typed must appear in the entry's name or keywords. Name matches rank first.
 *
 * Overall review, 20 Oct 2026: Preview rows show only in a local development build, so elsewhere
 * their entries are left out and no result leads to a row that is not there.
 */
export function findSettings(
  query: string,
  limit = 7,
  previews: boolean = showsUnwiredPreviews(),
): SettingsSearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const matches = SETTINGS_SEARCH_ENTRIES.filter((entry) => {
    if (entry.preview && !previews) return false;
    const haystack = `${entry.label} ${entry.keywords}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
  const inName = (entry: SettingsSearchEntry) =>
    words.every((word) => entry.label.toLowerCase().includes(word)) ? 0 : 1;
  return [...matches].sort((a, b) => inName(a) - inName(b)).slice(0, limit);
}
