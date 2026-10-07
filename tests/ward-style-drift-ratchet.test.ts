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

function count(pattern: RegExp): number {
  return files.reduce((total, file) => {
    const css = blankCssComments(readFileSync(file, "utf8"));
    return total + (css.match(pattern) ?? []).length;
  }, 0);
}

describe("ward styling drift ratchet", () => {
  it("scans the ward stylesheets", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("writes every pill radius through --radius-pill", () => {
    expect(count(/border-radius:\s*(9999|999)px/g)).toBe(0);
  });

  it("does not add literal font sizes", () => {
    expect(count(/font-size:\s*[0-9.]+(px|rem)\b/g)).toBeLessThanOrEqual(1208);
  });

  it("does not add literal border radii", () => {
    expect(count(/border-radius:\s*[0-9.]+(px|rem)\b/g)).toBeLessThanOrEqual(676);
  });
});
