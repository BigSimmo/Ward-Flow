// tests/ward-table-panel-inset.test.ts
//
// Task 6a — the table inset question, settled: a table's first column must line up with the
// heading above it. `docs/ward-flow/design/screen-adoption-playbook.md` (`search` adoption, "What
// `search` did NOT exercise") named the two sides of this as a known unresolved misalignment:
// `ward-table/ward-table.module.css`'s `.table th`/`.table td` inset horizontally by one token
// while `ward-panel.module.css`'s `.panelHeader` (every panel's own heading row) insets by another.
//
// This test reads both stylesheets from disk and compares the HORIZONTAL component of each rule's
// `padding` shorthand — never the vertical component, which is deliberately different (a table row
// is denser than a panel header by design, and nothing about this alignment question asks for that
// to change). It is a static CSS-text assertion, not a rendered measurement: jsdom loads no CSS
// Module stylesheet, so no DOM test in this repo can read a computed padding
// (`tests/ward-table-single-source.test.ts` and `tests/ward-design-language-contract.test.ts` use
// the identical strip-then-match approach for the same reason).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WARD_DIR = "src/components/ward-management";
const TABLE_PATH = join(WARD_DIR, "ward-table", "ward-table.module.css").split("\\").join("/");
const PANEL_PATH = join(WARD_DIR, "ward-panel.module.css").split("\\").join("/");

/** Same brace-matching strip used by `ward-table-single-source.test.ts` and
 *  `ward-token-layer.test.ts` — a naive regex closes on the first inner rule's own `}`, not the
 *  media block's, so a real depth walk is required rather than `/@media[^{]*\{[^}]*\}/`. */
function stripAtMediaBlocks(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@media", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    const braceStart = css.indexOf("{", at);
    if (braceStart === -1) {
      out += css.slice(at);
      break;
    }
    let depth = 1;
    let j = braceStart + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") depth -= 1;
      j += 1;
    }
    i = j;
  }
  return out;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

/** Comments stripped, then `@media`/`@media print` blocks stripped — order matters, since a real
 *  comment could contain the literal text "@media" followed by something brace-shaped. Matches
 *  `ward-table-single-source.test.ts`'s `baseDeclarations`, so both tables' and panels' BASE
 *  declarations are compared, never a forced-colors or print override of either. */
function baseDeclarations(css: string): string {
  return stripAtMediaBlocks(stripComments(css));
}

/** The horizontal component of a CSS `padding` shorthand: `<vert> <horiz>` yields `<horiz>`,
 *  a single value yields itself (all four sides share it), and `<top> <horiz> <bottom>` also
 *  yields the middle token — the three shapes this design language's own rules actually use.
 *  Never handles the four-value form: nothing in either file declares one, and a rule that started
 *  doing so would be a big enough change that this parser should be revisited, not silently guess. */
function horizontalPaddingToken(paddingValue: string): string {
  const tokens = paddingValue.trim().split(/\s+/u);
  if (tokens.length === 1) return tokens[0];
  if (tokens.length === 2 || tokens.length === 3) return tokens[1];
  throw new Error(`unexpected padding shorthand with ${tokens.length} values: "${paddingValue}"`);
}

/** Pulls the `padding` declaration's value out of one already-isolated rule body. Throws rather
 *  than returning `undefined` on a miss — a control that cannot fail here would be a scanner that
 *  looks like it is checking something and is not (see this task's own brief on that trap). */
function paddingValue(ruleBody: string): string {
  const match = /padding\s*:\s*([^;]+);/u.exec(ruleBody);
  if (!match) throw new Error(`no padding declaration found in rule body: ${ruleBody}`);
  return match[1];
}

describe("a ward table's cell inset agrees with its panel header's inset", () => {
  /** ⚠️ KNOWN-POSITIVE CONTROL, PRINTED ON EVERY RUN — this task's own brief requires it of any
   *  scanner over CSS text: a scanner that finds nothing looks identical whether the code is clean
   *  or the scanner is broken. Confirms the extraction functions actually parse a real three-token
   *  shorthand before either file below is trusted. */
  it("control: horizontalPaddingToken reads the middle token of a known three-value shorthand", () => {
    const control = horizontalPaddingToken("var(--ward-space-12) var(--ward-space-16) 0");
    expect(control, "known-positive control failed — the parser itself is broken").toBe("var(--ward-space-16)");
  });

  it("`.table th`/`.table td` (ward-table.module.css) declares a padding rule to compare", () => {
    const css = baseDeclarations(readFileSync(TABLE_PATH, "utf8"));
    const match = /\.table\s+th,\s*\.table\s+td\s*\{([^{}]*)\}/u.exec(css);
    expect(match, `expected to find the ".table th, .table td" rule in ${TABLE_PATH}`).not.toBeNull();
  });

  it("`.panelHeader` (ward-panel.module.css) declares a padding rule to compare", () => {
    const css = baseDeclarations(readFileSync(PANEL_PATH, "utf8"));
    const match = /\.panelHeader\s*\{([^{}]*)\}/u.exec(css);
    expect(match, `expected to find the ".panelHeader" rule in ${PANEL_PATH}`).not.toBeNull();
  });

  it("the table cell's horizontal inset equals the panel header's horizontal inset", () => {
    const tableCss = baseDeclarations(readFileSync(TABLE_PATH, "utf8"));
    const tableMatch = /\.table\s+th,\s*\.table\s+td\s*\{([^{}]*)\}/u.exec(tableCss);
    if (!tableMatch) throw new Error(`expected to find the ".table th, .table td" rule in ${TABLE_PATH}`);
    const tableHorizontal = horizontalPaddingToken(paddingValue(tableMatch[1]));

    const panelCss = baseDeclarations(readFileSync(PANEL_PATH, "utf8"));
    const panelMatch = /\.panelHeader\s*\{([^{}]*)\}/u.exec(panelCss);
    if (!panelMatch) throw new Error(`expected to find the ".panelHeader" rule in ${PANEL_PATH}`);
    const panelHorizontal = horizontalPaddingToken(paddingValue(panelMatch[1]));

    expect(
      tableHorizontal,
      `a table's first column (${tableHorizontal}) must line up with its panel header (${panelHorizontal}) — ` +
        `see the doc comment above ".table th, .table td" in ${TABLE_PATH} for the settled decision`,
    ).toBe(panelHorizontal);
  });
});
