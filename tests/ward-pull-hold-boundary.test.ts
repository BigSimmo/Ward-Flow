import { describe, expect, it } from "vitest";

import { causeOf } from "@/components/ward-management/movements/movements-screen-helpers";
import { bedHoldLapsed } from "@/components/ward-management/ward-bed-hold";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// One bed-hold boundary: Movements reads a pull as lapsed at its limit, exactly as `bedHold` does.
describe("Movements pull-hold boundary", () => {
  it("calls a pull expired at the limit itself, the same as the bed-hold rule", () => {
    const state = seedWardFlowState();
    const pulled = state.movements.find((movement) => movement.stage === "pulled")!;
    const at = { ...pulled, pullExpiresAt: NOW_ANCHOR };
    expect(bedHoldLapsed(NOW_ANCHOR, NOW_ANCHOR)).toBe(true);
    expect(causeOf(at, NOW_ANCHOR, new Map())).toBe("bed_pull_expired");
    expect(causeOf({ ...pulled, pullExpiresAt: NOW_ANCHOR + 1 }, NOW_ANCHOR, new Map())).not.toBe("bed_pull_expired");
  });
});
