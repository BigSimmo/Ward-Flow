import { describe, expect, it } from "vitest";

import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

describe("safeDecodeURIComponent", () => {
  it("decodes an ordinary encoded segment", () => {
    expect(safeDecodeURIComponent("hello%20world")).toBe("hello world");
    expect(safeDecodeURIComponent("ward%2Fbed%3D12")).toBe("ward/bed=12");
  });

  it("returns a malformed segment as typed instead of throwing", () => {
    expect(() => decodeURIComponent("100%")).toThrow(URIError);
    expect(safeDecodeURIComponent("100%")).toBe("100%");
    expect(safeDecodeURIComponent("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
