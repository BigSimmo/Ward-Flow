import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { rowSentence, totalsSentence } from "@/components/ward-management/capacity/capacity-screen";
import type { BedKindGap } from "@/components/ward-management/capacity/capacity-derivations";

describe("WF-51 zero-gap copy in capacity-screen", () => {
  it("does NOT contain 'nobody goes without today' in capacity-screen.tsx source", () => {
    const sourcePath = join(process.cwd(), "src/components/ward-management/capacity/capacity-screen.tsx");
    const source = readFileSync(sourcePath, "utf-8");
    expect(source).not.toContain("nobody goes without today");
  });

  it("produces 'net available capacity today' when row gap is 0", () => {
    const zeroGapRow: BedKindGap = {
      id: "open_adult",
      need: "An open adult bed",
      who: "Adult acute (open)",
      waiting: 5,
      bedsThatFit: 5,
      gap: 0,
    };
    const result = rowSentence(zeroGapRow);
    expect(result).toContain("net available capacity today");
    expect(result).toBe("5 waiting (adult acute (open)), exactly 5 beds that fit — net available capacity today.");
  });

  it("produces 'net available capacity today' when totals gap is 0", () => {
    const zeroGapTotals = {
      waiting: 12,
      bedsThatFit: 12,
      gap: 0,
    };
    const result = totalsSentence(zeroGapTotals);
    expect(result).toContain("net available capacity today");
    expect(result).toBe(
      "Across all four bed kinds, 12 people are waiting and exactly 12 beds fit — net available capacity today.",
    );
  });
});
