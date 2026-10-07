import { globSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankCssComments } from "./helpers/strip-source-comments";

/**
 * Styling drift ratchet (styling consistency audit, 7 October 2026).
 *
 * Ward Flow already has the tokens: `--radius-*` and `--text-*` in `globals.css`, `--r1`/`--r2`/
 * `--t-*` in `ward-flow-shell-tokens.module.css`. The drift is screens writing literals beside
 * them. Pill radii are fully tokenised and stay at zero. Literal font sizes and radii are capped
 * at the audited count so they can only fall: lower a cap when a cleanup lands, never raise it.
 * Literal px text also ignores the compact and spacious density settings, which scale rem.
 */
const files = globSync("src/components/ward-management/**/*.css");

/** Drops `var(...)` so a token's fallback (`var(--radius-pill, 9999px)`) is not counted as a literal. */
function withoutVars(value: string): string {
  let previous: string;
  do {
    previous = value;
    value = value.replace(/var\([^()]*\)/g, "");
  } while (value !== previous);
  return value;
}

/**
 * Counts declarations of `property` whose whole value still holds a matching literal, so
 * `clamp(10px, 2vw, 16px)`, `calc(12px - 2px)` and `0 12px` are caught as well as `12px`.
 */
function count(property: RegExp, literal: RegExp): number {
  const declaration = new RegExp(`(?:^|[;{\\s])(?:${property.source})\\s*:([^;{}]*)`, "g");
  return files.reduce((total, file) => {
    const css = blankCssComments(readFileSync(file, "utf8"));
    let found = 0;
    for (const match of css.matchAll(declaration)) {
      if (literal.test(withoutVars(match[1]))) found += 1;
    }
    return total + found;
  }, 0);
}

const radius = /border(?:-[a-z]+)*-radius/;
const sizeLiteral = /(?:^|[^\w.-])[0-9]*\.?[0-9]+(?:px|rem)\b/;

describe("ward styling drift ratchet", () => {
  it("scans the ward stylesheets", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("writes every pill radius through --radius-pill", () => {
    expect(count(radius, /\b(?:9999|999)px\b/)).toBe(0);
  });

  it("does not add literal font sizes", () => {
    expect(count(/font-size/, sizeLiteral)).toBeLessThanOrEqual(1216);
  });

  it("does not add literal border radii", () => {
    expect(count(radius, sizeLiteral)).toBeLessThanOrEqual(699);
  });
});
