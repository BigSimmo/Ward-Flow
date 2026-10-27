"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { taskItems } from "@/components/ward-management/ward-act-now-items";
import {
  noticeIsForWardChrome,
  wardTasksAreActionableForRole,
  type WardChromeRole,
} from "@/components/ward-management/ward-chrome-role";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  useDueSoonThresholds,
  useWardFlowSelect,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";
import { resolveWardScreenTitle } from "@/components/ward-management/ward-nav";
import { withUmrnInPlaceOfMovementIds } from "@/components/ward-management/ward-patient-resolver";

import { deriveCommandActivity } from "./ward-command-activity";
import {
  activityChangeCategory,
  isPendingNavigation,
  type ActivityCategoryFilter,
  type ActivityPart,
} from "./ward-bar-model";
import type { WardActivityContent } from "./ward-shell-types";

/*
 * The bar's state that draws nothing: the Activity drawer's feed, notices and filters, the Tasks
 * list, and the pending-navigation flag. Moved out of `ward-bar.tsx` (H-0906, 27 Oct 2026) so that
 * file is the bar's layout and drawer wiring. Each hook body is the bar's own code, unchanged.
 */

type WardBarData = ReturnType<
  typeof useWardFlowSelect<
    | "movements"
    | "patients"
    | "units"
    | "admissions"
    | "referrals"
    | "rejections"
    | "bedReleases"
    | "leaveBeds"
    | "refreshRequests"
    | "notices"
    | "dispatch"
    | "plannedAdmissions"
    | "inboxSnoozes"
    | "configuration"
    | "supportNotifications"
  >
>;

/** The Tasks list (the Alerts queue for the bed coordinator), and its unsnoozed rows for the badge. */
export function useWardBarTasks({
  shellRole,
  now,
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
}: Pick<
  WardBarData,
  | "movements"
  | "units"
  | "configuration"
  | "inboxSnoozes"
  | "admissions"
  | "patients"
  | "referrals"
  | "supportNotifications"
  | "plannedAdmissions"
  | "leaveBeds"
> & { shellRole: WardChromeRole; now: Instant }) {
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
  return { tasksItems, tasksActiveItems, tasksActiveCount };
}

/** The Activity drawer: the page's tally (or Command's derived feed), its notices and its filters. */
export function useWardBarActivity({
  activity,
  pathname,
  role,
  placeId,
  now,
  movements,
  patients,
  units,
  referrals,
  rejections,
  bedReleases,
  admissions,
  leaveBeds,
  refreshRequests,
  notices,
  dispatch,
}: Pick<
  WardBarData,
  | "movements"
  | "patients"
  | "units"
  | "referrals"
  | "rejections"
  | "bedReleases"
  | "admissions"
  | "leaveBeds"
  | "refreshRequests"
  | "notices"
  | "dispatch"
> & {
  activity: WardActivityContent | undefined;
  pathname: string;
  role: WardChromeRole;
  placeId: string | undefined;
  now: Instant;
}) {
  const network = useWardNetwork();
  const thresholds = useDueSoonThresholds();
  const [activityQuery, setActivityQuery] = useState("");
  const deferredActivityQuery = useDeferredValue(activityQuery);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [activityPart, setActivityPart] = useState<ActivityPart>("activity");
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<ActivityCategoryFilter>("all");
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
  return {
    activityQuery,
    setActivityQuery,
    unreadOnly,
    setUnreadOnly,
    activityPart,
    setActivityPart,
    activityCategoryFilter,
    setActivityCategoryFilter,
    commandActivity,
    usesDerivedActivity,
    shownActivity,
    lastActivityAt,
    activityCategoryCounts,
    filteredActivityChanges,
    scopedNotices,
    noticeText,
    visibleNotices,
    unreadNoticeCount,
    markNoticeRead,
  };
}

/**
 * True from a chrome link click until its page arrives, so a drawer close in between does not step
 * back through history.
 */
export function useNavigationPendingRef(pathname: string) {
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
  return navigationPendingRef;
}
