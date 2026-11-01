import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Site review, 12 Oct 2026: shared-part fixes that live only in CSS. Each pins the rule a later
 * restyle must keep: the two-tone focus ring, the Live pill's pause target, the phone Tasks row
 * target and the approved act-now style on the portrait list.
 */
const read = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");

describe("site review shell fixes", () => {
  it("fills the focus gap and adds the halo, at zero specificity, inside the Ward shell", () => {
    const layout = read("src/app/ward-flow/ward-flow-layout.module.css");
    const rule = /:where\(\.shellRow\)\s*:where\([^)]*button[^{]*:focus-visible\s*\{([^}]*)\}/u.exec(layout)?.[1];
    expect(rule, "no shared two-tone focus rule").toBeDefined();
    expect(rule).toMatch(/0 0 0 2px var\(--wf-focus-gap/u);
    expect(rule).toMatch(/0 0 0 6px color-mix\(in srgb, var\(--wf-focus-ring/u);
    // The hero sets its own gap, so the ring on the dark band keeps a dark gap.
    expect(read("src/components/wf/hero.module.css")).toMatch(/--wf-focus-gap:\s*var\(--wf-hero-2\)/u);
  });

  it("gives the Live pill's folded pause a 28px target, 48px on phone, without moving the pill", () => {
    const live = read("src/components/wf/live.module.css");
    const toggle = /\n\.toggle\s*\{([^}]*)\}/u.exec(live)?.[1] ?? "";
    expect(toggle).toMatch(/--wf-live-hit:\s*max\(28px, var\(--wf-tablet-tap, 0px\)\)/u);
    expect(toggle).toMatch(/min-height:\s*var\(--wf-live-hit\)/u);
    expect(toggle).toMatch(/margin-block:/u);
    expect(live).toMatch(/@media \(max-width: 48rem\) \{\s*\.toggle\s*\{\s*--wf-live-hit:\s*48px;/u);
    // One control: no hairline splitting the glyph off as a separate tile.
    const glyph = /\n\.toggleGlyph\s*\{([^}]*)\}/u.exec(live)?.[1] ?? "";
    expect(glyph).not.toMatch(/border-left/u);
    const hero = read("src/components/wf/hero.module.css");
    expect(hero).toMatch(
      /\[data-wf-live\] > button\[aria-pressed\]\s*\{[^}]*min-height:\s*44px;[^}]*margin-block:\s*-11px;/u,
    );
  });

  it("makes the phone Tasks row title a 44px target that keeps the row's layout", () => {
    const css = read("src/components/ward-management/ward-tasks-drawer.module.css");
    const phone = css.slice(css.lastIndexOf("@media (max-width: 48rem)"));
    const title = /\.rowTitle\s*\{([^}]*justify-self:\s*stretch[^}]*)\}/u.exec(phone)?.[1] ?? "";
    expect(title).toMatch(/margin-block:\s*-12px/u);
    expect(title).toMatch(/padding-block:\s*12px/u);
  });

  it("draws act now on the portrait list as the faint tint, with no side marker and never a red box", () => {
    const css = read("src/components/wf/portrait.module.css");
    expect(css).toMatch(/\.actNow\s*\{[^}]*position:\s*relative;[^}]*background:\s*var\(--wf-act-tint\)/u);
    // Josh, 31 Oct 2026: no coloured side edges, so the 3px coral marker is gone.
    expect(css).not.toMatch(/\.actNow::before/u);
    expect(css).not.toMatch(/inset 0 0 0 1px var\(--wf-danger\)/u);
  });

  it("draws the phone Menu act-now row as the faint tint, with no side marker", () => {
    const css = read("src/components/ward-management/shell/ward-phone-menu-act-now.module.css");
    expect(css).toMatch(/\.actNow\.actNow\s*\{[^}]*background:\s*var\(--wf-act-tint\)/u);
    // Josh, 31 Oct 2026: no coloured side edges, so the 3px coral bar is gone.
    expect(css).not.toMatch(/::before/u);
  });
});
