import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P194 (approved by Josh in chat, 27 Oct 2026, 9:21 PM AWST: "P194: tune for a ward desktop monitor,
 * about 1920 by 1080, shrink the panel to fit its content"). On a wide desktop the Movements timeline
 * panel had a fixed height, so with few rows its lower part stood empty. It now grows with its rows
 * up to the same cap, and scrolls beyond it. Narrower layouts keep their own heights.
 */
const css = readFileSync(
  resolve(process.cwd(), "src/components/ward-management/movements/movement-horizon.module.css"),
  "utf8",
);

function baseRule(selector: string): string {
  const match = new RegExp(`(?:^|\\n)${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`no top-level rule for ${selector}`);
  return match[1];
}

describe("Movements timeline panel fits its content on a desktop monitor (P194)", () => {
  it("caps the split with max-height instead of a fixed height", () => {
    const rule = baseRule(".diagSplit");
    expect(rule).not.toMatch(/(^|[^-])height:\s*clamp\(/);
    expect(rule).toMatch(/max-height:\s*clamp\(24\.5rem,\s*57dvh,\s*36rem\)/);
  });

  it("lets the grid size to its rows rather than fill the panel", () => {
    expect(baseRule(".ganttGridTable")).not.toMatch(/min-height:\s*100%/);
  });
});
