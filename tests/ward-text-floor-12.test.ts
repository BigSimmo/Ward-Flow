import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Design audit (Josh, 1 Nov 2026): 12px is the text floor everywhere, not only on ward routes.
 * The app-wide micro steps sit at the floor, the override register's pills read the 12px token, and
 * the WA map keeps its labels at 12px or more at the size it is drawn, however narrow.
 */
const read = (file: string) => readFileSync(file, "utf8");

describe("12px text floor", () => {
  it("raises the app-wide --text-3xs and --text-2xs steps to 12px", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/--text-3xs:\s*0\.75rem;/u);
    expect(css).toMatch(/--text-2xs:\s*0\.75rem;/u);
  });

  it("draws the override register's pills from the 12px token", () => {
    const source = read("src/components/ward-management/override-register.tsx");
    expect(source).not.toContain("--text-3xs");
    expect(source.match(/fontSize: "var\(--wf-fs-12, 0\.75rem\)"/gu)).toHaveLength(2);
  });

  it("keeps every WA map label at least 12px at the drawn size", () => {
    const css = read("src/components/ward-management/statistics/statistics-wa-map.module.css");
    const block = (selector: string) => {
      // The last block for the selector: the shared stroke rules come before each font rule.
      const start = css.lastIndexOf(`\n${selector} {`);
      expect(start, selector).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf("}", start));
    };
    for (const [selector, set] of [
      [".region", 14],
      [".regionSm", 14],
      [".fig,\n.figSm", 18],
      [".figSm", 13],
      [".label", 16],
      [".sub", 14],
      [".code", 12],
    ] as const) {
      expect(block(selector), selector).toContain(`font-size: max(${set}px, 12px * var(--wa-map-k, 1));`);
    }
    // Each view reads its own units-per-pixel, measured from the drawn width.
    expect(block(".wide")).toContain("--wa-map-k: var(--wa-map-k-wide, 1);");
    expect(block(".phone")).toContain("--wa-map-k: var(--wa-map-k-phone, 1);");
    const source = read("src/components/ward-management/statistics/statistics-wa-map.tsx");
    expect(source).toContain('"--wa-map-k-wide": (VIEW_W / width).toFixed(3)');
    expect(source).toContain('"--wa-map-k-phone": (PHONE_W / width).toFixed(3)');
  });

  it("the floor holds at a narrow drawn width: 600px wide, a 16px label draws 12px, never 10px", () => {
    const k = 960 / 600;
    const drawn = (set: number) => (Math.max(set, 12 * k) * 600) / 960;
    for (const set of [12, 13, 14, 16, 18]) expect(drawn(set)).toBeGreaterThanOrEqual(12);
  });
});
