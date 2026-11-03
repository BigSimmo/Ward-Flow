import { describe, expect, it } from "vitest";

import type { CensusRow } from "../src/components/ward-management/search/patient-census";
import {
  censusSections,
  countPatientStates,
  patientStateOf,
} from "../src/components/ward-management/search/patient-states";

// PS1 (3 Nov 2026): the Patients register's state switch. Synthetic rows, only the fields read.
function row(group: CensusRow["group"], where: string, communityTeam: string | null = null): CensusRow {
  return { key: `${group}-${where}-${communityTeam}`, group, where, communityTeam } as CensusRow;
}

describe("Patients register states (PS1)", () => {
  it("puts each census row in exactly one state", () => {
    expect(patientStateOf(row("ask", "ARM ED"))).toBe("ed");
    expect(patientStateOf(row("wait", "ED not recorded"))).toBe("ed");
    expect(patientStateOf(row("wait", "RPH Community"))).toBe("placement");
    expect(patientStateOf(row("wait", "Not in hospital", "Albany Community Team"))).toBe("placement");
    expect(patientStateOf(row("found", "ARM ED"))).toBe("placement");
    expect(patientStateOf(row("move", "In transit"))).toBe("placement");
    expect(patientStateOf(row("ward", "Dabakarn"))).toBe("inpatient");
    expect(patientStateOf(row("ward", "At ED"))).toBe("inpatient");
    expect(patientStateOf(row("off", "Community", "Albany Community Team"))).toBe("community");
    expect(patientStateOf(row("off", "Not in hospital"))).toBe("off");
  });

  it("counts add up to everyone", () => {
    const rows = [
      row("ask", "ARM ED"),
      row("wait", "RPH Community"),
      row("ward", "Dabakarn"),
      row("off", "Community", "Albany Community Team"),
      row("off", "Not in hospital"),
    ];
    const counts = countPatientStates(rows);
    expect(counts).toEqual({ all: 5, ed: 1, placement: 1, inpatient: 1, community: 1, off: 1 });
    expect(counts.ed + counts.placement + counts.inpatient + counts.community + counts.off).toBe(counts.all);
  });

  it("splits records with nothing open so Community and Not active each match one section", () => {
    const rows = [row("off", "Community", "Albany Community Team"), row("off", "Not in hospital")];
    const sections = censusSections(rows);
    const team = sections.find((section) => section.key === "team");
    const off = sections.find((section) => section.key === "off");
    expect(team?.label).toBe("With a community team");
    expect(team?.rows).toHaveLength(countPatientStates(rows).community);
    expect(off?.rows).toHaveLength(countPatientStates(rows).off);
  });

  it("splits people with no bed yet by source, ED waits first (M1)", () => {
    const rows = [row("wait", "RPH Community"), row("wait", "ARM ED"), row("ask", "ARM ED")];
    const keys = censusSections(rows).map((section) => section.key);
    expect(keys.indexOf("wait")).toBeLessThan(keys.indexOf("wait-list"));
    expect(keys).not.toContain("ask-list");
    const list = censusSections(rows).find((section) => section.key === "wait-list");
    expect(list?.rows.map((r) => r.where)).toEqual(["RPH Community"]);
  });
});
