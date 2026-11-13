import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Spec item 5 (13 Nov 2026), checked against the approved pictures: when a box or sheet opens on its
 * heading (`tabindex="-1"`, `openingFocusTarget`) or a scroll-only body takes a tab stop (a named
 * region, `useScrollBodyFocus` and the sheet and drawer `bodyLabel`), the ring is the kit's 2px
 * `--wf-focus-ring`, never the browser's own outline. The rules are global so every kit box, the
 * phone sheet and dark mode share them; `:where` keeps them weightless so a part's own rule wins.
 */
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function rule(selector: string) {
  const at = css.indexOf(`${selector}:focus-visible {`);
  expect(at, selector).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf("}", at));
}

describe("kit focus ring on an opening heading and a scroll-only body", () => {
  it("draws the 2px focus ring token on a heading a box opens on", () => {
    expect(rule(':where(:is(h1, h2, h3, h4, h5, h6, [role="heading"])[tabindex="-1"])')).toMatch(
      /outline: 2px solid var\(--wf-focus-ring, var\(--focus\)\);\s*outline-offset: 2px;/u,
    );
  });

  it("draws it inside a scroll-only body's edge, where the box cannot clip it", () => {
    expect(rule(':where([role="region"][tabindex="0"])')).toMatch(
      /outline: 2px solid var\(--wf-focus-ring, var\(--focus\)\);\s*outline-offset: -2px;/u,
    );
  });
});
