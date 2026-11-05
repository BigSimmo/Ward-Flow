import { describe, expect, it } from "vitest";
import { durationSampleText } from "@/components/ward-management/reports/pilot-measures-section";

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

describe("durationSampleText (WF-17)", () => {
  const withheld = { kind: "withheld" } as const;
  it("never splices 'not shown' into the sentence", () => {
    for (const text of [
      durationSampleText(withheld, withheld, "finished"),
      durationSampleText(withheld, 12, "finished"),
      durationSampleText(12, withheld, "finished"),
    ]) {
      expect(text).not.toMatch(/not shown/);
      expect(text).toMatch(/held back/);
    }
  });
  it("keeps exact counts as before", () => {
    expect(durationSampleText(7, 9, "finished")).toBe("from 7 of 9 finished");
  });
});
