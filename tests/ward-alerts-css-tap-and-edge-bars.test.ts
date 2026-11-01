import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { TAP_AREA_PX, tapAreaHeight } from "./helpers/css-tap-area";

/**
 * F3.3/F3.4 (P1), 2026-09-17 fix round: two CSS-only defects in
 * `src/components/ward-management/alerts/alerts.module.css` that no DOM test can see, because
 * jsdom does not apply a real CSS module stylesheet.
 *
 *  - Owner ruling: no coloured edge bars or top highlights. `.alertCard[data-tone="danger"]` and
 *    `.alertCard[data-tone="warning"]` used to carry a `border-left`; tone is carried by the icon
 *    and the badge text instead (both already present — no bar needed to say it twice).
 *  - `.btn`, `.btnSm` and `.filterBtn` used a fixed `height` below the 48px tap-target floor
 *    (`var(--ward-tap)`). Since 31 October 2026 (Josh: "no 48px controls") the rule is a 48px tap
 *    AREA: either the old `min-height: var(--ward-tap)`, or the kit shape, drawn at 40px (32px
 *    small) with an invisible `::after` cover (`tests/helpers/css-tap-area.ts`).
 */
const CSS_PATH = "src/components/ward-management/alerts/alerts.module.css";

function css(): string {
  return readFileSync(CSS_PATH, "utf8");
}

/** The exact rule shape the two tone selectors carried before this fix — kept as a literal
 *  pattern so a reintroduction under either selector is caught, whatever else changes nearby. */
const EDGE_BAR = /\.alertCard\[data-tone="(?:danger|warning)"\]\s*\{[^}]*border-left/;

describe("alerts.module.css — no coloured edge bars (F3.3)", () => {
  it("carries a real number of rules to scan — the anti-vacuity floor", () => {
    expect(css().length).toBeGreaterThan(500);
  });

  it("no tone-keyed alert card rule sets a border-left any more", () => {
    expect(EDGE_BAR.test(css())).toBe(false);
  });

  it("catches a reintroduced edge bar — mutation proof", () => {
    const reintroduced = `${css()}\n.alertCard[data-tone="danger"]{border-left:3px solid var(--danger);}`;
    expect(EDGE_BAR.test(reintroduced)).toBe(true);
  });
});

describe("alerts.module.css — buttons and filter chips keep the 48px tap area (F3.4)", () => {
  it.each(["btn", "btnSm", "filterBtn"])(".%s is drawn with a tap area of at least 48px", (className) => {
    const area = tapAreaHeight(css(), className);
    expect(area.drawn, `.${className} declares no height or min-height — this test proves nothing`).not.toBeNull();
    expect(
      area.total ?? 0,
      `.${className} tap area (drawn ${area.drawn}px + cover ${area.cover}px)`,
    ).toBeGreaterThanOrEqual(TAP_AREA_PX);
  });
});
