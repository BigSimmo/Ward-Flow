"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Plus,
  Settings,
  Wrench,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { standingFigures, WardStatsDrawerContent } from "@/components/ward-management/ward-standing-strip";

import { Sheet } from "@/components/ui/sheet";
import { createBrowserStore } from "@/lib/client-store-factory";
import { formatInstant, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardDemoControls } from "@/components/ward-management/ward-demo-controls";
import { WardGlobalSearch } from "@/components/ward-management/ward-global-search";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import {
  WARD_ADD_PERSON_HREF,
  WARD_HOME_HREF,
  WARD_REFERRAL_INTAKE_HREF,
  WARD_NAV,
  WARD_VIEWS,
  resolveWardPrimaryAction,
  resolveWardScreenTitle,
} from "@/components/ward-management/ward-nav";
import { wardPlaceFor } from "@/components/ward-management/ward-place";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import {
  edHealthService,
  movementBelongsToService,
  SERVICE_SCOPED_SCREENS,
  unitHealthService,
} from "@/components/ward-management/ward-service-scope";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { WardRoleSwitcher } from "@/components/ward-management/ward-role-switcher";
import {
  STATISTICS_COMPARE_HREF,
  STATISTICS_OVERVIEW_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { noticeIsForWardChrome, wardTasksAreActionableForRole } from "@/components/ward-management/ward-chrome-role";
import { WardCatchmentResolver } from "@/components/ward-management/tools/ward-catchment-resolver";
import { WardMhaCalculator } from "@/components/ward-management/tools/ward-mha-calculator";

import { announceToWardShell } from "./ward-live-region";
import { subscribeWardDrawer, subscribeWardDrawerClose } from "./ward-drawer-bus";
import {
  digestHref,
  edHref,
  handoverHref,
  movementHref,
  officerHref,
  onCallHref,
  settingsHref,
  unitHref,
  wardBoardHref,
} from "./ward-facade";
import type { WardActivityCategory, WardActivityContent, WardAppearance, WardPrimaryAction } from "./ward-shell-types";
import { deriveCommandActivity, type WardActivityEventTone } from "./ward-command-activity";
import { useWardChecks } from "./ward-checks";
import { setServiceScope, useServiceScope } from "./ward-service-store";
import styles from "./ward-bar.module.css";

/**
 * Ward Flow's third-edition bar (`docs/ward-flow/plans/2026-09-10-third-edition-build-master-
 * plan.md` §1.3, item 1.1). Ported from `docs/ward-flow/mockups/command-third-edition.html`'s
 * `header.hdr1` and shell script — place, the Service selector, search, three drawers (Activity,
 * Tasks and Tools), per the phase-1.1 brief. **NOT MOUNTED ANYWHERE YET**
 * — see `ward-rail.tsx`'s own header for what that means and why.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS REUSED RATHER THAN REBUILT, and why each one is safe to reuse here:
 *
 * - **Search** is `WardGlobalSearch` (`../ward-global-search.tsx`) unchanged — already the
 *   codebase's one universal-search implementation (patients + open movements, the "/" and
 *   Ctrl/Cmd+K shortcuts, its own Escape/ArrowDown/Enter keyboard contract). Building a second
 *   search engine here would be the exact "second definition of matches" that file's own header
 *   comment already warns against for ITS OWN callers.
 * - **The three drawers' modal chrome** is `<Sheet placement="right">` (`@/components/ui/sheet`)
 *   — this codebase's established accessible dialog: focus trap via `inert` on the rest of the
 *   page (not a hand-rolled Tab-cycle), Escape-closes, backdrop-click-closes, and focus returned
 *   to the trigger on close. It is already used across the app for exactly this shape of overlay.
 *   A hand-rolled trap here would duplicate `sheet-focus.ts`'s tested stacking/inert logic with
 *   worse odds of getting it right.
 * - **Tasks drawer content** is `WardTasksDrawer` (`../ward-tasks-drawer.tsx`) unchanged, fed by
 *   `buildActionInbox` — the same acknowledge/complete/reopen list the second-edition chrome
 *   already showed. It draws its own header (`<h2>Tasks</h2>`, a count, a close button), so the
 *   `<Sheet>` wrapping it renders with `headerHidden` to avoid a second header.
 * - **The Demonstration section** (Tools drawer) mounts `<WardDemoControls />` and
 *   `<WardRoleSwitcher />` verbatim — each already a self-contained, tested control with its own
 *   internal popover. Nothing about the clock/scenario/reset or the role switcher is reimplemented
 *   here; they are relocated, per the brief ("The demonstration controls — clock, scenario, reset
 *   — go in the Tools drawer, labelled Demonstration... The role switcher and the developer-hub
 *   exit go there too").
 * - **"Place"** reuses `wardPlaceFor(pathname, units)` (`../ward-place.ts`), the one function a
 *   pathname resolves to a place name through — same call `WardShellHeader` (the component this
 *   bar supersedes) already makes, rendering nothing when the route names no place.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY LEFT AS A SEAM RATHER THAN BUILT HERE:
 *
 * - **`activity` (the Activity drawer's page tally).** Screens may supply their existing tally.
 *   Command instead projects timestamped reducer records and shared navigation counts into a
 *   synthetic event feed and tally. Authored notices are read from reducer state and filtered to
 *   the current route-derived role and place; no notice text is reconstructed here.
 * - 🔴 **`primaryAction` (`WARD_PRIMARY_ACTIONS`) IS NOW WIRED — D-16.** This component still takes
 *   one resolved `WardPrimaryAction | undefined` and never performs its own lookup — the
 *   resolution from a pathname lives in `WardBarMount` at the bottom of this file, not here, for
 *   the reason given at that export's own doc comment (this bar is a Server Component's worth of
 *   layers away from `usePathname()`). What changed is what this component DOES with the resolved
 *   value: `ward-shell-types.ts`'s own `WardPrimaryAction` is now `ward-nav.ts`'s five-kind union
 *   itself (re-exported, not translated), so all five kinds render here directly. `"new-referral"`
 *   opens a popover listing its `menu`'s three real hrefs (never invented, never retyped).
 *   `"record-decision"`, `"contact-team"` and `"export-figures"` render as plain `<button>`
 *   elements — never an `<a>`, so no `href` attribute exists for them anywhere in this markup —
 *   that announce "`<label>` is not wired in this prototype." on click, the exact sentence standard
 *   §8.6 already uses for "Export the queue" (`docs/ward-flow/mockups/command-third-edition.html`'s
 *   own `announce("Export the queue is not wired in this prototype.")`), reused here in each
 *   action's own words rather than invented fresh. `"none"` and an absent `primaryAction` both
 *   render nothing, which is why `resolveWardPrimaryAction` (`ward-nav.ts`) does not need to tell
 *   the two apart.
 * - **Ward/ED contact tables** now show the current ward and department directory in Tools.
 *   The full-estate brief commissions these drawing sections. Contact values are not held by
 *   the engine, so every row says so instead of copying the drawing's placeholder addresses.
 * - 🔴 **§8.6's four fixed search sentences** — named here by subject and location only, never
 *   quoted, per round-2 review Minor 4: the risk/acuity/best-match refusal (§8.6, first bullet),
 *   the closed/arrived/discharged refusal (§8.6, second bullet), the no-results sentence (§8.6,
 *   the "Nothing found" bullet), and the results footer's fixed disclaimer (§8.6, the "footer of
 *   the results" bullet) — are NOT in `WardGlobalSearch` and this pass does not add them —
 *   round-1 review, Important 4, an unflagged trim in the prior pass, recorded here rather than
 *   repeating that. (Round-2 review, Minor 4: the previous wording here quoted two of those four
 *   sentences' actual text verbatim, so a grep asking "is this sentence present in `src/`"
 *   answered yes from this very comment recording that it is ABSENT — the reviewer's own grep did
 *   exactly that. A locator can never make that mistake, because it never reproduces the words
 *   being located.) `WardGlobalSearch` already refuses closed/arrived movements at the DATA
 *   level (that component's own header comment: "a movement that has closed or arrived can never
 *   appear here"), but surfaces none of the four sentences as text: no refusal shown in its
 *   popover or the filter bar, no distinct no-results wording of its own, no fixed footer. Adding
 *   them means changing `WardGlobalSearch`
 *   itself — a shared component this
 *   bar reuses unchanged, used wherever search appears, not owned by this phase-1.1 shell task —
 *   and the phase-1.1 brief's own enumerated list names "search" as a component to REUSE, not one
 *   to rewrite. Building the sentences into that file without that task's own review and catcher
 *   risks exactly the kind of untested surface area the contact-tables trim above was flagged for
 *   avoiding. Flagged rather than silently left out a second time.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * THE ESCAPE ORDER (standard §7.3, §7.6). `checkDrawerOrSearchOwnsEscape` below is the guard that
 * keeps one Escape press from clearing two things:
 *
 *   1. An open drawer/popover (Activity, Tasks, Tools, the Service selector) — closes it, returns
 *      focus, announces "Closed." `<Sheet>` already does this itself for the three drawers, so
 *      this file's own document-level handler simply returns without acting whenever one of them
 *      is open, checked from this component's OWN `openPanel` state rather than from event
 *      timing — reading React state is not sensitive to which of two `document.addEventListener`
 *      calls happened to register first, which the event-propagation route is.
 *   2. Search results / search text — owned entirely by `WardGlobalSearch`'s own `onKeyDown`,
 *      which always calls `preventDefault()` when it handles Escape. Because React dispatches
 *      that handler from the root container (an ANCESTOR of `document` in the bubble path is
 *      wrong — the root container is a DESCENDANT of `document`, so React's dispatch always runs
 *      before a plain `document.addEventListener` listener sees the same bubbling event), this
 *      file's handler can reliably bail out on `event.defaultPrevented` alone.
 *   3. 🔴 The service — NEVER cleared. Standard §7.3: "The service is never cleared by Escape: a
 *      further press says Nothing more to clear and names the service." A further press announces
 *      that sentence and changes nothing. This is the one behaviour `tests/ward-shell-third-
 *      edition.dom.test.tsx` names by number (assertion 2) and the one already-final drawing
 *      confirms verbatim in its own `escape()` (`docs/ward-flow/mockups/command-third-edition.html`,
 *      not the earlier `third-edition-kit/shell/shell-script.js` draft, which still cleared it —
 *      see that file's own SHELL-NOTES.md for the same discrepancy, resolved by the newer file).
 *
 * Page-specific Escape steps the drawing's own order also walks (a ward selection, a referral
 * subject, a department filter) belong to each host page's own domain state, which this shared
 * bar has no access to — there is deliberately no extensibility seam for them here, because
 * nothing in this phase names what one would look like, and guessing at its shape is exactly the
 * kind of decision "stop and hand it back" exists for.
 */

type WardBarPopoverId = "service" | "primary" | "activity" | "tasks" | "tools" | "referral" | "figures";
type ActivityPart = "activity" | "tally";
type ActivityCategoryFilter = "all" | Exclude<WardActivityCategory, "other">;

const ACTIVITY_CATEGORY_CHIPS: { id: ActivityCategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "escalation", label: "Escalations" },
  { id: "decline", label: "Declines" },
  { id: "referral", label: "Referrals" },
  { id: "transfer", label: "Transfers" },
];

function activityChangeCategory(change: { category?: WardActivityCategory }): WardActivityCategory {
  return change.category ?? "other";
}

const isDrawerPanel = (
  id: WardBarPopoverId | null,
): id is "activity" | "tasks" | "tools" | "referral" | "service" | "figures" =>
  id === "activity" || id === "tasks" || id === "tools" || id === "referral" || id === "service" || id === "figures";

const SERVICE_SWATCH_KEY: Record<HealthService, "north" | "south" | "east" | "wachs" | "cahs" | "private"> = {
  "North Metro": "north",
  "South Metro": "south",
  "East Metro": "east",
  WACHS: "wachs",
  CAHS: "cahs",
  Private: "private",
};

/** The exact sentence standard §8.6 already uses for a drawn-and-not-wired control (D-16) — named
 *  in one place so the three "not wired" primary-action kinds and any future caller share the
 *  identical wording rather than each typing a close paraphrase. */
const NOT_WIRED_SUFFIX = "is not wired in this prototype.";

const APPEARANCE_STORAGE_KEY = "ward-flow-appearance";
const appearanceChangeEvent = "ward-flow-appearance-change";

// An external store, not `useState` + a mount effect: React's own `set-state-in-effect` guard
// (`react-hooks/set-state-in-effect`) refuses a component reading a browser-only value with
// "read once in a `useState` initialiser, then correct after mount" — the SSR/hydration pattern
// `WardFlowProvider`'s own header comment documents at length for the clock. `useRailOpenStore`
// in `ward-rail.tsx` already solved the identical problem (a `localStorage`-backed preference
// that must not differ between server and client) this same way; this mirrors it exactly rather
// than inventing a second pattern for one more preference.
let appearanceInMemoryFallback: WardAppearance | null = null;

function getAppearanceSnapshot(): WardAppearance {
  if (appearanceInMemoryFallback !== null) return appearanceInMemoryFallback;
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

function subscribeAppearance(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(appearanceChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(appearanceChangeEvent, onChange);
  };
}

/**
 * Exported for Lane D's Settings appearance control (2026-09-12) — this store and
 * `applyAppearance` below are the ONLY writers of the appearance preference, and that is the point.
 *
 * 🔴 **A SECOND WRITER ON THE SAME STORAGE KEY IS NOT AN ACCEPTABLE SUBSTITUTE.** One that omits
 * the `dispatchEvent` in `applyAppearance` updates its own screen and leaves this bar's Tools
 * control showing the stale value until a reload — two controls disagreeing inside one session,
 * with the stored value correct underneath, and invisible to every gate this repository has.
 *
 * ⚠️ **`APPEARANCE_STORAGE_KEY` STAYS PRIVATE, deliberately.** Lane D's two-keys catcher would pass
 * BY CONSTRUCTION if the key were importable — it can only fail while the two sides spell the key
 * independently. **A guard that can only succeed is worse than no guard.**
 */
export const useAppearanceStore = createBrowserStore(
  subscribeAppearance,
  getAppearanceSnapshot,
  "auto" as WardAppearance,
);

export function applyAppearance(next: WardAppearance) {
  if (next === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", next);
  try {
    if (next === "auto") {
      window.localStorage.removeItem(APPEARANCE_STORAGE_KEY);
      appearanceInMemoryFallback = null;
    } else {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
      appearanceInMemoryFallback = null;
    }
  } catch {
    // Private browsing or quota exhaustion — remember the choice in memory for this render, the
    // same fallback `use-ward-sidebar-collapsed.ts` and `ward-rail.tsx`'s rail-open store already
    // accept for the identical reason: it just will not survive a reload.
    appearanceInMemoryFallback = next;
  }
  window.dispatchEvent(new Event(appearanceChangeEvent));
}

export type WardBarProps = {
  /** The Activity drawer's page tally. Command derives one when this is absent. */
  activity?: WardActivityContent;
  /**
   * `resolveWardPrimaryAction(pathname)` (`ward-nav.ts`), resolved by the caller — this component
   * never performs its own lookup (`WardBarMount`, at the bottom of this file, is the one caller
   * that resolves it from the route today). Absent, or `{ kind: "none" }`, both render no button;
   * every other kind renders — see this file's own header comment ("primaryAction... IS NOW
   * WIRED — D-16") for what each kind draws.
   */
  primaryAction?: WardPrimaryAction;
  /** Fires whenever the Service selector changes, so a future host page can scope its own data. */
  onServiceChange?: (service: HealthService | null) => void;
};

/**
 * What closing a drawer does to history. A drawer pushes its own history entry when it opens, so
 * that the browser's Back closes it; closing it by hand normally steps back past that entry. But
 * when a link inside the drawer has just been followed and its page has not arrived, that entry is
 * still current, and stepping back would cancel the chosen page. Then the entry is only relabelled.
 */
export function drawerCloseHistoryStep({
  drawerEntryIsCurrent,
  navigationPending,
  canGoBack,
}: {
  drawerEntryIsCurrent: boolean;
  navigationPending: boolean;
  canGoBack: boolean;
}): "back" | "clear" | "none" {
  if (!drawerEntryIsCurrent) return "none";
  if (navigationPending || !canGoBack) return "clear";
  return "back";
}

/** True when following `href` from `current` leaves this page for another page on this site. */
export function isPendingNavigation(href: string, current: string): boolean {
  const target = new URL(href, current);
  const here = new URL(current);
  return target.origin === here.origin && target.pathname !== here.pathname;
}

export function WardBar({ activity, primaryAction, onServiceChange }: WardBarProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const {
    movements,
    patients,
    units,
    admissions,
    referrals,
    rejections,
    bedReleases,
    leaveBeds,
    refreshRequests,
    notices,
    dispatch,
    inboxAcknowledgements,
    inboxCompletions,
  } = useWardFlow();
  // Live ticking clock for waits, freshness lines, notice scoping, and recorded actions — not the
  // stale `now` on the main context value, which only updates when something else dispatches.
  const now = useWardFlowClock();

  const { role, placeId } = useWardNavCounts();
  const checksPublication = useWardChecks();

  const [openPanel, setOpenPanel] = useState<WardBarPopoverId | null>(null);
  const [referralCategory, setReferralCategory] = useState<"community" | "ed" | "ward">("ward");
  // `ward-service-store.ts` — a `sessionStorage`-backed module store, not component-local state, so
  // the choice survives a remount (a route change unmounts and remounts this bar) and stays in sync
  // with any other reader (`WardRail`, a future scoped screen) in the same tab. See that file's own
  // header for why `sessionStorage` rather than `localStorage`, and why a storage throw still works.
  const service = useServiceScope();
  const appearance = useAppearanceStore();
  const [activityPart, setActivityPart] = useState<ActivityPart>("activity");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<ActivityCategoryFilter>("all");

  const serviceTriggerRef = useRef<HTMLButtonElement>(null);
  const primaryTriggerRef = useRef<HTMLButtonElement>(null);
  const figuresTriggerRef = useRef<HTMLButtonElement>(null);
  const figuresInitialFocusRef = useRef<HTMLElement | null>(null);
  const activityTriggerRef = useRef<HTMLButtonElement>(null);
  const tasksTriggerRef = useRef<HTMLButtonElement>(null);
  const toolsTriggerRef = useRef<HTMLButtonElement>(null);
  const servicePanelRef = useRef<HTMLDivElement>(null);
  const primaryPanelRef = useRef<HTMLDivElement>(null);

  const figures = useMemo(
    () =>
      standingFigures({
        movements,
        units,
        admissions,
        bedReleases,
        leaveBeds,
        now,
        chromeRole: role,
        placeId,
      }),
    [movements, units, admissions, bedReleases, leaveBeds, now, role, placeId],
  );
  const flaggedFigures = useMemo(() => figures.filter((f) => f.flagged), [figures]);
  const telemetrySummary = useMemo(
    () =>
      flaggedFigures.length > 0
        ? flaggedFigures.map((f) => `${f.value} ${f.label.toLowerCase()}`).join(", ")
        : "Nominal",
    [flaggedFigures],
  );

  // `WardTasksDrawer` draws its own header and its own close button — the Tasks `<Sheet>` below
  // is `headerHidden` with no `title`, so Sheet's own header (and the `closeRef` button it would
  // otherwise fall back to for initial focus) never renders. Without an explicit target, Sheet's
  // open-focus controller stays armed forever, waiting on a resolver that never returns an
  // element, and focus never enters the drawer at all. This ref-callback finds the drawer's own
  // close button (`aria-label="Close tasks panel"`) the moment its wrapper mounts, which happens
  // in the same commit as the drawer's own content.
  const tasksInitialFocusRef = useRef<HTMLElement | null>(null);
  const setTasksBodyRef = useCallback((node: HTMLDivElement | null) => {
    tasksInitialFocusRef.current = node?.querySelector<HTMLElement>('[aria-label="Close tasks panel"]') ?? null;
  }, []);

  const place = wardPlaceFor(pathname, units);
  const routeTitle =
    (/^\/mockups\/ward-flow\/statistics\/ward\//u.test(pathname) ? "Ward statistics" : undefined) ??
    (/^\/mockups\/ward-flow\/statistics\/ed\//u.test(pathname) ? "Emergency department statistics" : undefined) ??
    (/^\/mockups\/ward-flow\/statistics\/community\//u.test(pathname) ? "Community statistics" : undefined) ??
    (/^\/mockups\/ward-flow\/statistics\/service\//u.test(pathname) ? "Service statistics" : undefined) ??
    (/^\/mockups\/ward-flow\/movements\/[^/]+\/?$/u.test(pathname) ? "Movement Workspace" : undefined) ??
    (/^\/mockups\/ward-flow\/sovereign\/?$/u.test(pathname) ? "Sovereign Health" : undefined) ??
    (pathname === settingsHref() ? "Settings" : undefined) ??
    (pathname === officerHref() ? "Transport Hub" : undefined) ??
    (pathname === onCallHref() ? "On-call and contacts" : undefined) ??
    (pathname === WARD_ADD_PERSON_HREF ? "Add a patient" : undefined) ??
    (/^\/mockups\/ward-flow\/people\/[^/]+\/?$/u.test(pathname) ? "Patient Now" : undefined) ??
    (place?.kind === "ward" && /\/answer\/?$/u.test(pathname) ? "Ward Answer" : undefined) ??
    (/^\/mockups\/ward-flow\/board\//u.test(pathname) ? (place?.name ?? "Bed board") : undefined) ??
    place?.name ??
    [...WARD_VIEWS, ...WARD_NAV].find((entry) => entry.href === pathname)?.label ??
    (pathname === STATISTICS_OVERVIEW_HREF
      ? "Statistics overview"
      : pathname === STATISTICS_COMPARE_HREF
        ? "Statistics compare"
        : "Ward Flow");

  const routeSubtitle = useMemo(() => {
    if (place) {
      if (place.kind === "ward") {
        if (/^\/mockups\/ward-flow\/board\//u.test(pathname)) return "Bed Board";
        return "Inpatient Unit";
      }
      if (place.kind === "ed") return "Emergency Department";
      if (place.kind === "team") return "Community Team";
    }
    if (/^\/mockups\/ward-flow\/board\//u.test(pathname)) return "Live Bed Board";
    if (pathname === WARD_HOME_HREF || routeTitle === "Command") {
      return "Statewide Bed Coordination";
    }
    if (pathname.includes("/movements") || routeTitle === "Movements") {
      return "Transfers, Discharges & Arrivals";
    }
    if (pathname.includes("/sovereign") || routeTitle === "Sovereign Health") {
      return "Aboriginal Health Liaison & Cultural Safety";
    }
    if (pathname.includes("/capacity") || routeTitle === "Capacity") {
      return "Bed Availability & Occupancy";
    }
    if (pathname.includes("/delays") || routeTitle === "Delays") {
      return "Transfer & Placement Delays";
    }
    if (pathname.includes("/governance") || routeTitle === "Governance") {
      return "Registers & Compliance";
    }
    if (pathname.includes("/transport") || routeTitle === "Transport Hub") {
      return "Patient Transfers & Fleet";
    }
    if (pathname.includes("/network") || routeTitle === "Network") {
      return "Statewide Hospital Network";
    }
    if (routeTitle === "Bed board") {
      return "Live Bed Board";
    }
    if (
      routeTitle === "Ward statistics" ||
      routeTitle === "Emergency department statistics" ||
      routeTitle === "Community statistics" ||
      routeTitle === "Service statistics"
    ) {
      return "Flow & Utilisation Metrics";
    }
    if (routeTitle === "Settings") {
      return "System Preferences & Thresholds";
    }
    if (routeTitle === "On-call and contacts") {
      return "Directory & Rosters";
    }
    if (routeTitle === "Add a patient") {
      return "Clinical Placement Intake";
    }
    if (routeTitle === "Patient Now") {
      return "Real-Time Patient Record";
    }
    return undefined;
  }, [pathname, place, routeTitle, units]);

  // ⚠️ Audit finding STILL-06 (ward-flow-task-ledger.md §6.3 item 5, 2026-09-16): `buildActionInbox` returns the WHOLE network's
  // outstanding work, and `ACKNOWLEDGE_INBOX_ITEM`/`COMPLETE_INBOX_ITEM`/`REOPEN_INBOX_ITEM` are all
  // `EVENT_ROLE`-gated to `"coordinator"` alone (`ward-flow-events.ts`). `WardTasksDrawer` trusts its
  // caller and does not re-check role before dispatching (its own doc comment says so), so this is
  // the one place that must gate — `wardTasksAreActionableForRole` exists in `ward-chrome-role.ts`
  // for exactly this call. A ward/ED/officer route gets an empty inbox: zero badge, and the drawer's
  // own "No outstanding work right now." empty state, never a network list with every action refused.
  const tasksItems = useMemo(
    () => (wardTasksAreActionableForRole(role) ? buildActionInbox(movements.filter(isOpen), now, units) : []),
    [movements, now, units, role],
  );
  /**
   * The Service selector's own "{n} open" / "none open" option counts (build plan §3 "Service
   * panel"). One open-movement membership count per `HEALTH_SERVICES` member, through
   * `ward-service-scope.ts`'s own `movementBelongsToService` — the SAME join this panel's own
   * count can never disagree with by construction, since it calls that function directly rather
   * than a second copy.
   *
   * ⚠️ **CORRECTED, R2 (2026-09-17).** This used to cite a `shown + outside = total` test in
   * `tests/ward-service-scope.test.ts` proving movement membership over the real seed — that test
   * existed for MOVEMENTS once, under the name "TEST 8", but R1's own review had already replaced
   * it (it proved only that a filter and its negation sum to the total, true of any predicate) and
   * R2 replaced its successor again for the same reason. What proves `movementBelongsToService`
   * correct today is that file's `movementHealthServices`/`movementBelongsToService` describe
   * block, plus the R2 landmark-membership test — `shown + outside = total` survives in that file
   * only for REFERRALS, a different population from what this comment named.
   */
  const serviceOptionOpenCounts = useMemo(() => {
    const openMovementsList = movements.filter(isOpen);
    const counts = new Map<HealthService, number>();
    for (const candidate of HEALTH_SERVICES) {
      counts.set(
        candidate,
        openMovementsList.filter((movement) => movementBelongsToService(movement, candidate, units)).length,
      );
    }
    return counts;
  }, [movements, units]);
  const commandActivity = useMemo(
    () =>
      deriveCommandActivity({
        movements,
        units,
        referrals,
        rejections,
        bedReleases,
        leaveBeds,
        refreshRequests,
        now,
      }),
    [movements, units, referrals, rejections, bedReleases, leaveBeds, refreshRequests, now],
  );
  const usesDerivedActivity = activity === undefined;
  const currentScreenTitle = useMemo(() => resolveWardScreenTitle(pathname, units), [pathname, units]);
  const defaultActivity = useMemo(
    (): WardActivityContent => ({
      ...commandActivity.content,
      pageTitle: currentScreenTitle,
    }),
    [commandActivity.content, currentScreenTitle],
  );
  const shownActivity = activity ?? defaultActivity;
  const lastActivityAt = usesDerivedActivity ? commandActivity.lastEventAt : undefined;
  const activityCategoryCounts = useMemo(() => {
    const counts: Record<ActivityCategoryFilter, number> = {
      all: 0,
      escalation: 0,
      decline: 0,
      referral: 0,
      transfer: 0,
    };
    for (const change of shownActivity?.changes ?? []) {
      counts.all += 1;
      const category = activityChangeCategory(change);
      if (category !== "other") counts[category] += 1;
    }
    return counts;
  }, [shownActivity?.changes]);
  const filteredActivityChanges = useMemo(() => {
    const changes = shownActivity?.changes ?? [];
    if (activityCategoryFilter === "all") return changes;
    return changes.filter((change) => activityChangeCategory(change) === activityCategoryFilter);
  }, [shownActivity?.changes, activityCategoryFilter]);
  const scopedNotices = useMemo(
    () =>
      notices
        .filter((notice) => noticeIsForWardChrome(notice, role, placeId, now))
        .sort((left, right) => right.raisedAt - left.raisedAt),
    [notices, now, placeId, role],
  );
  // Item 48, Q2 (owner answer 48, 2026-09-17): "counts show unread only" — `scopedNotices` itself
  // still carries every notice this chrome may see, read or not (read notices stay in the list),
  // so the unread tally is a separate derived count rather than a second filtered array.
  const unreadNoticeCount = useMemo(
    () => scopedNotices.filter((notice) => notice.readAt === undefined).length,
    [scopedNotices],
  );

  // Item 48, Q2: the only dispatcher of `MARK_NOTICE_READ` (`ward-flow-events.ts`). `role` here is
  // `WardChromeRole`, a subset of `WardFlowRole` by construction, so it is passed straight through
  // — the reducer's own addressee check is what actually gates the write, exactly as
  // `noticeIsMarkableByChrome`'s own doc comment says a UI-side check never needs to duplicate.
  const markNoticeRead = useCallback(
    (noticeId: string) => {
      dispatch({ type: "MARK_NOTICE_READ", role, now, noticeId, actingPlaceId: placeId });
    },
    [dispatch, now, placeId, role],
  );

  // A link was followed from inside the chrome and its page has not arrived yet. While that is
  // true, closing a drawer must not step back through history: the drawer's own history entry is
  // still the current one until the new page commits, so history.back() would cancel the page the
  // person just chose (seen on slow loads, 26 Sept 2026). Cleared whenever the pathname changes.
  const navigationPendingRef = useRef(false);
  useEffect(() => {
    navigationPendingRef.current = false;
  }, [pathname]);
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      if (isPendingNavigation(anchor.href, window.location.href)) navigationPendingRef.current = true;
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const closePopover = useCallback((id: WardBarPopoverId, announce = true) => {
    setOpenPanel((current) => (current === id ? null : current));
    if (announce) announceToWardShell("Closed.");
    if (typeof window === "undefined" || !window.history) return;
    const step = drawerCloseHistoryStep({
      drawerEntryIsCurrent: Boolean(window.history.state?.wardDrawer),
      navigationPending: navigationPendingRef.current,
      canGoBack: typeof window.history.back === "function",
    });
    if (step === "back") {
      window.history.back();
    } else if (step === "clear") {
      const nextState = { ...window.history.state };
      delete nextState.wardDrawer;
      window.history.replaceState(nextState, "");
    }
    // Used once: a link whose own handler stopped the page change (a menu that opens a drawer
    // instead) must not keep later closes from stepping back.
    navigationPendingRef.current = false;
  }, []);

  const openPopover = useCallback(
    (id: WardBarPopoverId) => {
      setOpenPanel(id);
      if (typeof window !== "undefined" && window.history && isDrawerPanel(id)) {
        if (window.history.state?.wardDrawer) {
          window.history.replaceState({ ...window.history.state, wardDrawer: id }, "");
        } else {
          window.history.pushState({ ...window.history.state, wardDrawer: id }, "");
        }
      }
      if (id === "activity") {
        announceToWardShell(
          `Activity opened. Synthetic data: ${scopedNotices.length} notices and ${shownActivity?.changes.length ?? 0} recent changes.`,
        );
      } else if (id === "tasks") {
        announceToWardShell(`Tasks opened. ${tasksItems.length} invented tasks outstanding.`);
      } else if (id === "tools") {
        announceToWardShell("Tools opened. Demonstration controls, contacts and references are here.");
      } else if (id === "referral") {
        announceToWardShell("Referral drawer opened. Statewide psychiatric bed placement engine.");
      }
      // No opening announcement for the Service selector — the standard's §7.4 list of the shell's
      // fixed sentences names an announcement for CHOOSING or CLEARING a service, never for opening
      // the selector itself.
    },
    [scopedNotices.length, shownActivity?.changes.length, tasksItems.length],
  );

  useEffect(() => {
    function onPopState() {
      setOpenPanel((current) => {
        if (current !== null) {
          announceToWardShell("Closed.");
          return null;
        }
        return current;
      });
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const unsubOpen = subscribeWardDrawer((drawerId) => {
      openPopover(drawerId);
    });
    const unsubClose = subscribeWardDrawerClose(() => {
      setOpenPanel(null);
      announceToWardShell("Closed.");
    });
    return () => {
      unsubOpen();
      unsubClose();
    };
  }, [openPopover]);

  const selectService = useCallback(
    (next: HealthService | null) => {
      setServiceScope(next);
      onServiceChange?.(next);
      closePopover("service", false);
      serviceTriggerRef.current?.focus();
      // Round-1 review, Important 9: §7.4's own example is "Service set to South Metropolitan.
      // Showing 7 of 23." — the second clause is deliberately left off here, not merely
      // shortened. It names a queue count nothing in this shared bar computes (see Important 5,
      // just above: the choice is not wired to the queue, the strip, the drawers or the rail
      // yet), and announcing a figure this component cannot derive would be exactly the invented
      // count standard §8.3 forbids. The popover's own note already says the scope is not wired;
      // once a future task wires `onServiceChange` to something that actually filters, the count
      // belongs here too.
      announceToWardShell(next ? `Service set to ${next}.` : "Service set to all.");
    },
    [closePopover, onServiceChange],
  );

  const openMovement = useCallback(
    (movementId: string) => {
      // A task row is an in-drawer navigation affordance. Close the Sheet in the same event before
      // routing so its portal cannot remain over the destination while the new page mounts.
      setOpenPanel(null);
      if (typeof window !== "undefined" && window.history && window.history.state?.wardDrawer) {
        const nextState = { ...window.history.state };
        delete nextState.wardDrawer;
        window.history.replaceState(nextState, "");
      }
      router.push(movementHref(movementId));
    },
    [router],
  );

  // Close the Service selector, or the "New referral" popover, on an outside click — the three
  // drawers get the same behaviour from `<Sheet>`'s own backdrop; these are the only two pop-outs
  // that manage their own chrome. The mockup's own `newMenu` is the same shape of control as the
  // Service selector (`command-third-edition.html`'s "menus and drawers: one open at a time, close
  // outside, Escape returns focus"), so this reuses that exact effect rather than adding a second,
  // near-identical one.
  //
  // 🔴 **THE TRIGGER ITSELF MUST COUNT AS "INSIDE", NOT ONLY THE PANEL — S2 FIX, A REAL RACE, NOT A
  // HYPOTHETICAL ONE.** The trigger's own `onClick` toggles `openPanel` (open -> close, close ->
  // open), but a click is `mousedown` THEN `mouseup`/`click`, and this effect's own `mousedown`
  // listener fires first. With only `panelRef` checked, a second click on the TRIGGER (which is a
  // sibling of the panel, never inside it) read as "outside": `mousedown` closed the popover, React
  // committed that before `click` fired, and the trigger's own `onClick` then read the now-closed
  // `openPanel` and reopened it — one click that visibly did nothing, because close and reopen
  // happened inside it. A second, genuinely separate click was needed to close it for good. Treating
  // the OWNING trigger as inside too (both branches check both refs, unconditionally on which popover
  // is open, rather than assuming `openPanel` still names the same one two lines down — see the next
  // comment) leaves `onPointerDown` a no-op on that click, so the trigger's own `onClick` alone
  // decides the outcome: open -> closed, closed -> open, same as every other toggle button in this
  // file.
  useEffect(() => {
    if (openPanel !== "service" && openPanel !== "primary") return;
    const activePanel = openPanel;
    const panelRef = activePanel === "service" ? servicePanelRef : primaryPanelRef;
    const triggerRef = activePanel === "service" ? serviceTriggerRef : primaryTriggerRef;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closePopover(activePanel, false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [closePopover, openPanel]);

  // The one Escape order — see the file header for the full reasoning behind each branch. The
  // "New referral" popover joins the Service selector's branch rather than getting its own: both
  // are the drawing's own "menu" shape (`command-third-edition.html`'s `escape()`: any open menu
  // closes first, focus returns to its own trigger, "Closed." is announced), and only the SERVICE
  // VALUE itself — never a menu being open — gets the "Nothing more to clear" refusal below.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return; // WardGlobalSearch (or another field) already handled it.
      if (openPanel === "activity" || openPanel === "tasks" || openPanel === "tools" || openPanel === "referral")
        return; // Sheet's own handler closes these.
      if (openPanel === "service" || openPanel === "primary") {
        event.preventDefault();
        const triggerRef = openPanel === "service" ? serviceTriggerRef : primaryTriggerRef;
        closePopover(openPanel);
        triggerRef.current?.focus();
        return;
      }
      if (service !== null) {
        // Exact wording, build plan §3 "Escape": now that S2 wires the choice to a real store, the
        // old "not wired" clause is false — the fixed alternative is telling the owner what widening
        // the lists actually takes (choose All services), not that the feature does not exist yet.
        announceToWardShell(
          `Nothing more to clear. The service stays ${service}. Choose All services in the selector to widen the lists.`,
        );
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closePopover, openPanel, service]);

  /** `"neutral"` is this app's existing word for "nothing asserted either way" (`WardRecordTone`,
   *  `ward-record-row.tsx`) — reused here rather than inventing a fourth tone name. */
  const activityTone: "good" | "neutral" = shownActivity || scopedNotices.length > 0 ? "good" : "neutral";
  const activityToneFor = (id: string): WardActivityEventTone =>
    usesDerivedActivity ? (commandActivity.tones[id] ?? "info") : "info";
  const publishedChecks = checksPublication.published ? checksPublication.checks : [];
  const reconciledCheckCount = publishedChecks.filter((check) => check.ok).length;

  // Fixed jurisdiction resolution for place-specific views
  const fixedService = useMemo<HealthService | undefined>(() => {
    if (place) {
      if (place.kind === "ward") {
        const unitMatch =
          /^\/mockups\/ward-flow\/ward\/([^/]+)/.exec(pathname) ??
          /^\/mockups\/ward-flow\/board\/([^/]+)/.exec(pathname);
        const unitId = unitMatch ? decodeURIComponent(unitMatch[1]) : undefined;
        const currentUnit = unitId ? units.find((u) => u.id === unitId) : units.find((u) => u.name === place.name);
        if (currentUnit) return unitHealthService(currentUnit);
      }
      if (place.kind === "ed") {
        const edMatch = /^\/mockups\/ward-flow\/ed\/([^/]+)/.exec(pathname);
        if (edMatch) return edHealthService(decodeURIComponent(edMatch[1]));
      }
      if (place.kind === "team") {
        return undefined;
      }
    }
    return undefined;
  }, [pathname, place, units]);

  const isFixedJurisdiction = fixedService !== undefined;
  const activeService = isFixedJurisdiction ? fixedService : service;
  const activeSwatchKey = activeService ? (SERVICE_SWATCH_KEY[activeService] ?? "statewide") : "statewide";
  const activeServiceBadgeLabel = useMemo(() => {
    if (!activeService) return "STATEWIDE";
    if (activeService === "East Metro") return "EAST METRO";
    if (activeService === "North Metro") return "NORTH METRO";
    if (activeService === "South Metro") return "SOUTH METRO";
    if (activeService === "WACHS") return "WACHS";
    if (activeService === "Private") return "PRIVATE";
    return String(activeService).toUpperCase();
  }, [activeService]);

  return (
    <header
      className={styles.bar}
      aria-label="Header"
      data-testid="ward-bar"
      data-long-title={routeTitle.length > 17 || undefined}
    >
      <div className={styles.title}>
        <div className={styles.cockpitCapsule}>
          <div className={styles.titleGroup}>
            <span
              className={styles.place}
              data-testid={place ? "ward-bar-place" : "ward-bar-route-title"}
              title={routeTitle}
            >
              {routeTitle}
            </span>
            {routeSubtitle ? (
              <span className={styles.subtitle} data-testid="ward-bar-subtitle">
                {routeSubtitle}
              </span>
            ) : null}
          </div>

          <div className={styles.scopeBadgeContainer}>
            <button
              type="button"
              ref={serviceTriggerRef}
              className={styles.scopeBadgeBtn}
              data-testid="ward-bar-service-trigger"
              data-service={activeSwatchKey}
              data-locked={isFixedJurisdiction ? "true" : undefined}
              aria-haspopup={isFixedJurisdiction ? undefined : "true"}
              aria-expanded={isFixedJurisdiction ? undefined : openPanel === "service"}
              aria-controls={isFixedJurisdiction ? undefined : "ward-bar-service-panel"}
              aria-label={
                isFixedJurisdiction ? `Jurisdiction: ${activeService}` : `Service: ${activeService ?? "All services"}`
              }
              onClick={() => {
                if (isFixedJurisdiction) {
                  announceToWardShell(`${routeTitle} is in ${activeService}.`);
                  return;
                }
                if (openPanel === "service") {
                  closePopover("service", false);
                } else {
                  openPopover("service");
                }
              }}
            >
              <span className={styles.scopeBadgeInner}>
                <span className={styles.scopeDot} aria-hidden="true" />
                <span className={styles.scopeBadgeLabel}>{activeServiceBadgeLabel}</span>
                {!isFixedJurisdiction && <ChevronDown className={styles.scopeCaret} aria-hidden="true" />}
              </span>
              <span className="sr-only">{activeService ?? "All services"}</span>
            </button>

            {!isFixedJurisdiction && openPanel === "service" ? (
              <div
                id="ward-bar-service-panel"
                ref={servicePanelRef}
                className={styles.servicePanel}
                role="group"
                aria-label="Choose a health service"
                data-testid="ward-bar-service-panel"
              >
                <p className={styles.popoverHead}>
                  Service<span className={styles.popoverHint}>scopes the lists</span>
                </p>
                <button
                  type="button"
                  className={styles.serviceOption}
                  aria-pressed={service === null}
                  onClick={() => selectService(null)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <span className={styles.serviceDot} aria-hidden="true" style={{ background: "var(--muted)" }} />
                    All services
                  </span>
                  <Check className={styles.serviceCheck} aria-hidden="true" data-visible={service === null} />
                </button>
                {HEALTH_SERVICES.map((candidate) => {
                  const openCount = serviceOptionOpenCounts.get(candidate) ?? 0;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      className={styles.serviceOption}
                      aria-pressed={service === candidate}
                      onClick={() => selectService(candidate)}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <span
                          className={styles.serviceDot}
                          data-service={SERVICE_SWATCH_KEY[candidate]}
                          aria-hidden="true"
                        />
                        {candidate}
                      </span>
                      <span className={styles.serviceOptionCount} aria-hidden="true">
                        {openCount > 0 ? `${openCount} open` : "none open"}
                      </span>
                      <Check className={styles.serviceCheck} aria-hidden="true" data-visible={service === candidate} />
                    </button>
                  );
                })}
                <p className={styles.popoverNote}>
                  {`One service, or all of them. ${
                    SERVICE_SCOPED_SCREENS.length > 1
                      ? `${SERVICE_SCOPED_SCREENS.slice(0, -1).join(", ")} and ${SERVICE_SCOPED_SCREENS[SERVICE_SCOPED_SCREENS.length - 1]}`
                      : SERVICE_SCOPED_SCREENS.join(", ")
                  } narrow${SERVICE_SCOPED_SCREENS.length === 1 ? "s" : ""} their lists to it. The bed shortlist, whole-network figures, the rail counts and the drawers do not.`}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <span
          className={styles.mark}
          title="Patient and flow data are synthetic; WA hospital sites and health-service names are real. Not a medical device or clinical decision support."
        >
          <span className={styles.markLong}>Synthetic </span>prototype
        </span>
      </div>

      <div className={styles.centerGroup}>
        <div
          className={styles.searchWrap}
          onFocusCapture={() =>
            setOpenPanel((current) => (current === "service" || current === "primary" ? null : current))
          }
        >
          <WardGlobalSearch movements={movements} patients={patients} units={units} placeholder="Search" />
        </div>
      </div>

      <div className={styles.drawerTriggers}>
        <button
          type="button"
          ref={figuresTriggerRef}
          className={styles.drawerTrigger}
          data-testid="ward-bar-figures-trigger"
          aria-haspopup="dialog"
          aria-expanded={openPanel === "figures"}
          aria-controls="ward-bar-figures-drawer"
          onClick={() => (openPanel === "figures" ? closePopover("figures", false) : openPopover("figures"))}
          title={flaggedFigures.length > 0 ? `Clinical telemetry: ${telemetrySummary}` : "Clinical telemetry: Nominal"}
          aria-label={
            flaggedFigures.length > 0
              ? `Figures telemetry: ${telemetrySummary}. Open figures drawer.`
              : "Figures telemetry: Nominal. Open figures drawer."
          }
        >
          <BarChart3 className={styles.triggerIcon} aria-hidden="true" />
          <span className={styles.triggerLabel}>Figures</span>
          {flaggedFigures.length > 0 ? (
            <span className={styles.alarmBadge} data-tone="danger">
              {flaggedFigures.length}
            </span>
          ) : (
            <span className={styles.dot} data-tone="good" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          ref={activityTriggerRef}
          className={styles.drawerTrigger}
          data-testid="ward-bar-activity-trigger"
          aria-haspopup="dialog"
          aria-expanded={openPanel === "activity"}
          aria-controls="ward-bar-activity-drawer"
          onClick={() => (openPanel === "activity" ? closePopover("activity", false) : openPopover("activity"))}
        >
          <Activity className={styles.triggerIcon} aria-hidden="true" />
          <span className={styles.triggerLabel}>Activity</span>
          <span className={styles.dot} data-tone={activityTone} aria-hidden="true" />
          <span className="sr-only">
            {shownActivity ? ", synthetic activity" : ", activity not available for this page"}
          </span>
        </button>

        <button
          type="button"
          ref={tasksTriggerRef}
          className={styles.drawerTrigger}
          data-testid="ward-bar-tasks-trigger"
          aria-haspopup="dialog"
          aria-expanded={openPanel === "tasks"}
          aria-controls="ward-bar-tasks-drawer"
          onClick={() => (openPanel === "tasks" ? closePopover("tasks", false) : openPopover("tasks"))}
        >
          <ClipboardCheck className={styles.triggerIcon} aria-hidden="true" />
          <span className={styles.triggerLabel}>Tasks</span>
          <span className={styles.badge}>{tasksItems.length}</span>
        </button>

        <button
          type="button"
          ref={toolsTriggerRef}
          className={styles.drawerTrigger}
          data-testid="ward-bar-tools-trigger"
          aria-haspopup="dialog"
          aria-expanded={openPanel === "tools"}
          aria-controls="ward-bar-tools-drawer"
          onClick={() => (openPanel === "tools" ? closePopover("tools", false) : openPopover("tools"))}
        >
          <Wrench className={styles.triggerIcon} aria-hidden="true" />
          <span className={styles.triggerLabel}>Tools</span>
          <ChevronDown className={styles.triggerIcon} aria-hidden="true" />
        </button>
      </div>

      {/*
       * ⚠️ **THE PRIMARY ACTION IS A SIBLING OF `.drawerTriggers`, NEVER A MEMBER OF IT, AND THAT
       * WAS MEASURED.** `.drawerTriggers` is a nested flex row with `flex-shrink: 0` and no
       * `flex-wrap`, so nothing inside it can ever move to a second line or give up a pixel.
       * Rendered inside that group, this control made the group 379px wide inside the bar's 343px
       * content box at a 375px viewport, and `document.body.scrollWidth` measured 395 — the whole
       * PAGE scrolled sideways on `/mockups/ward-flow/statistics/ed/rph-ed`, which is what
       * `ui-ward-statistics-journey.spec.ts` refuses. As a direct child of `.bar` it is governed
       * by that row's own `flex-wrap: wrap` instead — the wrap this stylesheet's header calls
       * load-bearing at phone width — and takes its own line when the row runs out, costing
       * nothing at every width where it already fits.
       */}
      {/*
       * D-16, updated for item 43 (2026-09-17 owner answers): five kinds, three shapes. "none"
       * and an absent `primaryAction` both render nothing — the ONE branch below that returns
       * `null`. "new-referral" is the one kind with a real destination, so it is the one kind
       * that opens a popover of `<Link>`s. The other three (`record-decision`, `contact-team`,
       * `export-figures`) now open a popover of their own too — reusing the "primary" popover
       * id and its trigger/panel refs, so the shared outside-click and Escape handling below
       * (which already closes "primary" and returns focus to `primaryTriggerRef`) covers this
       * shape for free rather than a second near-identical mechanism. Never an `<a>`, so no
       * `href` attribute exists anywhere in this branch. The panel is headed by the control's
       * own label with the body EXACTLY "Not wired in this prototype." — the build plan's item
       * 43 wording (§3 "Top bar"), a menu headed "{label}" with that body. The click still
       * announces "<label> is not wired in this prototype." to the live region on first open,
       * standard §8.6's exact sentence, unchanged from before this task.
       */}
      {primaryAction?.kind === "new-referral" ? (
        <div className={styles.primaryWrap}>
          <button
            type="button"
            ref={primaryTriggerRef}
            className={`${styles.primary} ${styles.referralPrimary}`}
            data-testid="ward-bar-primary-action"
            aria-haspopup="true"
            aria-expanded={openPanel === "primary"}
            aria-controls="ward-bar-primary-panel"
            onClick={() => (openPanel === "primary" ? closePopover("primary", false) : openPopover("primary"))}
          >
            <span className={styles.primaryPrefix}>New </span>
            <span className={styles.primaryMain}>referral</span>
            <span className={styles.referralChevron} aria-hidden="true">
              <ChevronRight className={styles.triggerIcon} aria-hidden="true" />
            </span>
          </button>
          {openPanel === "primary" ? (
            <div
              id="ward-bar-primary-panel"
              ref={primaryPanelRef}
              className={styles.primaryPanel}
              role="menu"
              aria-label={primaryAction.label}
              data-testid="ward-bar-primary-panel"
            >
              {primaryAction.menu.map((entry) => (
                <Link
                  key={entry.source}
                  href={entry.href}
                  role="menuitem"
                  className={styles.primaryMenuItem}
                  data-testid={`ward-bar-primary-menu-${entry.source}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const category: "community" | "ed" | "ward" =
                      entry.source === "community" ? "community" : entry.source === "ed_medical" ? "ed" : "ward";
                    setReferralCategory(category);
                    openPopover("referral");
                  }}
                >
                  {entry.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : primaryAction && primaryAction.kind !== "none" ? (
        <div className={styles.primaryWrap}>
          <button
            type="button"
            ref={primaryTriggerRef}
            className={`${styles.primary} ${styles.referralPrimary}`}
            data-testid="ward-bar-primary-action"
            aria-haspopup="true"
            aria-expanded={openPanel === "primary"}
            aria-controls="ward-bar-primary-panel"
            onClick={() => {
              if (openPanel === "primary") {
                closePopover("primary", false);
                return;
              }
              openPopover("primary");
              announceToWardShell(`${primaryAction.label} ${NOT_WIRED_SUFFIX}`);
            }}
          >
            <span className={styles.primaryMain}>{primaryAction.label}</span>
            <span className={styles.referralChevron} aria-hidden="true">
              <ChevronRight className={styles.triggerIcon} aria-hidden="true" />
            </span>
          </button>
          {openPanel === "primary" ? (
            <div
              id="ward-bar-primary-panel"
              ref={primaryPanelRef}
              className={styles.primaryPanel}
              role="group"
              aria-label={primaryAction.label}
              data-testid="ward-bar-primary-panel"
            >
              <p className={styles.popoverHead}>{primaryAction.label}</p>
              <p className={styles.popoverNote}>Not wired in this prototype.</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <Sheet
        id="ward-bar-activity-drawer"
        open={openPanel === "activity"}
        onClose={() => closePopover("activity")}
        title="Activity"
        placement="right"
        testId="ward-bar-activity-sheet"
        returnFocusRef={activityTriggerRef}
        descriptionContent={
          <p className={styles.activityFreshness} data-tone={activityTone}>
            <span className={styles.dot} data-tone={activityTone} aria-hidden="true" />
            <span>
              Synthetic state · demo time {formatInstant(now)}
              {lastActivityAt === undefined
                ? " · no recorded event"
                : ` · last event ${formatInstantWithDay(lastActivityAt, now)}`}
            </span>
          </p>
        }
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetWide}`}
        headerClassName={styles.drawerHeader}
        titleClassName={styles.drawerTitle}
        closeButtonClassName={styles.drawerClose}
        bodyClassName={styles.drawerBody}
        footer={
          <p className={styles.drawerFoot}>
            Synthetic events are derived from current demo records and listed newest first.
          </p>
        }
        footerClassName={styles.drawerFooter}
      >
        <div className={`${styles.activitySegments} ${styles.segTrack}`} role="group" aria-label="Activity sections">
          <button
            type="button"
            className={styles.segBtn}
            aria-pressed={activityPart === "activity"}
            aria-controls="ward-bar-activity-events"
            onClick={() => setActivityPart("activity")}
          >
            Activity
            <span>{shownActivity?.changes.length ?? 0}</span>
          </button>
          <button
            type="button"
            className={styles.segBtn}
            aria-pressed={activityPart === "tally"}
            aria-controls="ward-bar-activity-tally"
            onClick={() => setActivityPart("tally")}
          >
            Live tally
            <span>{shownActivity?.pageTitle ?? "Current page"}</span>
          </button>
        </div>

        {activityPart === "activity" ? (
          <div
            className={styles.filterChipsTrack}
            role="group"
            aria-label="Filter events by category"
            data-testid="ward-bar-activity-category-filters"
          >
            {ACTIVITY_CATEGORY_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={styles.filterChip}
                aria-pressed={activityCategoryFilter === chip.id}
                data-testid={`ward-bar-activity-filter-${chip.id}`}
                onClick={() => setActivityCategoryFilter(chip.id)}
              >
                {chip.label}
                <span className={styles.chipCount}>{activityCategoryCounts[chip.id]}</span>
              </button>
            ))}
          </div>
        ) : null}

        <section id="ward-bar-activity-events" className={styles.activitySection} hidden={activityPart !== "activity"}>
          {scopedNotices.length > 0 ? (
            <>
              {/* Item 48, Q2: "counts show unread only" — the heading counts unread notices, never
                  `scopedNotices.length`, even though read notices stay in the list below. */}
              <p className={styles.activityHead}>
                Notices <span>· {unreadNoticeCount} unread</span>
              </p>
              <ol className={styles.activityFeed} aria-label="Notices">
                {scopedNotices.map((notice) => {
                  const isRead = notice.readAt !== undefined;
                  return (
                    <li key={notice.id} data-tone="info" data-notice-read={isRead}>
                      <time>{formatInstantWithDay(notice.raisedAt, now)}</time>
                      <span className={styles.eventDot} aria-hidden="true" />
                      <div className={styles.noticeContent}>
                        <span>{notice.sentence}</span>
                        {/* No automatic read on opening the drawer — this is the only place
                            `MARK_NOTICE_READ` is dispatched from, and only a person's own click
                            reaches it (item 48, Q2, owner answer 48). */}
                        {isRead ? (
                          <span className={styles.noticeReadLabel}>Read</span>
                        ) : (
                          <button
                            type="button"
                            className={styles.noticeMarkRead}
                            onClick={() => markNoticeRead(notice.id)}
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
          <p className={styles.activityHead}>
            Recent changes <span>{filteredActivityChanges.length}</span>
          </p>
          {!shownActivity && scopedNotices.length === 0 ? (
            <p className={styles.activityEmpty}>{service ? `No event today in ${service}.` : "No event today."}</p>
          ) : !shownActivity ? null : shownActivity.changes.length === 0 ? (
            <p className={styles.activityEmpty}>No event today.</p>
          ) : filteredActivityChanges.length === 0 ? (
            <p className={styles.activityEmpty}>No events in this category.</p>
          ) : (
            <ol className={`${styles.activityFeed} ${styles.feedList}`} aria-label="Recent changes">
              {filteredActivityChanges.map((change) => {
                const tone = activityToneFor(change.id);
                return (
                  <li
                    key={change.id}
                    className={styles.feedRow}
                    data-tone={tone}
                    data-category={activityChangeCategory(change)}
                  >
                    <time className={styles.feedTime}>{change.time}</time>
                    <span className={`${styles.eventDot} ${styles.feedToneDot}`} data-tone={tone} aria-hidden="true" />
                    <span className={styles.feedText}>{change.text}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {shownActivity && shownActivity.changes.length > 0 ? (
            <details className={styles.activityKey}>
              <summary>Event key</summary>
              <div>
                <span>
                  <i data-tone="info" aria-hidden="true" />
                  Recorded update
                </span>
                <span>
                  <i data-tone="warning" aria-hidden="true" />
                  Needs attention
                </span>
                <span>
                  <i data-tone="danger" aria-hidden="true" />
                  Deadline or refused action
                </span>
              </div>
            </details>
          ) : null}
          {publishedChecks.length > 0 ? (
            <details className={styles.activityKey} data-testid="ward-bar-figure-checks">
              <summary>
                Figure checks · {reconciledCheckCount} of {publishedChecks.length} reconcile
              </summary>
              <div>
                {publishedChecks.map((check) => (
                  <span key={check.label}>
                    <i data-tone={check.ok ? "info" : "danger"} aria-hidden="true" />
                    {check.label} · {check.ok ? "Reconciles" : "Does not reconcile"}
                  </span>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <section id="ward-bar-activity-tally" className={styles.activitySection} hidden={activityPart !== "tally"}>
          {shownActivity ? (
            <>
              <p className={styles.activityTitle}>{shownActivity.pageTitle} now</p>
              {shownActivity.tiles.length > 0 ? (
                <div className={styles.activityTiles}>
                  {shownActivity.tiles.map((tile) => (
                    <div key={tile.label} className={styles.activityTile} data-tone={tile.tone}>
                      <small>{tile.label}</small>
                      <b>{tile.value}</b>
                    </div>
                  ))}
                </div>
              ) : null}
              {usesDerivedActivity ? (
                <table className={styles.tallyDepartments}>
                  <caption>Emergency departments</caption>
                  <thead>
                    <tr>
                      <th scope="col">Department</th>
                      <th scope="col">Waiting</th>
                      <th scope="col">Longest</th>
                      <th scope="col">Due times passed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commandActivity.departments.map((row) => (
                      <tr key={row.ed.id}>
                        <th scope="row">
                          <Link
                            href={edHref(row.ed.id)}
                            onClick={() => closePopover("activity", false)}
                            title={row.ed.name}
                          >
                            {row.ed.siteCode}
                          </Link>
                        </th>
                        <td>{row.waiting}</td>
                        <td>{row.waiting ? splitDuration(row.longestWaitMinutes) : "—"}</td>
                        <td data-breached={row.breaching > 0}>{row.breaching}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </>
          ) : (
            <p className={styles.activityEmpty}>
              {service ? `No tally for this page in ${service}.` : "No tally for this page."}
            </p>
          )}
        </section>
      </Sheet>

      <Sheet
        id="ward-bar-tasks-drawer"
        open={openPanel === "tasks"}
        onClose={() => closePopover("tasks")}
        ariaLabel="Tasks"
        headerHidden
        placement="right"
        testId="ward-bar-tasks-sheet"
        initialFocusRef={tasksInitialFocusRef}
        returnFocusRef={tasksTriggerRef}
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetTasks}`}
        bodyClassName={styles.tasksCarrierBody}
      >
        <div ref={setTasksBodyRef} className={styles.tasksBody}>
          <WardTasksDrawer
            items={tasksItems}
            acknowledgements={inboxAcknowledgements}
            completions={inboxCompletions}
            role={role}
            now={now}
            dispatch={dispatch}
            onClose={() => closePopover("tasks")}
            onSelectMovement={openMovement}
          />
        </div>
      </Sheet>

      <Sheet
        id="ward-bar-tools-drawer"
        open={openPanel === "tools"}
        onClose={() => closePopover("tools")}
        title="Tools"
        titleAccessory={<span className={styles.drawerScope}>Whole network</span>}
        placement="right"
        testId="ward-bar-tools-sheet"
        returnFocusRef={toolsTriggerRef}
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetWide}`}
        headerClassName={styles.drawerHeader}
        titleClassName={styles.drawerTitle}
        closeButtonClassName={styles.drawerClose}
        bodyClassName={styles.drawerBody}
        footer={<p className={styles.drawerFoot}>Demo tools, not part of the clinical record.</p>}
        footerClassName={styles.drawerFooter}
      >
        <section className={styles.toolsSection}>
          <h3 className={styles.toolsHeading}>Appearance theme</h3>
          <div className={styles.segTrack} style={{ margin: "4px 0 10px" }}>
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={appearance === "dark"}
              onClick={() => applyAppearance("dark")}
            >
              Dark theme
            </button>
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={appearance === "light"}
              onClick={() => applyAppearance("light")}
            >
              Light theme
            </button>
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={appearance === "auto"}
              onClick={() => applyAppearance("auto")}
            >
              System
            </button>
          </div>
        </section>

        <section className={styles.toolsSection}>
          <h3 className={styles.toolsHeading}>Do</h3>
          <Link href={handoverHref()} className={styles.toolItem} onClick={() => closePopover("tools", false)}>
            <FileText aria-hidden="true" />
            <span>
              Handover sheet<em>Open the current handover and its print controls</em>
            </span>
          </Link>
          <Link
            href={WARD_REFERRAL_INTAKE_HREF}
            className={styles.toolItem}
            onClick={() => closePopover("tools", false)}
          >
            <Plus aria-hidden="true" />
            <span>
              Raise a referral<em>Choose the source and enter the referral details</em>
            </span>
          </Link>
          <Link href={settingsHref()} className={styles.toolItem} onClick={() => closePopover("tools", false)}>
            <Settings aria-hidden="true" />
            <span>
              Settings<em>System configuration and preference options</em>
            </span>
          </Link>
        </section>

        <section className={styles.toolsSection}>
          <h3 className={styles.toolsHeading}>
            Catchment resolver <span>WA Health</span>
          </h3>
          <WardCatchmentResolver />
        </section>

        <section className={styles.toolsSection}>
          <h3 className={styles.toolsHeading}>
            Form date review <span>Recorded times only</span>
          </h3>
          <WardMhaCalculator />
        </section>

        <section className={styles.toolsSection}>
          {/* Owner ruling for this plan (§1.3): the app's own demonstration controls — clock,
              scenario, reset — and the role switcher move here so nothing a demonstration needs
              is lost when the per-screen rail that used to carry them is removed. */}
          <h3 className={styles.toolsHeading}>Demonstration</h3>
          <div className={styles.toolsRow}>
            <WardDemoControls />
            <WardRoleSwitcher />
          </div>
        </section>

        <section className={styles.toolsSection}>
          <div className={styles.consequenceCard}>
            <div className={styles.cqHeader}>
              <span>State desk hotlines</span>
              <span className="badgePill" style={{ color: "var(--accent)", fontWeight: 600 }}>
                Internal WA Health
              </span>
            </div>
            <ul className={styles.cqList}>
              <li>
                State Bed Desk: <b>ext 8492</b> / (08) 6457 8492
              </li>
              <li>
                Mental Health Transport: <b>ext 7210</b>
              </li>
              <li>
                Chief Psychiatrist Liaison: <b>ext 1102</b>
              </li>
            </ul>
          </div>
        </section>

        <ToolsDirectory
          title="Ward contacts"
          onNavigate={() => closePopover("tools", false)}
          entries={units.map((unit) => ({
            id: unit.id,
            name: unit.name,
            href: unitHref(unit.id),
          }))}
        />
        <ToolsDirectory
          title="Emergency department contacts"
          onNavigate={() => closePopover("tools", false)}
          entries={allEmergencyDepartments().map((department) => ({
            id: department.id,
            name: department.name,
            href: edHref(department.id),
          }))}
        />
        <section className={styles.toolsSection} aria-label="Reference page">
          {/* This fixed HTML GET route is a document, so use native navigation rather than an RSC transition. */}
          <a href={digestHref()} className={styles.toolItem}>
            <BookOpen aria-hidden="true" />
            <span>
              Ward Flow Digest<em>Design reference — the complete product drawing</em>
            </span>
          </a>
        </section>
      </Sheet>

      <Sheet
        id="ward-bar-referral-drawer"
        open={openPanel === "referral"}
        onClose={() => closePopover("referral")}
        ariaLabel="Referral Side Drawer"
        headerHidden
        placement="right"
        testId="ward-bar-referral-sheet"
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetReferral}`}
        bodyClassName={styles.referralCarrierBody}
      >
        <WardReferralDrawer initialCategory={referralCategory} onClose={() => closePopover("referral")} />
      </Sheet>

      <Sheet
        id="ward-bar-figures-drawer"
        open={openPanel === "figures"}
        onClose={() => closePopover("figures")}
        title="Figures & Telemetry"
        titleAccessory={
          <span className={styles.drawerScope}>
            {role === "coordinator" ? "Whole network" : (place?.name ?? "Unit view")}
          </span>
        }
        placement="right"
        testId="ward-bar-figures-sheet"
        initialFocusRef={figuresInitialFocusRef}
        returnFocusRef={figuresTriggerRef}
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetFigures}`}
        bodyClassName={styles.figuresCarrierBody}
      >
        <WardStatsDrawerContent
          figures={figures}
          chromeRole={role}
          placeName={place?.name}
          now={now}
          onClose={() => closePopover("figures")}
        />
      </Sheet>
    </header>
  );
}

function ToolsDirectory({
  title,
  entries,
  onNavigate,
}: {
  title: string;
  entries: { id: string; name: string; href: string }[];
  onNavigate: () => void;
}) {
  return (
    <section className={`${styles.toolsSection} ${styles.directorySection}`}>
      <h3 className={styles.toolsHeading}>
        {title} <span>{entries.length}</span>
      </h3>
      <p className={styles.directoryNote}>Telephone and email details are not held in this prototype.</p>
      <ul className={styles.directoryList} aria-label={title}>
        {entries.map((entry) => (
          <li key={entry.id}>
            <Link href={entry.href} onClick={onNavigate}>
              <span>{entry.name}</span>
              <small>Contact not held</small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * `layout.tsx`'s (`src/app/mockups/ward-flow/layout.tsx`) own mount of the bar, wired to
 * `resolveWardPrimaryAction` — the "layout.tsx resolves the current route's action from
 * `WARD_PRIMARY_ACTIONS` and passes it" step D-16 calls for.
 *
 * ⚠️ **WHY THIS IS A SEPARATE COMPONENT, NOT A FEW LINES INSIDE `layout.tsx` ITSELF.** Resolving a
 * pathname needs `usePathname()`, a Client Component hook — but `layout.tsx` cannot become one:
 * it renders `DeveloperAreaGate` (`src/components/developer-area/developer-area-gate.tsx`)
 * directly, an `async` Server Component that reads `next/headers`, and a Client Component's own
 * module can never import a Server Component that uses a server-only API (the import would be
 * bundled for the browser, where `next/headers` does not exist). `WardBar` itself stays exactly
 * the pure, resolved-prop consumer its own doc comment describes — this wrapper is the one place
 * between the route and it that is allowed to call a hook, mirroring `WardShellHeader`
 * (`ward-shell.tsx`), the shell's other per-route resolver already mounted the identical way from
 * the same Server Component layout.
 */
export function WardBarMount(props: Omit<WardBarProps, "primaryAction">) {
  const pathname = usePathname() ?? "";
  return <WardBar {...props} primaryAction={resolveWardPrimaryAction(pathname)} />;
}
