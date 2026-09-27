// tests/ward-mockup-tokens-resolve.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EVERY STANDALONE WARD-FLOW MOCKUP MUST RESOLVE EVERY CUSTOM PROPERTY IT PAINTS WITH.
 *
 * 🔴 THE DEFECT THIS GUARDS. An unresolved `var(--x)` invalidates the whole CSS declaration and the
 * browser drops it — silently, with no console error. A standalone mockup under
 * `docs/ward-flow/design/prototypes/` has no `globals.css` behind it, so an element that reads an
 * undeclared token just renders at its inherited value and the page still looks deliberate. Five
 * mockups were shipped this way (`--clinical-accent`, `--font-sans`, `--spacing-tap`, `--warning`
 * across various files) and were invisible to the person approving them, because nothing failed.
 * `--spacing-tap` sits on interactive elements, so the defect was a silently collapsing tap target,
 * not merely a wrong colour.
 *
 * 🔴 THE BUG THIS GUARD ITSELF ALMOST HAD. A first version of this exact sweep collected every
 * `--x:` declaration in the file, including ones inside `@media (forced-colors: active)`. A token
 * declared ONLY inside that block is undeclared for every ordinary reader — forced-colors is an
 * override for one accessibility mode, not a definition — so that version reported files clean while
 * their rules were being silently discarded in normal mode. It contradicted a colleague who had
 * correctly identified `mockup-front-doors-v5.html` as missing exactly these tokens. The fix is a
 * brace-balanced strip of every forced-colors media block before collecting DECLARATIONS (not
 * before collecting USES — a token used inside forced-colors must still resolve there, since a
 * forced-colors user hits that block too).
 *
 * 🔴 DISCOVERY, NOT A HAND-WRITTEN LIST. The population comes from `readdirSync` over the prototypes
 * directory, not a literal array of filenames. A hand-picked list is exactly how a new offending file
 * joins the tree unnoticed — the list itself never changes, so the guard keeps reporting "clean"
 * about a population that no longer includes the new file.
 */

const DIR = join(process.cwd(), "docs/ward-flow/design/prototypes");

/**
 * Remove every `@media` block whose condition mentions `forced-colors`, walking braces so a nested
 * rule inside the block (or a brace inside a value, e.g. `color-mix(...)`) cannot end the strip early.
 * A naive `@media...{...}` regex is not brace-aware and either under- or over-matches; this walks the
 * actual nesting depth instead.
 */
function stripForcedColors(css: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const at = css.indexOf("@media", i);
    if (at < 0) return out + css.slice(i);
    const braceAt = css.indexOf("{", at);
    if (braceAt < 0) return out + css.slice(i);
    const condition = css.slice(at, braceAt);
    if (!/forced-colors/u.test(condition)) {
      // Not a forced-colors block — keep everything up to and including its opening brace and
      // keep scanning from there; its own declarations (and any nested blocks) are collected
      // normally by the caller.
      out += css.slice(i, braceAt + 1);
      i = braceAt + 1;
      continue;
    }
    // Forced-colors block: walk to the matching close brace and drop the whole span.
    let depth = 1;
    let j = braceAt + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}") depth -= 1;
      j += 1;
    }
    out += css.slice(i, at);
    i = j;
  }
}

/** Every `var(--x…)` reference anywhere in the style block, forced-colors included. */
function collectUsed(css: string): Set<string> {
  return new Set([...css.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/gu)].map((m) => m[1]));
}

/** Every `--x:` declaration OUTSIDE forced-colors — the only declarations an ordinary reader sees. */
function collectDeclared(cssWithoutForcedColors: string): Set<string> {
  return new Set([...cssWithoutForcedColors.matchAll(/^\s*(--[A-Za-z0-9-]+)\s*:/gmu)].map((m) => m[1]));
}

function extractStyleBlock(html: string): string | null {
  const open = html.indexOf("<style>");
  if (open < 0) return null;
  const close = html.indexOf("</style>", open);
  return close < 0 ? html.slice(open) : html.slice(open, close);
}

interface Scanned {
  file: string;
  missing: string[];
}

function scan(): { scanned: Scanned[]; filesWithStyle: number; totalFiles: number } {
  const totalFiles = readdirSync(DIR).filter((f) => f.endsWith(".html")).length;
  const files = readdirSync(DIR).filter((f) => f.endsWith(".html"));
  const scanned: Scanned[] = [];
  let filesWithStyle = 0;

  for (const file of files) {
    const html = readFileSync(join(DIR, file), "utf8");
    const css = extractStyleBlock(html);
    if (css === null) continue;
    filesWithStyle += 1;

    const used = collectUsed(css);
    const declared = collectDeclared(stripForcedColors(css));
    const missing = [...used].filter((token) => !declared.has(token)).sort();
    scanned.push({ file, missing });
  }

  return { scanned, filesWithStyle, totalFiles };
}

describe("ward-flow standalone mockups resolve every custom property they use", () => {
  it("examines a plausible population, not an empty or truncated one", () => {
    const { scanned, filesWithStyle, totalFiles } = scan();

    // Floor the population: a scan over an empty or truncated directory listing reports "clean",
    // and clean is indistinguishable from correct unless the population is proven non-trivial first.
    expect(totalFiles).toBeGreaterThanOrEqual(45);
    expect(filesWithStyle).toBeGreaterThanOrEqual(45);
    expect(scanned.length).toBe(filesWithStyle);

    // A known file must be in the discovered set — proves the directory path and extension filter
    // are actually finding real prototypes, not silently matching zero files.
    const files = scanned.map((s) => s.file);
    expect(files).toContain("mockup-front-doors-v5.html");
  });

  it("declares every custom property it paints with, outside forced-colors", () => {
    const { scanned } = scan();
    const offenders = scanned.filter((s) => s.missing.length > 0);

    if (offenders.length > 0) {
      const detail = offenders.map((o) => `  ${o.file}: ${o.missing.join(", ")}`).join("\n");
      expect.fail(
        `${offenders.length} mockup(s) reference a custom property with no declaration outside ` +
          `@media (forced-colors: active) — the var() is unresolved in normal mode and the browser ` +
          `silently drops the whole declaration:\n${detail}`,
      );
    }

    expect(offenders).toEqual([]);
  });
});
