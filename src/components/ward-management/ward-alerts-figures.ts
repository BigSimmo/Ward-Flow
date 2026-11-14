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
import { BedSingle } from "lucide-react";

import type { Instant } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { INBOX_CATEGORIES, inboxItemIsActNow } from "@/components/ward-management/ward-inbox-reducer";
import { WARD_ALERTS_HREF } from "@/components/ward-management/ward-nav";
import type { AcceptedAwaitingPull } from "@/components/ward-management/referrals/accepted-awaiting-pull";

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
 * bed pull (`acceptedReferralsAwaitingPull(...).length`, the coordinator desk, or the ward desk for its own wards).
 */
export function alertsNowFigures(activeItems: readonly { id: string }[], awaitingPull: number): AlertsNowFigures {
  let act = 0;
  let waiting = 0;
  let running = 0;
  for (const item of activeItems) {
    // Meeting actions open their owner destination and are not members of the Alerts queue.
    if (item.id.startsWith(INBOX_CATEGORIES.bed_meeting_action.idPrefix)) continue;
    const group = alertGroupOfId(item.id);
    if (group === "act") act += 1;
    else if (group === "wait") waiting += 1;
    else running += 1;
  }
  const actNow = act + awaitingPull;
  return { actNow, waiting, running, outstanding: actNow + waiting };
}

/** The id stem of an accepted-referral row in the bar's task list (never an inbox category). */
const ACCEPTED_PULL_ROW_PREFIX = "accepted-pull-";

export function isAcceptedPullRow(id: string): boolean {
  return id.startsWith(ACCEPTED_PULL_ROW_PREFIX);
}

/** The referral an accepted-referral row is about, for the patient resolver to name the person. */
export function acceptedPullReferralId(id: string): string | undefined {
  return isAcceptedPullRow(id) ? id.slice(ACCEPTED_PULL_ROW_PREFIX.length) || undefined : undefined;
}

/**
 * Q260 review (#1296): the bell's quick look lists what the badge counts, so a ward's acceptance
 * with no bed pulled is a row there too, in Act now. It opens Alerts, where the bed is pulled. It is
 * not an inbox row: it leaves when the bed is pulled, so it is never acknowledged or snoozed.
 * Pass these rows in the item list and `awaitingPull` 0 to `alertsNowFigures`, never both.
 */
export function acceptedPullTaskRows(toPull: readonly AcceptedAwaitingPull[], now: Instant): InboxItem[] {
  return toPull.map(({ referral, unitName }) => {
    const accepted = referral.destinations.find((arm) => arm.state === "accepted");
    return {
      id: `${ACCEPTED_PULL_ROW_PREFIX}${referral.id}`,
      kind: "fact",
      tone: "danger",
      icon: BedSingle,
      title: "Accepted, bed not pulled",
      detail: `${unitName} accepted. Pull the bed from Alerts.`,
      owner: "Bed coordinator",
      movementId: "",
      href: WARD_ALERTS_HREF,
      since: accepted?.decidedAt ?? referral.raisedAt ?? now,
    };
  });
}
