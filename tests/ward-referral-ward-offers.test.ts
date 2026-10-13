/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { wardOffersOutsideQueue } from "@/components/ward-management/referrals/home-ward-offers";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";

/**
 * S-8 (audit 13 Oct 2026): ward offers sent straight from Home (`REFER_TO_UNITS`) are listed on the
 * Referrals board once. A movement whose own referral is still queued is already a queue row.
 */
describe("wardOffersOutsideQueue", () => {
  it("lists open movements with a ward still asked and none accepted", () => {
    const state = seedWardFlowState();
    const offers = wardOffersOutsideQueue(state.movements, state.referrals);
    expect(offers.length).toBeGreaterThan(0);
    for (const movement of offers) {
      expect(movement.referredUnitIds.length).toBeGreaterThan(0);
      expect(movement.acceptedUnitId).toBeUndefined();
      expect(movement.closure).toBeUndefined();
    }
  });

  it("leaves out a movement whose referral is already in the queue, so it is counted once", () => {
    const state = seedWardFlowState();
    const queuedId = referralQueueOrder(state.referrals)[0]!.id;
    const offered = wardOffersOutsideQueue(state.movements, state.referrals)[0]!;
    const movements = state.movements.map((movement) =>
      movement.id === offered.id ? { ...movement, referralId: queuedId } : movement,
    );
    const ids = wardOffersOutsideQueue(movements, state.referrals).map((movement) => movement.id);
    expect(ids).not.toContain(offered.id);
  });
});
