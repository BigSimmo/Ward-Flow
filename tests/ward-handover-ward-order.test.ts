import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wardsByService } from "@/components/ward-management/handover/handover-model";

// D-126 (Josh, 10 Nov 2026): handover Beds lists each health service's wards A to Z, not most ready
// beds first, and desktop and phone show the same order. Synthetic ward names only.
const ward = (name: string, service: "North Metro" | "South Metro", ready: number) => ({ name, service, ready });

describe("handover Beds ward order (D-126)", () => {
  it("lists each service's wards A to Z, so a ward with more ready beds no longer comes first", () => {
    const groups = wardsByService([
      ward("Birch", "North Metro", 0),
      ward("Cedar", "North Metro", 6),
      ward("Ash", "North Metro", 1),
      ward("Willow", "South Metro", 9),
      ward("Elm", "South Metro", 0),
    ]);
    expect(groups.map((group) => group.service)).toEqual(["North Metro", "South Metro"]);
    expect(groups.map((group) => group.wards.map((w) => w.name))).toEqual([
      ["Ash", "Birch", "Cedar"],
      ["Elm", "Willow"],
    ]);
  });

  it("desktop and phone handover both take their ward order from wardsByService", () => {
    for (const file of ["handover-beds.tsx", "handover-phone.tsx"]) {
      const source = readFileSync(`src/components/ward-management/handover/${file}`, "utf8");
      expect(source, file).toContain("wardsByService(wards)");
      expect(source, file).not.toMatch(/b\.ready\s*-\s*a\.ready/u);
    }
  });
});
