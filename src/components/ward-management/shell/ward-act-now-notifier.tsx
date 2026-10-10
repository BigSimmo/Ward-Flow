"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { wardChromeRole, wardTasksAreActionableForRole } from "@/components/ward-management/ward-chrome-role";

import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";

import { newActNowItems, showActNowNotification, useActNowNotificationPreference } from "./ward-act-now-notifications";

/**
 * Sends a browser notification when a new act-now (red) alert appears in this tab, including an
 * overdue decision target. Renders nothing. The first reading is taken as the baseline, so opening
 * the app or turning the setting on never floods the screen with alerts that were already there.
 * Snoozed rows are off the active list; one that returns after its snooze counts as new.
 */
export function WardActNowNotifier() {
  const router = useRouter();
  // Same gate as the Tasks drawer (shell/ward-bar.tsx): only the coordinator's routes carry this
  // list, so a ward, ED, officer or community view is never notified of rows it cannot see.
  const actionable = wardTasksAreActionableForRole(wardChromeRole(usePathname()));
  const { movements, units, configuration, inboxSnoozes, sessionAdopted, worldGeneration } = useWardFlow();
  const now = useWardFlowClock();
  const [enabled] = useActNowNotificationPreference();
  // The baseline belongs to one adopted world: the seed shown before a saved session is restored,
  // or a world that was reset, must not make every restored alert look new.
  const previous = useRef<{ generation: number; ids: Set<string> } | null>(null);

  const actNow = useMemo(() => {
    if (!actionable) return [];
    return activeActNowItems({ movements, units, configuration, inboxSnoozes }, now);
  }, [actionable, movements, units, configuration, inboxSnoozes, now]);

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

  return null;
}
