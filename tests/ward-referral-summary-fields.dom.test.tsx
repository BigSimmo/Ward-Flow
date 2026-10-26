import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IsbarSheet } from "@/components/ward-management/referrals/referral-board-sheets";
import { UNIDENTIFIED_REFERRAL_PREFIX } from "@/components/ward-management/referrals/referral-inbox";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * #836: the referral form's Clinical presentation card writes Reason for referral to
 * `intake.reasonForReferral` and Patient story to `referral.history` (RECEIVE_REFERRAL in the
 * drawer). The board's Summary sheet read only the reason, so a story typed in the form never
 * reached the receiving desk's summary, and a blank field read "not recorded" without naming it.
 */

afterEach(cleanup);

const withIntake = seedWardFlowState().referrals.find((referral) => referral.intake !== undefined)!;

function background(referral: Referral): string {
  render(
    <IsbarSheet
      open
      onClose={() => undefined}
      referral={referral}
      name="Test Person"
      umrn="UM100001"
      demographics="34 F"
      now={NOW_ANCHOR}
    />,
  );
  return screen.getByText("Background").nextElementSibling?.textContent ?? "";
}

describe("Referral summary (ISBAR) reads what the referral form wrote (#836)", () => {
  it("has a seeded referral with an intake, so the cases below are not vacuous", () => {
    expect(withIntake).toBeDefined();
  });

  it("shows the patient story and the reason for referral together", () => {
    const text = background({
      ...withIntake,
      history: "Synthetic story line one\nline two",
      intake: { ...withIntake.intake!, reasonForReferral: "Synthetic reason" },
    });
    expect(text).toContain("On the referral letter, Synthetic reason.");
    expect(text).toContain("Patient story: Synthetic story line one line two.");
    expect(text).not.toContain("Reason for referral not recorded.");
    expect(text).not.toContain("Patient story not recorded.");
  });

  it("shows the story when only the story was written, and names the blank reason", () => {
    const text = background({
      ...withIntake,
      history: "Synthetic story only",
      intake: { ...withIntake.intake!, reasonForReferral: "" },
    });
    expect(text).toContain("Reason for referral not recorded.");
    expect(text).toContain("Patient story: Synthetic story only.");
  });

  it("names the blank story field rather than a bare 'not recorded'", () => {
    const text = background({ ...withIntake, history: "", intake: { ...withIntake.intake!, reasonForReferral: "R" } });
    expect(text).toContain("Patient story not recorded.");
  });

  it("leaves the unidentified label, already in Identify, out of the story", () => {
    const text = background({
      ...withIntake,
      patientId: undefined,
      history: `${UNIDENTIFIED_REFERRAL_PREFIX}synthetic description\nSynthetic story`,
    });
    expect(text).toContain("Patient story: Synthetic story.");
    expect(text).not.toContain(UNIDENTIFIED_REFERRAL_PREFIX);
  });

  it("says none were selected when the form recorded no risk flags", () => {
    render(
      <IsbarSheet
        open
        onClose={() => undefined}
        referral={{ ...withIntake, intake: { ...withIntake.intake!, riskFlags: [] } }}
        name="Test Person"
        umrn="UM100001"
        demographics="34 F"
        now={NOW_ANCHOR}
      />,
    );
    expect(screen.getByText("Assessment").nextElementSibling).toHaveTextContent("risk flags on the referral letter none selected");
  });
});
