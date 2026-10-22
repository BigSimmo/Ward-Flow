import { describe, expect, it } from "vitest";

import { GENDER_NO_LONGER_SUITS_REFUSAL } from "../src/components/ward-management/ward-change-reasons";
import { GENDER_DESIGNATION_PRIVACY_SENTENCE } from "../src/components/ward-management/ward-eligibility";
import { OVERRIDE_REASON_REQUIRED } from "../src/components/ward-management/ward-flow-reducer";
import { wardSafeRejectionReason } from "../src/components/ward-management/ward/ward-rejection-text";

// Josh's phone, 22 Oct 2026: the ward answer card showed "capacity_freshness: Last confirmed 308 min ago — stale".
describe("wardSafeRejectionReason", () => {
  it("names the gate by its label and drops the record id and dashes", () => {
    const reason =
      "FSH Older Adult is not eligible for movement WF-009 — failed gate capacity_freshness: " +
      `Last confirmed 308 min ago, stale. This placement ${OVERRIDE_REASON_REQUIRED}.`;
    const text = wardSafeRejectionReason(reason);
    expect(text).toBe(
      "FSH Older Adult fails the capacity freshness check. Last confirmed 308 min ago, stale. " +
        `This placement ${OVERRIDE_REASON_REQUIRED}.`,
    );
    expect(text).not.toMatch(/_|—|WF-009/u);
  });

  it("reads the referral refusals the same way", () => {
    expect(
      wardSafeRejectionReason(
        "Ward A cannot accept referral R-1 — failed gate allocatable_bed: 0 allocatable. This is not something a recorded reason can override.",
      ),
    ).toBe(
      "Ward A fails the allocatable bed check. 0 allocatable. This is not something a recorded reason can override.",
    );
  });

  it("keeps the gender and sex wording off the ward screens", () => {
    expect(wardSafeRejectionReason("Placement refused: Non-binary placement record missing")).toBe(
      GENDER_DESIGNATION_PRIVACY_SENTENCE,
    );
    expect(wardSafeRejectionReason("The bed designation no longer suits this patient (female only).")).toBe(
      GENDER_NO_LONGER_SUITS_REFUSAL,
    );
  });

  it("leaves any other refusal as written", () => {
    expect(wardSafeRejectionReason("No bed is free.")).toBe("No bed is free.");
  });
});
