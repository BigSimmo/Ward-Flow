import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * S4 (Josh, 4 Nov 2026): a clickable graph dot never moves on press. The global press nudge
 * (`:where(button, summary):active { translate: 0 1px }`) is cancelled on every chart dot, no
 * pressed or active rule moves or scales it, the chosen dot shows a ring, and the hit area (28px
 * with a mouse, 44px for a finger) is an invisible pseudo-element centred on the dot.
 */

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

// Waiting spread (`delays-board.module.css` .gDot) and All EDs (`ed-index.module.css` .mark) join
// this list once the branch that holds those files releases them.
const DOTS = [
  {
    name: "Alerts today band",
    file: "src/components/ward-management/alerts/alerts-today-band.module.css",
    selector: ".mark",
  },
] as const;

/** Every rule block whose selector list names `selector` (exactly, or with a pseudo/attribute). */
function rulesFor(css: string, selector: string) {
  const blocks: { selectors: string; body: string }[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  const escaped = selector.replace(".", "\\.");
  const names = new RegExp(`(^|[\\s,>+~])(button)?${escaped}(?![\\w-])`);
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(pattern)) {
    const selectors = match[1]!.trim();
    if (names.test(selectors)) blocks.push({ selectors, body: match[2]! });
  }
  return blocks;
}

describe("graph dots stay still on press", () => {
  for (const dot of DOTS) {
    it(`${dot.name}: the press nudge is cancelled and nothing moves the dot when pressed`, () => {
      const rules = rulesFor(read(dot.file), dot.selector);
      const active = rules.filter((rule) => rule.selectors.includes(`${dot.selector}:active`));
      expect(active.length).toBeGreaterThan(0);
      expect(active.some((rule) => /translate:\s*none/.test(rule.body))).toBe(true);

      // Pressed, active and chosen states must not move, scale or resize the dot.
      const pressed = rules.filter((rule) => /:active|\[aria-pressed="true"\]/.test(rule.selectors));
      for (const rule of pressed) {
        expect(rule.body, rule.selectors).not.toMatch(/(^|[\s;])transform\s*:/);
        expect(rule.body, rule.selectors).not.toMatch(/(^|[\s;])scale\s*:/);
        expect(rule.body, rule.selectors).not.toMatch(/(^|[\s;])translate\s*:(?!\s*none)/);
        expect(rule.body, rule.selectors).not.toMatch(/(^|[\s;])(width|height|top|left|margin|padding)\s*:/);
      }

      // The chosen dot shows a ring.
      expect(
        rules.some((rule) => rule.selectors.includes('[aria-pressed="true"]') && /box-shadow\s*:/.test(rule.body)),
      ).toBe(true);
    });

    it(`${dot.name}: a centred invisible hit area, 28px for a mouse and 44px for a finger`, () => {
      const css = read(dot.file);
      const before = rulesFor(css, dot.selector).filter((rule) => rule.selectors.includes("::before"));
      expect(before.some((rule) => /width:\s*28px/.test(rule.body) && /height:\s*28px/.test(rule.body))).toBe(true);
      expect(before.some((rule) => /translate\(-50%,\s*-50%\)/.test(rule.body))).toBe(true);
      const coarse = css.slice(css.indexOf("@media (pointer: coarse)"));
      expect(css.includes("@media (pointer: coarse)")).toBe(true);
      expect(coarse).toMatch(new RegExp(`${dot.selector.replace(".", "\\.")}::before\\s*\\{[^}]*width:\\s*44px`));
    });
  }

  it("the global press nudge is still a translate (it adds to a dot's centring transform)", () => {
    const globals = read("src/app/globals.css");
    expect(globals).toMatch(/:where\(button, summary\):active\s*\{\s*translate: 0 1px;/);
  });
});
