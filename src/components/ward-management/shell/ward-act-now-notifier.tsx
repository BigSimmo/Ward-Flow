"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

import { decisionTargetInboxItems } from "@/components/ward-management/ward-decision-targets";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";
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
  const { movements, units, configuration, inboxSnoozes, sessionAdopted, worldGeneration } = useWardFlow();
  const now = useWardFlowClock();
  const [enabled] = useActNowNotificationPreference();
  const previous = useRef<{ generation: number; ids: Set<string> } | null>(null);

  const actNow = useMemo(() => {
    const open = movements.filter(isOpen);
    const rows = [...buildActionInbox(open, now, units), ...decisionTargetInboxItems(open, now, configuration)];
    return partitionSnoozed(rows, inboxSnoozes, now).active.filter((item) => item.tone === "danger");
  }, [movements, units, configuration, inboxSnoozes, now]);

  useEffect(() => {
    if (!sessionAdopted) {
      previous.current = null;
      return;
    }
    const prior = previous.current;
    const ids = new Set(actNow.map((item) => item.id));
    previous.current = { generation: worldGeneration, ids };
    if (prior === null || prior.generation !== worldGeneration || !enabled) return;
    showActNowNotification(newActNowItems(prior.ids, actNow), () => router.push(WARD_ALERTS_HREF));
  }, [actNow, enabled, router, sessionAdopted, worldGeneration]);

  return null;
}
