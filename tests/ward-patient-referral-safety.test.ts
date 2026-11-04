// tests/ward-patient-referral-safety.test.ts
import { describe, expect, it } from "vitest";

import { referralSafetyFacts } from "@/components/ward-management/patients/patient-referral-safety";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

/**
 * PT1 H10 (Josh, 3 Nov 2026): the patient page shows risk flags and the working diagnosis read
 * only from the referral, under three conditions.
 *
 * 1. ONE READER. An ESLint rule in `eslint.config.mjs` (PT1 H10 block) stops any patient page file
 *    other than `patient-referral-safety.ts` reading a referral's risk flags or working diagnosis.
 * 2. A desk sees the flags only when its scoped workspace holds the referral the movement names.
 * 3. The referral's date always comes back with the flags.
 * This file proves 2 and 3 by behaviour.
 */
const RAISED = Date.UTC(2026, 10, 1, 9, 30);

function movement(overrides: Partial<Movement> = {}): Movement {
  return { id: "ZZ-SYNTH-1", openedAt: Date.UTC(2026, 10, 2, 8), ...overrides } as Movement;
}

function referral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: "RF-SYNTH-1",
    raisedAt: RAISED,
    intake: { riskFlags: ["aggression", "absconding"] },
    ...overrides,
  } as unknown as Referral;
}

describe("H10: what the patient page may show from a referral", () => {
  it("shows the named referral's flags and its raised date when the desk holds it", () => {
    const facts = referralSafetyFacts(movement({ referralId: "RF-SYNTH-1" }), referral());
    expect(facts).toMatchObject({ kind: "shown", riskFlags: ["aggression", "absconding"], raisedAt: RAISED });
  });

  it("says not shared when the movement names a referral this desk does not hold", () => {
    expect(referralSafetyFacts(movement({ referralId: "RF-SYNTH-1" }), undefined)).toEqual({ kind: "not_shared" });
  });

  it("never reads a different referral, even for the same person", () => {
    const other = referral({ id: "RF-SYNTH-2" });
    expect(referralSafetyFacts(movement({ referralId: "RF-SYNTH-1" }), other)).toEqual({ kind: "not_shared" });
  });

  it("reads an empty flag list as none flagged, not as no referral", () => {
    const facts = referralSafetyFacts(
      movement({ referralId: "RF-SYNTH-1" }),
      referral({ intake: { riskFlags: [] } } as unknown as Partial<Referral>),
    );
    expect(facts).toMatchObject({ kind: "shown", riskFlags: [] });
  });

  it("returns none with no movement in focus", () => {
    expect(referralSafetyFacts(undefined, referral())).toEqual({ kind: "none" });
  });
});
