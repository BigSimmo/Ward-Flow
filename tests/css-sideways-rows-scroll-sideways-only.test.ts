import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Sideways rows scroll sideways only (Josh, 10 Nov 2026). When a rule sets `overflow-x: auto`
 * and leaves `overflow-y` alone, the browser turns `overflow-y` into `auto` too. Any chip whose
 * invisible tap band, focus ring or badge reaches past the row then lets the whole row be dragged
 * up and down on a phone, half hiding the chips. Every rule that scrolls sideways must therefore
 * say what happens vertically in the same block: `overflow-y: hidden` for a sideways row, or an
 * explicit `overflow-y: auto` for a box meant to scroll both ways.
 */

const ROOT = join(process.cwd(), "src");

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

describe("sideways scrolling rows", () => {
  it("declare their vertical overflow in the same rule", () => {
    const offenders: string[] = [];
    for (const file of cssFiles(ROOT)) {
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const block of css.matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
        const body = block[2] ?? "";
        if (!/(^|[\s;])overflow-x\s*:\s*(auto|scroll)\b/.test(body)) continue;
        if (/(^|[\s;])overflow(-y)?\s*:/.test(body)) continue;
        const selector = (block[1] ?? "").trim().split("\n").pop()?.trim();
        offenders.push(`${relative(process.cwd(), file)}: ${selector}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // D-144 (Josh, 11 Nov 2026): on a phone the quick-link chip rows move only sideways under a finger.
  // D-159 (Josh, 12 Nov 2026): the row stays sideways-only, but a finger that starts on it can still
  // scroll the page, so the touch action allows both pans and the row's own overflow-y stays hidden.
  it.each([
    "wf/hero-top.module.css",
    "ward-management/quick-bar/ward-quick-bar.module.css",
    "wf/phone-rows.module.css",
    "ward-management/coordinator/home-hero.module.css",
  ])("%s keeps its phone chip row sideways and lets the page scroll from it", (file) => {
    const css = readFileSync(join(ROOT, "components", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).toMatch(/touch-action\s*:\s*pan-x pan-y\s*;/);
    expect(css).not.toMatch(/touch-action\s*:\s*pan-x\s*;/);
    expect(css).toMatch(/overscroll-behavior-x\s*:\s*contain/);
  });
});
