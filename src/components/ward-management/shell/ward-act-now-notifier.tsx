"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import { WARD_SHELL_ROLE, wardTasksAreActionableForRole } from "@/components/ward-management/ward-chrome-role";

import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";

import {
  newActNowItems,
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
  const actionable = wardTasksAreActionableForRole(WARD_SHELL_ROLE);
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
  );
  const now = useWardFlowClock();
  const [enabled] = useActNowNotificationPreference();
  // The baseline belongs to one adopted world: the seed shown before a saved session is restored,
  // or a world that was reset, must not make every restored alert look new.
  const previous = useRef<{ generation: number; ids: Set<string> } | null>(null);

  const actNow = useMemo(() => {
    if (!actionable) return [];
    // Audit A3-1: with the stays and leave beds, so an absence on an order is pushed too.
    return activeActNowItems(
      { movements, units, configuration, inboxSnoozes, leaveBeds, admissions, patients, referrals },
      now,
    );
  }, [actionable, movements, units, configuration, inboxSnoozes, leaveBeds, admissions, patients, referrals, now]);

  useEffect(() => {
    if (!sessionAdopted) {
      previous.current = null;
      return;
    }
    const prior = previous.current;
    previous.current = { generation: worldGeneration, ids: new Set(actNow.map((item) => item.id)) };
    if (prior === null || prior.generation !== worldGeneration || !enabled) return;
    showActNowNotification(newActNowItems(prior.ids, actNow), () => {
      router.push(WARD_ALERTS_HREF);
    });
  }, [actNow, enabled, router, sessionAdopted, worldGeneration]);

  // PWA plan item 8: the same act-now count on the Home Screen icon. A count only, never names.
  const actNowCount = actNow.length;
  useEffect(() => {
    if (sessionAdopted) setActNowAppBadge(actNowCount);
  }, [actNowCount, sessionAdopted]);

  return null;
}
