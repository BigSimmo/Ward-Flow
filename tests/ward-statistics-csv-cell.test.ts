import { describe, expect, it } from "vitest";

import { csvCell, csvProvenanceLines } from "@/components/ward-management/statistics/statistics-csv";

describe("statistics CSV cells", () => {
  it.each(["=cmd|x", "+1", "-1+1", "@cmd", "\tx", "\rx"])("neutralises %j", (text) => {
    expect(csvCell(text).startsWith(`"'`)).toBe(true);
  });
  it("quotes ordinary text, doubles quotes and leaves numbers alone", () => {
    expect(csvCell('Ward "A"')).toBe('"Ward ""A"""');
    expect(csvCell(-3)).toBe('"-3"');
  });
});

describe("CSV export provenance", () => {
  it("keeps the snapshot scope, full time and period in metadata rather than data columns", () => {
    const metadata = csvProvenanceLines({
      asAt: "Fri, 1 Jan 2027, 00:05 AWST",
      scope: "Synthetic ward",
      period: "Current stays in the selected view",
    });
    expect(metadata).toEqual([
      ["Data", "Synthetic, not clinical records"],
      ["As at", "Fri, 1 Jan 2027, 00:05 AWST"],
      ["Scope", "Synthetic ward"],
      ["Period", "Current stays in the selected view"],
      [],
    ]);
  });
});
