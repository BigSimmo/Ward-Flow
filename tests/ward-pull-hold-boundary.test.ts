import { describe, expect, it } from "vitest";

import { causeOf } from "@/components/ward-management/movements/movements-screen-helpers";
import { bedHoldLapsed } from "@/components/ward-management/ward-bed-hold";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// One bed-hold boundary: Movements reads a pull as lapsed once past its limit, exactly as `bedHold`
// does (audit L2, D-MCA (Josh, 14 Nov 2026): the one clock rule, as a legal breach).
describe("Movements pull-hold boundary", () => {
  it("calls a pull expired once past the limit, the same as the bed-hold rule", () => {
    const state = seedWardFlowState();
    const pulled = state.movements.find((movement) => movement.stage === "pulled")!;
    const past = { ...pulled, pullExpiresAt: NOW_ANCHOR - 1 };
    expect(bedHoldLapsed(NOW_ANCHOR - 1, NOW_ANCHOR)).toBe(true);
    expect(bedHoldLapsed(NOW_ANCHOR, NOW_ANCHOR)).toBe(false);
    expect(causeOf(past, NOW_ANCHOR, new Map())).toBe("bed_pull_expired");
    expect(causeOf({ ...pulled, pullExpiresAt: NOW_ANCHOR }, NOW_ANCHOR, new Map())).not.toBe("bed_pull_expired");
  });
});
