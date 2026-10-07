import { describe, expect, it } from "vitest";
import { safeDecodeURIComponent } from "@/lib/safe-url";

describe("safeDecodeURIComponent", () => {
  it("decodes standard encoded URI components", () => {
    expect(safeDecodeURIComponent("hello%20world")).toBe("hello world");
    expect(safeDecodeURIComponent("ward%2Fbed%3D12")).toBe("ward/bed=12");
  });

  it("handles null and undefined gracefully with fallback", () => {
    expect(safeDecodeURIComponent(null)).toBe("");
    expect(safeDecodeURIComponent(undefined, "default")).toBe("default");
  });

  it("returns fallback when URI component has invalid percent encoding without throwing URIError", () => {
    expect(() => decodeURIComponent("%99")).toThrow(URIError);
    expect(safeDecodeURIComponent("%99")).toBe("");
    expect(safeDecodeURIComponent("%99", "fallback-unit")).toBe("fallback-unit");
    expect(safeDecodeURIComponent("%E0%A4%A", "safe")).toBe("safe");
  });
});
