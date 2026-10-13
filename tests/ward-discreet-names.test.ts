import { describe, expect, it } from "vitest";

import { discreetPatientName, patientInitials } from "@/components/ward-management/settings/discreet-names";

// A2-20 (owner approved): Discreet names on phone shows initials plus UMRN. Synthetic names only.
describe("discreet patient names", () => {
  it("reads initials in spoken order from either name form", () => {
    expect(patientInitials("Talia Halloway")).toBe("TH");
    expect(patientInitials("Halloway, Talia")).toBe("TH");
    expect(patientInitials("Mary Anne Halloway")).toBe("MH");
  });

  it("gives initials plus UMRN", () => {
    expect(discreetPatientName("Halloway, Talia", "UM100001")).toBe("TH · UM100001");
  });

  it("leaves a name with no recorded UMRN as the resolver gave it", () => {
    expect(discreetPatientName("Unknown Patient", "UMRN not recorded")).toBe("Unknown Patient");
    expect(discreetPatientName("Initials TH", undefined)).toBe("Initials TH");
  });
});
