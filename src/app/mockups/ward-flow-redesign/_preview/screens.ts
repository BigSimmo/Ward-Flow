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
  { slug: "waiting", label: "Waiting", group: "Coordinator", appPath: "/ward-flow/waiting" },
  {
    slug: "new-referral",
    label: "New referral",
    group: "Coordinator",
    appPath: "/ward-flow/referrals/new",
    shellPath: "/ward-flow/referrals",
  },
  { slug: "ward", label: "My ward", group: "Desks", appPath: "/ward-flow/ward/rph-adult-secure" },
  { slug: "ed-board", label: "ED board", group: "Desks", appPath: "/ward-flow/ed/peel-ed" },
  { slug: "legal-forms", label: "Legal forms", group: "Reference", appPath: "/ward-flow/legal-forms" },
  { slug: "patient", label: "Patient record", group: "Places and records", appPath: "/ward-flow/people/196zcp24w5t0" },
  { slug: "add-patient", label: "Add a patient", group: "Places and records", appPath: "/ward-flow/people/new" },
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
