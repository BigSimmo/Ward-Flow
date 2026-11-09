"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import { WARD_SHELL_ROLE, wardTasksAreActionableForRole } from "@/components/ward-management/ward-chrome-role";
import { useAccessShellRole } from "./ward-access-store";
import { useCanOpenHref } from "./ward-access";
import { movementHref, unitHref } from "./ward-facade";
import { alertsToShow, deskSeesStaffRequests, extraAlertAllowed, useAlertPreferences } from "./ward-alert-preferences";
import { openStaffRequests } from "@/components/ward-management/staffing/staff-requests";

import { activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import { minuteOfDay } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { navigateWithDirtyGuard } from "@/components/ward-management/use-dirty-state-guard";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";

import {
  notificationSupport,
  setActNowAppBadge,
  showActNowNotification,
  useActNowNotificationPreference,
} from "./ward-act-now-notifications";

/**
 * Sends a browser notification when a new act-now (red) alert appears in this tab, including an
 * overdue decision target. Renders nothing. The first reading is taken as the baseline, so opening
 * the app or turning the setting on never floods the screen with alerts that were already there.
 * Snoozed rows are off the active list; one that returns after its snooze counts as new. Also keeps
 * the installed app's icon badge at the act-now count, where the browser supports it.
 */
export function WardActNowNotifier() {
  const router = useRouter();
  // Same gate as the Tasks drawer (shell/ward-bar.tsx): the signed-in person's list, on every page.
  const shellRole = useAccessShellRole(WARD_SHELL_ROLE);
  const actionable = wardTasksAreActionableForRole(shellRole);
  // Item 20 (9 Nov 2026): this desk's choices on this device, and where a tap on one alert goes.
  const [preferences] = useAlertPreferences(shellRole);
  const {
    dueSoon: wantsDueSoon,
    quiet: { on: quietOn, start: quietStart, end: quietEnd },
  } = preferences;
  const canOpen = useCanOpenHref();
  const {
    movements,
    units,
    configuration,
    inboxSnoozes,
    sessionAdopted,
    worldGeneration,
    leaveBeds,
    admissions,
    patients,
    referrals,
    supportNotifications,
    plannedAdmissions,
    staffRequests,
  } = useWardFlowSelect(
    "movements",
    "units",
    "configuration",
    "inboxSnoozes",
    "sessionAdopted",
    "worldGeneration",
    "leaveBeds",
    "admissions",
    "patients",
    "referrals",
    "supportNotifications",
    "plannedAdmissions",
    "staffRequests",
  );
  const now = useWardFlowClock();
  const [enabled] = useActNowNotificationPreference();
  // The baseline belongs to one adopted world: the seed shown before a saved session is restored,
  // or a world that was reset, must not make every restored alert look new.
  const previous = useRef<{ generation: number; ids: Set<string> } | null>(null);

  const active = useMemo(() => {
    if (!actionable) return [];
    // Audit A3-1: with the stays and leave beds, so an absence on an order is pushed too. The bar's
    // task source exactly, so this reuses the bar's list rather than building another on every page
    // load (F-11); the extra records add only warning rows, which the act-now filter drops.
    return activeTaskItems(
      {
        movements,
        units,
        configuration,
        inboxSnoozes,
        leaveBeds,
        admissions,
        patients,
        referrals,
        supportNotifications,
        plannedAdmissions,
        stuckHandoverMinutes: configuration.transportBookedTargetMinutes,
      },
      now,
    );
  }, [
    actionable,
    movements,
    units,
    configuration,
    inboxSnoozes,
    leaveBeds,
    admissions,
    patients,
    referrals,
    supportNotifications,
    plannedAdmissions,
    now,
  ]);
  const actNow = useMemo(() => active.filter((item) => item.tone === "danger"), [active]);

  useEffect(() => {
    if (!sessionAdopted) {
      previous.current = null;
      return;
    }
    const prior = previous.current;
    previous.current = { generation: worldGeneration, ids: new Set(active.map((item) => item.id)) };
    if (prior === null || prior.generation !== worldGeneration || !enabled) return;
    const fresh = active.filter((item) => !prior.ids.has(item.id));
    const quiet = { on: quietOn, start: quietStart, end: quietEnd };
    const shown = alertsToShow(fresh, { dueSoon: wantsDueSoon, staffRequests: false, quiet }, minuteOfDay(now));
    // One tap opens the one alert's own page where this desk may open it; a batch opens Alerts.
    const open = (only: InboxItem | undefined) => {
      const target = only?.href ?? (only?.movementId ? movementHref(only.movementId) : undefined);
      const href = target !== undefined && canOpen(target) ? target : WARD_ALERTS_HREF;
      navigateWithDirtyGuard(() => router.push(href));
    };
    showActNowNotification(shown.actNow, open, "act-now");
    showActNowNotification(shown.dueSoon, open, "due-soon");
  }, [
    active,
    enabled,
    router,
    sessionAdopted,
    worldGeneration,
    wantsDueSoon,
    quietOn,
    quietStart,
    quietEnd,
    canOpen,
    now,
  ]);

  // Item 20 (9 Nov 2026): a new staff request from a ward, for desks that chose it. Quiet hours hold it.
  const wantsStaff = preferences.staffRequests && deskSeesStaffRequests(shellRole);
  const openStaff = useMemo(() => openStaffRequests({ staffRequests }, now), [staffRequests, now]);
  const staffSeen = useRef<{ generation: number; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!sessionAdopted) {
      staffSeen.current = null;
      return;
    }
    const prior = staffSeen.current;
    staffSeen.current = { generation: worldGeneration, ids: new Set(openStaff.map((record) => record.id)) };
    if (prior === null || prior.generation !== worldGeneration || !enabled || !wantsStaff) return;
    if (
      !extraAlertAllowed(minuteOfDay(now), {
        dueSoon: false,
        staffRequests: true,
        quiet: { on: quietOn, start: quietStart, end: quietEnd },
      })
    )
      return;
    const fresh = openStaff.filter((record) => !prior.ids.has(record.id));
    const [only] = fresh;
    if (!only || notificationSupport() !== "granted") return;
    try {
      // Ward and count only: never a patient. Tap opens the ward.
      const ward = units.find((unit) => unit.id === only.unitId)?.name ?? "A ward";
      const body = fresh.length === 1 ? `${ward} asked for more staff` : `${fresh.length} wards asked for more staff`;
      const notification = new window.Notification("Ward Flow: staff requested", {
        body: `${body}. Synthetic demo data.`,
        tag: "ward-flow-staff",
      });
      notification.onclick = () => {
        window.focus();
        const href = fresh.length === 1 ? unitHref(only.unitId) : WARD_ALERTS_HREF;
        navigateWithDirtyGuard(() => router.push(canOpen(href) ? href : WARD_ALERTS_HREF));
        notification.close();
      };
    } catch {
      // No notification here; the request still shows on the ward and Capacity.
    }
  }, [
    openStaff,
    enabled,
    wantsStaff,
    sessionAdopted,
    worldGeneration,
    quietOn,
    quietStart,
    quietEnd,
    now,
    units,
    router,
    canOpen,
  ]);

  // PWA plan item 8: the same act-now count on the Home Screen icon. A count only, never names.
  const actNowCount = actNow.length;
  useEffect(() => {
    if (sessionAdopted) setActNowAppBadge(actNowCount);
  }, [actNowCount, sessionAdopted]);

  return null;
}
