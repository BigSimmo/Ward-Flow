import { describe, expect, it } from "vitest";

import { TAP_AREA_PX, lengthPx, tapAreaHeight, tapAreaWidth } from "./helpers/css-tap-area";

/**
 * Proves the tap-area helper both ways (Josh, 31 October 2026: "no 48px controls"; the tap area
 * stays 48px). The older shape and the kit shape pass; a control drawn small without a cover, or
 * with too short a cover, fails. Without the failing cases a helper that always said yes would
 * look the same as one that works.
 */
describe("css tap-area helper", () => {
  it("reads the tap tokens, px and rem", () => {
    expect(lengthPx("var(--ward-tap)")).toBe(TAP_AREA_PX);
    expect(lengthPx("var(--ward-tap, 3rem)")).toBe(TAP_AREA_PX);
    expect(lengthPx("var(--spacing-tap, 3rem)")).toBe(TAP_AREA_PX);
    expect(lengthPx("40px")).toBe(40);
    expect(lengthPx("2.5rem")).toBe(40);
    expect(lengthPx("-4px")).toBe(-4);
    expect(lengthPx("var(--wf-h-sm)")).toBeNull();
  });

  it("passes the older shape: the control's own min-height is the tap token", () => {
    expect(tapAreaHeight(".btn { min-height: var(--ward-tap); }", "btn").total).toBe(48);
  });

  it("passes the kit shape: drawn at 40px with a 4px cover above and below", () => {
    const css =
      ".b { position: relative; height: 40px; min-height: 40px; }\n.b::after { content: ''; position: absolute; inset: -4px 0; }";
    expect(tapAreaHeight(css, "b")).toEqual({ drawn: 40, cover: 8, total: 48 });
  });

  it("passes a small kit control: drawn at 32px with an 8px cover", () => {
    const css =
      ".sm:not([data-placement-action]) { height: 32px; }\n.sm:not([data-placement-action])::after { inset: -8px 0; }";
    expect(tapAreaHeight(css, "sm").total).toBe(48);
  });

  it("fails a control drawn at 40px with no cover", () => {
    expect(tapAreaHeight(".btn { height: 40px; }", "btn").total).toBe(40);
  });

  it("fails a small control whose cover is too short", () => {
    const css = ".sm { height: 32px; }\n.sm::after { inset: -4px 0; }";
    expect(tapAreaHeight(css, "sm").total).toBe(40);
  });

  it("reads top and bottom covers and the horizontal axis", () => {
    const css = ".x { height: 40px; width: 40px; }\n.x::after { top: -4px; bottom: -4px; inset-inline: 0; }";
    expect(tapAreaHeight(css, "x").total).toBe(48);
    const icon = ".i { width: 40px; }\n.i::after { inset: -4px; }";
    expect(tapAreaWidth(icon, "i").total).toBe(48);
  });

  it("counts each side of a three- or four-value inset on its own", () => {
    const topOnly = ".b { height: 40px; }\n.b::after { inset: -4px 0 0; }";
    expect(tapAreaHeight(topOnly, "b").total).toBe(44);
    const rightOnly = ".i { width: 40px; }\n.i::after { inset: 0 -4px 0 0; }";
    expect(tapAreaWidth(rightOnly, "i").total).toBe(44);
    const uneven = ".b { height: 40px; }\n.b::after { inset: -6px 0 -2px 0; }";
    expect(tapAreaHeight(uneven, "b").total).toBe(48);
  });

  it("never credits a different class that starts with the same name", () => {
    const css = ".btnPrimary { min-height: var(--ward-tap); }\n.btn { height: 36px; }";
    expect(tapAreaHeight(css, "btn").total).toBe(36);
  });

  it("ignores rules inside comments", () => {
    expect(tapAreaHeight("/* .btn { min-height: 48px; } */ .btn { height: 36px; }", "btn").total).toBe(36);
  });
});
