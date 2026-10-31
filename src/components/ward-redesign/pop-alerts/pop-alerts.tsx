"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { Sheet } from "@/components/wf/sheet";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { noticeIsForWardChrome, wardTasksAreActionableForRole } from "@/components/ward-management/ward-chrome-role";
import { useAccessNavFilter } from "@/components/ward-management/shell/ward-access";
import { ALERTS_ACCESS_ENTRY } from "@/components/ward-management/shell/ward-bar-model";
import { useWardBarTasks } from "@/components/ward-management/shell/ward-bar-state";
import { dischargeHref, movementHref } from "@/components/ward-management/shell/ward-facade";
import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";
import {
  NextAlertsTabs,
  openPageActivity,
  pageDrawsOwnActivity,
  type AlertsTab,
} from "@/components/ward-redesign/shell-next/next-bar-parts";

import { AlertsDrawer } from "./alerts-drawer";

const SHEET = '[data-testid="pop-alerts-sheet"]';
const BAR_ALERTS_BUTTON = '[data-testid="ward-bar-tasks-trigger"]';

/**
 * shell-next: Activity, chosen from the sheet's tabs, opens once this sheet has gone, the way the new
 * header's own tabs open it: the page's own Activity panel where the page draws one (Home), otherwise
 * the header's Activity panel. Focus goes back to the header's Alerts button, as it does there.
 */
function openActivityAfterSheet() {
  const started = performance.now();
  const step = () => {
    if (document.querySelector(SHEET) !== null && performance.now() - started < 1000) {
      requestAnimationFrame(step);
      return;
    }
    const alertsButton = document.querySelector<HTMLElement>(BAR_ALERTS_BUTTON);
    if (pageDrawsOwnActivity()) openPageActivity(alertsButton);
    else {
      alertsButton?.focus();
      openWardDrawer("activity");
    }
  };
  requestAnimationFrame(step);
}

/**
 * The Alerts drawer mock-up, drawn over its page. `page` is the page it opens over.
 *
 * The same Sheet and the same task list the app bar's bell opens (`WardBar`'s Tasks sheet and
 * `useWardBarTasks`), with the drawer body forked to `alerts-drawer.tsx` for the redesign: one filled
 * button (the most urgent row), same-kind alerts grouped, names surname first.
 */
export function PopAlerts({ page }: { page: ReactNode }) {
  const router = useRouter();
  const now = useWardFlowClock();
  const {
    movements,
    patients,
    units,
    admissions,
    referrals,
    dispatch,
    inboxAcknowledgements,
    inboxCompletions,
    plannedAdmissions,
    inboxOwnership,
    inboxSnoozes,
    configuration,
    supportNotifications,
    leaveBeds,
    notices,
  } = useWardFlowSelect(
    "movements",
    "patients",
    "units",
    "admissions",
    "referrals",
    "dispatch",
    "inboxAcknowledgements",
    "inboxCompletions",
    "plannedAdmissions",
    "inboxOwnership",
    "inboxSnoozes",
    "configuration",
    "supportNotifications",
    "leaveBeds",
    "notices",
  );
  const { shellRole, role, placeId } = useWardNavCounts();
  const accessNav = useAccessNavFilter();
  const alertsScreenOpen = accessNav(ALERTS_ACCESS_ENTRY).length > 0;
  const alertsQueueForDesk = wardTasksAreActionableForRole(shellRole);
  const { tasksItems, tasksActiveCount } = useWardBarTasks({
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

  // shell-next (30 Oct 2026): `?shell=next` draws the new header, whose Alerts panel has Alerts and
  // Activity tabs. Read as the preview shell reads it; the shareable copy has no search-params context.
  const nextShell =
    (useSearchParams()?.get("shell") ??
      (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("shell"))) === "next";
  // The unread notices the header counts on its Activity tab (`useWardBarActivity`).
  const unreadNotices = useMemo(
    () =>
      notices.filter((notice) => noticeIsForWardChrome(notice, role, placeId, now) && notice.readAt === undefined)
        .length,
    [notices, role, placeId, now],
  );

  const [open, setOpen] = useState(true);
  const chooseTab = useCallback((tab: AlertsTab) => {
    if (tab !== "activity") return;
    setOpen(false);
    openActivityAfterSheet();
  }, []);
  const dismissalGuardRef = useRef<(() => boolean) | null>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const setBodyRef = useCallback((node: HTMLDivElement | null) => {
    initialFocusRef.current = node?.querySelector<HTMLElement>("[data-sheet-autofocus]") ?? null;
  }, []);

  // The same routing as the app bar: a row opens its movement (or its own page), a discharge row its stay.
  const openMovement = useCallback(
    (movementId: string, action?: "refer" | "contact", href?: string) => {
      setOpen(false);
      startTransition(() => {
        router.push(
          href ??
            `${movementHref(movementId)}${action ? `?taskAction=${action}#${action === "refer" ? "patient-operations" : "pnTabs"}` : ""}`,
        );
      });
    },
    [router],
  );
  const openDischarge = useCallback(
    (admissionId: string) => {
      setOpen(false);
      startTransition(() => router.push(dischargeHref(admissionId)));
    },
    [router],
  );

  return (
    <>
      {page}
      <Sheet
        id="pop-alerts-drawer"
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Alerts"
        headerHidden
        placement="right"
        testId="pop-alerts-sheet"
        initialFocusRef={initialFocusRef}
        desktopBackdropClassName={barStyles.drawerBackdrop}
        contentClassName={`${barStyles.drawerSheet} ${barStyles.drawerSheetTasks}`}
        bodyClassName={barStyles.tasksCarrierBody}
      >
        {open && nextShell ? (
          <NextAlertsTabs
            current="alerts"
            alertsLabel={alertsScreenOpen && alertsQueueForDesk ? "Alerts" : "Tasks"}
            alertsCount={tasksActiveCount}
            unreadNotices={unreadNotices}
            onChoose={chooseTab}
          />
        ) : null}
        {open ? (
          <div ref={setBodyRef} className={barStyles.tasksBody}>
            <AlertsDrawer
              items={tasksItems}
              acknowledgements={inboxAcknowledgements}
              completions={inboxCompletions}
              ownership={inboxOwnership}
              snoozes={inboxSnoozes}
              configuration={configuration}
              role={shellRole}
              now={now}
              dispatch={dispatch}
              onClose={() => setOpen(false)}
              dismissalGuardRef={dismissalGuardRef}
              onSelectMovement={openMovement}
              onSelectDischarge={openDischarge}
              records={{ movements, admissions, patients, referrals, units }}
              alertsScreenOpen={alertsScreenOpen}
              alertsQueueForDesk={alertsQueueForDesk}
            />
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
