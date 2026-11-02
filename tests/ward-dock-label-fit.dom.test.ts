// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { fitDockLabel } from "../src/components/ward-management/shell/use-fit-dock-labels";

// Q307 (Josh, 2 Nov 2026): at 200% text a dock label shrinks to fit its tab, never below 12px.
// jsdom has no layout, so the label's word width follows its font size by a fixed ratio.
const realStyle = window.getComputedStyle;
afterEach(() => {
  window.getComputedStyle = realStyle;
});
function label(text: string, baseSize: number, column: number) {
  const element = document.createElement("span");
  element.textContent = text;
  const size = () => Number.parseFloat(element.style.fontSize || `${baseSize}`);
  Object.defineProperty(element, "clientWidth", { get: () => Math.min(column, text.length * 0.6 * size()) });
  Object.defineProperty(element, "scrollWidth", { get: () => text.length * 0.6 * size() });
  Object.defineProperty(element, "clientHeight", { get: () => size() });
  Object.defineProperty(element, "scrollHeight", { get: () => size() });
  window.getComputedStyle = ((target: Element) =>
    target === element
      ? ({ fontSize: `${size()}px` } as CSSStyleDeclaration)
      : realStyle(target)) as typeof getComputedStyle;
  return element;
}

describe("dock label fit", () => {
  it("leaves a label that fits at its own size alone", () => {
    const element = label("Home", 24, 78);
    fitDockLabel(element);
    expect(element.style.fontSize).toBe("");
  });

  it("shrinks a long word at 200% text until it fits its column", () => {
    const element = label("Referrals", 24, 78);
    fitDockLabel(element);
    const fitted = Number.parseFloat(element.style.fontSize);
    expect(fitted).toBeLessThan(24);
    expect(fitted).toBeGreaterThanOrEqual(12);
    expect(9 * 0.6 * fitted).toBeLessThanOrEqual(78);
  });

  it("never goes below 12px", () => {
    const element = label("Referrals", 24, 40);
    fitDockLabel(element);
    expect(element.style.fontSize).toBe("12px");
  });
});
