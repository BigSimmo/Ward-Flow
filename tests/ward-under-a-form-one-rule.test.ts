import { describe, expect, test } from "vitest";
import { edOpenSummaries, isUnderAForm } from "@/components/ward-management/ed/ed-home-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import type { Movement } from "@/components/ward-management/ward-model";

// Josh, 9 Nov 2026: Home's ED strip said Armadale had 15 on forms while the ED desk said 13. The two
// "Involuntary inpatient" rows with no form entered were counted by one screen only. One rule now.
describe("isUnderAForm: one rule for Home, the ED desk and the TV", () => {
  test("a recorded form counts, whatever the status", () => {
    expect(
      isUnderAForm({
        legalStatus: "Referred for psychiatric examination",
        legalForm: { code: "1A" } as Movement["legalForm"],
      }),
    ).toBe(true);
  });

  test("a detained or involuntary status counts even before its form is entered", () => {
    expect(isUnderAForm({ legalStatus: "Involuntary inpatient", legalForm: undefined })).toBe(true);
    expect(isUnderAForm({ legalStatus: "Detained awaiting examination", legalForm: undefined })).toBe(true);
  });

  test("voluntary and referred-only people with no form never count (P3-2)", () => {
    expect(isUnderAForm({ legalStatus: "Voluntary", legalForm: undefined })).toBe(false);
    expect(isUnderAForm({ legalStatus: "Referred for psychiatric examination", legalForm: undefined })).toBe(false);
  });

  test.each(WARD_SCENARIOS)("the standard Armadale case reads the same on every count (%s)", (scenario) => {
    // A16-14 (D-175 item 1): the Armadale case is the worked examples, now opt-in; 3 people without them.
    const { movements } = seedWardFlowState(scenario, { workedExamples: true });
    for (const summary of edOpenSummaries(movements, Date.now() as never)) {
      const count = summary.open.filter(isUnderAForm).length;
      expect(count).toBeGreaterThanOrEqual(summary.open.filter((m) => m.legalForm !== undefined).length);
      if (scenario === "standard" && summary.ed.siteCode === "ARM") expect(count).toBe(15);
    }
  });
});
