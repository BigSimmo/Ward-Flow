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
