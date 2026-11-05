import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { compactOccupancyLabel } from "@/components/ward-management/shell-next/next-rail-parts";

/**
 * WF-44 (5 Nov 2026): closed-rail occupancy pip used a bare "74%" with no place name, and the open
 * rail's Metro foot line sat on the same baseline as "East Metro 75.6%". The helper always pairs a
 * short place with the percent.
 */
describe("WF-44 compact occupancy label", () => {
  it("pairs a short place name with a rounded percent", () => {
    expect(compactOccupancyLabel("East Metro", 75.6)).toBe("East 76%");
    expect(compactOccupancyLabel("Metro", 74.6)).toBe("Metro 75%");
    expect(compactOccupancyLabel("North Metro", 87.2)).toBe("North 87%");
  });

  it("keeps a name that is not a Metro service", () => {
    expect(compactOccupancyLabel("RPH", 91.4)).toBe("RPH 91%");
  });

  it("shows an em dash when occupancy is missing", () => {
    expect(compactOccupancyLabel("East Metro", null)).toBe("—");
  });

  it("is what the closed-rail pip in NextRailBody renders", () => {
    // Full NextRailBody mount needs the shell provider tree; pin the call site instead.
    const source = readFileSync(
      resolve(__dirname, "../src/components/ward-management/shell-next/next-rail-body.tsx"),
      "utf8",
    );
    expect(source).toMatch(/compactOccupancyLabel\(\s*firstRow\?\.name/);
  });
});
