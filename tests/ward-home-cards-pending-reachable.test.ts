import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//gu, "");
const home = strip(readFileSync("src/components/ward-management/coordinator/home.module.css", "utf8"));

// #1631 (12 Nov 2026): while Home waits for its two early cards (layout shift on Home, 11 Nov 2026),
// the columns stay in place but must not leave the accessibility tree or the keyboard order.
describe("Home: the columns held for the early cards stay reachable", () => {
  const pendingRules = [...home.matchAll(/([^{}]*data-cards-pending[^{}]*)\{([^}]*)\}/gu)];

  it("holds the columns invisible with opacity, keeping their space", () => {
    expect(pendingRules.length).toBeGreaterThan(0);
    expect(pendingRules.some(([, , body]) => /opacity:\s*0/u.test(body ?? ""))).toBe(true);
  });

  it("never hides them with visibility or display, which screen readers and the keyboard skip", () => {
    for (const [, , body] of pendingRules) expect(body).not.toMatch(/visibility:\s*hidden|display:\s*none/u);
  });

  it("shows them as soon as focus moves inside", () => {
    for (const [, selector] of pendingRules) expect(selector).toMatch(/:not\(:focus-within\)/u);
  });
});
