import { describe, expect, it } from "vitest";

import { discreetPatientName, patientInitials } from "@/components/ward-management/settings/discreet-names";
import { patientResultTitle, type SearchResultItem } from "@/components/ward-management/ward-global-search";

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

  it("applies to person and movement search results only, through the given name display", () => {
    const discreet = (name: string, umrn: string | undefined | null) => discreetPatientName(name, umrn);
    const plain = (name: string) => name;
    const base = { kindLabel: "", href: "/" };
    const person = { ...base, kind: "person", id: "PT-1", title: "Halloway, Talia", umrn: "UM100001" } as const;
    const movement = {
      ...base,
      kind: "movement",
      id: "WF-1",
      title: "Halloway, Talia",
      subjectUmrn: "UM100001",
    } as const;
    const ward = { ...base, kind: "ward", id: "U-1", title: "Ward Talia" } as const;
    expect(patientResultTitle(person as SearchResultItem, discreet)).toBe("TH · UM100001");
    expect(patientResultTitle(movement as SearchResultItem, discreet)).toBe("TH · UM100001");
    expect(patientResultTitle(ward as unknown as SearchResultItem, discreet)).toBe("Ward Talia");
    // Desktop (the hook's non-phone form) keeps the name as given.
    expect(patientResultTitle(person as SearchResultItem, plain)).toBe("Halloway, Talia");
  });

  it("leaves a name with no recorded UMRN as the resolver gave it", () => {
    expect(discreetPatientName("Unknown Patient", "UMRN not recorded")).toBe("Unknown Patient");
    expect(discreetPatientName("Initials TH", undefined)).toBe("Initials TH");
  });
});
