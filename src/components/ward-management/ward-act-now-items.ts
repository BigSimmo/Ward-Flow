/**
 * ACT-NOW ITEMS — the one definition of "a red row on the coordinator's active list".
 *
 * Pure: no React, no browser API. The open-tab notifier (`shell/ward-act-now-notifier.tsx`) and the
 * Azure backend's phone push (`backend/ward-flow/engine.ts`) both read this, so a phone is never
 * told about a different set of alerts than the screen shows. Snoozed rows are off the active
 * list; one that returns after its snooze counts as new.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import { decisionTargetInboxItems } from "@/components/ward-management/ward-decision-targets";
import { buildActionInbox, isOpen, type InboxItem } from "@/components/ward-management/ward-derivations";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";

export type ActNowSource = Pick<WardFlowState, "movements" | "units" | "configuration" | "inboxSnoozes">;

/** The active (not snoozed) act-now rows at `now`. */
export function activeActNowItems(source: ActNowSource, now: Instant): InboxItem[] {
  const open = source.movements.filter(isOpen);
  const rows = [
    ...buildActionInbox(open, now, source.units),
    ...decisionTargetInboxItems(open, now, source.configuration),
  ];
  return partitionSnoozed(rows, source.inboxSnoozes, now).active.filter((item) => item.tone === "danger");
}

/** Act-now rows in `current` that were not on the active list last time. */
export function newActNowItems(previousIds: ReadonlySet<string>, current: readonly InboxItem[]): InboxItem[] {
  return current.filter((item) => item.tone === "danger" && !previousIds.has(item.id));
}
