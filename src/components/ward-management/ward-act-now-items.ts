/**
 * ACT-NOW ITEMS AND TASKS — the one definition of "a row on the coordinator's active list".
 *
 * Pure: no React, no browser API. The open-tab notifier (`shell/ward-act-now-notifier.tsx`) and the
 * shared backend's phone push (`backend/ward-flow/engine.ts`) both read this, so a phone is never
 * told about a different set of alerts than the screen shows. Snoozed rows are off the active
 * list; one that returns after its snooze counts as new.
 *
 * L1 (site review, 12 Oct 2026): the header's Tasks badge counted 11, Alerts "Now" 8 (it dropped
 * the arrival and discharge notification rows) and Home Exceptions counted snoozed rows and missed
 * the decision targets. Every one of those now reads `taskItems` / `activeTaskItems` from here, and
 * act now is the red subset of the same active list, so the figures cannot drift apart again.
 * `tests/ward-shared-figures.test.ts` pins that they agree on the seed.
 */
import type { Instant } from "@/components/ward-management/ward-clock";
import { absenceInboxItems } from "@/components/ward-management/ward-absence-tasks";
import { decisionTargetInboxItems } from "@/components/ward-management/ward-decision-targets";
import {
  buildActionInbox,
  isOpen,
  type ActionInboxRecords,
  type InboxItem,
} from "@/components/ward-management/ward-derivations";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { partitionSnoozed } from "@/components/ward-management/ward-inbox-snooze";

/**
 * What the task list reads. The records (admissions, patients, referrals, notifications, planned
 * admissions) are optional so a caller holding only the core state still gets the movement rows;
 * pass them to get the notification and planned-arrival rows too.
 */
export type TaskSource = Pick<WardFlowState, "movements" | "units" | "configuration" | "inboxSnoozes"> &
  Omit<ActionInboxRecords, "movements"> & {
    /** Audit A3-1: leave beds, for the act-now row when a person on an order is absent. */
    leaveBeds?: WardFlowState["leaveBeds"];
  };

/** @deprecated name kept for existing callers; the same shape as `TaskSource`. */
export type ActNowSource = TaskSource;

/** Every task row at `now`, snoozed ones included: the inbox rows plus the decision targets. */
export function taskItems(source: TaskSource, now: Instant): InboxItem[] {
  const open = source.movements.filter(isOpen);
  return [
    // Audit A3-1: absent without leave on an order sits first; it is the most urgent row there is.
    ...absenceInboxItems(source, now),
    ...buildActionInbox(open, now, source.units, {
      movements: source.movements,
      admissions: source.admissions,
      patients: source.patients,
      referrals: source.referrals,
      supportNotifications: source.supportNotifications,
      plannedAdmissions: source.plannedAdmissions,
      stuckHandoverMinutes: source.stuckHandoverMinutes,
    }),
    ...decisionTargetInboxItems(open, now, source.configuration),
  ];
}

/** The active (not snoozed) task rows at `now`: the header's Tasks badge and Home's Exceptions. */
export function activeTaskItems(source: TaskSource, now: Instant): InboxItem[] {
  return partitionSnoozed(taskItems(source, now), source.inboxSnoozes, now).active;
}

/** The active (not snoozed) act-now rows at `now`: the red subset of `activeTaskItems`. */
export function activeActNowItems(source: TaskSource, now: Instant): InboxItem[] {
  return activeTaskItems(source, now).filter((item) => item.tone === "danger");
}

/** Act-now rows in `current` that were not on the active list last time. */
export function newActNowItems(previousIds: ReadonlySet<string>, current: readonly InboxItem[]): InboxItem[] {
  return current.filter((item) => item.tone === "danger" && !previousIds.has(item.id));
}
