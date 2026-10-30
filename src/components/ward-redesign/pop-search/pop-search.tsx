"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { wardTasksAreActionableForRole } from "@/components/ward-management/ward-chrome-role";
import { canDispatch } from "@/components/ward-management/ward-role-permissions";
import { useWardPartialDisplayHost } from "@/components/ward-management/ward-partial-view";
import { useAccessNavFilter, useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { useEffectiveWardAccess, useWardAccessSnapshot } from "@/components/ward-management/shell/ward-access-store";
import { ALERTS_ACCESS_ENTRY } from "@/components/ward-management/shell/ward-bar-model";
import { useWardBarTasks } from "@/components/ward-management/shell/ward-bar-state";
import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";

import { GlobalSearch } from "./global-search";

/** The app bar's own search box, found once the bar has drawn. */
function findBarSearch(): HTMLElement | null {
  return document.querySelector<HTMLElement>('header [data-testid="ward-global-search"]');
}

/**
 * The Search mock-up, drawn over its page. `page` is the page it opens over.
 *
 * The header's search is the real `WardGlobalSearch`, which cannot be changed at source, so this
 * draws the redesigned fork (`global-search.tsx`) in the same place in the app bar, with the same
 * props the bar gives it, and opens it on load as "/" does. The bar's own box is hidden while the
 * mock-up shows, and comes back when it closes.
 */
export function PopSearch({ page }: { page: ReactNode }) {
  const now = useWardFlowClock();
  const {
    movements,
    patients,
    units,
    admissions,
    referrals,
    plannedAdmissions,
    inboxSnoozes,
    configuration,
    supportNotifications,
    leaveBeds,
  } = useWardFlowSelect(
    "movements",
    "patients",
    "units",
    "admissions",
    "referrals",
    "plannedAdmissions",
    "inboxSnoozes",
    "configuration",
    "supportNotifications",
    "leaveBeds",
  );
  const { shellRole } = useWardNavCounts();
  const accessNav = useAccessNavFilter();
  const oneAlertsQueue = accessNav(ALERTS_ACCESS_ENTRY).length > 0 && wardTasksAreActionableForRole(shellRole);
  const { tasksActiveItems } = useWardBarTasks({
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
  });

  // The same permissions and lifetime the header's search wrapper gives it (`ward-global-search-lazy`).
  const desk = useEffectiveWardAccess();
  const access = useWardAccessSnapshot();
  const host = useWardPartialDisplayHost();
  const canOpenHref = useCanOpenHref();
  const canRunAction = useCallback(
    (action: "new-referral" | "add-patient" | "advance-clock") =>
      action === "advance-clock"
        ? desk.role === "coordinator"
        : desk.role !== "admin" &&
          canDispatch(desk.role, action === "new-referral" ? "RECEIVE_REFERRAL" : "ADD_PATIENT"),
    [desk.role],
  );
  const active = (until: number) => until > now;
  const accessLifetime =
    host.shared && host.accessContext === null
      ? null
      : JSON.stringify({
          shared: host.shared,
          context: host.accessContext,
          desk,
          openings: access.records.filter((record) => active(record.until)).map(({ id, until }) => [id, until]),
          covers: access.covers.filter((cover) => active(cover.until)).map(({ id, until }) => [id, until]),
        });

  // Take the bar's search slot once the bar has drawn, hiding the real box while the mock-up is up.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let frame = 0;
    let hidden: HTMLElement | null = null;
    const find = () => {
      const real = findBarSearch();
      if (!real?.parentElement) {
        frame = window.requestAnimationFrame(find);
        return;
      }
      hidden = real;
      real.style.display = "none";
      setSlot(real.parentElement);
    };
    find();
    return () => {
      window.cancelAnimationFrame(frame);
      if (hidden) hidden.style.display = "";
    };
  }, []);

  return (
    <>
      {page}
      {slot
        ? createPortal(
            <GlobalSearch
              key={accessLifetime ?? "unavailable"}
              openOnMount
              movements={movements}
              patients={patients}
              referrals={referrals}
              units={units}
              tasks={tasksActiveItems}
              onSeeAllTasks={() => openWardDrawer("tasks")}
              tasksAreAlerts={oneAlertsQueue}
              plannedAdmissions={plannedAdmissions}
              now={now}
              placeholder="Search"
              accessLifetime={accessLifetime}
              canOpenHref={canOpenHref}
              canRunAction={canRunAction}
            />,
            slot,
          )
        : null}
    </>
  );
}
