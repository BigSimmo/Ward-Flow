import { isOpen, referralForMovement } from "@/components/ward-management/ward-derivations";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";

/**
 * S-8 (audit 13 Oct 2026): ward offers made straight from Home (`REFER_TO_UNITS`: Offer on a
 * bedflow row, or Override on the placement shortlist) never reached the Referrals board, because
 * the board lists `Referral` records and a direct offer writes only the movement's
 * `referredUnitIds`. This is the list of those offers: an open movement with a ward still asked
 * and none accepted.
 *
 * Counted once: a movement whose own referral is still in the coordinator queue is already a row
 * on the board, so it is left out here. Longest wait first, as the queue is.
 */
export function wardOffersOutsideQueue(movements: readonly Movement[], referrals: Referral[]): Movement[] {
  const queuedIds = new Set(referralQueueOrder(referrals).map((referral) => referral.id));
  return movements
    .filter(
      (movement) =>
        isOpen(movement) &&
        movement.referredUnitIds.length > 0 &&
        movement.acceptedUnitId === undefined &&
        !queuedIds.has(referralForMovement(movement, referrals)?.id ?? ""),
    )
    .sort((a, b) => (a.referredAt ?? a.openedAt) - (b.referredAt ?? b.openedAt));
}

/**
 * A9-30 (F-27, 13 Nov 2026): what a WARD desk has to answer, one count for the Referrals title, the
 * dock and menu badge and the empty line: the referrals queued for it plus the beds offered straight
 * to it (`wardOffersOutsideQueue`). The board used to say "Nothing for <ward> to answer" and badge 0
 * above "Offered to your ward 1, waiting on your answer". Off the ward desk an offer waits on a
 * ward, not on the reader, so other desks keep the queue count alone.
 */
export function wardDeskAnswerCount(queued: number, movements: readonly Movement[], referrals: Referral[]): number {
  return queued + wardOffersOutsideQueue(movements, referrals).length;
}
