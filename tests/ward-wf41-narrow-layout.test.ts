import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WF-41 (5 Nov 2026): at ~610px of card width the ED pressure table clipped inside redesign
 * halves, and on a short phone the sticky segment + dock left roughly half the viewport.
 */
describe("WF-41 narrow layout CSS", () => {
  it("stacks redesign halves that hold ED or ward pressure tables under 80rem", () => {
    const css = readFileSync(
      resolve(__dirname, "../src/components/ward-management/statistics/redesign/statistics-redesign.module.css"),
      "utf8",
    );
    expect(css).toMatch(/WF-41/);
    expect(css).toMatch(
      /@media\s*\(\s*max-width:\s*80rem\s*\)\s*\{[\s\S]*?\.halves:has\(table\[id="edPressureTable"\]\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(css).toMatch(
      /@media\s*\(\s*max-width:\s*80rem\s*\)\s*\{[\s\S]*?\.tableWrap:has\(>\s*table\[id="edPressureTable"\]\)[\s\S]*?overflow-x:\s*auto/,
    );
  });

  it("unsticks the phone segment under 44rem tall", () => {
    const css = readFileSync(
      resolve(__dirname, "../src/components/ward-management/statistics/statistics-phone.module.css"),
      "utf8",
    );
    expect(css).toMatch(/WF-41/);
    expect(css).toMatch(
      /@media\s*\(\s*max-height:\s*44rem\s*\)\s*\{[\s\S]*?\.segPinned\s*\{[\s\S]*?position:\s*static/,
    );
  });

  it("keeps a v6 overflow fallback for pressure tableWraps under 64rem", () => {
    const css = readFileSync(
      resolve(__dirname, "../src/components/ward-management/statistics/statistics-v6.module.css"),
      "utf8",
    );
    expect(css).toMatch(/WF-41/);
    // Base .tableWrap keeps overflow-x: auto (the narrow-viewport fallback named in WF-41).
    expect(css).toMatch(/\.tableWrap\s*\{[\s\S]*?overflow-x:\s*auto/);
  });
});
