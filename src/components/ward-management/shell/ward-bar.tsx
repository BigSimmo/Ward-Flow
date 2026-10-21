"use client";

import dynamic from "next/dynamic";
import { RotateCcwClock, Wrench } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";

import { Sheet } from "@/components/wf/sheet";
import { canRestoreFocusTo, hasOpenSheet, isTopmostSheet, popSheet, pushSheet } from "@/components/wf/sheet-focus";
import { publishLiveClock, useIsPhone, useWfBandActive } from "@/components/wf";
import { createBrowserStore } from "@/lib/client-store-factory";
import {
  readStoredGlarePreference,
  readStoredThemePreference,
  setGlarePreference,
  setThemePreference,
  subscribeGlarePreference,
  subscribeThemePreference,
} from "@/lib/theme-client";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { WARD_HISTORY_TRAVERSAL_CANCELLED } from "@/components/ward-management/use-dirty-state-guard";
import { waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";
import { WardGlobalSearch } from "@/components/ward-management/ward-global-search-lazy";
import type { HealthService } from "@/components/ward-management/ward-model";
import { WARD_ALERTS_HREF, resolveWardScreenTitle } from "@/components/ward-management/ward-nav";
import { wardPlaceFor } from "@/components/ward-management/ward-place";
import { WardDemoClockPopover } from "@/components/ward-management/ward-demo-controls";
import { WardReferralDrawer, WardTasksDrawer } from "./ward-bar-lazy-panels";
import {
  referralSheetRequestFromHref,
  referralSheetRequestFromSearch,
  type ReferralSheetRequest,
} from "@/components/ward-management/referrals/referral-sheet-link";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import {
  CHROME_ROLE_LABELS,
  noticeIsForWardChrome,
  wardTasksAreActionableForRole,
} from "@/components/ward-management/ward-chrome-role";
// The Tools sheet (Tools review, 15 Oct 2026): one scrolling sheet in groups, Demo at the foot.
const WardToolsSheet = dynamic(() =>
  import("@/components/ward-management/tools/ward-tools-sheet").then((m) => m.WardToolsSheet),
);
import { subscribeToolsTool } from "@/components/ward-management/tools/ward-tools-open";
import type { ToolsSheetToolId } from "@/components/ward-management/tools/ward-tools-sheet";

import { announceToWardShell } from "./ward-live-region";
import { WARD_BAR_PAGE_TOOLS_ID } from "./ward-bar-page-tools";
import { subscribeWardDrawer, subscribeWardDrawerClose } from "./ward-drawer-bus";
import { dischargeHref, movementHref, patientSearchHref } from "./ward-facade";
import type { WardActivityContent, WardAppearance, WardPrimaryAction } from "./ward-shell-types";
import { deriveCommandActivity, type WardActivityEventTone } from "./ward-command-activity";
import { useWardChecks } from "./ward-checks";
import { setServiceScope, useServiceScope } from "./ward-service-store";
import { replayEarlyHeaderTap } from "./ward-early-tap";
import { WardDataModeSlot } from "../ward-shared-access";
import { useAccessNavFilter, useDeskHomeHref } from "./ward-access";
import { noteWardRoute, wardBackParent } from "./ward-back";
import {
  ALERTS_ACCESS_ENTRY,
  REFERRAL_BOARD_HREF,
  SERVICE_SWATCH_KEY,
  activityChangeCategory,
  drawerCloseHistoryStep,
  fixedServiceFor,
  focusAlertsQueue,
  isDrawerPanel,
  isPendingNavigation,
  isReferralSheetPath,
  phoneBarAction,
  roleReferralCategory,
  routeBarAction,
  wardBarRouteTitle,
  withRoleCategory,
  type ActivityCategoryFilter,
  type ActivityPart,
  type ReferralOpenRequest,
  type WardBarPopoverId,
} from "./ward-bar-model";
import { useBandScrolled, useBarScrolled } from "./ward-bar-scroll";
import {
  PhoneMenuEntry,
  WardBarBack,
  WardBarDrawerTriggers,
  WardBarPrimaryAction,
  WardBarServiceSelector,
} from "./ward-bar-controls";
import { WardBarActivityBody } from "./ward-bar-activity";
import styles from "./ward-bar.module.css";

// Moved to `ward-bar-model.ts`; re-exported so existing importers keep working.
export { drawerCloseHistoryStep, isPendingNavigation };

/**
 * Ward Flow's third-edition bar (`docs/ward-flow/plans/2026-09-10-third-edition-build-master-
 * plan.md` §1.3, item 1.1). Ported from `design/third-edition-mockups/command-third-edition.html`'s
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
 * - **The three drawers' modal chrome** is `<Sheet placement="right">` (`@/components/wf/sheet`)
 *   — this codebase's established accessible dialog: focus trap via `inert` on the rest of the
 *   page (not a hand-rolled Tab-cycle), Escape-closes, backdrop-click-closes, and focus returned
 *   to the trigger on close. It is already used across the app for exactly this shape of overlay.
 *   A hand-rolled trap here would duplicate `sheet-focus.ts`'s tested stacking/inert logic with
 *   worse odds of getting it right.
 * - **Tasks drawer content** is `WardTasksDrawer` (`../ward-tasks-drawer.tsx`) unchanged, fed by
 *   `buildActionInbox` — the same acknowledge/complete/reopen list the second-edition chrome
 *   already showed. It draws its own header (`<h2>Tasks</h2>`, a count, a close button), so the
 *   `<Sheet>` wrapping it renders with `headerHidden` to avoid a second header.
 * - **Tools** is the one sheet in `../tools/ward-tools-sheet.tsx` (Tools review, 15 Oct 2026). It
 *   reuses the shared figures, catchment and contact mappings, with the demo controls in one panel.
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
 *   §8.6 already uses for "Export the queue" (`design/third-edition-mockups/command-third-edition.html`'s
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
 *      confirms verbatim in its own `escape()` (`design/third-edition-mockups/command-third-edition.html`,
 *      not the earlier `third-edition-kit/shell/shell-script.js` draft, which still cleared it —
 *      see that file's own SHELL-NOTES.md for the same discrepancy, resolved by the newer file).
 *
 * Page-specific Escape steps the drawing's own order also walks (a ward selection, a referral
 * subject, a department filter) belong to each host page's own domain state, which this shared
 * bar has no access to — there is deliberately no extensibility seam for them here, because
 * nothing in this phase names what one would look like, and guessing at its shape is exactly the
 * kind of decision "stop and hand it back" exists for.
 */

/*
 * The ward appearance controls (Tools, rail, Settings, Community) are views over the app's ONE theme
 * switch in `@/lib/theme-client`. Before that the ward kept its own key while the rest of the app
 * kept another, so a ward pin could render the shell in one theme and the page in the other. Now
 * there is one stored preference and one writer, `setThemePreference`, which applies `data-theme`,
 * `.dark` and `theme-color` together and notifies every subscriber, in this tab and others.
 *
 * The ward names the follow-the-OS choice "auto"; the app names it "system". These two functions are
 * the only translation between them.
 */
function getAppearanceSnapshot(): WardAppearance {
  const preference = readStoredThemePreference();
  return preference === "system" ? "auto" : preference;
}

export const useAppearanceStore = createBrowserStore(
  subscribeThemePreference,
  getAppearanceSnapshot,
  "auto" as WardAppearance,
);

export function applyAppearance(next: WardAppearance) {
  setThemePreference(next === "auto" ? "system" : next);
}

/** Glare mode, a separate on/off preference with its own single writer in `@/lib/theme-client`. */
export const useGlareStore = createBrowserStore(subscribeGlarePreference, readStoredGlarePreference, false);

export function applyGlare(on: boolean) {
  setGlarePreference(on);
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

export function WardBar({ activity, primaryAction: pagePrimaryAction, onServiceChange }: WardBarProps) {
  const network = useWardNetwork();
  const thresholds = useDueSoonThresholds();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  // A1-17: the shared phone query, so the server's phone guess draws the phone bar first.
  const isPhone = useIsPhone();
  const primaryAction = phoneBarAction(pagePrimaryAction, isPhone);
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
    plannedAdmissions,
    inboxOwnership,
    inboxSnoozes,
    configuration,
    supportNotifications,
  } = useWardFlowSelect(
    "movements",
    "patients",
    "units",
    "admissions",
    "referrals",
    "rejections",
    "bedReleases",
    "leaveBeds",
    "refreshRequests",
    "notices",
    "dispatch",
    "inboxAcknowledgements",
    "inboxCompletions",
    "plannedAdmissions",
    "inboxOwnership",
    "inboxSnoozes",
    "configuration",
    "supportNotifications",
  );
  // Live ticking clock for waits, freshness lines, notice scoping, and recorded actions — not the
  // stale `now` on the main context value, which only updates when something else dispatches.
  const now = useWardFlowClock();
  // Phone Live chips read "Live HH:MM" from this one clock (v10 phone hero, `publishLiveClock`).
  const liveClockFace = formatInstant(now);
  useEffect(() => {
    publishLiveClock(liveClockFace);
  }, [liveClockFace]);
  useEffect(() => () => publishLiveClock(undefined), []);
  // The header is ready: press the panel button a reader tapped while it was still loading.
  useEffect(() => replayEarlyHeaderTap(), []);

  const { role, shellRole, placeId } = useWardNavCounts();
  // One Alerts queue (Josh, 16 Oct 2026): the Tasks button is the Alerts button. On the Alerts
  // screen it does not open a second copy of the list; it takes the person to the queue.
  // Only for the desk whose list it is (the bed coordinator, as the task gate below) and whose role
  // may open the Alerts screen. Other desks keep Tasks and its "Bed coordinator's list" empty state.
  const accessNav = useAccessNavFilter();
  const alertsScreenOpen = accessNav(ALERTS_ACCESS_ENTRY).length > 0;
  const alertsQueueForDesk = wardTasksAreActionableForRole(shellRole);
  const oneAlertsQueue = alertsScreenOpen && alertsQueueForDesk;
  const path = pathname.replace(/\/+$/u, "");
  const onAlertsScreen = oneAlertsQueue && path === WARD_ALERTS_HREF;
  const onPatientsPage = path === patientSearchHref();
  const roleCategory = roleReferralCategory(role);
  const checksPublication = useWardChecks();

  const [openPanel, setOpenPanel] = useState<WardBarPopoverId | null>(null);
  // The latest open panel for event callbacks that must announce a close once, outside a state updater.
  const openPanelRef = useRef<WardBarPopoverId | null>(null);
  useEffect(() => {
    openPanelRef.current = openPanel;
  }, [openPanel]);
  // A history Back is asynchronous. Keep the drawer identity here so repeated closes are
  // ignored and a delayed popstate cannot close a drawer opened in the meantime.
  const closingViaHistoryRef = useRef<{ id: WardBarPopoverId; announce: boolean } | null>(null);
  const [referralRequest, setReferralRequest] = useState<ReferralOpenRequest>({ id: 0, category: "ward" });
  // The slide-out fills this with its guarded close, which asks before discarding a draft.
  const referralCloseRef = useRef<(() => void) | null>(null);
  // `ward-service-store.ts` — a `sessionStorage`-backed module store, not component-local state, so
  // the choice survives a remount (a route change unmounts and remounts this bar) and stays in sync
  // with any other reader (`WardRail`, a future scoped screen) in the same tab. See that file's own
  // header for why `sessionStorage` rather than `localStorage`, and why a storage throw still works.
  const service = useServiceScope();
  const [toolsOpenRequest, setToolsOpenRequest] = useState<{ tool: ToolsSheetToolId; seq: number } | undefined>();
  const toolsReturnFocusRef = useRef<HTMLElement | null>(null);
  const clearToolsOpenRequest = useCallback(() => setToolsOpenRequest(undefined), []);
  useEffect(
    () =>
      subscribeToolsTool((tool, returnFocus) => {
        // A Board time pill opens Tools at Demo; closing Tools goes back to that pill.
        toolsReturnFocusRef.current = returnFocus ?? null;
        setToolsOpenRequest((current) => ({ tool, seq: (current?.seq ?? 0) + 1 }));
      }),
    [],
  );
  const [activityQuery, setActivityQuery] = useState("");
  const deferredActivityQuery = useDeferredValue(activityQuery);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [activityPart, setActivityPart] = useState<ActivityPart>("activity");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<ActivityCategoryFilter>("all");

  const serviceTriggerRef = useRef<HTMLButtonElement>(null);
  const primaryTriggerRef = useRef<HTMLButtonElement>(null);
  const activityTriggerRef = useRef<HTMLButtonElement>(null);
  const tasksTriggerRef = useRef<HTMLButtonElement>(null);
  const toolsTriggerRef = useRef<HTMLButtonElement>(null);
  // Phone: Activity and Tools open from the Menu sheet, so focus returns to the Menu button.
  const phoneMenuRef = useRef<HTMLButtonElement>(null);
  // On a phone drill-down Back replaces Menu, so focus returns to whichever of the two is showing.
  const phoneBackRef = useRef<HTMLButtonElement>(null);
  const phoneReturnTarget = useMemo<RefObject<HTMLButtonElement | null>>(
    () => ({
      get current() {
        const back = phoneBackRef.current;
        return isPhone && back?.isConnected ? back : phoneMenuRef.current;
      },
    }),
    [isPhone],
  );
  // Read when Tools closes: the Board time pill that opened it, else the button that opens Tools.
  const toolsReturnTarget = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        // A pill that has left the page cannot take focus, so fall back to the Tools button.
        const pill = toolsReturnFocusRef.current;
        if (pill?.isConnected) return pill;
        return isPhone ? phoneReturnTarget.current : toolsTriggerRef.current;
      },
    }),
    [isPhone, phoneReturnTarget],
  );
  const referralReturnFocusRef = useRef<HTMLElement>(null);
  const servicePanelRef = useRef<HTMLDivElement>(null);
  const primaryPanelRef = useRef<HTMLDivElement>(null);

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
  const routeTitle = wardBarRouteTitle(pathname, place, isPhone);
  // Back (Josh, 20 Oct 2026): drill-down screens lead with Back; rail and dock pages keep Menu.
  const deskHomeHref = useDeskHomeHref();
  const backHref = wardBackParent(pathname, deskHomeHref);
  useEffect(() => noteWardRoute(pathname), [pathname]);

  // ⚠️ Audit finding STILL-06 (ward-flow-task-ledger.md §6.3 item 5, 2026-09-16): `buildActionInbox` returns the WHOLE network's
  // outstanding work, and `ACKNOWLEDGE_INBOX_ITEM`/`COMPLETE_INBOX_ITEM`/`REOPEN_INBOX_ITEM` are all
  // `EVENT_ROLE`-gated to `"coordinator"` alone (`ward-flow-events.ts`). `WardTasksDrawer` trusts its
  // caller and does not re-check role before dispatching (its own doc comment says so), so this is
  // the one place that must gate — `wardTasksAreActionableForRole` exists in `ward-chrome-role.ts`
  // for exactly this call. A ward/ED/officer route gets an empty inbox: zero badge, and the drawer's
  // own "No outstanding work right now." empty state, never a network list with every action refused.
  // Device audit item 6 (11 Oct 2026): Tasks is the signed-in person's count on every page, so it
  // is gated on `shellRole`, not the route — it no longer drops to 0 on ED, team and officer pages.
  // L1 (site review, 12 Oct 2026): the one task list (`taskItems`, `ward-act-now-items.ts`) that
  // Alerts and Home Exceptions read too, so the badge and those lists cannot disagree.
  // The quick look is the Alerts list for the bed coordinator, so it words a stuck handover as the
  // Alerts screen does (same rows, tones and counts either way).
  const tasksItems = useMemo(() => {
    if (!wardTasksAreActionableForRole(shellRole)) return [];
    return taskItems(
      {
        movements,
        units,
        configuration,
        inboxSnoozes,
        admissions,
        patients,
        referrals,
        supportNotifications,
        plannedAdmissions,
        leaveBeds,
        stuckHandoverMinutes: configuration.transportBookedTargetMinutes,
      },
      now,
    );
  }, [
    movements,
    now,
    units,
    shellRole,
    plannedAdmissions,
    admissions,
    patients,
    referrals,
    supportNotifications,
    configuration,
    inboxSnoozes,
    leaveBeds,
  ]);
  // Snoozed rows stay in the drawer's own Snoozed section and leave the badge until they return.
  const tasksActiveItems = useMemo(
    () => partitionSnoozed(tasksItems, inboxSnoozes, now).active,
    [tasksItems, inboxSnoozes, now],
  );
  const tasksActiveCount = tasksActiveItems.length;
  /*
   * Josh (13 Oct 2026, iPhone): the phone New referral sheet starts under the bar, so the bar stays
   * on screen, but the sheet inerted the whole page and Menu and Search could not be tapped. While
   * that sheet is open on a phone, Menu and Search opt out of the sheet's background inert; Menu
   * opens its own sheet on top and the referral, with everything typed, stays open beneath.
   */
  const headerLiveOverSheet = isPhone && openPanel === "referral";
  /**
   * The Service selector's own "{n} waiting" counts. L1 (site review, 12 Oct 2026): this used to
   * count every open movement that touched a service (origin ED or any ward asked), so a person
   * referred across services counted twice: "All services 70 open" over services adding to 97,
   * and East Metro 43 here against 35 on Network. It now reads `waitingInEds`
   * (`ward-shared-figures.ts`), the figure Home's hero and Network print: people waiting in each
   * service's emergency departments. A person waits in one department, so the services add up to
   * All services.
   */
  const waiting = useMemo(() => waitingInEds(movements, now), [movements, now]);
  const commandActivity = useMemo(
    () =>
      deriveCommandActivity({
        movements,
        patients,
        units,
        referrals,
        rejections,
        bedReleases,
        admissions,
        leaveBeds,
        refreshRequests,
        now,
        sites: network.sites,
        thresholds,
      }),
    [
      movements,
      patients,
      units,
      referrals,
      rejections,
      bedReleases,
      admissions,
      leaveBeds,
      refreshRequests,
      now,
      thresholds,
      network,
    ],
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
    const query = deferredActivityQuery.trim().toLowerCase();
    return changes.filter(
      (change) =>
        (activityCategoryFilter === "all" || activityChangeCategory(change) === activityCategoryFilter) &&
        `${change.text} ${change.time}`.toLowerCase().includes(query),
    );
  }, [shownActivity?.changes, activityCategoryFilter, deferredActivityQuery]);
  const scopedNotices = useMemo(
    () =>
      notices
        .filter((notice) => noticeIsForWardChrome(notice, role, placeId, now))
        .sort((left, right) => right.raisedAt - left.raisedAt),
    [notices, now, placeId, role],
  );
  // D-39: a notice names the patient by UMRN, never by the WF journey number it was raised on.
  const umrnLookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const noticeText = (sentence: string) => withUmrnInPlaceOfMovementIds(sentence, umrnLookup);
  const visibleNotices = scopedNotices.filter(
    (notice) =>
      (!unreadOnly || notice.readAt === undefined) &&
      noticeText(notice.sentence).toLowerCase().includes(deferredActivityQuery.trim().toLowerCase()),
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

  const closePopover = useCallback(
    (id: WardBarPopoverId, announce = true) => {
      // Do not issue another Back while the first one is still waiting for popstate.
      if (closingViaHistoryRef.current !== null) return;
      if (typeof window === "undefined" || !window.history) {
        setOpenPanel((current) => (current === id ? null : current));
        if (announce) announceToWardShell("Closed.");
        return;
      }
      const step = drawerCloseHistoryStep({
        drawerEntryIsCurrent: Boolean(window.history.state?.wardDrawer),
        navigationPending: navigationPendingRef.current,
        canGoBack: typeof window.history.back === "function",
      });
      if (step === "back") {
        // Keep the sheet and its background lock until popstate completes the close.
        closingViaHistoryRef.current = { id, announce };
        window.history.back();
      } else {
        setOpenPanel((current) => (current === id ? null : current));
        if (announce) announceToWardShell("Closed.");
        if (step === "clear") {
          const nextState = { ...window.history.state };
          delete nextState.wardDrawer;
          window.history.replaceState(nextState, "");
        }
      }
      // Used once: a link whose own handler stopped the page change (a menu that opens a drawer
      // instead) must not keep later closes from stepping back.
      navigationPendingRef.current = false;
    },
    [setOpenPanel],
  );

  const openPopover = useCallback(
    (id: WardBarPopoverId) => {
      // An ordinary open returns focus to the Tools button; a Board time pill sets its own after this.
      if (id === "tools") toolsReturnFocusRef.current = null;
      // One Alerts queue: a phone opens the Alerts screen rather than a drawer copy of it, and the
      // Alerts screen itself moves focus to its own queue. Covers the dock, the menu and search.
      if (id === "tasks" && oneAlertsQueue && (isPhone || onAlertsScreen)) {
        if (onAlertsScreen) focusAlertsQueue(tasksActiveCount);
        else {
          // The referral sheet can persist across routes; close it through the normal lifecycle
          // before sending the person to Alerts.
          if (openPanel !== null) {
            navigationPendingRef.current = true;
            closePopover(openPanel, false);
          }
          router.push(WARD_ALERTS_HREF);
        }
        return;
      }
      // A replacement open must wait for the pending Back; otherwise its popstate would
      // be indistinguishable from the drawer that initiated the close.
      if (closingViaHistoryRef.current !== null) return;
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
        announceToWardShell(
          oneAlertsQueue
            ? `Alerts opened. ${tasksActiveCount} invented alerts outstanding.`
            : `Tasks opened. ${tasksActiveCount} invented tasks outstanding.`,
        );
      } else if (id === "tools") {
        announceToWardShell("Tools opened. Quick actions, look ups, print and share, and demo controls are here.");
      } else if (id === "referral") {
        announceToWardShell("Referral drawer opened. Statewide psychiatric bed placement engine.");
      }
      // No opening announcement for the Service selector — the standard's §7.4 list of the shell's
      // fixed sentences names an announcement for CHOOSING or CLEARING a service, never for opening
      // the selector itself.
    },
    [
      closePopover,
      isPhone,
      onAlertsScreen,
      oneAlertsQueue,
      openPanel,
      router,
      scopedNotices.length,
      setOpenPanel,
      shownActivity?.changes.length,
      tasksActiveCount,
    ],
  );

  /**
   * Opens the referral slide-out with `request`. Every open gets a new id, so the slide-out mounts
   * fresh with what this open asked for. `returnFocus` is where focus goes when it closes.
   */
  const openReferral = useCallback(
    (request: ReferralSheetRequest, returnFocus: HTMLElement | null) => {
      setReferralRequest((current) => ({ ...request, id: current.id + 1 }));
      referralReturnFocusRef.current = returnFocus;
      openPopover("referral");
    },
    [openPopover],
  );

  /** Closing on the slide-out route settles the URL on the Referrals board it sits over. */
  const closeReferral = useCallback(() => {
    if (!isReferralSheetPath(pathname)) {
      closePopover("referral");
      return;
    }
    // The page changes next, so closing must not step back through history first.
    navigationPendingRef.current = true;
    closePopover("referral");
    startTransition(() => {
      router.replace(REFERRAL_BOARD_HREF);
    });
  }, [closePopover, pathname, router]);

  // Arriving on the slide-out route (a typed URL, a new tab, a router push) opens the slide-out once,
  // over the Referrals board, with what the query asks for. No history entry: Back leaves the page.
  const routeReferralOpenedRef = useRef(false);
  useEffect(() => {
    if (!isReferralSheetPath(pathname)) {
      routeReferralOpenedRef.current = false;
      return undefined;
    }
    if (routeReferralOpenedRef.current) return undefined;
    routeReferralOpenedRef.current = true;
    const search = new URLSearchParams(window.location.search);
    const request = withRoleCategory(referralSheetRequestFromSearch(search), search, roleCategory);
    let opened = false;
    const frame = window.requestAnimationFrame(() => {
      opened = true;
      setReferralRequest((current) => ({ ...request, id: current.id + 1 }));
      referralReturnFocusRef.current = null;
      setOpenPanel("referral");
      announceToWardShell("Referral drawer opened. Statewide psychiatric bed placement engine.");
    });
    return () => {
      window.cancelAnimationFrame(frame);
      // Not yet opened (a Strict Mode re-run, say): let the next run open it. Once open, never again.
      if (!opened) routeReferralOpenedRef.current = false;
    };
  }, [pathname, roleCategory]);

  // Every link to the slide-out route — the patient page's Refer, the board's New referral, a search
  // preview, the rail — opens the slide-out in place instead of leaving the page. Capture phase on
  // window, so it runs before the link's own handler; `Link` does not navigate a prevented click.
  // Modified clicks (new tab or window) and the bar's own menu keep their ordinary behaviour.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (primaryPanelRef.current?.contains(anchor)) return;
      const request = referralSheetRequestFromHref(anchor.href, window.location.origin);
      if (!request) return;
      event.preventDefault();
      event.stopPropagation();
      const search = new URL(anchor.href, window.location.origin).searchParams;
      openReferral(withRoleCategory(request, search, roleCategory), anchor);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [openReferral, roleCategory]);

  useEffect(() => {
    function onHistoryTraversalCancelled() {
      // Capture kept the panel open and restored its entry. The pending Back is finished,
      // so a later close may try again without approving any other dirty form.
      closingViaHistoryRef.current = null;
    }
    function onPopState() {
      const closing = closingViaHistoryRef.current;
      if (closing !== null) {
        // Only the drawer that initiated Back may be closed by its delayed event, and it keeps
        // the caller's choice not to announce (a service pick announces its own confirmation).
        closingViaHistoryRef.current = null;
        if (openPanel !== closing.id) return;
        setOpenPanel(null);
        if (closing.announce) announceToWardShell("Closed.");
        return;
      }
      if (openPanel === null) return;
      setOpenPanel(null);
      // Announce in the event, outside React's state updater/render phase.
      announceToWardShell("Closed.");
    }
    window.addEventListener(WARD_HISTORY_TRAVERSAL_CANCELLED, onHistoryTraversalCancelled);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener(WARD_HISTORY_TRAVERSAL_CANCELLED, onHistoryTraversalCancelled);
      window.removeEventListener("popstate", onPopState);
    };
  }, [openPanel]);

  useEffect(() => {
    const unsubOpen = subscribeWardDrawer((drawerId, href) => {
      if (drawerId === "referral") {
        const opener = document.activeElement;
        // A button that raises a referral from where it sits (ED, community team, Home) passes the
        // same link a Refer link would, so the slide-out opens prefilled from that place.
        const request = href ? referralSheetRequestFromHref(href, window.location.origin) : null;
        const search = href ? new URL(href, window.location.origin).searchParams : null;
        openReferral(
          request && search ? withRoleCategory(request, search, roleCategory) : { category: roleCategory },
          opener instanceof HTMLElement ? opener : null,
        );
        return;
      }
      openPopover(drawerId);
    });
    const unsubClose = subscribeWardDrawerClose(() => {
      // The rail's Escape reaches here before the Sheet's own Escape handler. Any open Sheet
      // drawer ("activity", "tasks", "tools", "referral") leaves Escape to that handler so
      // history.back() and closingViaHistoryRef stay in sync (and an unsent referral draft asks).
      if (referralCloseRef.current || hasOpenSheet()) return;
      // Announced once, from the event: a state updater may run more than once.
      const wasOpen = openPanelRef.current !== null;
      setOpenPanel(null);
      if (wasOpen) announceToWardShell("Closed.");
    });
    return () => {
      unsubOpen();
      unsubClose();
    };
  }, [openPopover, openReferral, roleCategory]);

  const selectService = useCallback(
    (next: HealthService | null) => {
      closePopover("service", false);
      serviceTriggerRef.current?.focus();
      // DA-14 (design audit): a new service redraws the whole page, about 260 ms on a slow phone,
      // and the store is read through useSyncExternalStore, so a transition cannot defer it. The
      // write waits for the next frame and then one more task, so the browser paints the tap and
      // the closing panel before the redraw starts (a bare zero timer can run before any paint).
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          setServiceScope(next);
          onServiceChange?.(next);
        }, 0);
      });
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
    (movementId: string, action?: "refer" | "contact", href?: string) => {
      const globalWindow =
        typeof window !== "undefined"
          ? (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean })
          : null;
      if (globalWindow?.__wardFlowConfirmNavigation && !globalWindow.__wardFlowConfirmNavigation()) return;
      // A task row is an in-drawer navigation affordance. Close the Sheet in the same event before
      // routing so its portal cannot remain over the destination while the new page mounts.
      setOpenPanel(null);
      if (typeof window !== "undefined" && window.history && window.history.state?.wardDrawer) {
        const nextState = { ...window.history.state };
        delete nextState.wardDrawer;
        window.history.replaceState(nextState, "");
      }
      startTransition(() => {
        router.push(
          href ??
            `${movementHref(movementId)}${action ? `?taskAction=${action}#${action === "refer" ? "patient-operations" : "pnTabs"}` : ""}`,
        );
      });
    },
    [router, setOpenPanel],
  );

  // A discharge notification task opens the stay's checklist on the discharges board.
  const openDischarge = useCallback(
    (admissionId: string) => {
      const globalWindow =
        typeof window !== "undefined"
          ? (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean })
          : null;
      if (globalWindow?.__wardFlowConfirmNavigation && !globalWindow.__wardFlowConfirmNavigation()) return;
      setOpenPanel(null);
      if (typeof window !== "undefined" && window.history && window.history.state?.wardDrawer) {
        const nextState = { ...window.history.state };
        delete nextState.wardDrawer;
        window.history.replaceState(nextState, "");
      }
      startTransition(() => {
        router.push(dischargeHref(admissionId));
      });
    },
    [router, setOpenPanel],
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
      // The phone service sheet's scrim closes it on its own click, so the tap never reaches the page.
      if (target instanceof Element && target.closest("[data-ward-service-scrim]")) return;
      closePopover(activePanel, false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [closePopover, openPanel]);

  // shell-23 (13 Oct 2026): on a phone the service sheet is a real popup like Menu and Create. It
  // joins the shared sheet stack, so the page behind is inert, and focus moves to the chosen service.
  // Its scrim opts out of that inert so a tap on it still closes the sheet. Desktop keeps its menu.
  useEffect(() => {
    if (!isPhone || openPanel !== "service") return;
    const sheetId = "ward-bar-service-sheet";
    const panel = servicePanelRef.current;
    const trigger = serviceTriggerRef.current;
    pushSheet(sheetId, panel);
    panel?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    // Tab and Shift+Tab stay inside the sheet, as Sheet's own trap does.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panel || !isTopmostSheet(sheetId)) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]):not([tabindex="-1"])'),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next =
        index === -1
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      event.preventDefault();
      focusable[next].focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      popSheet(sheetId);
      // Back to the Service button once the sheet is gone and the page is no longer inert, however
      // it closed (scrim, Escape or a choice), unless focus has already moved somewhere real.
      window.requestAnimationFrame(() => {
        const active = document.activeElement;
        const lost = active === null || active === document.body || !active.isConnected || panel?.contains(active);
        if (lost && trigger?.isConnected && canRestoreFocusTo(trigger)) trigger.focus();
      });
    };
  }, [isPhone, openPanel]);

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
      if (hasOpenSheet()) return;
      if (service !== null) {
        // Exact wording, build plan §3 "Escape": now that S2 wires the choice to a real store, the
        // old "not wired" clause is false — the fixed alternative is telling the owner what widening
        // the lists actually takes (choose Statewide), not that the feature does not exist yet.
        announceToWardShell(
          `Nothing more to clear. The service stays ${service}. Choose Statewide in the selector to widen the lists.`,
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
  const fixedService = useMemo<HealthService | undefined>(
    () => fixedServiceFor(pathname, place, units),
    [pathname, place, units],
  );

  const isFixedJurisdiction = fixedService !== undefined;
  const activeService = isFixedJurisdiction ? fixedService : service;
  const activeSwatchKey = activeService ? (SERVICE_SWATCH_KEY[activeService] ?? "statewide") : "statewide";
  const activeServiceBadgeLabel = activeService ?? "Statewide";
  const activityHasUnread = unreadNoticeCount > 0;

  // A page that opens on the shared Hero bands the header (v10 7.1). On phone the lean bar sits in
  // hero ink at rest and hands over to its own solid scrolled face (v10 Home mockup, 11 Oct 2026).
  const barRef = useRef<HTMLElement>(null);
  const barScrolled = useBarScrolled(barRef, isPhone);
  const bandHero = useWfBandActive();
  const bandScrolled = useBandScrolled(barRef, bandHero && !isPhone);
  const bandState = !bandHero
    ? undefined
    : isPhone
      ? barScrolled
        ? undefined
        : "ink"
      : bandScrolled
        ? "light"
        : "ink";
  // Phone only: the condensed bar's live line, the open movements in the current scope.
  const allWaitingCount = waiting.total;
  const scopeWaitingCount = activeService
    ? (waiting.byService.get(activeService as HealthService) ?? 0)
    : allWaitingCount;

  return (
    <header
      ref={barRef}
      className={styles.bar}
      aria-label="Header"
      data-testid="ward-bar"
      data-wf-bar=""
      data-band={bandState}
      data-long-title={routeTitle.length > 17 || undefined}
      data-scrolled={barScrolled || undefined}
    >
      {/* Phone (Josh, 10 Oct 2026, locked lean bar): Menu, title over the service line, Search, Tasks. */}
      <PhoneMenuEntry
        backHref={backHref}
        menuRef={phoneMenuRef}
        backRef={phoneBackRef}
        returnFocusRef={phoneReturnTarget}
        tasksCount={tasksActiveCount}
        activityUnread={unreadNoticeCount}
        roleCategory={roleCategory}
        onOpenDrawer={openPopover}
        onOpenReferral={openReferral}
        liveOverSheet={headerLiveOverSheet}
      />
      {/* Device audit (11 Oct 2026): on the phone the whole title block is the service control's
          tap target, not only the 91 x 18 service line. A tap on the title forwards to the service
          button, which stays the one keyboard and screen-reader control; taps inside the button's
          own container (the button itself, the sheet and its scrim) are left to it. */}
      {backHref ? <WardBarBack parentHref={backHref} phone={false} /> : null}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the row click is a pointer shortcut, and its own button is the keyboard route */}
      <div
        className={styles.title}
        onClick={
          isPhone
            ? (event) => {
                if ((event.target as Element).closest(`.${styles.scopeBadgeContainer}`)) return;
                serviceTriggerRef.current?.click();
              }
            : undefined
        }
      >
        <div className={styles.titleGroup}>
          <span
            className={styles.place}
            data-testid={place ? "ward-bar-place" : "ward-bar-route-title"}
            title={routeTitle}
          >
            {routeTitle}
          </span>
        </div>

        <WardBarServiceSelector
          serviceTriggerRef={serviceTriggerRef}
          servicePanelRef={servicePanelRef}
          activeSwatchKey={activeSwatchKey}
          isPhone={isPhone}
          bandState={bandState}
          isFixedJurisdiction={isFixedJurisdiction}
          openPanel={openPanel}
          activeService={activeService}
          activeServiceBadgeLabel={activeServiceBadgeLabel}
          routeTitle={routeTitle}
          closePopover={closePopover}
          openPopover={openPopover}
          scopeWaitingCount={scopeWaitingCount}
          service={service}
          selectService={selectService}
          allWaitingCount={allWaitingCount}
          waiting={waiting}
        />

        {/* A page's own header tools land here (`ward-bar-page-tools.tsx`). Empty on most pages. */}
        <div id={WARD_BAR_PAGE_TOOLS_ID} className={styles.pageTools} data-testid="ward-bar-page-tools" />

        {/* v10: the Prototype pill beside the service pill, in place of the Data mode bar. */}
        <WardDataModeSlot className={styles.dataMode} />

        {/* A7 (overall review, 20 Oct 2026): the demo clock's one place. It opens the demo
            controls in Tools; the rail no longer repeats it. At 1000px and below the bar has no
            room (CSS hides it): the tablet Menu sheet keeps its "Board time" line and phone page
            Live chips read the same time (`publishLiveClock` above). */}
        <WardDemoClockPopover
          className={styles.demoClock}
          testId="ward-bar-demo-clock"
          title={`Board time ${liveClockFace} AWST`}
          aria-label={`Board time ${liveClockFace} AWST`}
        >
          <span className={styles.demoClockDot} aria-hidden="true" />
          <span className={styles.demoClockLabel}>Board time</span>
          <span className={styles.demoClockTime}>{liveClockFace}</span>
          <span className={styles.demoClockTz}>AWST</span>
        </WardDemoClockPopover>

        <span
          className={styles.mark}
          title="Patient and flow data are synthetic; WA hospital sites and health-service names are real. Not approved for clinical use."
        >
          <span className={styles.markLong}>Synthetic </span>prototype
        </span>
      </div>

      <div className={styles.centerGroup}>
        {/* The Patients page has its own search box, which filters its list in place, so the header
            search steps aside there and the screen keeps one search (simpler screens review, A5). */}
        {onPatientsPage ? null : (
          <div
            className={styles.searchWrap}
            data-sheet-inert-skip={headerLiveOverSheet ? "" : undefined}
            onFocusCapture={() =>
              setOpenPanel((current) => (current === "service" || current === "primary" ? null : current))
            }
          >
            <WardGlobalSearch
              movements={movements}
              patients={patients}
              referrals={referrals}
              units={units}
              // shell-4: the same active list the Tasks badge counts, so "3 of N" agrees with it.
              tasks={tasksActiveItems}
              aboveSheets={headerLiveOverSheet}
              onSeeAllTasks={() => openPopover("tasks")}
              plannedAdmissions={plannedAdmissions}
              now={now}
              placeholder="Search"
            />
          </div>
        )}
      </div>

      <WardBarDrawerTriggers
        activityTriggerRef={activityTriggerRef}
        tasksTriggerRef={tasksTriggerRef}
        toolsTriggerRef={toolsTriggerRef}
        openPanel={openPanel}
        closePopover={closePopover}
        openPopover={openPopover}
        activityHasUnread={activityHasUnread}
        unreadNoticeCount={unreadNoticeCount}
        shownActivity={shownActivity}
        oneAlertsQueue={oneAlertsQueue}
        isPhone={isPhone}
        onAlertsScreen={onAlertsScreen}
        tasksActiveCount={tasksActiveCount}
      />

      {/*
       * ⚠️ **THE PRIMARY ACTION IS A SIBLING OF `.drawerTriggers`, NEVER A MEMBER OF IT, AND THAT
       * WAS MEASURED.** `.drawerTriggers` cannot shrink, so a primary inside it pushed the whole page
       * sideways at 375px (`ui-ward-statistics-journey.spec.ts`). As a direct child of `.bar` it
       * keeps its own place in the row and its labels collapse by the bar's container width.
       *
       * D-16, item 43: five kinds, three shapes. "none" and an absent `primaryAction` render nothing.
       * "new-referral" opens a menu of its three real destinations. The other three kinds open a
       * popover headed by their own label whose body reads exactly "Not wired in this prototype.",
       * and announce "<label> is not wired in this prototype." on first open. Never an `<a>`.
       *
       * v6 (7 Oct 2026): one primary split button. The caret sits in its own segment behind a fine
       * divider; the whole control still opens the same menu, so no action changed.
       */}
      <WardBarPrimaryAction
        primaryAction={primaryAction}
        primaryTriggerRef={primaryTriggerRef}
        primaryPanelRef={primaryPanelRef}
        openPanel={openPanel}
        closePopover={closePopover}
        openPopover={openPopover}
        openReferral={openReferral}
        roleCategory={roleCategory}
      />

      <Sheet
        id="ward-bar-activity-drawer"
        open={openPanel === "activity"}
        onClose={() => closePopover("activity")}
        title="Activity"
        headerLeading={
          <span className={styles.drawerTile} aria-hidden="true">
            <RotateCcwClock aria-hidden="true" className={styles.drawerHeadingIcon} strokeWidth={1.75} />
          </span>
        }
        headerActions={
          <kbd className={styles.escKbd} aria-hidden="true">
            Esc
          </kbd>
        }
        placement="right"
        testId="ward-bar-activity-sheet"
        returnFocusRef={isPhone ? phoneReturnTarget : activityTriggerRef}
        descriptionContent={
          isPhone ? (
            // v10 Activity sheet (phone): one quiet line, then the list.
            <p className={styles.activityFreshness} data-tone={activityTone}>
              <span>
                {unreadNoticeCount > 0 ? `${unreadNoticeCount} unread · ` : ""}
                {shownActivity?.changes.length ?? 0} events · newest first
              </span>
            </p>
          ) : (
            <p className={styles.activityFreshness} data-tone={activityTone}>
              <span>
                Synthetic state · demo time {formatInstant(now)}
                {lastActivityAt === undefined
                  ? " · no recorded event"
                  : ` · last event ${formatInstantWithDay(lastActivityAt, now)}`}
              </span>
            </p>
          )
        }
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetWide}`}
        headerClassName={styles.drawerHeader}
        titleClassName={styles.drawerTitle}
        closeButtonClassName={styles.drawerClose}
        bodyClassName={styles.drawerBody}
        footer={
          isPhone ? undefined : (
            <div className={styles.drawerFoot}>
              <span>Synthetic events · newest first</span>
              <WardDemoClockPopover>
                <span className={styles.footClock}>
                  Demo time <b>{formatInstant(now)}</b>
                </span>
              </WardDemoClockPopover>
            </div>
          )
        }
        footerClassName={styles.drawerFooter}
      >
        <WardBarActivityBody
          isPhone={isPhone}
          activityPart={activityPart}
          setActivityPart={setActivityPart}
          shownActivity={shownActivity}
          unreadNoticeCount={unreadNoticeCount}
          lastActivityAt={lastActivityAt}
          now={now}
          activityQuery={activityQuery}
          setActivityQuery={setActivityQuery}
          activityCategoryFilter={activityCategoryFilter}
          setActivityCategoryFilter={setActivityCategoryFilter}
          activityCategoryCounts={activityCategoryCounts}
          scopedNotices={scopedNotices}
          unreadOnly={unreadOnly}
          setUnreadOnly={setUnreadOnly}
          visibleNotices={visibleNotices}
          noticeText={noticeText}
          markNoticeRead={markNoticeRead}
          filteredActivityChanges={filteredActivityChanges}
          service={service}
          activityToneFor={activityToneFor}
          publishedChecks={publishedChecks}
          reconciledCheckCount={reconciledCheckCount}
          usesDerivedActivity={usesDerivedActivity}
          commandActivity={commandActivity}
          closePopover={closePopover}
        />
      </Sheet>

      <Sheet
        id="ward-bar-tasks-drawer"
        open={openPanel === "tasks"}
        onClose={() => closePopover("tasks")}
        ariaLabel={oneAlertsQueue ? "Alerts" : "Tasks"}
        headerHidden
        placement="right"
        testId="ward-bar-tasks-sheet"
        initialFocusRef={tasksInitialFocusRef}
        returnFocusRef={tasksTriggerRef}
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetTasks}`}
        bodyClassName={styles.tasksCarrierBody}
      >
        {openPanel === "tasks" ? (
          <div ref={setTasksBodyRef} className={styles.tasksBody}>
            <WardTasksDrawer
              items={tasksItems}
              acknowledgements={inboxAcknowledgements}
              completions={inboxCompletions}
              ownership={inboxOwnership}
              snoozes={inboxSnoozes}
              configuration={configuration}
              role={shellRole}
              now={now}
              dispatch={dispatch}
              onClose={() => closePopover("tasks")}
              onSelectMovement={openMovement}
              onSelectDischarge={openDischarge}
              records={{ movements, admissions, patients, referrals, units }}
              alertsScreenOpen={alertsScreenOpen}
              alertsQueueForDesk={alertsQueueForDesk}
            />
          </div>
        ) : null}
      </Sheet>

      <Sheet
        id="ward-bar-tools-drawer"
        open={openPanel === "tools"}
        onClose={() => closePopover("tools")}
        title="Tools"
        headerLeading={
          <span className={styles.drawerTile} aria-hidden="true">
            <Wrench aria-hidden="true" className={styles.drawerHeadingIcon} strokeWidth={1.75} />
          </span>
        }
        headerActions={
          <kbd className={styles.escKbd} aria-hidden="true">
            Esc
          </kbd>
        }
        descriptionContent={<p className={styles.activityFreshness}>Whole network</p>}
        placement="right"
        testId="ward-bar-tools-sheet"
        returnFocusRef={toolsReturnTarget}
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetWide}`}
        headerClassName={styles.drawerHeader}
        titleClassName={styles.drawerTitle}
        closeButtonClassName={styles.drawerClose}
        bodyClassName={styles.drawerBody}
        footer={
          <div className={styles.drawerFoot}>
            <span>Whole network · synthetic prototype</span>
            <WardDemoClockPopover>
              <span className={styles.footClock}>
                Demo time <b>{formatInstant(now)}</b>
              </span>
            </WardDemoClockPopover>
          </div>
        }
        footerClassName={styles.drawerFooter}
      >
        <WardToolsSheet
          isPhone={isPhone}
          roleLabel={CHROME_ROLE_LABELS[role]}
          onNavigate={() => closePopover("tools", false)}
          onNewReferral={(destination = "ward") =>
            openReferral(
              { category: roleCategory, destination },
              isPhone ? phoneReturnTarget.current : toolsTriggerRef.current,
            )
          }
          openRequest={toolsOpenRequest}
          onRequestHandled={clearToolsOpenRequest}
        />
      </Sheet>

      <Sheet
        id="ward-bar-referral-drawer"
        open={openPanel === "referral"}
        onClose={() => (referralCloseRef.current ? referralCloseRef.current() : closeReferral())}
        ariaLabel="Referrals"
        headerHidden
        placement="right"
        testId="ward-bar-referral-sheet"
        returnFocusRef={referralReturnFocusRef}
        desktopBackdropClassName={styles.drawerBackdrop}
        contentClassName={`${styles.drawerSheet} ${styles.drawerSheetReferral}`}
        bodyClassName={styles.referralCarrierBody}
      >
        {openPanel === "referral" ? (
          <WardReferralDrawer
            key={referralRequest.id}
            initialCategory={referralRequest.category}
            initialDestination={referralRequest.destination}
            initialPatientId={referralRequest.personId}
            initialOriginSiteCode={referralRequest.originSiteCode}
            initialSendingTeam={referralRequest.sendingTeam}
            initialUnitIds={referralRequest.unitIds}
            closeRequestRef={referralCloseRef}
            onClose={closeReferral}
          />
        ) : null}
      </Sheet>
    </header>
  );
}

/**
 * `layout.tsx`'s (`src/app/ward-flow/layout.tsx`) own mount of the bar, wired to
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
  return <WardBar {...props} primaryAction={routeBarAction(pathname)} />;
}
