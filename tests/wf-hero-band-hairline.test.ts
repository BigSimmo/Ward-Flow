import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Alerts redesign (Josh, 1 Nov 2026): a grey hairline showed under the header band in any scaled
 * or zoomed view, where the lip at bottom -1px and the band's fill to its exact edge anti-aliased.
 * The lip now sits inside the band and the band's fill stops 4px short of its edge.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//gu, "");

describe("header band hairline", () => {
  for (const file of ["src/components/wf/hero.module.css", "src/components/wf/phone.module.css"]) {
    it(`keeps the band's lip inside the band in ${file}`, () => {
      const css = strip(readFileSync(file, "utf8"));
      const lips = css.match(/\.hero\[data-band="off"\]::after\s*\{[^}]*\}/gu) ?? [];
      expect(lips.length).toBeGreaterThan(0);
      for (const lip of lips) expect(lip).toMatch(/bottom:\s*0;/u);
      expect(css).toMatch(/background-size:\s*100% calc\(100% - 4px\);/u);
    });
  }
});
