import { describe, expect, it } from "vitest";

import { referenceTeamDetail } from "@/components/ward-management/reference/ward-reference-teams";
import { buildDirectory, filterDirectoryEntries } from "@/components/ward-management/tools/tools-directory";
import { buildToolsFigures, occupancyPercent } from "@/components/ward-management/tools/tools-figures-model";
import type { Unit } from "@/components/ward-management/ward-model";

const dabakarn = { id: "rph-adult-secure", name: "Dabakarn", siteCode: "RPH" } as Unit;

describe("tools directory", () => {
  it("joins a ward to its fixture extension and a prototype email", () => {
    const ward = buildDirectory([dabakarn]).find((entry) => entry.id === "ward:rph-adult-secure");
    expect(ward).toMatchObject({
      name: "Dabakarn",
      phone: "ext 2105",
      email: "rph-adult-secure@example.invalid",
      provenance: "fixture",
    });
  });

  it("keeps a published community number and leaves a missing email blank", () => {
    const community = buildDirectory([]).filter((entry) => entry.category === "community");
    const published = community.find((entry) => entry.email !== null);
    expect(published).toBeDefined();
    expect(published?.phone).toBe(referenceTeamDetail(published!.name)?.publishedPhone ?? null);
    expect(community.some((entry) => entry.email === null)).toBe(true);
  });

  it("gives new desks unique prototype 94xx extensions and keeps the state bed desk number", () => {
    const book = buildDirectory([]);
    const prototypes = book.filter((entry) => entry.provenance === "prototype");
    expect(prototypes.length).toBeGreaterThan(0);
    for (const entry of prototypes) expect(entry.phone).toMatch(/^ext 94\d\d$/);
    expect(new Set(prototypes.map((entry) => entry.phone)).size).toBe(prototypes.length);
    expect(book.find((entry) => entry.name === "State bed desk")?.phone).toContain("8492");
    expect(book.find((entry) => entry.name === "Mental health transport")?.phone).toBe("ext 7210");
  });

  it("filters by category and by name", () => {
    const book = buildDirectory([dabakarn]);
    expect(filterDirectoryEntries(book, "wards", "dabakarn").map((entry) => entry.id)).toEqual([
      "ward:rph-adult-secure",
    ]);
    expect(filterDirectoryEntries(book, "wards", "no-such-unit")).toEqual([]);
  });
});

describe("tools figures model", () => {
  it("returns an empty network without inventing a percentage", () => {
    const model = buildToolsFigures({
      movements: [],
      units: [],
      admissions: [],
      referrals: [],
      bedReleases: [],
      leaveBeds: [],
      now: 0,
      role: "coordinator",
    });
    expect(model.occupancy).toMatchObject({ occupied: 0, beds: 0, pulled: 0, percent: "—" });
    expect(model.duePassed).toBe(0);
    expect(model.dueSoon).toBe(0);
    expect(model.beds.find((row) => row.id === "ready")?.value).toBe("0");
  });

  it("states occupancy as a percentage of staffed beds", () => {
    expect(occupancyPercent(242, 304)).toBe("79.6%");
    expect(occupancyPercent(50, 100)).toBe("50%");
    expect(occupancyPercent(0, 0)).toBe("—");
  });
});
