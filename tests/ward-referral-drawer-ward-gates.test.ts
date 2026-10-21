import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardRefusalWords } from "@/components/ward-management/referrals/ward-referral-drawer-placement-step";
import { wardReferralDestinations } from "@/components/ward-management/referrals/ward-referral-drawer-model";

// Audit 1 (CS-06, Josh 20 Oct): the referral form's ward list runs the engine's own referral check,
// so a ward that will refuse this person never reads "Bed ready".
const state = seedWardFlowState("standard");
const unit = (id: string) => state.units.find((candidate) => candidate.id === id)!;
const ward = (unitId: string, sex: "Male" | "Female", legalStatus: string) =>
  wardReferralDestinations([unitId], { sex, gender: sex, security: "Open", legalStatus, highAcuity: false })[0]!;

describe("referral form ward refusals in words", () => {
  it("says Geraldton Adult Open is female only for an adult male open referral", () => {
    expect(wardRefusalWords(unit("ger-adult-open"), ward("ger-adult-open", "Male", "Voluntary"), "Adult", 0)).toBe(
      "Female-only ward",
    );
  });

  it("says a ward not set up for involuntary admissions refuses a Form 1A", () => {
    expect(wardRefusalWords(unit("sjgs-adult-open"), ward("sjgs-adult-open", "Male", "Form 1A"), "Adult", 0)).toBe(
      "Not set up for involuntary admissions",
    );
  });

  it("says the count is out of date rather than Bed ready when the ward's count is stale", () => {
    const stale = unit("ger-adult-open").allocatable.confirmedAt + 7 * 24 * 60;
    expect(
      wardRefusalWords(unit("ger-adult-open"), ward("ger-adult-open", "Female", "Voluntary"), "Adult", stale),
    ).toBe("Count out of date");
  });

  it("says nothing when the engine accepts", () => {
    expect(
      wardRefusalWords(unit("ger-adult-open"), ward("ger-adult-open", "Female", "Voluntary"), "Adult", 0),
    ).toBeUndefined();
  });
});
