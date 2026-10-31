/**
 * Preview only: every redesigned page and popup, the group it is listed under in the viewer, and
 * the address it will have once built. The shell reads that address to mark its menu and title,
 * and links in the shell are mapped back to the matching mock-up through it.
 */
import type { WardAccess } from "@/components/ward-management/ward-role-access";

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
  /** The desk the page is drawn as, for another role's view. Left out, it is the statewide coordinator. */
  role?: WardAccess;
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

/** The desk each role's views are drawn as: the same ward, ED and team the coordinator's mock-ups show. */
const ROLE_DESKS = {
  ward: { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } },
  ed: { role: "ed", scope: { kind: "ed", edId: "peel-ed" } },
  community: { role: "community", scope: { kind: "team", teamName: "Midland" } },
  officer: { role: "officer", scope: { kind: "jobs" } },
  "bed-manager": { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } },
  executive: { role: "executive", scope: { kind: "statewide" } },
  admin: { role: "admin", scope: { kind: "statewide" } },
} satisfies Record<string, WardAccess>;

export const MOCKUP_SCREENS: readonly MockupScreen[] = [
  { slug: "home", label: "Home", group: "Coordinator", appPath: "/ward-flow" },
  { slug: "capacity", label: "Capacity", group: "Coordinator", appPath: "/ward-flow/capacity" },
  { slug: "movements", label: "Movements", group: "Coordinator", appPath: "/ward-flow/movements" },
  { slug: "waiting", label: "Waiting", group: "Coordinator", appPath: "/ward-flow/waiting" },
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
  { slug: "patients", label: "Patients", group: "Work and reports", appPath: "/ward-flow/search" },
  { slug: "discharges", label: "Discharges", group: "Work and reports", appPath: "/ward-flow/discharges" },
  { slug: "statistics", label: "Statistics", group: "Work and reports", appPath: "/ward-flow/statistics" },
  { slug: "alerts", label: "Alerts", group: "Reference", appPath: "/ward-flow/alerts" },
  { slug: "legal-forms", label: "Legal forms", group: "Reference", appPath: "/ward-flow/legal-forms" },
  { slug: "on-call", label: "On-call", group: "Reference", appPath: "/ward-flow/on-call" },
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
  {
    slug: "community-team",
    label: "Community team",
    group: "Places and records",
    appPath: "/ward-flow/community/midland",
  },
  { slug: "patient", label: "Patient record", group: "Places and records", appPath: "/ward-flow/people/196zcp24w5t0" },
  { slug: "add-patient", label: "Add a patient", group: "Places and records", appPath: "/ward-flow/people/new" },
  { slug: "settings", label: "Settings", group: "Places and records", appPath: "/ward-flow/settings" },
  { slug: "statistics-compare", label: "Compare", group: "Statistics pages", appPath: "/ward-flow/statistics/compare" },
  { slug: "statistics-list", label: "Ward list", group: "Statistics pages", appPath: "/ward-flow/statistics/wards" },
  {
    slug: "statistics-unit",
    label: "One ward",
    group: "Statistics pages",
    appPath: "/ward-flow/statistics/ward/fsh-adult-secure",
  },
  { slug: "statistics-weekly", label: "Weekly", group: "Statistics pages", appPath: "/ward-flow/statistics/weekly" },
  {
    slug: "as-ward-home",
    label: "My ward",
    group: "As nurse in charge",
    appPath: "/ward-flow/ward/rph-adult-secure",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-stays",
    label: "Stays and discharges",
    group: "As nurse in charge",
    appPath: "/ward-flow/board/rph-adult-secure",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-discharges",
    label: "Discharges",
    group: "As nurse in charge",
    appPath: "/ward-flow/discharges",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-referrals",
    label: "Referrals",
    group: "As nurse in charge",
    appPath: "/ward-flow/referrals",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-waiting",
    label: "Waiting",
    group: "As nurse in charge",
    appPath: "/ward-flow/waiting",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-legal-forms",
    label: "Legal forms",
    group: "As nurse in charge",
    appPath: "/ward-flow/legal-forms",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-handover",
    label: "Handover",
    group: "As nurse in charge",
    appPath: "/ward-flow/handover",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-statistics",
    label: "Statistics",
    group: "As nurse in charge",
    appPath: "/ward-flow/statistics",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-alerts",
    label: "Alerts",
    group: "As nurse in charge",
    appPath: "/ward-flow/alerts",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ward-settings",
    label: "Settings",
    group: "As nurse in charge",
    appPath: "/ward-flow/settings",
    role: ROLE_DESKS["ward"],
  },
  {
    slug: "as-ed-home",
    label: "ED board",
    group: "As ED clinician",
    appPath: "/ward-flow/ed/peel-ed",
    role: ROLE_DESKS["ed"],
  },
  {
    slug: "as-ed-referrals",
    label: "Referrals",
    group: "As ED clinician",
    appPath: "/ward-flow/referrals",
    role: ROLE_DESKS["ed"],
  },
  {
    slug: "as-ed-waiting",
    label: "Waiting",
    group: "As ED clinician",
    appPath: "/ward-flow/waiting",
    role: ROLE_DESKS["ed"],
  },
  {
    slug: "as-ed-legal-forms",
    label: "Legal forms",
    group: "As ED clinician",
    appPath: "/ward-flow/legal-forms",
    role: ROLE_DESKS["ed"],
  },
  {
    slug: "as-ed-handover",
    label: "Handover",
    group: "As ED clinician",
    appPath: "/ward-flow/handover",
    role: ROLE_DESKS["ed"],
  },
  {
    slug: "as-ed-statistics",
    label: "Statistics",
    group: "As ED clinician",
    appPath: "/ward-flow/statistics",
    role: ROLE_DESKS["ed"],
  },
  {
    slug: "as-community-home",
    label: "Community team",
    group: "As community clinician",
    appPath: "/ward-flow/community/midland",
    role: ROLE_DESKS["community"],
  },
  {
    slug: "as-community-referrals",
    label: "Referrals",
    group: "As community clinician",
    appPath: "/ward-flow/referrals",
    role: ROLE_DESKS["community"],
  },
  {
    slug: "as-community-movements",
    label: "Movements",
    group: "As community clinician",
    appPath: "/ward-flow/movements",
    role: ROLE_DESKS["community"],
  },
  {
    slug: "as-community-patient",
    label: "Patient record",
    group: "As community clinician",
    appPath: "/ward-flow/people/196zcp24w5t0",
    role: ROLE_DESKS["community"],
  },
  {
    slug: "as-community-statistics",
    label: "Statistics",
    group: "As community clinician",
    appPath: "/ward-flow/statistics",
    role: ROLE_DESKS["community"],
  },
  {
    slug: "as-officer-alerts",
    label: "Alerts",
    group: "As transport officer",
    appPath: "/ward-flow/alerts",
    role: ROLE_DESKS["officer"],
  },
  {
    slug: "as-bed-manager-home",
    label: "Capacity",
    group: "As site bed manager",
    appPath: "/ward-flow/capacity",
    role: ROLE_DESKS["bed-manager"],
  },
  {
    slug: "as-bed-manager-ward",
    label: "My ward",
    group: "As site bed manager",
    appPath: "/ward-flow/ward/rph-adult-secure",
    role: ROLE_DESKS["bed-manager"],
  },
  {
    slug: "as-bed-manager-discharges",
    label: "Discharges",
    group: "As site bed manager",
    appPath: "/ward-flow/discharges",
    role: ROLE_DESKS["bed-manager"],
  },
  {
    slug: "as-bed-manager-referrals",
    label: "Referrals",
    group: "As site bed manager",
    appPath: "/ward-flow/referrals",
    role: ROLE_DESKS["bed-manager"],
  },
  {
    slug: "as-bed-manager-statistics",
    label: "Statistics",
    group: "As site bed manager",
    appPath: "/ward-flow/statistics",
    role: ROLE_DESKS["bed-manager"],
  },
  {
    slug: "as-executive-home",
    label: "Statistics",
    group: "As executive",
    appPath: "/ward-flow/statistics",
    role: ROLE_DESKS["executive"],
  },
  {
    slug: "as-executive-capacity",
    label: "Capacity",
    group: "As executive",
    appPath: "/ward-flow/capacity",
    role: ROLE_DESKS["executive"],
  },
  {
    slug: "as-executive-settings",
    label: "Settings",
    group: "As executive",
    appPath: "/ward-flow/settings",
    role: ROLE_DESKS["executive"],
  },
  {
    slug: "as-admin-home",
    label: "Settings",
    group: "As access admin",
    appPath: "/ward-flow/settings",
    role: ROLE_DESKS["admin"],
  },
  {
    slug: "as-admin-governance",
    label: "Governance",
    group: "As access admin",
    appPath: "/ward-flow/governance",
    role: ROLE_DESKS["admin"],
  },
];

/** Popups drawn over their page. Each page opens its own; the viewer asks it to on load. */
export const MOCKUP_POPUPS: readonly MockupPopup[] = [
  { slug: "pop-bed-meeting-sheet", label: "Bed meeting sheet", group: "Page popups", over: "capacity", pop: "sheet" },
  { slug: "pop-scenario", label: "Try a scenario", group: "Page popups", over: "capacity", pop: "scenario" },
  { slug: "pop-capacity-ward", label: "Capacity ward panel", group: "Page popups", over: "capacity", pop: "ward" },
  { slug: "pop-movement", label: "Movement drawer", group: "Page popups", over: "movements", pop: "movement" },
  { slug: "pop-forecast-sheet", label: "Phone bed forecast", group: "Page popups", over: "capacity", pop: "forecast" },
  { slug: "pop-alerts", label: "Alerts drawer", group: "Shell popups", over: "home", pop: "alerts" },
  { slug: "pop-activity", label: "Activity", group: "Shell popups", over: "home", pop: "activity-panel" },
  { slug: "pop-tools", label: "Tools", group: "Shell popups", over: "home", pop: "tools" },
  { slug: "pop-search", label: "Search", group: "Shell popups", over: "home", pop: "search" },
  { slug: "pop-help", label: "Help", group: "Shell popups", over: "home", pop: "help" },
  { slug: "pop-shortcuts", label: "Keyboard shortcuts", group: "Shell popups", over: "home", pop: "shortcuts" },
  { slug: "pop-demo", label: "Demo menu", group: "Shell popups", over: "home", pop: "demo" },
  { slug: "pop-menu", label: "Phone menu", group: "Shell popups", over: "home", pop: "menu" },
  { slug: "pop-create", label: "Create", group: "Shell popups", over: "home", pop: "create" },
  { slug: "pop-ward-switcher", label: "Ward switcher", group: "Shell popups", over: "ward", pop: "ward-switcher" },
  { slug: "pop-shift-brief", label: "Shift brief", group: "Shell popups", over: "ward", pop: "shift-brief" },
  { slug: "pop-desk", label: "Go to a desk", group: "Shell popups", over: "home", pop: "desk" },
  { slug: "pop-service-picker", label: "Service picker", group: "Shell popups", over: "home", pop: "service-picker" },
  { slug: "pop-more-pages", label: "More pages", group: "Shell popups", over: "home", pop: "more-pages" },
  { slug: "pop-tour", label: "Tour", group: "Shell popups", over: "home", pop: "tour" },
  { slug: "pop-bed-record", label: "Bed record", group: "Page popups", over: "ward", pop: "bed-record" },
  { slug: "pop-confirm-beds", label: "Confirm beds", group: "Page popups", over: "ward", pop: "confirm-beds" },
  { slug: "pop-broadcast", label: "Broadcast", group: "Page popups", over: "alerts", pop: "broadcast" },
  { slug: "pop-ward-notices", label: "Ward notices", group: "Page popups", over: "ward", pop: "ward-notices" },
  { slug: "pop-refer-ward", label: "Refer to a ward", group: "Page popups", over: "ed-board", pop: "refer-ward" },
  { slug: "pop-ed-actions", label: "ED actions", group: "Page popups", over: "ed-board", pop: "ed-actions" },
  { slug: "pop-log-transport", label: "Log transport", group: "Page popups", over: "ed-board", pop: "log-transport" },
  { slug: "pop-record-form", label: "Record a form", group: "Page popups", over: "legal-forms", pop: "record-form" },
  { slug: "pop-record-exam", label: "Record exam", group: "Page popups", over: "legal-forms", pop: "record-exam" },
  { slug: "pop-add-time", label: "Add the time", group: "Page popups", over: "legal-forms", pop: "add-time" },
  {
    slug: "pop-community-referral",
    label: "Community referral",
    group: "Older popups",
    over: "community-team",
    pop: "community-referral",
  },
  {
    slug: "pop-community-note",
    label: "Community note",
    group: "Older popups",
    over: "community-team",
    pop: "community-note",
  },
  {
    slug: "pop-community-record",
    label: "Community record drawer",
    group: "Older popups",
    over: "community-team",
    pop: "community-record",
  },
  {
    slug: "pop-community-transport-book",
    label: "Community transport booking",
    group: "Older popups",
    over: "community-team",
    pop: "community-transport-book",
  },
  {
    slug: "pop-community-transport-cancel",
    label: "Cancel community transport",
    group: "Older popups",
    over: "community-team",
    pop: "community-transport-cancel",
  },
  {
    slug: "pop-board-blocker",
    label: "Record a bed blocker",
    group: "Older popups",
    over: "stays",
    pop: "board-blocker",
  },
  { slug: "pop-clearance", label: "Medical clearance", group: "Older popups", over: "patient", pop: "clearance" },
  { slug: "pop-idle-warning", label: "Idle warning", group: "Older popups", over: "home", pop: "idle-warning" },
  { slug: "pop-idle-lock", label: "Idle lock", group: "Older popups", over: "home", pop: "idle-lock" },
  {
    slug: "pop-confirm-leave",
    label: "Leave with unsaved changes",
    group: "Older popups",
    over: "add-patient",
    pop: "confirm-leave",
  },
  {
    slug: "pop-confirm-discard",
    label: "Discard escalation",
    group: "Older popups",
    over: "home",
    pop: "confirm-discard",
  },
  { slug: "pop-state-loading", label: "Loading", group: "States", over: "home", pop: "state-loading" },
  {
    slug: "pop-state-loading-capacity",
    label: "Loading (Capacity)",
    group: "States",
    over: "capacity",
    pop: "state-loading",
  },
  {
    slug: "pop-state-loading-waiting",
    label: "Loading (Waiting)",
    group: "States",
    over: "waiting",
    pop: "state-loading",
  },
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
export function mockupHrefForAppPath(href: string, rolePrefix?: string): string | null {
  const path = href.split(/[?#]/)[0]?.replace(/\/$/, "") || "/";
  // A role's view keeps its links inside that role's views where one is drawn.
  const asRole = rolePrefix
    ? MOCKUP_SCREENS.find((screen) => screen.slug.startsWith(rolePrefix) && screen.appPath === path)
    : undefined;
  if (asRole) return `${MOCKUP_BASE}/${asRole.slug}`;
  // A page not drawn for this role is not drawn: falling back to the coordinator's page would switch
  // the desk, the rail and the data under the reviewer.
  if (rolePrefix) return null;
  const exact = MOCKUP_SCREENS.find((screen) => screen.appPath === path && !screen.role);
  if (exact) return `${MOCKUP_BASE}/${exact.slug}`;
  const prefixed = PREFIX_SCREENS.find(([prefix]) => path.startsWith(prefix));
  return prefixed ? `${MOCKUP_BASE}/${prefixed[1]}` : null;
}
