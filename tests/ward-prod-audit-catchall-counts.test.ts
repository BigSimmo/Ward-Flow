import { describe, expect, it } from "vitest";

import { heroHighlights } from "@/components/ward-management/movements/movements-screen-helpers";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { LONG_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Production audit catch-all, numbers-agree NA2-10: Movements' "Past 24h" pill counts the same people
 * as Waiting's "Over 24h" (people still in an ED), so someone already in transit is not counted.
 */
describe("Movements Past 24h matches Waiting Over 24h", () => {
  it("counts only people still waiting in an ED", () => {
    const state = seedWardFlowState();
    const at = NOW_ANCHOR + 24 * 60;
    const past = heroHighlights(at, LONG_WAIT_MINUTES).find((highlight) => highlight.id === "past")!;
    const open = state.movements.filter(isOpen);
    const waitingLong = open.filter((m) => isWaitingInEd(m) && at - m.openedAt >= LONG_WAIT_MINUTES);
    const inTransitLong = open.filter((m) => !isWaitingInEd(m) && at - m.openedAt >= LONG_WAIT_MINUTES);
    expect(inTransitLong.length, "the seed has a long journey no longer waiting in an ED").toBeGreaterThan(0);
    expect(open.filter(past.test).length).toBe(waitingLong.length);
  });
});
