/**
 * Find a setting: one entry per row on the Settings workspaces. Typing in the band's search lists
 * the matches; choosing one opens its tab and highlights the row carrying `data-setting="<id>"`.
 * The query lives in React state only and is never written to browser storage.
 */

export type SettingsTab = "rules" | "alerts" | "display" | "profile" | "data";

export const SETTINGS_TABS: readonly { readonly id: SettingsTab; readonly label: string }[] = [
  { id: "rules", label: "Rules" },
  { id: "alerts", label: "Alerts" },
  { id: "display", label: "Display" },
  { id: "profile", label: "Profile and shift" },
  { id: "data", label: "Data and about" },
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
  { id: "pull-hold", label: "Pull hold", tab: "rules", keywords: "pulled held bed reservation return" },
  { id: "morning-count", label: "Morning count", tab: "rules", keywords: "rollup ward count deadline" },
  { id: "surge", label: "Standard or Surge timings", tab: "rules", keywords: "busy day preset surge ends" },
  { id: "first-warning", label: "First warning", tab: "rules", keywords: "legal due time form urgent" },
  { id: "second-warning", label: "Second warning", tab: "rules", keywords: "legal due time form due soon" },
  { id: "occupancy", label: "Occupancy alert", tab: "rules", keywords: "bed alerts threshold capacity" },
  { id: "tier-one", label: "Tier 1 overdue after", tab: "rules", keywords: "referral queue overdue" },
  { id: "ward-silent", label: "Ward not answering", tab: "rules", keywords: "reminder referral silent" },
  { id: "bed-hold", label: "Bed hold expires", tab: "rules", keywords: "held bed flag review" },
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
  { id: "buzz", label: "Buzz sound", tab: "alerts", keywords: "chime urgent audio sound test" },
  { id: "flash", label: "Flash on urgent", tab: "alerts", keywords: "visual pulse screen edge" },
  { id: "buzz-again", label: "Buzz again if not seen", tab: "alerts", keywords: "repeat acknowledge" },
  { id: "quiet-hours", label: "Quiet hours", tab: "alerts", keywords: "night mute silence" },
  { id: "shift-summary", label: "Summary at shift start", tab: "alerts", keywords: "what changed digest" },
  { id: "snooze", label: "Snooze alerts", tab: "alerts", keywords: "quiet pause ward round" },
  { id: "notifications", label: "Notifications", tab: "alerts", keywords: "tell me when in app sound" },
  { id: "live-lists", label: "Live lists", tab: "alerts", keywords: "update pause idle" },
  { id: "timer-seconds", label: "Seconds on timers", tab: "alerts", keywords: "clock countdown" },
  { id: "wallboard", label: "Wallboard refresh", tab: "alerts", keywords: "board shared screen" },
  { id: "theme", label: "Theme", tab: "display", keywords: "appearance dark light night auto" },
  { id: "sidebar", label: "Sidebar", tab: "display", keywords: "rail navigation icons" },
  { id: "text-size", label: "Text size", tab: "display", keywords: "font larger smaller" },
  { id: "density", label: "Row density", tab: "display", keywords: "compact comfortable" },
  { id: "touch", label: "Touch mode", tab: "display", keywords: "tablet larger targets" },
  { id: "reduce-motion", label: "Reduce motion", tab: "display", keywords: "animation accessibility" },
  { id: "high-contrast", label: "High contrast", tab: "display", keywords: "accessibility edges ink" },
  { id: "initials", label: "Initials only on shared screens", tab: "display", keywords: "privacy wallboard" },
  { id: "lock-idle", label: "Lock after idle", tab: "display", keywords: "privacy timeout blank" },
  { id: "clear-on-close", label: "Clear session on close", tab: "display", keywords: "privacy tab drafts" },
  { id: "shortcuts", label: "Shortcuts", tab: "display", keywords: "keyboard keys" },
  { id: "role", label: "Role", tab: "profile", keywords: "profile sign in account" },
  { id: "service", label: "Service in view", tab: "profile", keywords: "default health service scope" },
  { id: "opens-on", label: "Opens on", tab: "profile", keywords: "start first screen home" },
  { id: "my-shift", label: "My shift", tab: "profile", keywords: "day evening night roster" },
  { id: "covering", label: "Covering for", tab: "profile", keywords: "cover desk alerts" },
  { id: "handover-sections", label: "Handover sheet sections", tab: "profile", keywords: "print handover" },
  { id: "handover-reminder", label: "Remind me before shift end", tab: "profile", keywords: "handover reminder" },
  { id: "handover-open", label: "Open handover at shift change", tab: "profile", keywords: "handover" },
  { id: "export", label: "Export rules", tab: "data", keywords: "download backup json" },
  { id: "import", label: "Import rules", tab: "data", keywords: "upload backup json" },
  { id: "clear-session", label: "Clear session", tab: "data", keywords: "cache drafts browser" },
  { id: "restore", label: "Restore all defaults", tab: "data", keywords: "reset baseline" },
  { id: "about", label: "About", tab: "data", keywords: "version synthetic medical device" },
  { id: "thresholds", label: "Thresholds", tab: "data", keywords: "reference triggers figures" },
  { id: "fixed-defaults", label: "Fixed defaults", tab: "data", keywords: "operational reference code" },
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
