import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **THE MONO FACE EARNS ITS PLACE IN A COLUMN AND NOWHERE ELSE.**
 *
 * Ward Lead's ruling, 2026-09-06, after a per-node browser survey of all 26 `--font-mono`
 * declarations in ward stylesheets. **The face is paired with `font-variant-numeric: tabular-nums`
 * for exactly one purpose: so a stack of figures aligns.** That is the whole of what it buys. A
 * value that never sits above a sibling aligns with nothing, so the face buys nothing and costs
 * legibility.
 *
 * **In a column it earns its place; a one-off in a heading, a badge or a sentence does not.**
 *
 * ⚠️ **THE RULE EXISTS BECAUSE GRAMMAR GAVE THE WRONG ANSWER TWICE.** `.clock` renders `"7h 00m"`
 * and `.groupCount` renders `"2 people"` — the same shape, a number with a word attached — and they
 * are ruled opposite ways. Not on "people versus m", which is a real distinction and not the one
 * that decides it: `.clock` is 288 nodes, one per row down a table; `.groupCount` is 42 nodes, one
 * per group heading, never above one another. **A name-based or grammar-based ruling gets that pair
 * exactly backwards, and it is the pair most likely to be ruled on together.**
 *
 * ⚠️ **WHAT THIS FILE CAN AND CANNOT DO.** It reads stylesheets, because jsdom applies no CSS-module
 * styles — `getComputedStyle` on a rendered node reports nothing about these declarations, so there
 * is no DOM route to the assertion. It therefore guards **the declaration returning to a ruled
 * selector**, which is the realistic regression, and not the rendered face.
 *
 * ⚠️ **AND NO FOCUSED RUN CAN SELECT THIS FILE.** `npm run test:focused` selects by `vitest related`,
 * which walks the import graph; this file imports `node:fs` and `vitest` and nothing else. A change
 * that breaks it changes no file it imports. **Only a full run executes it** — the same limitation
 * `ward-prototype-disclosure.test.ts` carries, recorded rather than hidden.
 */

const RULED = [
  // --- prose or one-off: the face must NOT return ---
  {
    file: "src/components/ward-management/ward-modes-second-edition.module.css",
    selector: ".panelBadge",
    face: false,
    why: 'the synthetic-data disclosure — "Synthetic prototype", the one string whose job is to be read as a sentence by somebody who might otherwise believe the data',
  },
  {
    file: "src/components/ward-management/ward-management.module.css",
    selector: ".rowVerdict",
    face: false,
    why: 'renders exactly "Eligible" or "Not eligible" and never a digit in any state',
  },
  {
    file: "src/components/ward-management/ward-record-row.module.css",
    selector: ".groupCount",
    face: false,
    why: "42 nodes, one per group HEADING — they never sit above one another, so nothing aligns",
  },
  {
    file: "src/components/ward-management/capacity/capacity.module.css",
    selector: ".attentionWho",
    face: false,
    why: "ward names and bed-kind needs; 11 nodes, all prose, not one containing a digit",
  },
  {
    file: "src/components/ward-management/ward-panel.module.css",
    selector: ".panelCount",
    face: false,
    why: "21 of the 32 WardPanel call sites that pass a count render English prose",
  },
  // --- columns: the face is CORRECT and removing it is the regression ---
  {
    file: "src/components/ward-management/ward-record-row.module.css",
    selector: ".clock",
    face: true,
    why: "288 nodes, one per row down a table — the alignment is the point",
  },
  {
    file: "src/components/ward-management/ward-bar.module.css",
    selector: ".count",
    face: true,
    why: "bare digits in a legend column; the same file's .zero rule already warns against removing it",
  },
  {
    file: "src/components/ward-management/ward-controls.module.css",
    selector: ".pillCount",
    face: true,
    why: "bare digits, a column of filter counts",
  },
  {
    file: "src/components/ward-management/capacity/capacity.module.css",
    selector: ".gapNumber",
    face: true,
    why: "signed shortfalls down a table column",
  },
];

function ruleBody(file: string, selector: string): string | null {
  /*
   * Deliberately NOT a regex. Building one from the selector needs backslash escaping, and two
   * generated files in this session were broken by escapes being eaten before they reached disk —
   * once producing a literal 0x08 byte where a word boundary was meant. A plain string search over
   * a stylesheet whose selectors are all simple class names cannot go wrong that way.
   */
  const css = readFileSync(file, "utf8");
  const needle = `
${selector} {`;
  const at = css.indexOf(needle);
  if (at === -1) return null;
  const open = at + needle.length;
  const close = css.indexOf("}", open);
  return close === -1 ? null : css.slice(open, close);
}

describe("the monospace face earns its place in a column and nowhere else", () => {
  it("still finds every ruled selector, so the assertions below are not vacuous", () => {
    /*
     * The floor is on the POPULATION WALKED, never on the findings. A floor on violations goes red
     * the day somebody does the right thing, which teaches the next person to delete the guard.
     */
    const missing = RULED.filter((r) => ruleBody(r.file, r.selector) === null);
    expect(
      missing.map((r) => `${r.file} ${r.selector}`),
      "these ruled selectors no longer exist — renamed or removed, and this guard silently stopped " +
        "checking them rather than failing",
    ).toEqual([]);
    expect(RULED.filter((r) => r.face).length, "no column case is being checked").toBeGreaterThan(2);
    expect(RULED.filter((r) => !r.face).length, "no prose case is being checked").toBeGreaterThan(2);
  });

  it("keeps the face off the slots that hold prose or stand alone", () => {
    const wrong: string[] = [];
    for (const rule of RULED.filter((r) => !r.face)) {
      const body = ruleBody(rule.file, rule.selector) ?? "";
      if (/font-family/u.test(body)) wrong.push(`${rule.selector} (${rule.file}) — ${rule.why}`);
    }
    expect(
      wrong,
      "a code face is back on a slot that holds prose or stands alone. The face buys alignment in a " +
        "column and nothing anywhere else.",
    ).toEqual([]);
  });

  it("keeps the face ON the columns, because removing it is the regression this rule is misread as licensing", () => {
    const stripped: string[] = [];
    for (const rule of RULED.filter((r) => r.face)) {
      const body = ruleBody(rule.file, rule.selector) ?? "";
      if (!/font-family:\s*var\(--font-mono\)/u.test(body))
        stripped.push(`${rule.selector} (${rule.file}) — ${rule.why}`);
    }
    expect(
      stripped,
      "the monospace face has been removed from a column of figures. That is what it is FOR: a stack " +
        "of numbers that aligns. Somebody applying 'drop the mono' as a blanket rule takes the " +
        "alignment with it, which is a regression wearing the fix's commit message.",
    ).toEqual([]);
  });
});
