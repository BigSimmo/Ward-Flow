import { describe, expect, it } from "vitest";

import { PATIENT_MODES } from "../src/components/ward-management/patients/patient-mode";
import { whyBedDoesNotFit } from "../src/components/ward-management/ward/ward-bed-board-logic";

// Hold and Pull wording sweep (22 Oct 2026): a bed kept for an incoming patient is pulled. Hold is
// kept for a bed kept while its patient is away, on leave or at an ED.
describe("incoming beds read as pulled", () => {
  it("names the patient mode Bed pulled", () => {
    expect(PATIENT_MODES.held.label).toBe("Bed pulled");
  });

  it("says a bed kept for someone on their way is pulled for them", () => {
    const bed = { bedNumber: 7, status: "ready", designation: "Open", heldFor: "PT-045", preparing: false } as const;
    const pick = { kind: "referral", referralId: "R-1", name: "PT-046", secureBedNeeded: false } as const;
    expect(whyBedDoesNotFit(bed, pick, false)).toBe("it is pulled for PT-045");
  });
});
