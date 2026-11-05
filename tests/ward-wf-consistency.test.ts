import { describe, expect, it } from "vitest";

import { minutesInEd, minutesSinceReferral } from "@/components/ward-management/ward-shared-figures";

/** WF-02 (live test, 5 Nov 2026). Synthetic values only. */
describe("wait clocks (WF-02)", () => {
  it("counts since referral from referredAt and never falls back to openedAt", () => {
    expect(minutesSinceReferral({ referredAt: 100 }, 160)).toBe(60);
    expect(minutesSinceReferral({ referredAt: undefined }, 160)).toBeUndefined();
  });

  it("counts time in ED from openedAt, never negative", () => {
    expect(minutesInEd({ openedAt: 10 }, 70)).toBe(60);
    expect(minutesInEd({ openedAt: 90 }, 70)).toBe(0);
  });
});
