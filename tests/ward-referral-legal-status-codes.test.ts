import { describe, expect, it } from "vitest";

import { LEGAL_STATUS_FORM_CODES } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { SELECTABLE_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";

/**
 * WT-14 (walk-through, 26 Oct 2026): the referral's Legal status offered 1A, 4A and 5A only, while
 * the ED raise, Pull the bed and the ward's placement form offered the full intake list. The
 * referral now offers the same list, in the same order, so a patient on Form 3B can be referred as
 * one rather than as an "other" status.
 */
describe("referral legal status choices", () => {
  it("are the intake list's codes, in its order", () => {
    expect(LEGAL_STATUS_FORM_CODES).toEqual(SELECTABLE_LEGAL_FORMS.map((form) => form.code));
  });

  it("include the detention orders the ED board already shows", () => {
    expect(LEGAL_STATUS_FORM_CODES).toContain("3B");
    expect(LEGAL_STATUS_FORM_CODES).not.toContain("Voluntary");
  });
});
