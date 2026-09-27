/**
 * Declarative search index and domain taxonomy for the Ward Flow Settings console.
 * Modeled after PsychSift's `settings-sections.ts` to provide keyword search,
 * domain filtering, and real-time hit counts across configuration parameters.
 */

export type SettingsDomainId =
  "cat-appearance" | "cat-thresholds" | "cat-allocation" | "cat-notifications" | "cat-reset";

export interface SettingsDomain {
  readonly id: SettingsDomainId;
  readonly navLabel: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
}

export const SETTINGS_DOMAINS: readonly SettingsDomain[] = [
  {
    id: "cat-appearance",
    navLabel: "Appearance & Theme",
    title: "Appearance & Theme",
    eyebrow: "Domain 1 · Presentation",
    description: "Console display presentation, daylight and dark contrast modes, and navigation rail density.",
  },
  {
    id: "cat-thresholds",
    navLabel: "Clinical Thresholds",
    title: "Clinical Escalation & Operational Thresholds",
    eyebrow: "Domain 2 · Operational Limits",
    description:
      "Emergency department dwell targets, warning windows, medical clearance buffers, and published operational safeguards.",
  },
  {
    id: "cat-allocation",
    navLabel: "Bed Allocation Weights",
    title: "Bed Allocation & Capacity Rules",
    eyebrow: "Domain 3 · Capacity & Surge",
    description:
      "Reservation hold duration, parallel referral enquiry limits, bay integrity, and ward acuity profile limits.",
  },
  {
    id: "cat-notifications",
    navLabel: "Notifications & Telemetry",
    title: "Notifications, Access Matrix & Telemetry",
    eyebrow: "Domain 4 · Governance & Telemetry",
    description:
      "Clinical escalation notifications, AHPRA-aligned role scopes, keyboard accelerators, and search access telemetry.",
  },
  {
    id: "cat-reset",
    navLabel: "Local Storage & Reset",
    title: "Local Storage, Workspace & Baseline Reset",
    eyebrow: "Domain 5 · Storage & Defaults",
    description:
      "Browser session memory, clinical handover sheet output configuration, and audited configuration baseline restoration.",
  },
];

export interface SettingsSearchEntry {
  readonly id: string;
  readonly domainId: SettingsDomainId;
  readonly label: string;
  readonly keywords: string;
}

export const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] = [
  // Domain 1: Appearance & Theme
  {
    id: "setting-appearance-theme",
    domainId: "cat-appearance",
    label: "Console Appearance Theme",
    keywords: "appearance theme dark light auto mode colour color contrast display night day",
  },
  {
    id: "setting-rail-density",
    domainId: "cat-appearance",
    label: "Primary Navigation Rail Width",
    keywords: "navigation rail toggle open close density compact expanded sidebar collapse",
  },

  // Domain 2: Clinical Thresholds
  {
    id: "setting-ed-threshold",
    domainId: "cat-thresholds",
    label: "Emergency Department Access Target",
    keywords: "ed access target emergency dwell time wait ed screen ed-home movements board access target line",
  },
  {
    id: "setting-due-soon-urgent",
    domainId: "cat-thresholds",
    label: "First warning before a legal due time",
    keywords:
      "due soon warning first urgent due within the hour legal due time default not a legal limit dueSoonUrgentMinutes",
  },
  {
    id: "setting-due-soon",
    domainId: "cat-thresholds",
    label: "Second warning before a legal due time",
    keywords: "due soon warning second legal due time default not a legal limit dueSoonMinutes",
  },
  {
    id: "setting-morning-rollup",
    domainId: "cat-thresholds",
    label: "Morning roll-up time",
    keywords: "morning rollup deadline roll-up time census discharge confirm beds inpatient wards",
  },
  {
    id: "setting-form4a-warn",
    domainId: "cat-thresholds",
    label: "Recorded Form 4A expiry warning (demo)",
    keywords: "form 4a transport order expiry warning legal authority buffer not wired prototype",
  },
  {
    id: "setting-auto-escalate",
    domainId: "cat-thresholds",
    label: "Automated Multi-Service Escalation Broadcast",
    keywords: "automated notification broadcast duty consultant state bed desk notification not wired prototype",
  },
  {
    id: "setting-medical-release",
    domainId: "cat-thresholds",
    label: "Medical Clearance Bed Release Buffer",
    keywords: "medical clearance buffer toxicology emergency turnaround relinquishment not wired prototype",
  },
  {
    id: "setting-published-thresholds",
    domainId: "cat-thresholds",
    label: "Published Operational Thresholds Table",
    keywords: "published thresholds emergency ed access target legal form deadline immutable read only",
  },
  {
    id: "setting-operational-defaults",
    domainId: "cat-thresholds",
    label: "Operational defaults",
    keywords:
      "operational defaults late arrival grace referral overdue after hours occupancy ed pressure shift pattern read only not a legal limit",
  },

  // Domain 3: Bed Allocation Weights
  {
    id: "setting-hold-duration",
    domainId: "cat-allocation",
    label: "Pulled Bed Reservation Hold Duration",
    keywords: "bed hold duration reservation timer release pull expires accepting unit",
  },
  {
    id: "setting-parallel-cap",
    domainId: "cat-allocation",
    label: "Parallel Referral Enquiry Cap",
    keywords: "parallel referral cap units concurrent enquiry shortlist intake statistics",
  },
  {
    id: "setting-gender-mix",
    domainId: "cat-allocation",
    label: "Gender Designation & Bay Integrity Enforcement",
    keywords: "gender mix bay integrity sex designation num override female male ward protection not wired prototype",
  },
  {
    id: "setting-acuity-ceiling",
    domainId: "cat-allocation",
    label: "Ward Acuity & 1:1 Specialling Ceiling",
    keywords: "acuity ceiling specialling nursing high dependency unit patient ratio not wired prototype",
  },

  // Domain 4: Notifications & Telemetry
  {
    id: "setting-buzz-alert",
    domainId: "cat-notifications",
    label: "Audio & Visual Urgent Buzz Alerts",
    keywords: "audio visual urgent buzz alerts chime sound flash coordinator ward",
  },
  {
    id: "setting-wallboard-refresh",
    domainId: "cat-notifications",
    label: "Wallboard Auto-Refresh Timer",
    keywords: "wallboard auto refresh timer unattended countdown telemetry ed coordinator desk",
  },
  {
    id: "setting-form1a-strict",
    domainId: "cat-notifications",
    label: "Require a Form 1A before an involuntary admission",
    keywords: "form 1a examination involuntary due time countdown not wired prototype",
  },
  {
    id: "setting-form4a-escort",
    domainId: "cat-notifications",
    label: "Escort required before transport advances (demo)",
    keywords: "form 4a escort police wapol mental health transport rfds custody transfer stamp not wired prototype",
  },
  {
    id: "setting-auth-hospital",
    domainId: "cat-notifications",
    label: "Authorised Hospital Involuntary Bed Validation",
    keywords:
      "authorised hospital gazetted facility involuntary admission validation mental health service not wired prototype",
  },
  {
    id: "setting-cp-audit",
    domainId: "cat-notifications",
    label: "Audit Log for Chief Psychiatrist",
    keywords: "chief psychiatrist audit log governance timestamp review not wired prototype",
  },
  {
    id: "setting-roles-matrix",
    domainId: "cat-notifications",
    label: "Statewide Clinical Roles & Delegations Matrix",
    keywords: "roles ahpra delegations matrix permissions consultant coordinator num liaison transport audit",
  },
  {
    id: "setting-keyboard-shortcuts",
    domainId: "cat-notifications",
    label: "Tactical Keyboard Shortcuts",
    keywords: "keyboard shortcuts keys slash escape bracket hotkey navigation cheatsheet",
  },
  {
    id: "setting-search-ledger",
    domainId: "cat-notifications",
    label: "Ephemeral Search Access Ledger",
    keywords: "search history ledger clear delete erase privacy log audit queries",
  },

  // Domain 5: Local Storage & Reset
  {
    id: "setting-default-service",
    domainId: "cat-reset",
    label: "Default Service Startup",
    keywords: "default service startup starts on all services not saved bar visit scope",
  },
  {
    id: "setting-handover-sheet",
    domainId: "cat-reset",
    label: "Printed Handover Sheet Configuration",
    keywords: "handover sheet print longest waits beds pulled in transit placement gone wrong shift sign off",
  },
  {
    id: "setting-demonstration-data",
    domainId: "cat-reset",
    label: "Demonstration Data Controls Location",
    keywords: "demonstration data clock scenario reset tools drawer bar q7 q-7",
  },
];

/**
 * Filter setting entry IDs based on search query string.
 */
export function filterSettingEntries(query: string): Set<string> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return new Set(SETTINGS_SEARCH_ENTRIES.map((entry) => entry.id));
  }
  const matching = new Set<string>();
  for (const entry of SETTINGS_SEARCH_ENTRIES) {
    const haystack = `${entry.label} ${entry.keywords}`.toLowerCase();
    if (haystack.includes(q)) {
      matching.add(entry.id);
    }
  }
  return matching;
}

/**
 * Count matching entries per domain given a set of matched entry IDs.
 */
export function countMatchesByDomain(matchedIds: Set<string>): Record<SettingsDomainId, number> {
  const counts: Record<SettingsDomainId, number> = {
    "cat-appearance": 0,
    "cat-thresholds": 0,
    "cat-allocation": 0,
    "cat-notifications": 0,
    "cat-reset": 0,
  };
  for (const entry of SETTINGS_SEARCH_ENTRIES) {
    if (matchedIds.has(entry.id)) {
      counts[entry.domainId] = (counts[entry.domainId] ?? 0) + 1;
    }
  }
  return counts;
}
