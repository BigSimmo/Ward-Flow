import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as glyphs from "@/components/wf/glyphs";
import { WARD_NAV_ICONS, WARD_VIEW_ICONS } from "@/components/ward-management/ward-nav-icons";

// Icon overhaul (3 Nov 2026): Ward Flow's own glyphs for the menus.
describe("Ward Flow glyphs", () => {
  const entries = Object.entries(glyphs);

  it.each(entries)("%s draws on the 24px grid with a tone layer and stays decorative", (_name, Glyph) => {
    const html = renderToStaticMarkup(createElement(Glyph, { "aria-hidden": "true", strokeWidth: 1.75 }));
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke-width="1.75"');
    expect(html).toContain("var(--wf-glyph-tone");
    expect(html).toContain('aria-hidden="true"');
  });

  it("gives every menu destination its own glyph, so the icon-only rail never shows two the same", () => {
    const navIcons = Object.values(WARD_NAV_ICONS);
    expect(new Set(navIcons).size).toBe(navIcons.length);
  });

  it("keeps Alerts and All EDs apart, and Discharges off the Sign out icon", () => {
    expect(WARD_NAV_ICONS.alerts).not.toBe(WARD_NAV_ICONS.ed);
    expect(WARD_NAV_ICONS.discharges).toBe(glyphs.GlyphDischarge);
    expect(WARD_VIEW_ICONS.delays).toBe(glyphs.GlyphWaiting);
  });
});
