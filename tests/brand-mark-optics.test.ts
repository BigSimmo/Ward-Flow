import { describe, expect, it } from "vitest";

import { BRAND_MASTERS, BRAND_ON_LIGHT, brandMarkInner, pickBrandMaster } from "@/lib/brand-mark";

/**
 * The BedChart mark (D-261) is four optical masters, not one drawing scaled. These tests guard the
 * size rule, the shared ink box that lets the mark sit in a line of type, the crease being a cut
 * rather than a painted line. The colours and the committed icon.svg are pinned in
 * tests/design-token-contract.test.ts, beside the other token checks.
 */

describe("the size masters", () => {
  it("picks the master by the pixels drawn", () => {
    expect(pickBrandMaster(16)).toBe("micro");
    expect(pickBrandMaster(17)).toBe("small");
    expect(pickBrandMaster(23)).toBe("small");
    expect(pickBrandMaster(24)).toBe("text");
    expect(pickBrandMaster(47)).toBe("text");
    expect(pickBrandMaster(48)).toBe("display");
    expect(pickBrandMaster(512)).toBe("display");
  });

  it("drops the fold only at micro size", () => {
    expect(BRAND_MASTERS.micro.flap).toBeNull();
    for (const name of ["display", "text", "small"] as const) {
      expect(BRAND_MASTERS[name].flap).toBeTruthy();
      expect(BRAND_MASTERS[name].crease).toBeGreaterThan(0);
    }
  });

  it("thickens the crease as the mark gets smaller, so the fold still reads", () => {
    const { display, text, small } = BRAND_MASTERS;
    expect(display.crease).toBeLessThan(text.crease);
    expect(text.crease).toBeLessThan(small.crease);
  });

  it("centres every master's ink box in its grid", () => {
    for (const m of Object.values(BRAND_MASTERS)) {
      expect(m.ink.x + m.ink.width / 2).toBeCloseTo(m.viewBox / 2, 5);
      expect(m.ink.y + m.ink.height / 2).toBeCloseTo(m.viewBox / 2, 5);
    }
  });

  it("puts every micro edge on a whole pixel", () => {
    const numbers = `${BRAND_MASTERS.micro.pillow} ${BRAND_MASTERS.micro.bed}`.match(/-?\d+(\.\d+)?/g) ?? [];
    for (const n of numbers) expect(Number(n) * 2, n).toBe(Math.round(Number(n) * 2));
  });
});

describe("the crease", () => {
  it("is cut with a mask, so the mark sits on any ground", () => {
    const inner = brandMarkInner(BRAND_ON_LIGHT, "display", "t");
    expect(inner).toContain('<mask id="t"');
    expect(inner).toContain('stroke="#000"');
    expect(inner).toContain('mask="url(#t)"');
  });
});
