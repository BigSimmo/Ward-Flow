import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { CardSafetyTags } from "@/components/ward-management/patients/card-safety-tags";
import { interpreterRequired } from "@/components/ward-management/patients/patient-flight-header";
import { interpreterLanguageRequired } from "@/components/ward-management/patients/patient-interpreter";
import { referralCardFlags } from "@/components/ward-management/patients/patient-referral-safety";
import { RISK_FLAG_LABELS } from "@/components/ward-management/referrals/referral-risk-flags";
import { REFERRAL_RISK_FLAGS } from "@/components/ward-management/referrals/referral-submission";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";

/**
 * Josh, 9 Nov 2026 (care plans and safety flags thread: defaults approved): risk flag tags on the ED
 * board and bed requests, under H10's conditions (one reader, only a referral this desk can see,
 * the referral's date always shown), plus an interpreter tag; and the new security escort flag.
 */
const DAY_ZERO = new Date("2026-11-09T00:00:00+08:00");
const RAISED = -2 * 24 * 60; // two days before day zero, in demo minutes

function movement(overrides: Partial<Movement> = {}): Movement {
  return { id: "ZZ-SYNTH-1", openedAt: 0, ...overrides } as Movement;
}

function referral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "RF-SYNTH-1",
    raisedAt: RAISED,
    intake: { riskFlags: ["aggression", "securityEscort"] },
    ...overrides,
  } as unknown as Referral;
}

describe("card risk flag tags", () => {
  it("reads the named referral's flags in words, with its date", () => {
    expect(referralCardFlags(movement({ referralId: "RF-SYNTH-1" }), [referral()])).toEqual({
      labels: ["Aggression", "Needs security escort"],
      raisedAt: RAISED,
    });
  });

  it("shows nothing when this desk cannot see the referral, or it flagged none", () => {
    expect(referralCardFlags(movement({ referralId: "RF-SYNTH-1" }), [])).toBeUndefined();
    expect(referralCardFlags(movement({ referralId: "RF-SYNTH-1" }), [referral({ id: "RF-SYNTH-2" })])).toBeUndefined();
    const none = referral({ intake: { riskFlags: [] } } as unknown as Partial<Referral>);
    expect(referralCardFlags(movement({ referralId: "RF-SYNTH-1" }), [none])).toBeUndefined();
  });

  it("renders the referral date beside the tags, and the interpreter language", () => {
    render(
      <CardSafetyTags
        movement={movement({ referralId: "RF-SYNTH-1" })}
        referrals={[referral()]}
        patient={{ interpreterLanguage: "Italian — interpreter required" }}
        dayZero={DAY_ZERO}
        testId="tags"
      />,
    );
    const tags = screen.getByTestId("tags");
    expect(tags).toHaveTextContent(/^Referral 7 Nov/u);
    expect(tags).toHaveTextContent("Needs security escort");
    expect(tags).toHaveTextContent("Italian interpreter");
  });

  it("renders nothing for a desk that cannot see the referral and no interpreter need", () => {
    const { container } = render(
      <CardSafetyTags
        movement={movement({ referralId: "RF-SYNTH-1" })}
        referrals={[]}
        patient={{ interpreterLanguage: "English — no interpreter required" }}
        dayZero={DAY_ZERO}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("security escort flag", () => {
  it("can be recorded on a referral and reads in words", () => {
    expect(REFERRAL_RISK_FLAGS).toContain("securityEscort");
    expect(RISK_FLAG_LABELS.securityEscort).toBe("Needs security escort");
  });
});

describe("interpreter reading", () => {
  it("matches the patient page's reading", () => {
    for (const interpreterLanguage of [
      undefined,
      "",
      "English — no interpreter required",
      "Vietnamese — interpreter required",
      "Arabic - interpreter required",
      "Greek",
    ]) {
      const patient = { interpreterLanguage } as Patient;
      expect(interpreterLanguageRequired(patient)).toBe(interpreterRequired(patient));
    }
  });
});
