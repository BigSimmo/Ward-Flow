/**
 * B4 (one Waiting list, Josh 19 Oct 2026): the Delays board's saved views and the links other
 * screens use to open them. Each view only narrows the board; it never re-sorts it, so the board's
 * own order (longest wait with recorded legal times pinned, or by blocker) still applies.
 *
 * The definitions are Josh's, approved 19 Oct 2026:
 * - Needs me now: the coordinator's own decision is due, a form's recorded due time is close, or a
 *   person flagged the journey urgent.
 * - Form due: a recorded due time within the due-soon window (3 h by default) or already passed.
 * - For handover: anything to act on now, plus anything due before the next handover.
 *
 * Every form time here is the due time as recorded on the movement (`legalForm.dueAt`). Nothing
 * here works out a Mental Health Act time or expiry.
 */
import type { DueSoonThresholds, Instant } from "@/components/ward-management/ward-clock";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { HealthService } from "@/components/ward-management/ward-model-vocabulary";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { referralBelongsToService } from "@/components/ward-management/ward-service-scope";
import {
  defaultHandoverShift,
  handoverCutoff,
  isActNow,
  isDueBy,
  toHandoverRow,
} from "@/components/ward-management/handover/handover-model";

import type { BoardRow } from "./delays-board-model";
import type { WaitingViewId } from "./waiting-href";

/** "1 h", "3 h", or minutes when the window is not whole hours, from the configured warnings. */
export function windowText(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

export function waitingViewLabel(view: WaitingViewId, thresholds: DueSoonThresholds): string {
  if (view === "needs-me") return "Needs me now";
  if (view === "form") return `Form due within ${windowText(thresholds.soonMinutes)}`;
  return "For handover";
}

/** What each view holds, in words, for the chip's hint. */
export function waitingViewHint(view: WaitingViewId, thresholds: DueSoonThresholds): string {
  const soon = windowText(thresholds.soonMinutes);
  if (view === "needs-me")
    return `Waiting on you, plus anyone with a recorded form time within ${soon} or passed, or flagged urgent`;
  if (view === "form") return `A recorded form due time within ${soon}, or already passed`;
  return "Anything to act on now, plus anything due before the next handover";
}

/** A recorded form due time within the due-soon window, or already passed. Also the board's pin rule. */
export function isFormDue(row: Pick<BoardRow, "dueIn">, thresholds: DueSoonThresholds): boolean {
  return row.dueIn !== undefined && row.dueIn <= thresholds.soonMinutes;
}

/**
 * For handover, read with the Handover sheet's own rules (`isActNow`, `isDueBy`) against the next
 * handover still to come. `actNow` is whether the shared act-now list (`activeActNowItems`, the one
 * the sheet, Alerts and Tasks read) holds this journey, so the view and the sheet's Act now agree;
 * without it the row falls back to its own recorded times, as the sheet's rows do.
 */
export function isForHandover(movement: Movement, now: Instant, actNow?: boolean): boolean {
  const row = { ...toHandoverRow(movement, [], [], []), actNow };
  return isActNow(row, now) || isDueBy(row, now, handoverCutoff(defaultHandoverShift(now), now));
}

export function inWaitingView(view: WaitingViewId, row: BoardRow, thresholds: DueSoonThresholds): boolean {
  if (view === "form") return isFormDue(row, thresholds);
  if (view === "handover") return row.forHandover;
  return row.owner === "yours" || isFormDue(row, thresholds) || row.movement.flaggedUrgent;
}

/** Referrals still waiting for a ward's answer: not yet a movement, so not on the board. */
export function queuedReferralCount(referrals: Referral[], service: HealthService | null, units: Unit[]): number {
  const queue = referralQueueOrder(referrals);
  return service === null
    ? queue.length
    : queue.filter((referral) => referralBelongsToService(referral, service, units)).length;
}
