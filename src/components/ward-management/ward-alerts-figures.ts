/**
 * THE ALERTS FIGURES — one definition of "act now", "waiting" and "outstanding" for the coordinator.
 *
 * Q260 (pre-launch review T1, Josh approved 2 Nov 2026): Home and Alerts said "Act now 4", the phone
 * Menu said "Act-now alerts 3", and the bell and Tasks dock said 12 while the Alerts heading read
 * "4 act now, 9 waiting". The gap was one row kind: a ward's acceptance with no bed pulled (Q111),
 * which Home and Alerts list in Act now but the shared task list (`ward-act-now-items.ts`) does not
 * hold. The Menu row and the badge now read their numbers from here, as the Alerts screen does.
 *
 * Pure and light (reducer ids only), so the shell can read it without loading the Alerts screen.
 * `alerts-model.ts` groups rows with `alertGroupOfId`, so the screen and the badge cannot disagree.
 */
import { INBOX_CATEGORIES, inboxItemIsActNow } from "@/components/ward-management/ward-inbox-reducer";

export type AlertGroup = "act" | "wait" | "running";

/** Running countdowns share a stem with the overdue target rows, so they are matched first. */
const RUNNING_PREFIXES = [
  INBOX_CATEGORIES.target_pending_referral_decision.idPrefix,
  INBOX_CATEGORIES.target_pending_transfer_acceptance.idPrefix,
  INBOX_CATEGORIES.target_pending_transport_booked.idPrefix,
];

/** A task row's group on the Alerts screen, read from its id alone. */
export function alertGroupOfId(id: string): AlertGroup {
  if (RUNNING_PREFIXES.some((prefix) => id.startsWith(prefix))) return "running";
  return inboxItemIsActNow(id) ? "act" : "wait";
}

export type AlertsNowFigures = {
  /** Act-now task rows plus accepted referrals with no bed pulled: the Act now figure everywhere. */
  actNow: number;
  /** Waiting task rows. */
  waiting: number;
  /** Running countdowns: listed on Alerts, never counted as outstanding (not yet late). */
  running: number;
  /** Act now plus waiting: the Alerts heading and Now tab, the bell and the Tasks dock. */
  outstanding: number;
};

/**
 * The figures for the active (not snoozed) task rows and the count of accepted referrals awaiting a
 * bed pull (`acceptedReferralsAwaitingPull(...).length`, coordinator desk only).
 */
export function alertsNowFigures(activeItems: readonly { id: string }[], awaitingPull: number): AlertsNowFigures {
  let act = 0;
  let waiting = 0;
  let running = 0;
  for (const item of activeItems) {
    const group = alertGroupOfId(item.id);
    if (group === "act") act += 1;
    else if (group === "wait") waiting += 1;
    else running += 1;
  }
  const actNow = act + awaitingPull;
  return { actNow, waiting, running, outstanding: actNow + waiting };
}
