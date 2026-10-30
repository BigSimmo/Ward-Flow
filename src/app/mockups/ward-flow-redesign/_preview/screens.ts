/**
 * Preview only: every redesigned page and popup, the group it is listed under in the viewer, and
 * the address it will have once built. The shell reads that address to mark its menu and title,
 * and links in the shell are mapped back to the matching mock-up through it.
 */
export type MockupScreen = {
  slug: string;
  label: string;
  group: string;
  /** The app address this page replaces once approved. */
  appPath: string;
  /**
   * The address the shell is told it is on, when that differs from `appPath`. New referral uses
   * the board's, so the app bar does not open its own slide-out over the redesigned one.
   */
  shellPath?: string;
  /** Pages that draw without the app's rail and header (the TV, sign in, print packs). */
  bare?: boolean;
};

export type MockupPopup = {
  slug: string;
  label: string;
  group: string;
  /** The page it opens over. */
  over: string;
  /** What the page is asked to open (`openOnLoad`). */
  pop: string;
};

export const MOCKUP_BASE = "/mockups/ward-flow-redesign";

export const MOCKUP_SCREENS: readonly MockupScreen[] = [
  { slug: "home", label: "Home", group: "Coordinator", appPath: "/ward-flow" },
  { slug: "capacity", label: "Capacity", group: "Coordinator", appPath: "/ward-flow/capacity" },
  { slug: "movements", label: "Movements", group: "Coordinator", appPath: "/ward-flow/movements" },
  { slug: "waiting", label: "Waiting", group: "Coordinator", appPath: "/ward-flow/waiting" },
  { slug: "eds", label: "All EDs", group: "Coordinator", appPath: "/ward-flow/ed" },
  { slug: "referrals", label: "Referrals", group: "Coordinator", appPath: "/ward-flow/referrals" },
  {
    slug: "new-referral",
    label: "New referral",
    group: "Coordinator",
    appPath: "/ward-flow/referrals/new",
    shellPath: "/ward-flow/referrals",
  },
  { slug: "handover", label: "Handover", group: "Coordinator", appPath: "/ward-flow/handover" },
  { slug: "ward", label: "My ward", group: "Desks", appPath: "/ward-flow/ward/rph-adult-secure" },
  { slug: "stays", label: "Stays and discharges", group: "Desks", appPath: "/ward-flow/board/rph-adult-secure" },
  { slug: "ed-board", label: "ED board", group: "Desks", appPath: "/ward-flow/ed/peel-ed" },
  { slug: "transport", label: "Transport", group: "Desks", appPath: "/ward-flow/transport/officer" },
  { slug: "patients", label: "Patients", group: "Work and reports", appPath: "/ward-flow/search" },
  { slug: "discharges", label: "Discharges", group: "Work and reports", appPath: "/ward-flow/discharges" },
  { slug: "wards", label: "All wards", group: "Work and reports", appPath: "/ward-flow/wards" },
  { slug: "statistics", label: "Statistics", group: "Work and reports", appPath: "/ward-flow/statistics" },
  { slug: "alerts", label: "Alerts", group: "Reference", appPath: "/ward-flow/alerts" },
  { slug: "legal-forms", label: "Legal forms", group: "Reference", appPath: "/ward-flow/legal-forms" },
  { slug: "out-of-area", label: "Out of area", group: "Reference", appPath: "/ward-flow/out-of-area" },
  { slug: "on-call", label: "On-call", group: "Reference", appPath: "/ward-flow/on-call" },
  { slug: "seclusion", label: "Seclusion", group: "Reference", appPath: "/ward-flow/seclusion" },
  { slug: "governance", label: "Governance", group: "Reference", appPath: "/ward-flow/governance" },
  {
    slug: "bed-meeting-tv",
    label: "Bed meeting TV",
    group: "Bed meeting and reports",
    appPath: "/ward-flow/bed-meeting",
    bare: true,
  },
  {
    slug: "agenda",
    label: "Meeting agenda",
    group: "Bed meeting and reports",
    appPath: "/ward-flow/bed-meeting/agenda",
  },
  {
    slug: "downtime",
    label: "Downtime pack",
    group: "Bed meeting and reports",
    appPath: "/ward-flow/reports/downtime",
  },
  {
    slug: "chronology",
    label: "Patient chronology",
    group: "Bed meeting and reports",
    appPath: "/ward-flow/reports/chronology",
  },
  { slug: "places", label: "Places", group: "Places and records", appPath: "/ward-flow/hub" },
  { slug: "community", label: "Community", group: "Places and records", appPath: "/ward-flow/community" },
  {
    slug: "community-team",
    label: "Community team",
    group: "Places and records",
    appPath: "/ward-flow/community/midland",
  },
  { slug: "patient", label: "Patient record", group: "Places and records", appPath: "/ward-flow/people/196zcp24w5t0" },
  { slug: "add-patient", label: "Add a patient", group: "Places and records", appPath: "/ward-flow/people/new" },
  {
    slug: "ward-answer",
    label: "Ward answer",
    group: "Places and records",
    appPath: "/ward-flow/ward/rph-adult-secure/answer",
  },
  { slug: "settings", label: "Settings", group: "Places and records", appPath: "/ward-flow/settings" },
  { slug: "sign-in", label: "Sign in", group: "Places and records", appPath: "/ward-flow-sign-in", bare: true },
  { slug: "statistics-compare", label: "Compare", group: "Statistics pages", appPath: "/ward-flow/statistics/compare" },
  { slug: "statistics-list", label: "Ward list", group: "Statistics pages", appPath: "/ward-flow/statistics/wards" },
  {
    slug: "statistics-unit",
    label: "One ward",
    group: "Statistics pages",
    appPath: "/ward-flow/statistics/ward/fsh-adult-secure",
  },
  { slug: "statistics-weekly", label: "Weekly", group: "Statistics pages", appPath: "/ward-flow/statistics/weekly" },
];

/** Popups drawn over their page. Each page opens its own; the viewer asks it to on load. */
export const MOCKUP_POPUPS: readonly MockupPopup[] = [
  { slug: "pop-bed-meeting-sheet", label: "Bed meeting sheet", group: "Page popups", over: "capacity", pop: "sheet" },
  { slug: "pop-scenario", label: "Try a scenario", group: "Page popups", over: "capacity", pop: "scenario" },
  { slug: "pop-capacity-ward", label: "Capacity ward panel", group: "Page popups", over: "capacity", pop: "ward" },
  { slug: "pop-movement", label: "Movement drawer", group: "Page popups", over: "movements", pop: "movement" },
  { slug: "pop-forecast-sheet", label: "Phone bed forecast", group: "Page popups", over: "capacity", pop: "forecast" },
  { slug: "pop-alerts", label: "Alerts drawer", group: "Shell popups", over: "home", pop: "alerts" },
  { slug: "pop-activity", label: "Activity", group: "Shell popups", over: "home", pop: "activity" },
  { slug: "pop-tools", label: "Tools", group: "Shell popups", over: "home", pop: "tools" },
  { slug: "pop-search", label: "Search", group: "Shell popups", over: "home", pop: "search" },
  { slug: "pop-help", label: "Help", group: "Shell popups", over: "home", pop: "help" },
  { slug: "pop-shortcuts", label: "Keyboard shortcuts", group: "Shell popups", over: "home", pop: "shortcuts" },
  { slug: "pop-demo", label: "Demo menu", group: "Shell popups", over: "home", pop: "demo" },
  { slug: "pop-menu", label: "Phone menu", group: "Shell popups", over: "home", pop: "menu" },
  { slug: "pop-create", label: "Create", group: "Shell popups", over: "home", pop: "create" },
  { slug: "pop-ward-switcher", label: "Ward switcher", group: "Shell popups", over: "ward", pop: "ward-switcher" },
  { slug: "pop-shift-brief", label: "Shift brief", group: "Shell popups", over: "stays", pop: "shift-brief" },
  { slug: "pop-desk", label: "Go to a desk", group: "Shell popups", over: "home", pop: "desk" },
  { slug: "pop-service-picker", label: "Service picker", group: "Shell popups", over: "home", pop: "service-picker" },
  { slug: "pop-more-pages", label: "More pages", group: "Shell popups", over: "home", pop: "more-pages" },
  { slug: "pop-tour", label: "Tour", group: "Shell popups", over: "ward", pop: "tour" },
  { slug: "pop-bed-record", label: "Bed record", group: "Page popups", over: "stays", pop: "bed-record" },
  { slug: "pop-confirm-beds", label: "Confirm beds", group: "Page popups", over: "ward", pop: "confirm-beds" },
  { slug: "pop-broadcast", label: "Broadcast", group: "Page popups", over: "home", pop: "broadcast" },
  { slug: "pop-ward-notices", label: "Ward notices", group: "Page popups", over: "ward", pop: "ward-notices" },
  { slug: "pop-refer-ward", label: "Refer to a ward", group: "Page popups", over: "ed-board", pop: "refer-ward" },
  { slug: "pop-ed-actions", label: "ED actions", group: "Page popups", over: "ed-board", pop: "ed-actions" },
  { slug: "pop-log-transport", label: "Log transport", group: "Page popups", over: "ed-board", pop: "log-transport" },
  { slug: "pop-officer-job", label: "Officer job panel", group: "Page popups", over: "transport", pop: "officer-job" },
  { slug: "pop-record-form", label: "Record a form", group: "Page popups", over: "legal-forms", pop: "record-form" },
  { slug: "pop-record-exam", label: "Record exam", group: "Page popups", over: "legal-forms", pop: "record-exam" },
  { slug: "pop-add-time", label: "Add the time", group: "Page popups", over: "legal-forms", pop: "add-time" },
  { slug: "pop-state-loading", label: "Loading", group: "States", over: "home", pop: "state-loading" },
  { slug: "pop-state-empty", label: "Empty", group: "States", over: "home", pop: "state-empty" },
  { slug: "pop-state-error", label: "Error", group: "States", over: "home", pop: "state-error" },
  { slug: "pop-state-offline", label: "Offline", group: "States", over: "home", pop: "state-offline" },
  { slug: "pop-state-toast", label: "Toast", group: "States", over: "home", pop: "state-toast" },
  { slug: "pop-state-not-wired", label: "Not wired", group: "States", over: "home", pop: "state-not-wired" },
];

/** Prefix routes: any address under these opens the one example drawn for them. */
const PREFIX_SCREENS: readonly (readonly [prefix: string, slug: string])[] = [
  ["/ward-flow/statistics/ward/", "statistics-unit"],
  ["/ward-flow/statistics/", "statistics-list"],
  ["/ward-flow/ward/", "ward"],
  ["/ward-flow/board/", "stays"],
  ["/ward-flow/ed/", "ed-board"],
  ["/ward-flow/people/", "patient"],
  ["/ward-flow/community/", "community-team"],
  ["/ward-flow/movements/", "patient"],
];

export function screenBySlug(slug: string): MockupScreen | undefined {
  return MOCKUP_SCREENS.find((screen) => screen.slug === slug);
}

/** The mock-up that stands for an app address, or null when none is drawn. */
export function mockupHrefForAppPath(href: string): string | null {
  const path = href.split(/[?#]/)[0]?.replace(/\/$/, "") || "/";
  const exact = MOCKUP_SCREENS.find((screen) => screen.appPath === path);
  if (exact) return `${MOCKUP_BASE}/${exact.slug}`;
  const prefixed = PREFIX_SCREENS.find(([prefix]) => path.startsWith(prefix));
  return prefixed ? `${MOCKUP_BASE}/${prefixed[1]}` : null;
}
