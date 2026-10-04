import { describe, expect, it } from "vitest";

import { csvCell } from "@/components/ward-management/statistics/statistics-csv";

describe("statistics CSV cells", () => {
  it.each(["=cmd|x", "+1", "-1+1", "@cmd", "\tx", "\rx"])("neutralises %j", (text) => {
    expect(csvCell(text).startsWith(`"'`)).toBe(true);
  });
  it("quotes ordinary text, doubles quotes and leaves numbers alone", () => {
    expect(csvCell('Ward "A"')).toBe('"Ward ""A"""');
    expect(csvCell(-3)).toBe('"-3"');
  });
});
