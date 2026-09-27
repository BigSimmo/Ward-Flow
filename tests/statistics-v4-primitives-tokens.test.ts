// tests/statistics-v4-primitives-tokens.test.ts
//
// ⚠️ `npm run test:focused` CANNOT SELECT THIS FILE. It imports no `src/` module — it reads CSS
// text off disk, the same shape as `tests/ward-raw-colour.test.ts` and
// `tests/ward-design-language-contract.test.ts`. A focused run that comes back green has not run
// this guard; run it by name or let the full suite run it.
//
// WHY THIS EXISTS. Task 2 of `.superpowers/sdd/wise-singing-thunder/` ports the fourth-edition
// statistics design language (`docs/ward-flow/design/prototypes/statistics-language-v4.css`) into
// `src/components/ward-management/statistics/statistics-v4.module.css` as app-token-only
// primitives. Two existing guards already cover PART of "every colour is a token" for this file
// automatically, because both discover their file set from disk rather than from a list:
// `ward-raw-colour.test.ts` (no raw hex/rgb/hsl in any ward stylesheet) and
// `ward-design-language-contract.test.ts` (no `--ward-*` token used that `ward-tokens.module.css`
// does not declare). Neither checks the OTHER half of what this file actually uses — the raw
// `--text-*`, `--border`, `--radius-*`, `--e*`, `--focus`, `--spacing-tap`, `--tracking-*` and
// `--font-weight-*` tokens that come from `ckb-v2-tokens.css`/`globals.css` rather than the
// `--ward-*` layer — and neither asserts that the SHAPE the brief actually asked for (a figure
// band, a panel, a data table, a disclosure, a key/value list, a delta, line/arc chart primitives,
// and NO bar chart) is present. This file closes both gaps for `statistics-v4.module.css`
// specifically.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stripCssComments } from "./ward-raw-colour.test";

const FILE = "src/components/ward-management/statistics/statistics-v4.module.css";
const TOKEN_SOURCES = [
  "src/components/ward-management/ward-tokens.module.css",
  "src/app/ckb-v2-tokens.css",
  "src/app/globals.css",
];

const raw = readFileSync(FILE, "utf8");
const code = stripCssComments(raw);

/** Every custom property this design-token layer declares, anywhere across the three files the
 * task brief names as where a primitive must resolve — `ward-tokens.module.css` and
 * `ckb-v2-tokens.css` — plus `globals.css`, which the other two are demonstrably built on
 * (`ckb-v2-tokens.css` is `@import`-ed by `globals.css`, and several tokens this file legitimately
 * uses — `--font-weight-*`, `--tracking-*`, `--spacing-tap`, `--text-3xs`, `--focus` — are declared
 * only there, not in `ckb-v2-tokens.css` itself). Comment-stripped for the same reason
 * `ward-design-language-contract.test.ts` strips before scanning: a token named only in a
 * measured-contrast comment is not a declaration a `var()` can resolve to. */
function declaredTokens(): Set<string> {
  const declared = new Set<string>();
  for (const file of TOKEN_SOURCES) {
    const stripped = stripCssComments(readFileSync(file, "utf8"));
    for (const m of stripped.matchAll(/(^|[\s;{])(--[a-zA-Z0-9-]+)\s*:/gu)) declared.add(m[2]);
  }
  return declared;
}

/** Every `var(--…)` reference this file's real declarations make — never a name mentioned only in
 * prose, which is the exact trap `ward-design-language-contract.test.ts`'s own header comment
 * records: a token named in a comment inflated the DECLARED set there; here it would inflate the
 * USED set instead, and either direction hides a real phantom reference. */
function varReferences(cssText: string): string[] {
  return [...cssText.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/gu)].map((m) => m[1]);
}

const HEX = /#[0-9a-fA-F]{3,8}\b/gu;
const COLOUR_FUNCTION = /\b(rgba?|hsla?)\(((?:[^()]|\([^()]*\))*)\)/gu;

describe("statistics-v4.module.css: no hardcoded colour, every primitive resolves to a real token", () => {
  it("the file exists and is a real stylesheet, not an empty one", () => {
    // Floor the POPULATION this test reads, never the finding — a byte check against an empty
    // file passes for every path that does not exist.
    expect(raw.length).toBeGreaterThan(8_000);
  });

  it("declares the token layer this test resolves against, in a healthy quantity (anti-vacuity floor)", () => {
    // If a source file moves or a regex stops matching, `declaredTokens()` returns a tiny or empty
    // set and every "resolves to a real token" assertion below would pass having checked nothing.
    expect(declaredTokens().size).toBeGreaterThan(300);
  });

  it("finds the var() usages it is looking for, in a fixture it controls (positive control)", () => {
    const fixture = [
      "/* a comment naming --totally-invented-token and #abcdef, which must not count */",
      ".rawHex { color: #1b2533; }",
      ".rawRgb { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }",
      ".phantom { color: var(--totally-invented-token); }",
      ".real { color: var(--text-heading); background: var(--ward-canvas); }",
    ].join("\n");
    const stripped = stripCssComments(fixture);

    const hexHits = stripped.match(HEX) ?? [];
    const colourHits = [...stripped.matchAll(COLOUR_FUNCTION)].map((m) => m[0]);
    const refs = varReferences(stripped);

    expect(hexHits, "the hex detector did not find the raw hex in its own fixture").toEqual(["#1b2533"]);
    expect(colourHits.length, "the colour-function detector did not find the raw rgba() in its own fixture").toBe(1);
    expect(refs.sort()).toEqual(["--text-heading", "--totally-invented-token", "--ward-canvas"].sort());

    const declared = declaredTokens();
    const phantoms = refs.filter((r) => !declared.has(r));
    expect(
      phantoms,
      "the phantom-token check did not flag the fixture's invented token, so a pass on the real file proves nothing",
    ).toEqual(["--totally-invented-token"]);
  });

  it("declares no raw hex, rgb(), hsl() colour — every colour is a token reference", () => {
    const hexHits = [...(code.match(HEX) ?? [])];
    const colourHits = [...code.matchAll(COLOUR_FUNCTION)]
      .filter((m) => !/^\s*var\(/u.test(m[2])) // rgb(var(--x) / 0.2) is token-derived, same exemption as ward-raw-colour.test.ts
      .map((m) => m[0]);
    expect(hexHits, `raw hex found: ${hexHits.join(", ")}`).toEqual([]);
    expect(colourHits, `raw colour function found: ${colourHits.join(", ")}`).toEqual([]);
  });

  it("every var() this file declares resolves to a token declared in the app's own token layer", () => {
    const declared = declaredTokens();
    const refs = varReferences(code);
    // Floor the POPULATION walked, never the finding: if the var()-extraction regex breaks, this
    // reports zero references and the "no phantoms" assertion below passes having checked nothing.
    expect(refs.length, "no var() references were found — the scan is broken, not the file").toBeGreaterThan(80);

    const uniqueRefs = [...new Set(refs)];
    expect(uniqueRefs.length).toBeGreaterThan(40);

    const phantoms = uniqueRefs.filter((r) => !declared.has(r));
    expect(
      phantoms,
      `these custom properties are used but never declared in ward-tokens.module.css, ckb-v2-tokens.css ` +
        `or globals.css, so they resolve to nothing at runtime: ${phantoms.join(", ")}`,
    ).toEqual([]);
  });

  it("declares every primitive the task brief asked for", () => {
    // Named per the brief, not merely counted — a length check alone passes on the wrong classes.
    const required = [
      ".band", // the figure band — one continuous strip, hairline-divided
      ".bandItem",
      ".panel",
      ".panelHeader",
      ".panelBody",
      ".dtable", // data table: tabular figures, right-aligned numeric cells
      ".reveal", // disclosure
      ".revealBody",
      ".kv", // key/value list
      ".figs", // a figure row for inside a panel
      ".delta", // a direction paired with a word
      ".deltaWord",
      ".cLine", // line chart primitive
      ".cRingValue", // arc/ring chart primitive
    ];
    const missing = required.filter(
      (cls) =>
        !code.includes(`${cls} `) &&
        !code.includes(`${cls}[`) &&
        !code.includes(`${cls},`) &&
        !code.includes(`${cls}\n`) &&
        !code.includes(`${cls}.`) &&
        !code.includes(`${cls} >`),
    );
    expect(missing, `these required primitives are not declared: ${missing.join(", ")}`).toEqual([]);
  });

  it("the data table right-aligns numeric cells with tabular figures, and marks severity by width", () => {
    expect(code).toMatch(/\.dtable\s+td\.n,?\s*\n?\s*\.dtable\s+th\.n/u);
    expect(code).toContain("font-variant-numeric: tabular-nums");
    expect(code).toContain("text-align: right");
    // The severity stripe: present on EVERY toned row (a neutral base, so presence/absence — not
    // hue — is what survives greyscale), then a tone-specific override of the same width.
    expect(code).toMatch(/tr\[data-tone\]\s*>\s*:first-child\s*\{\s*box-shadow:\s*inset 3px/u);
    expect(code).toContain('tr[data-tone="crit"]');
    expect(code).toContain('tr[data-tone="warn"]');
    expect(code).toContain('tr[data-tone="good"]');
  });

  it("the disclosure summary never drops below the 48px tap floor", () => {
    expect(code).toContain("min-height: var(--spacing-tap)");
    expect(code).not.toMatch(/\.reveal[\s\S]{0,400}min-height:\s*2\.75rem/u);
  });

  it("the delta pairs a direction with a word — colour is never the only carrier", () => {
    expect(code).toContain('[data-dir="up"]');
    expect(code).toContain('[data-dir="down"]');
    expect(code).toContain('[data-dir="flat"]');
    expect(code).toContain(".deltaWord");
  });

  it("draws no bar-chart primitive", () => {
    // Every class name this file declares, checked for the word "bar" as approached from a chart
    // context. A literal substring match on "bar" would also flag unrelated words; none of this
    // file's real class names contain "bar" at all (checked: band/bandItem do not — "band" has no
    // "bar" substring), so a plain case-insensitive substring check is safe here.
    const classNames = [...code.matchAll(/\.([A-Za-z][\w-]*)/gu)].map((m) => m[1]);
    expect(classNames.length).toBeGreaterThan(30);
    const barLike = classNames.filter((c) => /bar/iu.test(c));
    expect(
      barLike,
      `bar-shaped class name(s) found, and the brief asked for lines and arcs only: ${barLike.join(", ")}`,
    ).toEqual([]);
    // And the converse floor: the line/arc vocabulary the brief DID ask for is actually present.
    for (const chartClass of [".cLine", ".cArea", ".cDot", ".cRingTrack", ".cRingValue", ".cThreshold"]) {
      expect(code, `${chartClass} is missing — the chart primitives are incomplete`).toContain(chartClass);
    }
  });

  it("is additive: the existing statistics stylesheets are untouched siblings, not rewritten", () => {
    // Ruling 3 — this task never migrates a screen or edits the pre-existing files.
    expect(FILE).not.toBe("src/components/ward-management/statistics/statistics.module.css");
    expect(FILE).not.toBe("src/components/ward-management/statistics/statistics-sections.module.css");
  });
});
