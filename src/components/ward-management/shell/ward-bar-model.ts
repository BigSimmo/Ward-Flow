// The Ward Flow bar's pure parts, moved out of `ward-bar.tsx` to keep it under the line cap: its
// panel ids, Activity and Service tables, history and referral helpers, and the route title.
import type { WfTone } from "@/components/wf";
import type { Unit, HealthService } from "@/components/ward-management/ward-model";
import {
  WARD_ADD_PERSON_HREF,
  WARD_ALERTS_HREF,
  WARD_ED_HREF,
  WARD_HOME_HREF,
  WARD_NAV,
  WARD_NEW_REFERRAL_MENU,
  WARD_REFERRAL_INTAKE_HREF,
  WARD_VIEWS,
  resolveWardPrimaryAction,
} from "@/components/ward-management/ward-nav";
import { wardPlaceIdFor, type WardPlace } from "@/components/ward-management/ward-place";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import {
  edHealthService,
  SERVICE_SCOPED_SCREENS,
  unitHealthService,
} from "@/components/ward-management/ward-service-scope";
import {
  STATISTICS_COMPARE_HREF,
  STATISTICS_OVERVIEW_HREF,
} from "@/components/ward-management/statistics/statistics-sections";
import type {
  ReferralSheetCategory,
  ReferralSheetRequest,
} from "@/components/ward-management/referrals/referral-sheet-link";

import { announceToWardShell } from "./ward-live-region";
import { officerHref, onCallHref, settingsHref } from "./ward-facade";
import type { WardActivityCategory, WardPrimaryAction } from "./ward-shell-types";
import type { WardActivityEventTone } from "./ward-command-activity";

export type WardBarPopoverId = "service" | "primary" | "activity" | "tasks" | "tools" | "referral";
export type ActivityPart = "activity" | "tally";
export type ActivityCategoryFilter = "all" | Exclude<WardActivityCategory, "other">;

export const ACTIVITY_CATEGORY_CHIPS: { id: ActivityCategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "escalation", label: "Escalations" },
  { id: "decline", label: "Declines" },
  { id: "referral", label: "Referrals" },
  { id: "transfer", label: "Transfers" },
];

/** v6 rule 7: one glyph per tone. The word beside it carries the meaning. */
export const ACTIVITY_GLYPH: Record<WardActivityEventTone, WfTone> = {
  danger: "danger",
  warning: "warning",
  info: "info",
};

export const ACTIVITY_TONE_WORD: Record<WardActivityEventTone, string> = {
  danger: "Act now",
  warning: "Needs you",
  info: "Update",
};

export function activityChangeCategory(change: { category?: WardActivityCategory }): WardActivityCategory {
  return change.category ?? "other";
}

export const isDrawerPanel = (
  id: WardBarPopoverId | null,
): id is "activity" | "tasks" | "tools" | "referral" | "service" =>
  id === "activity" || id === "tasks" || id === "tools" || id === "referral" || id === "service";

export const SERVICE_SWATCH_KEY: Record<HealthService, "north" | "south" | "east" | "wachs" | "cahs" | "private"> = {
  "North Metro": "north",
  "South Metro": "south",
  "East Metro": "east",
  WACHS: "wachs",
  CAHS: "cahs",
  Private: "private",
};

/** What the service choice narrows, named from `SERVICE_SCOPED_SCREENS` so it cannot drift (D-e).
 *  Screen readers only: the painted note and its "scopes the lists" hint were removed at the
 *  owner's request (9 Oct 2026). */
const SERVICE_SCOPED_SCREEN_LIST =
  SERVICE_SCOPED_SCREENS.length > 1
    ? `${SERVICE_SCOPED_SCREENS.slice(0, -1).join(", ")} and ${SERVICE_SCOPED_SCREENS[SERVICE_SCOPED_SCREENS.length - 1]}`
    : SERVICE_SCOPED_SCREENS.join(", ");
/** The painted sheet line (shell-1, 13 Oct 2026): it used to promise "What every page and count
 *  shows", which most pages do not honour. It now names only the screens that read the choice. */
export const SERVICE_SCOPE_SHEET_LINE = `Narrows the ${SERVICE_SCOPED_SCREEN_LIST} lists`;
export const SERVICE_SCOPE_NOTE = `One service, or all of them. ${SERVICE_SCOPED_SCREEN_LIST} narrow${SERVICE_SCOPED_SCREENS.length === 1 ? "s" : ""} their lists to it. The bed shortlist, whole-network figures, the rail counts and the drawers do not. Each count is the people waiting in that service's emergency departments; a narrowed list also shows people referred to its wards.`;

/** The exact sentence standard §8.6 already uses for a drawn-and-not-wired control (D-16) — named
 *  in one place so the three "not wired" primary-action kinds and any future caller share the
 *  identical wording rather than each typing a close paraphrase. */
export const NOT_WIRED_SUFFIX = "is not wired in this prototype.";

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

/** The desktop bar keeps each page's own primary action; phone actions live in the phone menu. */
const NEW_REFERRAL_ACTION: WardPrimaryAction = {
  kind: "new-referral",
  label: "New referral",
  menu: WARD_NEW_REFERRAL_MENU,
};

export function phoneBarAction(action: WardPrimaryAction | undefined, phone: boolean): WardPrimaryAction | undefined {
  return phone ? undefined : action;
}

/**
 * The universal desktop header (Josh, 9 Oct 2026): "ensure that referral is on every single page".
 * A route with no action of its own, or a deliberate "none", shows New referral. A route with its
 * own primary (Record a decision, Contact a team, Export the figures) keeps it, so the bar still
 * holds one primary button.
 */
export function routeBarAction(pathname: string): WardPrimaryAction {
  const action = resolveWardPrimaryAction(pathname);
  // The intake route IS the open referral slide-out, so a second referral trigger stays off there.
  if (action?.kind === "none" && pathname.replace(/\/$/, "") === WARD_REFERRAL_INTAKE_HREF) return action;
  return action === undefined || action.kind === "none" ? NEW_REFERRAL_ACTION : action;
}

/** What the referral slide-out opens with. `id` changes on every open, so each open starts fresh. */
export type ReferralOpenRequest = ReferralSheetRequest & { readonly id: number };

/** Where a referral comes from when nothing else says: the current role's own side, else a ward. */
export function roleReferralCategory(role: string): ReferralSheetCategory {
  if (role === "ed") return "ed";
  if (role === "community") return "community";
  return "ward";
}

/** A link that names no `source` takes the role's side rather than the module's default. */
export function withRoleCategory(
  request: ReferralSheetRequest,
  search: URLSearchParams,
  category: ReferralSheetCategory,
): ReferralSheetRequest {
  return search.get("source")?.trim() ? request : { ...request, category };
}

/** The Referrals board the slide-out route sits over, read from the rail rather than retyped. */
export const REFERRAL_BOARD_HREF = WARD_NAV.find((item) => item.id === "referrals")?.href ?? WARD_HOME_HREF;

/**
 * The Alerts button on the Alerts screen: moves focus to the first row of the queue (or the queue
 * itself when it is empty) instead of opening the same list again in a drawer.
 */
export function focusAlertsQueue(openCount: number) {
  const focusQueue = () => {
    const target =
      // A snoozed row is not outstanding work, so focus lands on the first active row.
      document.querySelector<HTMLElement>('[data-alert-id]:not([data-snoozed]) [data-testid="ward-alerts-open"]') ??
      document.querySelector<HTMLElement>('section[aria-label="Alerts"]');
    if (target) {
      if (!target.matches("a, button") && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.scrollIntoView({ block: "nearest" });
      target.focus();
    }
    announceToWardShell(`You are on Alerts. ${openCount} invented alerts outstanding.`);
  };
  // Broadcast, Notices or History may be showing, with no queue rows mounted. Choose the Now tab
  // first and focus once it has drawn, so the section fallback is only for an empty queue.
  const nowTab = document.getElementById("alerts-tab-now");
  if (nowTab && nowTab.getAttribute("aria-selected") !== "true") {
    nowTab.click();
    requestAnimationFrame(focusQueue);
  } else {
    focusQueue();
  }
}

/** The Alerts screen as an access entry, to ask whether this desk's role may open it. */
export const ALERTS_ACCESS_ENTRY = [{ id: "alerts", href: WARD_ALERTS_HREF, label: "Alerts" }] as const;

export function isReferralSheetPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === WARD_REFERRAL_INTAKE_HREF;
}

/** The bar's title for the current route: on the phone the page itself, else the place or screen. */
export function wardBarRouteTitle(pathname: string, place: WardPlace | undefined, isPhone: boolean): string {
  // Phone (v10 mockup): the patient, movement and add pages name the page itself in the lean bar.
  const phoneRouteTitle = !isPhone
    ? undefined
    : pathname === WARD_ADD_PERSON_HREF
      ? "Add patient"
      : /^\/ward-flow\/people\/[^/]+\/?$/u.test(pathname)
        ? "Patient"
        : /^\/ward-flow\/movements\/[^/]+\/?$/u.test(pathname)
          ? "Movement"
          : // The statistics tab's own word, so the lean bar never mixes "Statistics compare" with "EDs".
            /^\/ward-flow\/statistics\/(services|wards|eds|teams|overview|compare)\/?$/u.test(pathname)
            ? (
                {
                  services: "Services",
                  wards: "Wards",
                  eds: "EDs",
                  teams: "Teams",
                  overview: "Overview",
                  compare: "Compare",
                } as const
              )[
                pathname.replace(/\/$/u, "").split("/").pop() as
                  "services" | "wards" | "eds" | "teams" | "overview" | "compare"
              ]
            : /^\/ward-flow\/statistics\/weekly\/?$/u.test(pathname)
              ? "Weekly"
              : place?.kind === "ward" && /\/answer\/?$/u.test(pathname)
                ? "Ward answer"
                : place?.kind === "ed"
                  ? // The short name ("RPH ED") fits the lean bar; the full name is in the hero.
                    edShortName(edById(wardPlaceIdFor(pathname) ?? "")) || place.name
                  : undefined;
  const routeTitle =
    phoneRouteTitle ??
    (/^\/ward-flow\/statistics\/ward\//u.test(pathname) ? "Ward statistics" : undefined) ??
    (/^\/ward-flow\/statistics\/ed\//u.test(pathname) ? "Emergency department statistics" : undefined) ??
    (/^\/ward-flow\/statistics\/community\//u.test(pathname) ? "Community statistics" : undefined) ??
    (/^\/ward-flow\/statistics\/service\//u.test(pathname) ? "Service statistics" : undefined) ??
    (/^\/ward-flow\/movements\/[^/]+\/?$/u.test(pathname) ? "Patient" : undefined) ??
    (pathname === WARD_ED_HREF ? "All EDs" : undefined) ??
    (pathname === settingsHref() ? "Settings" : undefined) ??
    (pathname === officerHref() ? "Transport" : undefined) ??
    (pathname === onCallHref() ? "On-call" : undefined) ??
    (/^\/ward-flow\/reports\/downtime\/?$/u.test(pathname) ? "Downtime pack" : undefined) ??
    (/^\/ward-flow\/reports\/chronology\/?$/u.test(pathname) ? "Patient chronology" : undefined) ??
    (pathname === WARD_ADD_PERSON_HREF ? "Add a patient" : undefined) ??
    (/^\/ward-flow\/people\/[^/]+\/?$/u.test(pathname) ? "Patient" : undefined) ??
    (place?.kind === "ward" && /\/answer\/?$/u.test(pathname) ? "Ward Answer" : undefined) ??
    (/^\/ward-flow\/board\//u.test(pathname) ? (place?.name ?? "Bed board") : undefined) ??
    place?.name ??
    [...WARD_VIEWS, ...WARD_NAV].find((entry) => entry.href === pathname)?.label ??
    (pathname === STATISTICS_OVERVIEW_HREF
      ? "Statistics overview"
      : pathname === STATISTICS_COMPARE_HREF
        ? "Statistics compare"
        : "Ward Flow");
  return routeTitle;
}

/** Fixed jurisdiction resolution for place-specific views: the service a ward or ED route sits in. */
export function fixedServiceFor(
  pathname: string,
  place: WardPlace | undefined,
  units: readonly Unit[],
): HealthService | undefined {
  if (place) {
    if (place.kind === "ward") {
      const unitMatch = /^\/ward-flow\/ward\/([^/]+)/.exec(pathname) ?? /^\/ward-flow\/board\/([^/]+)/.exec(pathname);
      const unitId = unitMatch ? decodeURIComponent(unitMatch[1]) : undefined;
      const currentUnit = unitId ? units.find((u) => u.id === unitId) : units.find((u) => u.name === place.name);
      if (currentUnit) return unitHealthService(currentUnit);
    }
    if (place.kind === "ed") {
      const edMatch = /^\/ward-flow\/ed\/([^/]+)/.exec(pathname);
      if (edMatch) return edHealthService(decodeURIComponent(edMatch[1]));
    }
    if (place.kind === "team") {
      return undefined;
    }
  }
  return undefined;
}
