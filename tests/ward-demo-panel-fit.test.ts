import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Shared design parts item 8 (13 Nov 2026), checked against the approved pictures: on a laptop the
 * Demo panel's clock buttons and Reset demo are the kit's 32px small height, inside a 4px inset, so
 * the whole panel fits 1280 x 600 without cutting the last See it as row; a phone keeps 40px drawn
 * (48px tap). The Viewing as bar is a full-width strip, not a rounded inset card.
 */
const root = join(process.cwd(), "src/components/ward-management");
const demo = readFileSync(join(root, "tools/ward-demo-panel.module.css"), "utf8");
const bar = readFileSync(join(root, "shell/ward-viewing-as-bar.module.css"), "utf8");
const PHONE = "@media (max-width: 46.4375rem)";

/** The first declaration block for `selector` outside any media query. */
function block(css: string, selector: string) {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

describe("Demo panel fits a 1280 x 600 laptop", () => {
  it("draws the clock buttons and Reset demo at the kit's small height on a laptop", () => {
    const buttons = block(demo, ".small,\n.reset");
    expect(buttons).toMatch(/min-height: var\(--wf-h-sm\);/u);
    expect(buttons).not.toMatch(/min-height: \d+px/u);
    expect(block(demo, ".clockRow")).toMatch(
      /padding: var\(--wf-s-1\) var\(--wf-s-1\) var\(--wf-s-1\) var\(--wf-s-3\);/u,
    );
  });

  it("keeps 40px buttons on a phone", () => {
    const phone = demo.slice(demo.indexOf(PHONE));
    expect(phone).toMatch(/\.choice,\s*\.small,\s*\.reset \{\s*min-height: 40px;/u);
  });
});

describe("Viewing as bar", () => {
  it("is a full-width strip with a hairline below, not a rounded inset card", () => {
    const strip = block(bar, ".bar");
    expect(strip).not.toMatch(/margin|border-radius|border:/u);
    expect(strip).toMatch(/border-bottom: 1px solid var\(--wf-line-2\);/u);
  });

  it("keeps the words to one line so the way back always shows", () => {
    expect(block(bar, ".text")).toMatch(/white-space: nowrap;[\s\S]*text-overflow: ellipsis;/u);
    expect(block(bar, ".back")).toMatch(/text-decoration: underline;/u);
  });
});
