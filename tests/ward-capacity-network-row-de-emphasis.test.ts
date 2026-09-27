// tests/ward-capacity-network-row-de-emphasis.test.ts
//
// 🔴 THE DEFECT THIS FILE EXISTS FOR: task-1c-fix-brief.md, "The de-emphasis half of the Capacity
// highlight is inert. It has never worked." `.networkTable tbody tr[data-ward-network-row-
// matches="false"] { color: var(--ward-muted); }` never took effect, because `color` is an
// INHERITED property and `ward-table.module.css`'s `.table td { color: var(--text); }` is declared
// on the element itself — a property declared on the element always wins over an inherited value,
// regardless of specificity. Raising specificity on the row selector would not have helped; the
// mechanism was never specificity. Fixed by targeting the cells directly:
// `.networkTable tbody tr[...="false"] td { color: var(--ward-muted); }`.
//
// ⚠️ **NO OTHER GATE IN THIS REPOSITORY CAN CATCH THIS.** jsdom (every `.dom.test.tsx` in this
// suite) loads no CSS Module stylesheet, so `getComputedStyle` on a jsdom-rendered cell can never
// report the row's colour — a DOM test can only assert the data attribute and the visible word,
// which is why `ward-capacity-screen.dom.test.tsx` already does exactly that and still missed this.
// This file reads the stylesheets off disk instead, the same technique
// `ward-capacity-bed-map.dom.test.tsx` already uses to prove `.preparing` never declares its own
// `background`.
//
// ⚠️ **THIS FILE IMPORTS NOTHING FROM `src/`.** `test:focused` selects by import graph, so it can
// never pick this file up on its own — it must be run by name:
// `npx vitest run tests/ward-capacity-network-row-de-emphasis.test.ts`.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const CAPACITY_CSS_PATH = "src/components/ward-management/capacity/capacity.module.css";
const WARD_TABLE_CSS_PATH = "src/components/ward-management/ward-table/ward-table.module.css";

/**
 * 🔴 **A NAIVE CSS-TEXT SCAN LIES IN TWO WAYS, BOTH MEASURED ON THIS PROJECT — task-1c-fix-brief.md:**
 *
 *   1. Comments are not code. A rule's own attribute selector, repeated in a doc comment two lines
 *      above the real rule (this file's own `capacity.module.css` edit does exactly that, in its
 *      new header comment), can make a non-greedy `[^}]*?\{` regex swallow the comment's prose as
 *      if it were the selector, because the comment has no `{` of its own to stop at and the regex
 *      just keeps going until it finds the real rule's brace.
 *   2. Every ward colour token is redeclared inside `@media (forced-colors: active)` and
 *      `@media print` blocks, and a scanner that does not skip them can attribute a forced-colors
 *      override to the base rule. `ward-tokens.module.css` carries both kinds of block; the two
 *      files this test reads do not today, but the stripper below is applied unconditionally
 *      rather than assumed unnecessary, and is proven to actually strip (not merely find nothing
 *      to strip) on a synthetic string below.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/**
 * Removes every `@media (forced-colors: active) { ... }` / `@media print { ... }` block, including
 * its full nested contents, by counting braces rather than matching to the first `}` — a naive
 * `[^}]*\}` stops at the FIRST inner rule's closing brace and leaves the rest of the block (and its
 * own trailing `}`) in the output as loose text.
 */
function stripAtRuleBlocks(css: string, atRuleStart: RegExp): string {
  let out = "";
  let cursor = 0;
  for (;;) {
    atRuleStart.lastIndex = cursor;
    const match = atRuleStart.exec(css);
    if (!match) {
      out += css.slice(cursor);
      return out;
    }
    out += css.slice(cursor, match.index);
    const openBrace = css.indexOf("{", match.index);
    if (openBrace === -1) {
      out += css.slice(match.index);
      return out;
    }
    let depth = 1;
    let i = openBrace + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    cursor = i;
  }
}

function cleanCss(css: string): string {
  let cleaned = stripComments(css);
  cleaned = stripAtRuleBlocks(cleaned, /@media\s*\(\s*forced-colors\s*:\s*active\s*\)/giu);
  cleaned = stripAtRuleBlocks(cleaned, /@media\s+print\b/giu);
  return cleaned;
}

describe("the CSS-text cleaner itself — proven on a synthetic string before it is trusted on a real stylesheet", () => {
  /**
   * 🔴 **THE KNOWN-POSITIVE CONTROL, PER THE BRIEF.** "A scanner that finds nothing looks identical
   * whether the code is clean or the scanner is broken." A stripper that always returns its input
   * unchanged would pass every assertion below that merely checks for ABSENCE of some string — so
   * this control also asserts PRESENCE of the text that must survive, on a fixture built to exercise
   * both traps in one pass: a comment quoting an attribute selector with no `{` of its own, and a
   * forced-colors block nested one level deep.
   */
  it("strips comments and forced-colors/print blocks by brace-matching, without eating what comes after them", () => {
    const synthetic = `
/* a comment mentioning tr[data-x="false"] with no brace of its own, then more prose */
.real tr[data-x="false"] {
  color: var(--muted);
}
@media (forced-colors: active) {
  .real tr[data-x="false"] {
    color: CanvasText;
  }
  .nested { background: red; }
}
@media print {
  .real tr[data-x="false"] { color: black; }
}
.survivor { color: blue; }
`;
    const cleaned = cleanCss(synthetic);
    expect(
      cleaned,
      "the comment was not stripped — a rule text scan could match its prose instead of code",
    ).not.toMatch(/a comment mentioning/u);
    expect(cleaned, "the forced-colors block leaked a declaration past the base rule").not.toMatch(/CanvasText/u);
    expect(cleaned, "the forced-colors block's nested rule leaked").not.toMatch(/\.nested/u);
    expect(cleaned, "the print block leaked a declaration").not.toMatch(/@media print/u);
    expect(cleaned, "the print block's own body leaked past the stripper").not.toMatch(/color:\s*black/u);
    // The real rule and everything after the stripped blocks must survive intact.
    expect(cleaned, "the stripper ate the real rule along with the comment").toMatch(/color:\s*var\(--muted\)/u);
    expect(cleaned, "the stripper ate content after the stripped blocks").toMatch(/\.survivor\s*\{\s*color:\s*blue;/u);
  });
});

describe("Capacity network table row de-emphasis — the highlight half must reach the cells, not stop at the row", () => {
  const rawCapacityCss = readFileSync(CAPACITY_CSS_PATH, "utf8");
  const capacityCss = cleanCss(rawCapacityCss);
  const rawWardTableCss = readFileSync(WARD_TABLE_CSS_PATH, "utf8");
  const wardTableCss = cleanCss(rawWardTableCss);

  /**
   * 🔴 THE CORE REGRESSION GUARD. Finds the rule whose selector contains the "false" (non-matching)
   * attribute value and asserts the selector reaches an actual cell element — `td` or `th` — rather
   * than stopping at the bare row. A selector that stops at `]{` is exactly the inert rule this task
   * fixes: `color` is inherited, and `ward-table.module.css`'s `.table td` declares its own `color`
   * on every cell, so a `color` set no lower than the `<tr>` never wins and never even competes.
   */
  it("targets a cell element under the non-matching row, not the bare row itself", () => {
    const match = /\.networkTable\s+tbody\s+tr\[data-ward-network-row-matches="false"\]([^{]*)\{([^}]*)\}/u.exec(
      capacityCss,
    );
    expect(
      match,
      'no de-emphasis rule found for data-ward-network-row-matches="false" — this guard is vacuous',
    ).not.toBeNull();
    const [, selectorTail, body] = match as RegExpExecArray;
    // The bug's exact shape: the attribute selector on the `<tr>` followed immediately by the rule
    // body, with nothing reaching down to a cell.
    expect(
      selectorTail.trim(),
      `the de-emphasis rule is still scoped to the row only ("${selectorTail.trim() || "<empty>"}") — color is ` +
        "inherited and every <td> in this table declares its own, so this can never take effect",
    ).toMatch(/^(td|th)\b/u);
    expect(body, "the de-emphasis rule no longer sets a colour at all").toMatch(/color\s*:\s*var\(--ward-muted\)/u);
    expect(
      body,
      "do not reach for !important — scope the selector instead (see the shared table's own warning)",
    ).not.toMatch(/!important/u);
  });

  /**
   * The highlight ("true") half is not inherited-property-broken the way the de-emphasis half was
   * — `background` is not inherited, so a row-level declaration paints through a cell's own
   * transparent box. But that is a fact about `ward-table.module.css` not declaring a `background`
   * on `.table td`, not a guarantee, per the brief: "Confirm by the same reasoning that the
   * matching row's background genuinely reaches the cells, rather than assuming it does because it
   * looked right in a screenshot." Pinned here so a future `.table td { background: ... }` addition
   * — which would silently re-break the highlight half the same way this task's de-emphasis half
   * was broken — goes red instead of passing every existing test.
   */
  it("still highlights matching rows via background on the row — and the shared cell rule must never paint its own background over it", () => {
    const highlightMatch =
      /\.networkTable\s+tbody\s+tr\[data-ward-network-row-matches="true"\]([^{]*)\{([^}]*)\}/u.exec(capacityCss);
    expect(
      highlightMatch,
      'no highlight rule found for data-ward-network-row-matches="true" — this guard is vacuous',
    ).not.toBeNull();
    const [, , highlightBody] = highlightMatch as RegExpExecArray;
    expect(highlightBody, "the highlight rule no longer sets a background").toMatch(
      /background\s*:\s*var\(--ward-subtle\)/u,
    );

    /**
     * 🔴 **A FOURTH TRAP, FOUND BY MEASUREMENT: COMPOUND-SELECTOR TEXT ALIASING.**
     * `ward-table.module.css` contains two things a bare `/\.table\s+td\s*\{/` can match, and the
     * wrong one comes first — `.table th,\n.table td {` (border-bottom/padding/text-align/
     * vertical-align) precedes the real `.table td {` rule (color/overflow-wrap) that this
     * assertion actually cares about. `exec` returns the first match, so an unqualified selector
     * scan silently grades the compound rule and can never see a `background` added to the real
     * one. Anchoring on the declaration this assertion is actually about — `color: var(--text)`,
     * which only the real `.table td` rule declares — finds the right rule regardless of which
     * one appears first in the file, rather than relying on selector order staying as measured.
     */
    const cellRuleMatch = /\.table\s+td\s*\{([^}]*color\s*:\s*var\(--text\)[^}]*)\}/u.exec(wardTableCss);
    expect(
      cellRuleMatch,
      "no `.table td { color: var(--text) ... }` rule found in ward-table.module.css — this guard is vacuous",
    ).not.toBeNull();
    const cellRuleBody = (cellRuleMatch as RegExpExecArray)[1];
    expect(
      cellRuleBody,
      "`.table td` now declares its own background-color, which would paint over the row's highlight",
    ).not.toMatch(/background-color\s*:/u);
    expect(
      cellRuleBody,
      "`.table td` now declares the `background` shorthand, which would erase the row's highlight the same way " +
        "the bed-map hatch was found to risk erasing a ready bed's fill",
    ).not.toMatch(/(?<![-\w])background\s*:/u);
  });
});
