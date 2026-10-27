import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Desktop mouse wheel (Josh, 27 Oct 2026: "my mouse is not scrolling down" on some pages).
 *
 * Desktop side panels and lists scroll on their own with `overscroll-behavior: contain`. In
 * Chromium that swallows the wheel over such a panel once it is at its end, and over a panel with
 * nothing to scroll the wheel did nothing at all. The globals rule lets the wheel carry on to the
 * page for a mouse, while phones, touch screens, dialogs, menus and popups keep their containment.
 */
const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function wheelRule() {
  const start = globals.indexOf("@media (hover: hover) and (pointer: fine) {\n  [data-wf-scroller]");
  expect(start, "the desktop wheel rule is missing from globals.css").toBeGreaterThan(-1);
  return globals.slice(start, globals.indexOf("\n}\n", start));
}

describe("desktop wheel reaches the page past a contained panel", () => {
  it("resets vertical overscroll inside the work column for a fine pointer only", () => {
    const rule = wheelRule();
    expect(rule).toContain("overscroll-behavior-y: auto !important;");
    // Horizontal chip and table tracks keep their own containment.
    expect(rule).not.toMatch(/overscroll-behavior(-x|-inline)?\s*:/);
  });

  it("leaves dialogs, menus, listboxes and popovers contained", () => {
    const rule = wheelRule();
    for (const overlay of [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[role="menu"]',
      '[role="listbox"]',
      "[popover]",
    ]) {
      expect(rule.split(overlay).length - 1, `${overlay} must be excluded with its contents`).toBe(2);
    }
  });
});
