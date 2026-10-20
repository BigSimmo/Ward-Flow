import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * DA-24 (overall review, 20 Oct 2026): with wider letter, word or line spacing a tight segmented
 * track squeezed its items under their own labels, so the labels ran into each other. The kit item
 * may still give up most of its side space, but its floor is now its label (calc-size), with the
 * old floor of 0 kept first for browsers without calc-size. Checked in Chromium at 1440, 1280 and
 * 390 px wide, with and without the text-spacing override: no item changes size at normal spacing.
 */
const choice = readFileSync(resolve(process.cwd(), "src/components/wf/choice.module.css"), "utf8");

function block(selector: string): string {
  const start = choice.indexOf(`\n${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThan(-1);
  return choice.slice(start, choice.indexOf("}", start));
}

describe("kit segmented item never shrinks under its label (DA-24)", () => {
  it("floors the item at its label, after a plain fallback", () => {
    const item = block(".segItem");
    expect(item).toMatch(/min-width: 0;\s*min-width: calc-size\(max-content, size - 16px\);/);
    expect(item).toContain("white-space: nowrap");
  });
});
