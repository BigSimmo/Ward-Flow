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
  const { movements, units, configuration, inboxSnoozes } = useWardFlow();
  const now = useWardFlowClock();
  const [enabled] = useActNowNotificationPreference();
  const previous = useRef<Set<string> | null>(null);

  const actNow = useMemo(() => {
    const open = movements.filter(isOpen);
    const rows = [...buildActionInbox(open, now, units), ...decisionTargetInboxItems(open, now, configuration)];
    return partitionSnoozed(rows, inboxSnoozes, now).active.filter((item) => item.tone === "danger");
  }, [movements, units, configuration, inboxSnoozes, now]);

  useEffect(() => {
    const prior = previous.current;
    previous.current = new Set(actNow.map((item) => item.id));
    if (prior === null || !enabled) return;
    showActNowNotification(newActNowItems(prior, actNow), () => router.push(WARD_ALERTS_HREF));
  }, [actNow, enabled, router]);

  return null;
}
