import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { blankCssComments } from "./helpers/strip-source-comments";

function source(path: string): string {
  return blankCssComments(readFileSync(resolve(process.cwd(), path), "utf8"));
}

/**
 * R2-19 / OA-54 — the ward board's "Who is in these beds" panel is print-only: hidden on screen,
 * restored under `@media print`. Officer print (R2-14) is now guarded; this closes the deferred
 * "wait until printing is tested" gate for that panel without inventing a visible UI.
 */
describe("Ward board — Who is in these beds stays print-only", () => {
  const CSS = "src/components/ward-management/board/board.module.css";

  it("hides .people on screen and restores it under @media print", () => {
    const css = source(CSS);
    const screenPeople = css.match(/\.people\s*\{[^}]*\}/);
    expect(screenPeople, ".people rule missing").toBeTruthy();
    expect(screenPeople![0]).toMatch(/display:\s*none/);

    const printStart = css.indexOf("@media print {");
    expect(printStart).toBeGreaterThanOrEqual(0);
    const printBlock = css.slice(printStart);
    expect(printBlock).toMatch(/\.people\s*\{[^}]*display:\s*block/);
    expect(printBlock).toMatch(/\.people\s*\{[^}]*color:\s*CanvasText/);
  });
});
