// tests/ward-raise-referral-gender-diagnosis-guard.test.ts
import { describe, expect, it } from "vitest";

import type { ReferralDraft } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { allEmergencyDepartments } from "../src/components/ward-management/ward-sites";

/**
 * Opus review round 2, 17 September 2026 (P2): `RAISE_REFERRAL` wrote `event.draft.gender` and
 * `event.draft.tentativeDiagnosis` straight onto the created movement with no membership check —
 * unlike `RECEIVE_REFERRAL`, which already refuses an off-list `gender` or `tentativeDiagnosis`.
 * A caller bypassing the picker's own type (a lower-case `"non-binary"`, an invented diagnosis
 * code) reached the movement unrefused. This file pins the refusal `RAISE_REFERRAL` now shares
 * with `RECEIVE_REFERRAL`.
 */

const ED_ID = allEmergencyDepartments()[0]!.id;
const NOW = 9 * 60;

function draft(overrides: Partial<ReferralDraft> = {}): ReferralDraft {
  return {
    cohort: "Older adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    highAcuity: false,
    legalStatus: "Voluntary",
    urgency: 2,
    legalFormCode: null,
    ...overrides,
  };
}

function raise(state: WardFlowState, overrides: Partial<ReferralDraft>): WardFlowState {
  return wardFlowReducer(state, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW,
    edId: ED_ID,
    draft: draft(overrides),
  });
}

describe("engine: RAISE_REFERRAL refuses an off-list gender or diagnosis (Opus review round 2)", () => {
  it('refuses a lower-case "non-binary" gender, membership-checked like RECEIVE_REFERRAL', () => {
    const seeded = seedWardFlowState();
    const before = seeded.movements.length;
    // `as never`: deliberately bypassing the picker's own `ReferralGender` type, the same way a
    // caller outside this codebase's own type-checked screens could.
    const after = raise(seeded, { gender: "non-binary" as never });

    expect(after.rejections, "an off-list gender must be refused").toHaveLength(1);
    expect(after.rejections[0]!.reason).toMatch(/RAISE_REFERRAL gender must be chosen from REFERRAL_GENDERS/);
    expect(after.movements.length, "a refused RAISE_REFERRAL must create nothing").toBe(before);
  });

  it('refuses an invented diagnosis code "F99-invented", membership-checked like RECEIVE_REFERRAL', () => {
    const seeded = seedWardFlowState();
    const before = seeded.movements.length;
    const after = raise(seeded, { tentativeDiagnosis: "F99-invented" as never });

    expect(after.rejections, "an off-list diagnosis code must be refused").toHaveLength(1);
    expect(after.rejections[0]!.reason).toMatch(
      /RAISE_REFERRAL tentativeDiagnosis must be chosen from TENTATIVE_DIAGNOSIS_BLOCKS/,
    );
    expect(after.movements.length, "a refused RAISE_REFERRAL must create nothing").toBe(before);
  });

  it("still accepts a real gender and a real diagnosis code together", () => {
    const seeded = seedWardFlowState();
    const before = seeded.movements.length;
    const after = raise(seeded, { gender: "Non-binary", tentativeDiagnosis: "F30–F39" });

    expect(after.rejections).toEqual([]);
    expect(after.movements.length).toBe(before + 1);
  });
});
