import { describe, expect, it } from "vitest";
import {
  NOT_RECORDED,
  involuntaryBedNeededForLegalStatus,
} from "@/components/ward-management/referrals/ward-referral-drawer-model";

// Owner ruling D-69 (Josh, 20 Oct 2026, 2:02 PM AWST): "Needs an involuntary-capable bed until
// status is set." A referral destination with no legal status must never default to Voluntary.
describe("referral destination: involuntary-capable bed until legal status is set (D-69)", () => {
  it("needs an involuntary-capable bed with no status, then not once Voluntary is set, then again for Involuntary", () => {
    let legalStatus = "";
    expect(involuntaryBedNeededForLegalStatus(legalStatus)).toBe(true);

    legalStatus = "Voluntary";
    expect(involuntaryBedNeededForLegalStatus(legalStatus)).toBe(false);

    legalStatus = "Involuntary";
    expect(involuntaryBedNeededForLegalStatus(legalStatus)).toBe(true);
  });

  it.each([undefined, null, "", "   ", NOT_RECORDED])("treats %j as no status recorded", (status) => {
    expect(involuntaryBedNeededForLegalStatus(status)).toBe(true);
  });
});
