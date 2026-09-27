import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * F3.3/F3.4 (P1), 2026-09-17 fix round: two CSS-only defects in
 * `src/components/ward-management/alerts/alerts.module.css` that no DOM test can see, because
 * jsdom does not apply a real CSS module stylesheet.
 *
 *  - Owner ruling: no coloured edge bars or top highlights. `.alertCard[data-tone="danger"]` and
 *    `.alertCard[data-tone="warning"]` used to carry a `border-left`; tone is carried by the icon
 *    and the badge text instead (both already present — no bar needed to say it twice).
 *  - `.btn`, `.btnSm` and `.filterBtn` used a fixed `height` below the 48px tap-target floor
 *    (`var(--ward-tap)`); they must resolve to at least that via `min-height`.
 */
const CSS_PATH = "src/components/ward-management/alerts/alerts.module.css";

function css(): string {
  return readFileSync(CSS_PATH, "utf8");
}

/** The exact rule shape the two tone selectors carried before this fix — kept as a literal
 *  pattern so a reintroduction under either selector is caught, whatever else changes nearby. */
const EDGE_BAR = /\.alertCard\[data-tone="(?:danger|warning)"\]\s*\{[^}]*border-left/;

/** The body of one EXACT top-level rule (`.btn {`, never `.btn[aria-disabled...] {` or
 *  `.btnPrimary {`) — found by locating the selector followed immediately by `{`. */
function exactRuleBody(className: string, source: string): string {
  const marker = `.${className} {`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`no exact "${marker}" rule found in ${CSS_PATH} — this test proves nothing`);
  }
  const close = source.indexOf("}", start);
  return source.slice(start, close);
}

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

describe("alerts.module.css — buttons and filter chips meet the tap-target floor (F3.4)", () => {
  it.each(["btn", "btnSm", "filterBtn"])(
    ".%s resolves its height via min-height: var(--ward-tap), not a fixed height",
    (className) => {
      const body = exactRuleBody(className, css());
      expect(body).toMatch(/min-height:\s*var\(--ward-tap\)/);
      // A leftover fixed `height:` (not `min-height:`) would re-cap the box below the floor even
      // with min-height present, so both must be checked.
      expect(body).not.toMatch(/(?<!min-)height:\s*[\d.]+(rem|px)/);
    },
  );
});
