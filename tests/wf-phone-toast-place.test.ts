import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Shared design parts item 4 (13 Nov 2026), checked against the approved phone picture: the toast
 * runs the full width less 16px gutters (not only as wide as its words, centred), and on a page with
 * a pinned action bar it rests 24px above the bar. The bar's top stands 65px above the dock's clear
 * line at 390 x 844; the old 85px left the toast 44px above it.
 */
const css = readFileSync(join(process.cwd(), "src/components/wf/overlay.module.css"), "utf8");
const phone = css.slice(css.indexOf("@media (max-width: 46.4375rem) {\n  /* F-15"));

describe("phone toast place", () => {
  it("stretches between the 16px gutters", () => {
    const region = phone.slice(phone.indexOf(".toastRegion {"), phone.indexOf("}", phone.indexOf(".toastRegion {")));
    expect(region).toMatch(/left: var\(--wf-s-4\);\s*right: var\(--wf-s-4\);/u);
    expect(region).toMatch(/align-items: stretch;/u);
  });

  it("rests 24px above a pinned action bar", () => {
    const rule = phone.slice(phone.indexOf("[data-wf-phone-action-bar]"));
    expect(rule.slice(0, rule.indexOf("}"))).toMatch(/var\(--wf-phone-action-bar-h, 65px\) \+ var\(--wf-s-6\)/u);
  });

  it("draws on a solid surface, never see-through", () => {
    const toast = phone.slice(phone.indexOf("  .toast {"), phone.indexOf("}", phone.indexOf("  .toast {")));
    expect(toast).toMatch(/--toast-bg: light-dark\(var\(--wf-ink-1\), var\(--wf-track\)\);/u);
    expect(toast).not.toMatch(/transparent\)/u);
  });

  it("gives Undo and close a 48px tap cover (review EH-3)", () => {
    const rule = phone.slice(phone.indexOf(".toast .toastClose::after {"));
    expect(rule.slice(0, rule.indexOf("}"))).toMatch(/inset: -5px;/u);
  });
});
