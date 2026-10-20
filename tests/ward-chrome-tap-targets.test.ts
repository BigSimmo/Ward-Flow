import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

/**
 * Wave-2 chrome tap targets (#4 / #22 / #23).
 *
 * Browser re-measure on tip `f997ac75a1` (1440 / 820 / 390): Raise Referral and the Ward Flow
 * home link already resolved to ≥48px. Header Close's *hit* box was already 48×48, but its
 * `::before` chrome was inset to ~34×34 — the measured "36×36 Close". These pins keep the CSS
 * contracts that deliver those sizes; jsdom cannot compute layout, so this is a source contract.
 */
const RAIL_CSS = "src/components/ward-management/shell/ward-rail.module.css";
const BAR_CSS = "src/components/ward-management/shell/ward-bar.module.css";
const SHARED_ACCESS_CSS = "src/components/ward-management/ward-shared-access.module.css";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function usesWardTapFloor(source: string, selector: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
  const values: string[] = [];
  postcss.parse(source).walkRules((rule) => {
    if (!rule.selectors.some((candidate) => normalize(candidate) === normalize(selector))) return;
    rule.each((child) => {
      if (child.type === "decl" && child.prop === "min-height") values.push(child.value);
    });
  });
  return values.length > 0 && values.every((value) => /^var\(--ward-tap(?:\s*[,)]|$)/.test(value));
}

/** Body of one exact top-level `.className { … }` rule (not a descendant/compound selector). */
function exactRuleBody(source: string, className: string): string {
  const marker = `.${className} {`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Missing exact rule .${className} { in stylesheet`);
  }
  const open = start + marker.length - 1;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`Unclosed rule .${className}`);
}

describe("Wave-2 chrome tap targets — rail Raise Referral and home link", () => {
  const css = read(RAIL_CSS);

  // v10 (Josh, 10 Oct 2026): the sidebar's outlined New referral is gone and the header holds the
  // one primary. Its 48px pin is replaced by a pin that it stays gone, in the CSS and the markup.
  it("the rail carries no New referral button; the header keeps the one primary", () => {
    expect(css).not.toMatch(/\.btnRailReferral\b/);
    const rail = read("src/components/ward-management/shell/ward-rail.tsx");
    expect(rail).not.toMatch(/ward-rail-referral-trigger/);
    expect(read("src/components/ward-management/shell/ward-bar-controls.tsx")).toMatch(
      /data-testid="ward-bar-primary-action"/,
    );
  });

  it(".brandLink (Ward Flow home) pins min-height to --ward-tap / --spacing-tap", () => {
    const body = exactRuleBody(css, "brandLink");
    expect(body).toMatch(/min-height:\s*var\(--ward-tap/);
    expect(body).not.toMatch(/min-height:\s*(?:36px|2\.25rem|44px)\b/);
  });
});

describe("Shared access chrome tap targets — toolbar and notice buttons", () => {
  it(".toolbar button and .notice button pin min-height to --ward-tap (48px floor)", () => {
    const css = read(SHARED_ACCESS_CSS);
    expect(usesWardTapFloor(css, ".toolbar button")).toBe(true);
    expect(usesWardTapFloor(css, ".notice button")).toBe(true);
  });

  it.each([
    ["combined selectors", ".toolbar button, .notice button { min-height: var(--ward-tap); }"],
    ["reversed selectors and whitespace", ".notice   button,\n.toolbar\tbutton { min-height: var(--ward-tap); }"],
    ["split rules", ".toolbar button { min-height: var(--ward-tap); } .notice button { min-height: var(--ward-tap); }"],
    ["combined fallback", ".toolbar button, .notice button { min-height: var(--ward-tap,var(--spacing-tap,3rem)); }"],
    [
      "split fallbacks",
      ".toolbar button { min-height: var(--ward-tap,var(--spacing-tap,3rem)); } .notice button { min-height: var(--ward-tap, 3rem); }",
    ],
  ])("accepts equivalent ward tap floors: %s", (_name, css) => {
    expect(usesWardTapFloor(css, ".toolbar button")).toBe(true);
    expect(usesWardTapFloor(css, ".notice button")).toBe(true);
  });

  it.each([".toolbar button", ".notice button"])("rejects missing or invalid floors for %s", (selector) => {
    expect(usesWardTapFloor(".other button { min-height: var(--ward-tap); }", selector)).toBe(false);
    expect(usesWardTapFloor(`${selector} { color: red; }`, selector)).toBe(false);
    expect(usesWardTapFloor(`${selector} { min-height: 44px; }`, selector)).toBe(false);
    expect(usesWardTapFloor(`${selector} { min-height: var(--ward-tap-other); }`, selector)).toBe(false);
    expect(usesWardTapFloor(`${selector} { .nested { min-height: var(--ward-tap); } }`, selector)).toBe(false);
    expect(usesWardTapFloor(`${selector} { min-height: var(--ward-tap); min-height: 44px; }`, selector)).toBe(false);
  });
});

describe("Wave-2 chrome tap targets — header drawer Close", () => {
  const css = read(BAR_CSS);

  it(".drawerClose is a full --spacing-tap square", () => {
    const body = exactRuleBody(css, "drawerClose");
    expect(body).toMatch(/width:\s*var\(--spacing-tap/);
    expect(body).toMatch(/height:\s*var\(--spacing-tap/);
    expect(body).toMatch(/min-width:\s*var\(--spacing-tap/);
    expect(body).toMatch(/min-height:\s*var\(--spacing-tap/);
    expect(body).not.toMatch(/(?:width|height|min-width|min-height):\s*(?:36px|2\.25rem)\b/);
  });

  it(".drawerClose::before fills the tap face (no 7px inset that paints ~34×34)", () => {
    const marker = ".drawerClose::before {";
    const start = css.indexOf(marker);
    expect(start, "missing .drawerClose::before rule").toBeGreaterThan(-1);
    const open = start + marker.length - 1;
    let depth = 0;
    let end = -1;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = css.slice(open + 1, end);
    expect(body).toMatch(/inset:\s*0\s*;/);
    expect(body).not.toMatch(/inset:\s*0\.4375rem/);
    expect(body).not.toMatch(/inset:\s*7px/);
  });
});

describe("Phone service chip tap target (overall review, 20 Oct 2026)", () => {
  /** Every declaration of `prop` on exactly `selector` inside the phone block, in source order. */
  function phoneValues(source: string, selector: string, prop: string): string[] {
    const values: string[] = [];
    postcss.parse(source).walkRules((rule) => {
      const parent = rule.parent;
      const inPhone = parent?.type === "atrule" && (parent as postcss.AtRule).params.trim() === "(max-width: 48rem)";
      if (!inPhone || !rule.selectors.some((candidate) => candidate.trim() === selector)) return;
      rule.walkDecls(prop, (decl) => {
        values.push(decl.value);
      });
    });
    return values;
  }

  it("gives the service button a 24px box (WCAG 2.5.8) without moving its line", () => {
    const css = read(BAR_CSS);
    const base = exactRuleBody(css, "scopeBadgeBtn");
    expect(base).toMatch(/display:\s*inline-flex/u);
    // The last phone rule wins: at least 24px, not the 18px line it used to be.
    expect(phoneValues(css, ".scopeBadgeBtn", "min-height").at(-1)).toBe("24px");
    // The 3px it gains on each side come back from its margins, so nothing beside it shifts.
    expect(phoneValues(css, ".scopeBadgeBtn", "margin-block").at(-1)).toBe("calc(-0.75rem - 3px)");
    // And its 48px hit area stays 48px: 24px plus 12px above and below.
    expect(phoneValues(css, ".scopeBadgeBtn::before", "inset").at(-1)).toBe("-12px -8px");
  });
});
