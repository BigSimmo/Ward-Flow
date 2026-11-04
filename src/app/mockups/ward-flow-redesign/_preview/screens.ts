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

export const MOCKUP_SCREENS: readonly MockupScreen[] = [
  { slug: "home", label: "Home", group: "Coordinator", appPath: "/ward-flow" },
  { slug: "capacity", label: "Capacity", group: "Coordinator", appPath: "/ward-flow/capacity" },
  { slug: "waiting", label: "Waiting", group: "Coordinator", appPath: "/ward-flow/waiting" },
  { slug: "movements", label: "Movements", group: "Coordinator", appPath: "/ward-flow/movements" },
  { slug: "handover", label: "Handover", group: "Coordinator", appPath: "/ward-flow/handover" },
  {
    slug: "new-referral",
    label: "New referral",
    group: "Coordinator",
    appPath: "/ward-flow/referrals/new",
    shellPath: "/ward-flow/referrals",
  },
  { slug: "discharges", label: "Discharges", group: "Coordinator", appPath: "/ward-flow/discharges" },
  { slug: "ward", label: "My ward", group: "Desks", appPath: "/ward-flow/ward/rph-adult-secure" },
  { slug: "ed-board", label: "ED board", group: "Desks", appPath: "/ward-flow/ed/peel-ed" },
  { slug: "legal-forms", label: "Legal forms", group: "Reference", appPath: "/ward-flow/legal-forms" },
  { slug: "patient", label: "Patient record", group: "Places and records", appPath: "/ward-flow/people/196zcp24w5t0" },
  { slug: "add-patient", label: "Add patient", group: "Places and records", appPath: "/ward-flow/people/new" },
  // Q218 (Josh, 2 Nov 2026): the pages with no approved redesign are drawn from main in the newest
  // shell, so the master design no longer shows their older (BL86) content.
  { slug: "eds", label: "All EDs", group: "Coordinator", appPath: "/ward-flow/ed" },
  { slug: "referrals", label: "Referrals", group: "Coordinator", appPath: "/ward-flow/referrals" },
  { slug: "stays", label: "Stays and discharges", group: "Desks", appPath: "/ward-flow/board/rph-adult-secure" },
  // The page the Officer job panel pop-up opens over (2 Nov 2026).
  { slug: "transport", label: "Transport", group: "Desks", appPath: "/ward-flow/transport/officer" },
  { slug: "patients", label: "Patients", group: "Work and reports", appPath: "/ward-flow/search" },
  { slug: "wards", label: "All wards", group: "Work and reports", appPath: "/ward-flow/wards" },
  { slug: "alerts", label: "Alerts", group: "Reference", appPath: "/ward-flow/alerts" },
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
  {
    slug: "ward-answer",
    label: "Ward answer",
    group: "Places and records",
    appPath: "/ward-flow/ward/rph-adult-secure/answer",
  },
  { slug: "settings", label: "Settings", group: "Places and records", appPath: "/ward-flow/settings" },
  { slug: "sign-in", label: "Sign in", group: "Places and records", appPath: "/ward-flow-sign-in", bare: true },
  { slug: "statistics-list", label: "Ward list", group: "Statistics pages", appPath: "/ward-flow/statistics/wards" },
  {
    slug: "statistics-unit",
    label: "One ward",
    group: "Statistics pages",
    appPath: "/ward-flow/statistics/ward/fsh-adult-secure",
  },
  { slug: "statistics-network", label: "Network", group: "Statistics pages", appPath: "/ward-flow/statistics" },
  { slug: "ed-department", label: "One ED", group: "Coordinator", appPath: "/ward-flow/ed/fsh-ed" },
];

/** Popups drawn over their page. Each page opens its own; the viewer asks it to on load. */
export const MOCKUP_POPUPS: readonly MockupPopup[] = [
  { slug: "pop-alerts", label: "Alerts drawer", group: "Shell popups", over: "home", pop: "alerts" },
  { slug: "pop-activity", label: "Activity", group: "Shell popups", over: "home", pop: "activity-panel" },
  { slug: "pop-tools", label: "Tools", group: "Shell popups", over: "home", pop: "tools" },
  { slug: "pop-search", label: "Search", group: "Shell popups", over: "home", pop: "search" },
  { slug: "pop-help", label: "Help", group: "Shell popups", over: "home", pop: "help" },
  { slug: "pop-shortcuts", label: "Keyboard shortcuts", group: "Shell popups", over: "home", pop: "shortcuts" },
  { slug: "pop-demo", label: "Demo menu", group: "Shell popups", over: "home", pop: "demo" },
  { slug: "pop-menu", label: "Phone menu", group: "Shell popups", over: "home", pop: "menu" },
  { slug: "pop-create", label: "Create", group: "Shell popups", over: "home", pop: "create" },
  { slug: "pop-service-picker", label: "Service picker", group: "Shell popups", over: "home", pop: "service-picker" },
  { slug: "pop-more-pages", label: "More pages", group: "Shell popups", over: "home", pop: "more-pages" },
  { slug: "pop-tour", label: "Tour", group: "Shell popups", over: "home", pop: "tour" },
  { slug: "pop-refer-ward", label: "Refer to a ward", group: "Page popups", over: "ed-board", pop: "refer-ward" },
  {
    slug: "pop-discharge",
    label: "Discharge detail",
    group: "Page popups",
    over: "discharges",
    pop: "discharge-detail",
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
  // Q221 (Josh, 2 Nov 2026): the real page opens its own pop-up on load.
  { slug: "pop-broadcast", label: "Broadcast", group: "Page popups", over: "alerts", pop: "broadcast" },
  {
    slug: "pop-community-note",
    label: "Community note",
    group: "Older popups",
    over: "community-team",
    pop: "community-note",
  },
  // Josh (2 Nov 2026): the master's other older pop-ups open on main's real pages too, as a click does.
  { slug: "pop-desk", label: "Go to a desk", group: "Shell popups", over: "home", pop: "desk" },
  { slug: "pop-shift-brief", label: "Shift brief", group: "Shell popups", over: "ward", pop: "shift-brief" },
  { slug: "pop-ward-switcher", label: "Ward switcher", group: "Shell popups", over: "ward", pop: "ward-switcher" },
  { slug: "pop-add-time", label: "Add the time", group: "Page popups", over: "legal-forms", pop: "add-time" },
  { slug: "pop-bed-meeting-sheet", label: "Bed meeting sheet", group: "Page popups", over: "capacity", pop: "sheet" },
  { slug: "pop-bed-record", label: "Bed record", group: "Page popups", over: "ward", pop: "bed-record" },
  { slug: "pop-capacity-ward", label: "Capacity ward panel", group: "Page popups", over: "capacity", pop: "ward" },
  { slug: "pop-confirm-beds", label: "Confirm beds", group: "Page popups", over: "ward", pop: "confirm-beds" },
  { slug: "pop-ed-actions", label: "ED actions", group: "Page popups", over: "ed-board", pop: "ed-actions" },
  { slug: "pop-forecast-sheet", label: "Phone bed forecast", group: "Page popups", over: "capacity", pop: "forecast" },
  { slug: "pop-log-transport", label: "Log transport", group: "Page popups", over: "ed-board", pop: "log-transport" },
  { slug: "pop-movement", label: "Movement drawer", group: "Page popups", over: "movements", pop: "movement" },
  { slug: "pop-officer-job", label: "Officer job panel", group: "Page popups", over: "transport", pop: "officer-job" },
  { slug: "pop-record-exam", label: "Record exam", group: "Page popups", over: "legal-forms", pop: "record-exam" },
  { slug: "pop-record-form", label: "Record a form", group: "Page popups", over: "legal-forms", pop: "record-form" },
  { slug: "pop-scenario", label: "Try a scenario", group: "Page popups", over: "capacity", pop: "scenario" },
  { slug: "pop-ward-notices", label: "Ward notices", group: "Page popups", over: "ward", pop: "ward-notices" },
  {
    slug: "pop-board-blocker",
    label: "Record a bed blocker",
    group: "Older popups",
    over: "stays",
    pop: "board-blocker",
  },
  {
    slug: "pop-ward-accept",
    label: "Accept in principle",
    group: "Older popups",
    over: "ward-answer",
    pop: "ward-accept",
  },
];

/** Prefix routes: any address under these opens the one example drawn for them. */
const PREFIX_SCREENS: readonly (readonly [prefix: string, slug: string])[] = [
  ["/ward-flow/ward/", "ward"],
  ["/ward-flow/ed/", "ed-board"],
  ["/ward-flow/people/", "patient"],
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
