import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "../src/components/ward-management/delays/delays-board.module.css"), "utf8");

/** Every top-level declaration block whose selector is exactly `.gDot`. */
function gDotBlocks(source: string): string[] {
  return [...source.matchAll(/(^|\n)\.gDot\s*\{([^}]*)\}/gu)].map((match) => match[2] ?? "");
}

describe("Delays Wait spread dots stay inside their lanes (v10)", () => {
  it("never puts a dot back in the page flow: every .gDot position is absolute", () => {
    const blocks = gDotBlocks(css);
    expect(blocks.length, "no .gDot rule found; the selector moved").toBeGreaterThan(0);
    for (const block of blocks) {
      const position = block.match(/position:\s*([a-z]+)/u)?.[1];
      if (position !== undefined) expect(position).toBe("absolute");
    }
  });

  it("gives each dot a 28px transparent hit area and dims by colour, not opacity", () => {
    expect(css).toMatch(/\.gDot::before\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;/u);
    expect(css).toMatch(/\.gDot\[data-dim="true"\]\s*\{[^}]*color:\s*var\(--wf-dim\)/u);
    expect(css).not.toMatch(/\.dim\s*\{[^}]*opacity/u);
  });
});
