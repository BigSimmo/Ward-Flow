import { describe, expect, it } from "vitest";

import { ED_STAGE_LABELS } from "@/components/ward-management/ed/ed-home-derivations";
import { referralIsbarText, type ReferralTextInput } from "@/components/ward-management/referrals/referral-letter";

// Walk-through 26 Oct 2026, Stream C wording. All names and numbers are synthetic.
const input: ReferralTextInput = {
  destinationPhrase: "a ward",
  patientName: "Alex Testperson",
  umrn: "UM000001",
  ageSex: "41, female",
  suburb: "Midland",
  from: "Royal Perth Hospital ED",
  recipients: ["Ward 3"],
  urgency: "Tier 2, urgent",
  legalStatus: "Voluntary",
  reason: "Synthetic reason",
  history: "Synthetic history",
  risks: ["Suicide", "Aggression"],
  clearance: "Cleared",
  clearanceChecklist: "ECG done, Bloods to follow",
  referrer: { name: "Dr Synthetic", role: "Registrar", phone: "08 0000 0001" },
};

describe("walk-through C wording", () => {
  it("WT-40: the ISBAR assessment line keeps the case of risks and clearance items", () => {
    const line = referralIsbarText(input, { referralId: "R-1", sentAt: "10:50" })
      .split("\n")
      .find((text) => text.startsWith("A: "));
    expect(line).toBe("A: Risks: Suicide, Aggression. Medical clearance: Cleared (ECG done, Bloods to follow).");
  });

  it("WT-40: no risks reads as a sentence", () => {
    const text = referralIsbarText(
      { ...input, risks: [], clearanceChecklist: "" },
      { referralId: "R-1", sentAt: "10:50" },
    );
    expect(text).toContain("A: Risks: None selected. Medical clearance: Cleared.");
  });

  it("WT-37: both stages before acceptance read as no bed yet on the ED board and ED TV", () => {
    expect(ED_STAGE_LABELS.placement_requested).toBe("No bed yet");
    expect(ED_STAGE_LABELS.destination_review).toMatch(/^No bed yet/);
  });
});
