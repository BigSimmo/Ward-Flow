/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { isbarText } from "@/components/ward-management/referrals/referral-board-sheets";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit CS3-02: the referral summary showed the letter's medical clearance and legal status as if
 * they were the current record. It now gives what is recorded, or "not recorded", and names the
 * letter's words as the letter's. Synthetic seed data only.
 */
const seeded = seedWardFlowState().referrals[0]!;
// The letter says cleared and gives a legal status; nothing is recorded on the referral itself.
const referral: Referral = {
  ...seeded,
  medicalClearance: undefined,
  intake: {
    catchment: { teamName: "Synthetic community team", confirmed: true },
    reasonForReferral: "Synthetic reason",
    legalStatus: "Voluntary",
    riskFlags: [],
    medicalClearance: { cleared: true },
    triageAndRampCompleted: true,
    charts: [],
    additionalDocuments: false,
    referrer: seeded.intake?.referrer ?? ({} as NonNullable<Referral["intake"]>["referrer"]),
  },
};

const lines = (recorded?: Parameters<typeof isbarText>[5]) =>
  isbarText(referral, "Synthetic Person", "UM000000", "Adult", NOW_ANCHOR, recorded).split("\n");

describe("referral summary: recorded facts, not the letter's (audit CS3-02)", () => {
  it("separates the recorded request from bed requirements without inventing advice", () => {
    const summary = lines();
    expect(summary).toHaveLength(5);
    expect(summary[4]).toMatch(/^Recommendation: Recorded request: .+\. Recorded bed needs: /);
    expect(summary[1]).not.toContain("Asking for");
    expect(summary[4]).not.toMatch(/recommend admission|clinically indicated/i);
  });
  it("says clearance and legal status are not recorded when only the letter has them", () => {
    expect(referral).toBeDefined();
    const [, , background, assessment] = lines();
    expect(background).toContain("Legal status not recorded");
    expect(background).toContain("(on the referral letter: Voluntary)");
    expect(background).toMatch(/^Background: On the referral letter, /);
    expect(assessment).toContain("Medical clearance not recorded.");
    expect(assessment).not.toMatch(/clearance cleared/);
  });

  it("gives the recorded legal status and clearance with when it was recorded", () => {
    const [, , background, assessment] = lines({
      legalStatus: "Involuntary (Form 6A)",
      clearance: { cleared: false, at: NOW_ANCHOR - 30 },
    });
    expect(background).toContain("Legal status Involuntary (Form 6A)");
    expect(assessment).toMatch(/Medical clearance not cleared, recorded /);
  });
});
