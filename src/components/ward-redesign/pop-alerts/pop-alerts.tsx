"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useRef, useState, type ReactNode } from "react";

import { Sheet } from "@/components/wf/sheet";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardNavCounts } from "@/components/ward-management/use-ward-nav-counts";
import { wardTasksAreActionableForRole } from "@/components/ward-management/ward-chrome-role";
import { useAccessNavFilter } from "@/components/ward-management/shell/ward-access";
import { ALERTS_ACCESS_ENTRY } from "@/components/ward-management/shell/ward-bar-model";
import { useWardBarTasks } from "@/components/ward-management/shell/ward-bar-state";
import { dischargeHref, movementHref } from "@/components/ward-management/shell/ward-facade";
import barStyles from "@/components/ward-management/shell/ward-bar.module.css";

import { AlertsDrawer } from "./alerts-drawer";

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
  );
  const { shellRole } = useWardNavCounts();
  const accessNav = useAccessNavFilter();
  const alertsScreenOpen = accessNav(ALERTS_ACCESS_ENTRY).length > 0;
  const alertsQueueForDesk = wardTasksAreActionableForRole(shellRole);
  const { tasksItems } = useWardBarTasks({
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

  const [open, setOpen] = useState(true);
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
