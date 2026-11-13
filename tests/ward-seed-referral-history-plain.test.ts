import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * Audit G A31 (13 Nov 2026): RF-014 and RF-015's histories ended "INVENTED DEMONSTRATION TEXT.",
 * and RF-015 leads Home's "Referrals to decide", so the first row a presenter opens read as a planted
 * placeholder. Seeded referral histories read as ordinary notes; the synthetic-data notice lives on
 * the page, not inside a record.
 */
describe("seeded referral histories read as ordinary notes", () => {
  it("carry no placeholder marker on the Standard day", () => {
    const state = seedWardFlowState("standard");
    const histories = state.referrals.map((referral) => [referral.id, referral.history ?? ""] as const);
    expect(histories.some(([id]) => id === "RF-015")).toBe(true);
    expect(histories.filter(([, history]) => /INVENTED|DEMONSTRATION TEXT|placeholder/iu.test(history))).toEqual([]);
  });
});
