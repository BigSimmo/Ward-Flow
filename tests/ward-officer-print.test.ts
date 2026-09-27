import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { blankCssComments } from "./helpers/strip-source-comments";

function source(path: string): string {
  return blankCssComments(readFileSync(resolve(process.cwd(), path), "utf8"));
}

/**
 * R2-14 — officer-screen print loss. The screen already had a print block, but it only lifted
 * height on `.jobsPanel` while fleet/jobs/refusals still carried `overflow: hidden`, so content
 * clipped once the sheet paginated. This guard pins the overflow reset and the ink/paper pair.
 */
describe("Transport officer — print keeps job content visible", () => {
  function printBlock(): string {
    const css = source("src/components/ward-management/officer/officer.module.css");
    const printStart = css.indexOf("@media print {");
    expect(printStart, "officer.module.css: could not find the @media print block").toBeGreaterThanOrEqual(0);
    return css.slice(printStart);
  }

  it("resets .screen background and pins color-scheme: light so CanvasText is never white-on-white", () => {
    const block = printBlock();
    const screenRuleStart = block.indexOf(".screen {");
    const screenRuleEnd = block.indexOf("}", screenRuleStart);
    expect(screenRuleStart).toBeGreaterThanOrEqual(0);
    const screenRule = block.slice(screenRuleStart, screenRuleEnd);
    expect(screenRule).toContain("background: none");
    expect(screenRule).toContain("color-scheme: light");
  });

  it("opens overflow on the content panels that clip on screen", () => {
    const block = printBlock();
    for (const selector of [".jobsPanel", ".fleetPanel", ".refusals"]) {
      expect(block, `${selector} must appear in the print block`).toContain(selector);
    }
    expect(block).toMatch(/\.jobsPanel[\s\S]*overflow:\s*visible\s*!important/);
    expect(block).toMatch(/\.fleetPanel[\s\S]*overflow:\s*visible\s*!important/);
    expect(block).toMatch(/\.refusals[\s\S]*overflow:\s*visible\s*!important/);
  });

  it("hides interactive chrome and keeps the jobs panel visible", () => {
    const block = printBlock();
    expect(block).toMatch(/\.actionRow[\s\S]*display:\s*none\s*!important/);
    expect(block).toMatch(/\.inactiveRow[\s\S]*display:\s*none\s*!important/);
    expect(block).toMatch(/\.jobsPanel[\s\S]*display:\s*block\s*!important/);
  });
});
