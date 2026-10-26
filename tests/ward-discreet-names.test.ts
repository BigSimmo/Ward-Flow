import { describe, expect, it } from "vitest";

import { patientNameAsGiven } from "@/components/ward-management/settings/discreet-names";
import { patientResultTitle, type SearchResultItem } from "@/components/ward-management/ward-global-search";

// D-83 (Josh, 26 Oct 2026; fresh audit W-9): names in full everywhere. The Discreet names on phone
// setting (A2-20) was removed, so the shared name formatter returns the name as given. Synthetic names only.
// `usePatientNameDisplay` returns this formatter.
const nameFor: (name: string, umrn: string | undefined | null) => string = patientNameAsGiven;

describe("patient names are shown in full", () => {
  it("returns the name as given, in either name form", () => {
    expect(nameFor("Halloway, Talia", "UM100001")).toBe("Halloway, Talia");
    expect(nameFor("Talia Halloway", undefined)).toBe("Talia Halloway");
  });

  it("gives person and movement search results their full name", () => {
    const base = { kindLabel: "", href: "/" };
    const person = { ...base, kind: "person", id: "PT-1", title: "Halloway, Talia", umrn: "UM100001" } as const;
    const movement = {
      ...base,
      kind: "movement",
      id: "WF-1",
      title: "Halloway, Talia",
      subjectUmrn: "UM100001",
    } as const;
    expect(patientResultTitle(person as SearchResultItem, nameFor)).toBe("Halloway, Talia");
    expect(patientResultTitle(movement as SearchResultItem, nameFor)).toBe("Halloway, Talia");
  });
});
