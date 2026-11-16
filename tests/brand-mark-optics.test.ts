import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BRAND_FIELD,
  BRAND_MASTERS,
  BRAND_ON_DARK,
  BRAND_ON_LIGHT,
  brandIconSvg,
  brandMarkInner,
  pickBrandMaster,
} from "@/lib/brand-mark";

/**
 * The BedChart mark (D-261) is four optical masters, not one drawing scaled. These tests guard the
 * size rule, the shared ink box that lets the mark sit in a line of type, the crease being a cut
 * rather than a painted line, the committed favicon matching the source, and the colours staying
 * on the v9 tokens.
 */

const tokens = readFileSync(new URL("../src/app/ward-flow-v9-tokens.css", import.meta.url), "utf8");
const darkStart = tokens.indexOf('\n:root[data-theme="dark"],');
const lightBlock = tokens.slice(0, darkStart);
const darkBlock = tokens.slice(darkStart);

function token(block: string, name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(block);
  expect(match, `${name} is not set`).not.toBeNull();
  return (match as RegExpExecArray)[1].toLowerCase();
}

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

describe("the colours", () => {
  it("stay on the v9 tokens", () => {
    expect(BRAND_ON_LIGHT.pillow).toBe(token(lightBlock, "--wf-pri-1"));
    expect(BRAND_ON_LIGHT.bed).toBe(token(lightBlock, "--wf-hero-2"));
    expect(BRAND_ON_DARK.pillow).toBe(token(darkBlock, "--wf-accent"));
    expect(BRAND_ON_DARK.bed).toBe(token(darkBlock, "--wf-ink-1"));
    expect(BRAND_FIELD.light).toBe(token(lightBlock, "--wf-hero-1"));
    expect(BRAND_FIELD.dark).toBe(token(darkBlock, "--wf-surface"));
  });

  it("match the in-app brand tokens", () => {
    expect(token(lightBlock, "--wf-brand-pillow")).toBe(BRAND_ON_LIGHT.pillow);
    expect(token(lightBlock, "--wf-brand-bed")).toBe(BRAND_ON_LIGHT.bed);
    expect(token(lightBlock, "--wf-brand-hero-pillow")).toBe(BRAND_ON_DARK.pillow);
    expect(token(lightBlock, "--wf-brand-hero-bed")).toBe(BRAND_ON_DARK.bed);
    expect(token(darkBlock, "--wf-brand-pillow")).toBe(BRAND_ON_DARK.pillow);
    expect(token(darkBlock, "--wf-brand-bed")).toBe(BRAND_ON_DARK.bed);
  });
});

describe("the committed browser-tab icon", () => {
  it("is exactly what brandIconSvg() draws", () => {
    const committed = readFileSync(new URL("../src/app/icon.svg", import.meta.url), "utf8");
    expect(committed).toBe(brandIconSvg());
  });
});
