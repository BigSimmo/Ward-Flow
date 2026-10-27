import { describe, expect, it } from "vitest";

import { declineToastText } from "@/components/ward-management/ward/ward-answer-feedback";

/**
 * PC report reconciliation (26 Oct 2026): "No suitable bed" and "Bed pulled for earlier referral"
 * put the referral on the ward's waitlist in the engine, so the Ward answer toast must not say
 * "Referral declined" for them.
 */
describe("Ward answer decline toast wording", () => {
  it("says waitlisted for the two reasons the engine waitlists", () => {
    expect(declineToastText("no_suitable_bed")).toBe("Referral waitlisted for this ward.");
    expect(declineToastText("bed_pulled_for_earlier_referral")).toBe("Referral waitlisted for this ward.");
  });

  it("says declined for any other reason", () => {
    expect(declineToastText("capability_mismatch")).toBe("Referral declined.");
    expect(declineToastText(undefined)).toBe("Referral declined.");
  });
});
