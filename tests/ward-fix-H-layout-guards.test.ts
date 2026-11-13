import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Audit 5 layout fixes (13 Nov 2026), guarded at the stylesheet level so a cut cannot return:
 * A5-07 the Waiting wait cell, A5-08 Decline on a phone referral panel, A5-09 the phone Bed board's
 * Show picker under the folder sheet, and A5-01 the left-hand menu on a laptop-height window.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const wm = "src/components/ward-management";

/** The body of the first `@media <query> {` block, up to its closing brace at column 0. */
function mediaBlock(css: string, query: string, from = 0): string {
  const start = css.indexOf(`@media ${query} {`, from);
  expect(start, `no @media ${query}`).toBeGreaterThan(-1);
  const end = css.indexOf("\n}\n", start);
  return css.slice(start, end);
}

/** The declarations of `selector { … }` inside a block. */
function rule(block: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = block.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "u"));
  expect(match, `no rule for ${selector}`).not.toBeNull();
  return match![1];
}

describe("A5-07 Waiting: the wait figure is never cut", () => {
  const css = read(`${wm}/delays/delays-board.module.css`);

  it("the table's wait cell wraps its label under the figure instead of clipping it", () => {
    const table = mediaBlock(css, "(min-width: 46.5rem)");
    expect(rule(table, ".tbl .cWait")).toMatch(/white-space:\s*normal/u);
    const wait = rule(table, ".tbl .cWait .wt");
    expect(wait).toMatch(/flex:\s*0 1 auto/u);
    expect(wait).toMatch(/flex-wrap:\s*wrap/u);
    expect(wait).toMatch(/min-width:\s*0/u);
    const label = rule(table, ".tbl .cWait .wt > .lg");
    expect(label).toMatch(/flex-basis:\s*100%/u);
    expect(label).toMatch(/white-space:\s*normal/u);
  });

  it("the phone row's wait shrinks to its 6rem column, so a long in-transit label wraps", () => {
    // The phone row's column rules live in the later phone block that sets the 6rem time column.
    const at = css.indexOf("grid-template-columns: auto minmax(0, 1fr) 6rem;");
    expect(at).toBeGreaterThan(-1);
    const phone = css.slice(css.lastIndexOf("@media (max-width: 46.4375rem) {", at));
    expect(rule(phone, ".r .wt")).toMatch(/flex:\s*0 1 auto/u);
    expect(phone).toMatch(/\.r \.cWait,\s*\.r \.wcell\s*\{[^}]*min-width:\s*0/u);
  });
});

describe("A5-08 phone referral panel: Decline keeps its whole word", () => {
  const css = read(`${wm}/referrals/referral-match-phone.module.css`);

  it("the quiet row's first button sizes from its label and never shrinks below it", () => {
    expect(rule(css, ".foot[data-in-drawer] > :first-child")).toMatch(/flex:\s*1 0 auto/u);
  });
});

describe("A5-09 phone Bed board: the Show picker clears the folder sheet's edge", () => {
  const css = read(`${wm}/board/board.module.css`);

  it("the bed list carries the 12px top margin the board's other blocks carry", () => {
    const at = css.indexOf("\n  .screen .phoneBeds {");
    expect(at).toBeGreaterThan(-1);
    const phone = mediaBlock(css, "screen and (max-width: 46.4375rem)", css.lastIndexOf("@media", at));
    const margin = rule(phone, ".screen .phoneBeds").match(/margin:\s*([^;]+);/u)?.[1];
    expect(margin).toBe("var(--wf-s-3) 0");
  });
});

describe("A5-01 the left-hand menu fits a laptop-height window", () => {
  const css = read(`${wm}/shell/ward-rail.module.css`);
  const tsx = read(`${wm}/shell-next/next-rail-body.tsx`);

  it("under 850px tall the Bed alerts card folds to its pill", () => {
    const fold = mediaBlock(css, "screen and (min-width: 62.5625rem) and (max-height: 53.0625rem)");
    expect(fold).toMatch(
      /\.rail\[data-rail="open"\] \.capacityPulseStrip \.capacityFold,\s*\.rail\[data-rail="open"\] \.capacityPulseStrip \.alertsEyebrow\s*\{\s*display:\s*none;/u,
    );
    // Both the place rows and the ready line carry the fold class.
    expect(tsx.match(/\$\{styles\.capacityFold\}/gu)?.length).toBe(2);
  });

  it("under 700px tall the counted rows drop their quiet second line and its height", () => {
    const short = mediaBlock(css, "screen and (min-width: 62.5625rem) and (max-height: 43.75rem)");
    expect(rule(short, '.rail[data-rail="open"] .railState')).toMatch(/display:\s*none/u);
    expect(rule(short, '.rail[data-rail="open"] .railLink[data-two-line="true"]')).toMatch(
      /min-height:\s*var\(--wf-h-md\)/u,
    );
    // The short-window rules come after the desktop two-line height they override.
    expect(css.indexOf("(max-height: 43.75rem)")).toBeGreaterThan(
      css.indexOf('.rail[data-rail="open"] .railLink[data-two-line="true"] {\n    min-height: 2.875rem;'),
    );
  });
});
