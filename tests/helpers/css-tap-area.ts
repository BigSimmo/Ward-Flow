/**
 * Ward Flow's tap-area rule, read from a CSS Module as text (jsdom applies no real stylesheet).
 *
 * Josh, 31 October 2026: "no 48px controls". A control is drawn smaller (a phone kit button at
 * 40px, a small one at 32px) and keeps the 48px tap area through an invisible `::after` cover that
 * reaches above and below it (`src/components/wf/button.module.css`). The older shape, a control
 * whose own `min-height` is the 48px tap token, still meets the rule. Page CSS tests use this
 * helper so that a page rebuilt to the kit shape passes without the test being rewritten, while a
 * control drawn small with no cover still fails.
 *
 * Read as text, so it sees every rule for the class wherever it sits (including inside `@media`)
 * and does not resolve the cascade. It is a floor check, not a layout engine.
 */

/** The tap area every interactive control keeps, in CSS pixels. */
export const TAP_AREA_PX = 48;

/** The 48px tap tokens, trusted without re-deriving their value. */
const TAP_TOKEN = /^var\(--(?:ward-tap|spacing-tap)\b/u;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** A length in px, or null when it is not a plain px or rem value or a tap token. */
export function lengthPx(raw: string): number | null {
  const value = raw.replace(/\s*!important$/u, "").trim();
  if (TAP_TOKEN.test(value)) return TAP_AREA_PX;
  const px = /^(-?[\d.]+)px$/u.exec(value);
  if (px) return Number(px[1]);
  const rem = /^(-?[\d.]+)rem$/u.exec(value);
  if (rem) return Number(rem[1]) * 16;
  if (value === "0") return 0;
  return null;
}

type Rule = { selector: string; body: string };

function rules(css: string): Rule[] {
  return [...stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/gu)].flatMap(([, selectorList, body]) =>
    selectorList.split(",").map((selector) => ({ selector: selector.trim(), body })),
  );
}

function declarations(body: string, property: string): string[] {
  const pattern = new RegExp(`(?:^|;|\\s)${escapeForRegExp(property)}\\s*:\\s*([^;]+)`, "gu");
  return [...body.matchAll(pattern)].map((match) => match[1].trim());
}

/** `.name`, optionally narrowed by `:not(...)`, `[attr]` or a state pseudo-class, never a
 *  different class that merely starts with the same letters. */
function selectsClass(selector: string, className: string, pseudoElement: boolean): boolean {
  const name = escapeForRegExp(className);
  const narrowing = String.raw`(?::not\([^)]*\)|\[[^\]]*\]|:(?:hover|focus|focus-visible|active))*`;
  const tail = pseudoElement ? "::after" : "";
  return new RegExp(`(?:^|\\s|>)\\.${name}${narrowing}${tail}$`, "u").test(selector);
}

export type TapArea = {
  /** The tallest drawn size the class declares (`height` or `min-height`), or null if none. */
  drawn: number | null;
  /** How far the `::after` cover reaches beyond the drawn box, top and bottom added together. */
  cover: number;
  /** drawn + cover, or null when the class declares no drawn size at all. */
  total: number | null;
};

/** One axis of an `inset` shorthand: the vertical axis is its first value, the horizontal axis
 *  its second (or its first when only one is given). Only outward (negative) reach counts. */
function insetReach(body: string, axis: "vertical" | "horizontal"): number {
  let reach = 0;
  for (const raw of declarations(body, "inset")) {
    const parts = raw.split(/\s+/u);
    const pick = axis === "vertical" ? parts[0] : (parts[1] ?? parts[0]);
    const value = lengthPx(pick ?? "");
    if (value !== null && value < 0) reach = Math.max(reach, -value * 2);
  }
  const sides = axis === "vertical" ? ["top", "bottom"] : ["left", "right"];
  const sideReach = sides
    .map((side) => Math.max(0, ...declarations(body, side).map((raw) => -(lengthPx(raw) ?? 0))))
    .reduce((sum, value) => sum + value, 0);
  return Math.max(reach, sideReach);
}

function measure(css: string, className: string, axis: "vertical" | "horizontal"): TapArea {
  const all = rules(css);
  const sizeProperties = axis === "vertical" ? ["min-height", "height"] : ["min-width", "width"];
  const drawnValues = all
    .filter((rule) => selectsClass(rule.selector, className, false))
    .flatMap((rule) => sizeProperties.flatMap((property) => declarations(rule.body, property)))
    .map(lengthPx)
    .filter((value): value is number => value !== null);
  const drawn = drawnValues.length > 0 ? Math.max(...drawnValues) : null;
  const cover = Math.max(
    0,
    ...all.filter((rule) => selectsClass(rule.selector, className, true)).map((rule) => insetReach(rule.body, axis)),
  );
  return { drawn, cover, total: drawn === null ? null : drawn + cover };
}

/** The vertical tap area of `.className`: its drawn height plus any `::after` cover. */
export function tapAreaHeight(css: string, className: string): TapArea {
  return measure(css, className, "vertical");
}

/** The horizontal tap area of `.className` (for icon-only controls such as a close cross). */
export function tapAreaWidth(css: string, className: string): TapArea {
  return measure(css, className, "horizontal");
}
