import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readCss(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("Mobile 16px input floor, 44x44px touch targets, 320px DOB overflow & v9 CSS contract", () => {
  it("enforces a 16px (1rem) mobile/coarse-pointer font-size floor across all 14 form and screen CSS modules and 2.75rem min-height on .choice", () => {
    const formCss = readCss("src/components/wf/form.module.css");
    expect(formCss).toMatch(/\.control\s*\{[^}]*font-size:\s*max\(1rem,\s*16px\)/);
    expect(formCss).toMatch(/\.choice\s*\{[^}]*min-height:\s*2\.75rem/);

    const mobileInputModules = [
      "src/components/wf/form.module.css",
      "src/components/ward-management/ward/ward-bed-dossier-drawer.module.css",
      "src/components/ward-management/delays/delays-board.module.css",
      "src/components/ward-management/movements/movement-horizon.module.css",
      "src/components/ward-management/movements/movement-drawer.module.css",
      "src/components/ward-management/movements/movement-workspace-cockpit.module.css",
      "src/components/ward-management/referrals/ward-referral-drawer.module.css",
      "src/components/ward-management/ward/ward-answer-view.module.css",
      "src/components/ward-management/ward-global-search.module.css",
      "src/components/ward-management/search/patient-typeahead.module.css",
      // census.module.css left this list with the Patients redesign (D-91): its search and date of birth
      // boxes are the kit's SearchField and DateField, whose `.control` carries the floor above.
      // statistics-nav.module.css left this list on 3 Nov 2026: its phone section select became the kit Menu,
      // so it has no text box to zoom.
      "src/components/ward-management/community/community-team-phone.module.css",
      "src/components/ward-management/ed/ed-board-controls.module.css",
      "src/components/ward-management/ed/ed.module.css",
      "src/components/ward-management/tools/ward-tools-sheet.module.css",
      "src/components/ward-management/referrals/arrival-time-modal.module.css",
    ];
    for (const modPath of mobileInputModules) {
      expect(readCss(modPath), `${modPath} must include max(1rem, 16px)`).toContain("max(1rem, 16px)");
    }
  });

  it("replaces opacity dimming on .row[data-dim='true'] with v9 token colours and adds reduced-motion and tabular-nums in portrait.module.css", () => {
    const portraitCss = readCss("src/components/wf/portrait.module.css");
    const dimBlockMatch = portraitCss.match(/\.row\[data-dim="true"\]\s*\{([^}]*)\}/);
    expect(dimBlockMatch).not.toBeNull();
    expect(dimBlockMatch?.[1]).not.toMatch(/opacity\s*:/);
    expect(portraitCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(portraitCss).toMatch(/\.groupCount\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    expect(portraitCss).toMatch(/\.triggerSummary\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });

  it("raises .shortlistOverrideButton and .allocationButtonTouch min-height to at least 2.75rem (44px) and raises --wf-phone-pill-gap to 8px", () => {
    const shortlistCss = readCss("src/components/ward-management/coordinator/shortlist-panel.module.css");
    const overrideMinHeight = shortlistCss.match(/\.shortlistOverrideButton[^{]*\{[^}]*min-height:\s*([\d.]+)rem/);
    expect(Number(overrideMinHeight?.[1])).toBeGreaterThanOrEqual(2.75);
    expect(shortlistCss).not.toMatch(/min-height:\s*2\.125rem/);

    const wfTokens = readCss("src/app/ward-flow-v9-tokens.css");
    expect(wfTokens).toMatch(/--wf-phone-pill-gap:\s*8px/);
  });

  it("prevents 320px horizontal overflow when DOB filter is open in census.module.css", () => {
    const censusCss = readCss("src/components/ward-management/search/census.module.css");
    // The Patients redesign (D-91): with the date of birth open the form grows to at most 560px and
    // never sets a fixed minimum width, so a 320px phone never scrolls sideways.
    const dobOpen = /\.searchForm:has\(\.dobField\)\s*\{([^}]*)\}/u.exec(censusCss)?.[1];
    expect(dobOpen).toBeDefined();
    expect(dobOpen).not.toMatch(/min-width:\s*\d+px/u);
  });

  // out-of-area-third-edition.module.css left this case on 15 Oct 2026: nothing imported it, so it
  // was deleted (fix list 2.4). The live out-of-area sheets are in tests/ward-table-min-width.test.ts.
  it("eliminates 11px font-size fallbacks in referrals.module.css and expands collapsed rail controls to 2.75rem", () => {
    const referralsCss = readCss("src/components/ward-management/referrals/referrals.module.css");
    expect(referralsCss).not.toMatch(/font-size:\s*var\(--t-0,\s*11px\)/);

    const railCss = readCss("src/components/ward-management/shell/ward-rail.module.css");
    expect(railCss).toMatch(/\.rail\[data-rail="closed"\]\s+\.compactAlertPip\s*\{[^}]*min-height:\s*2\.75rem/);
    expect(railCss).toMatch(/\.rail\[data-rail="closed"\]\s+\.utilityLink\s*\{[^}]*width:\s*2\.75rem/);
    expect(railCss).toMatch(/\.rail\[data-rail="closed"\]\s+\.userProfileCard\s*\{[^}]*min-height:\s*2\.75rem/);
  });

  // P151: a CSS rule can't be rendered in jsdom (no pseudo-element content), so this one stays a CSS
  // contract here rather than in the drawer's DOM wording test.
  it("P151: the referral drawer's CSS asterisk has empty alt text, so screen readers do not read '* * *'", () => {
    const css = readCss("src/components/ward-management/referrals/ward-referral-drawer.module.css");
    const rule = /\.required::after\s*\{([^}]*)\}/u.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/content:\s*"\*"\s*\/\s*""/u);
  });

  // WF-41 (5 Nov 2026): at ~610px of card width the ED pressure table clipped inside redesign
  // halves, and on a short phone the sticky segment and dock left roughly half the viewport.
  it("WF-41: pressure tables stack and scroll inside their card, and the phone segment unsticks when short", () => {
    const redesign = readCss("src/components/ward-management/statistics/redesign/statistics-redesign.module.css");
    expect(redesign).toMatch(
      /@media\s*\(\s*max-width:\s*80rem\s*\)\s*\{[\s\S]*?\.halves:has\(table\[id="edPressureTable"\]\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    );
    expect(redesign).toMatch(
      /@media\s*\(\s*max-width:\s*80rem\s*\)\s*\{[\s\S]*?\.tableWrap:has\(>\s*table\[id="edPressureTable"\]\)[\s\S]*?overflow-x:\s*auto/u,
    );
    const phone = readCss("src/components/ward-management/statistics/statistics-phone.module.css");
    expect(phone).toMatch(
      /@media\s*\(\s*max-height:\s*44rem\s*\)\s*\{[\s\S]*?\.segPinned\s*\{[\s\S]*?position:\s*static/u,
    );
    const v6 = readCss("src/components/ward-management/statistics/statistics-v6.module.css");
    expect(v6).toMatch(/\.tableWrap\s*\{[\s\S]*?overflow-x:\s*auto/u);
  });

  // WF-46 (5 Nov 2026): the access admin's Audit trail read as half-drawn, in small text.
  it("WF-46: the governance event list keeps readable sizes and drops its scroll edge when empty", () => {
    const css = readCss("src/components/ward-management/governance-third-edition.module.css");
    expect(css).toMatch(/\.capturedList\[data-empty\]\s*\{[^}]*animation:\s*none/u);
    expect(css.match(/\n\.eventHeader \{[^}]*\}/u)?.[0] ?? "").toContain("var(--wf-fs-13)");
    expect(css.match(/\n\.eventRow \{\n  width: 100%;[^}]*\}/u)?.[0] ?? "").toContain("var(--wf-fs-14)");
  });

  // WF-44 (5 Nov 2026): the live NextRail, not only the unmounted legacy rail, labels its closed
  // tile and stacks Metro above the ready count with styles that exist.
  it("WF-44: the live rail stacks Metro and ready beds and labels its closed tile", () => {
    const css = readCss("src/components/ward-management/shell-next/next-rail.module.css");
    expect(css).toMatch(/\.readyStack\s*\{[^}]*flex-direction:\s*column/u);
    expect(css).toMatch(/\.readyMetro\s*\{[^}]*white-space:\s*nowrap/u);
    expect(css, "no empty rule").not.toMatch(/\{\s*\}/u);
    const body = readCss("src/components/ward-management/shell-next/next-rail-body.tsx");
    expect(body).toMatch(/className=\{styles\.compactAlertVal\}>\{compactPipText\(firstRow\)\}/u);
  });
});

// Design audit PR 3 (5 Nov 2026): kit, focus and states. These read stylesheets on purpose, since
// jsdom computes no layout, so they live in this listed contract file (CQ-10 ratchet).
const read = readCss;

/** One CSS rule block, from its selector to its closing brace. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("offline note: one pinned note at a time", () => {
  it("hides the drawn offline note while a higher note is pinned in the banner holder", () => {
    const css = read("src/app/ward-flow/ward-flow-layout.module.css");
    expect(css).toMatch(/\.bannerHolder > \* \+ \[data-wf-offline-slot\]\) > :global\(\[data-wf-offline-note\]\)/u);
  });
});

describe("K1 and K3: kit controls grow with large text in every engine", () => {
  it("buttons, options and fields use a floor (min-height) with an auto height, calc-size only as an extra", () => {
    const button = read("src/components/wf/button.module.css");
    for (const selector of [".b", ".sm", ".lg"]) {
      const rule = block(button, selector);
      expect(rule, selector).toMatch(/min-height: var\(--wf-h-(md|sm|lg)\);\s*height: auto;\s*height: calc-size/u);
      expect(rule, selector).not.toMatch(/\n\s*height: var\(/u);
    }
    const choice = read("src/components/wf/choice.module.css");
    expect(block(choice, ".segItem")).toMatch(/min-height: var\(--wf-target\);\s*height: auto;/u);
    expect(block(choice, ".tab")).toContain("min-height: 34px");
    expect(choice).not.toMatch(/html\) \.segItem\.segItem,\s*:global\(html\) \.ptItem\.ptItem \{\s*height: 30px/u);
    const form = read("src/components/wf/form.module.css");
    expect(block(form, ".in")).toMatch(/min-height: max\(var\(--wf-h-md\), var\(--wf-tablet-tap, 0px\)\);/u);
    expect(block(form, ".in")).not.toMatch(/\n\s*height: var\(--wf-h-md\)/u);
    expect(block(form, ".control")).toContain("align-self: stretch");
    for (const [file, selector] of [
      ["src/components/wf/badge.module.css", ".bd"],
      ["src/components/wf/v10-pass2.module.css", ".pill"],
      ["src/components/wf/live.module.css", ".lv"],
      ["src/components/wf/show-more-row.module.css", ".row"],
      ["src/components/wf/time-presets.module.css", ".preset"],
      ["src/components/wf/feed.module.css", ".upToDate"],
    ] as const) {
      expect(block(read(file), selector), `${file} ${selector}`).toMatch(/\n\s*min-height: /u);
      expect(block(read(file), selector), `${file} ${selector}`).not.toMatch(/\n\s*height: \d/u);
    }
  });
});

describe("chip strip edge fade", () => {
  it("writes the scroll-driven fade as longhands, so the CSS build cannot fold it into a shorthand Chrome drops", () => {
    for (const file of ["src/components/wf/choice.module.css", "src/components/wf/v10-pass2.module.css"]) {
      const css = read(file);
      expect(css, file).not.toMatch(/animation: wfRowFade/u);
      expect(css, file).toMatch(/animation-name: wfRowFade;\s*animation-duration: 1ms;/u);
    }
  });
});

describe("K2: fields outside the kit take the kit focus ring", () => {
  it("draws a 2px solid ring with a 2px gap, from the kit token", () => {
    const globals = read("src/app/globals.css");
    const start = globals.indexOf(':where(input:not([type="checkbox"])');
    const rule = globals.slice(start, globals.indexOf("}", start));
    expect(rule).toContain("outline: 2px solid var(--wf-focus-ring, var(--focus));");
    expect(rule).toContain("outline-offset: 2px;");
    expect(rule).not.toContain("outline: 1px");
  });
});

describe("K15: Ward Flow's own z-index tokens", () => {
  it("declares the scale in the v9 tokens with the legacy values, and the kit reads it", () => {
    const tokens = read("src/app/ward-flow-v9-tokens.css");
    for (const [name, value] of [
      ["base", 0],
      ["raised", 10],
      ["chrome", 60],
      ["overlay", 80],
      ["popover", 95],
      ["modal", 100],
      ["toast", 110],
    ] as const) {
      expect(tokens).toContain(`--wf-z-${name}: ${value};`);
      expect(read("src/app/ckb-v2-tokens.css")).toMatch(new RegExp(`--z-${name}: ${value};`, "u"));
    }
    for (const file of ["dialog.module.css", "list-picker.module.css", "overlay.module.css", "phone.module.css"]) {
      expect(read(`src/components/wf/${file}`), file).not.toMatch(/var\(--z-/u);
    }
    expect(read("src/components/ward-management/ed/ed-handover.module.css")).not.toContain("var(--z-overlay, 60)");
  });
});

describe("states", () => {
  it("ST4: the first-load note rests at the foot of the window at every width", () => {
    const note = block(read("src/app/ward-flow/ward-flow-layout.module.css"), ".loadingNote");
    expect(note).toContain("bottom: 0.75rem");
    expect(note).not.toContain("top:");
  });

  it("ST8: the offline note rests at the foot of the window, above the dock on a phone", () => {
    const css = read("src/components/ward-management/shell/ward-offline-banner.module.css");
    const banner = block(css, ".banner");
    expect(banner).toContain("position: fixed");
    expect(banner).toContain("bottom: 0.75rem");
    expect(css).toMatch(/\.banner \{\s*bottom: calc\(var\(--wf-dock-clear/u);
  });

  it("ST8 (PR #1474 review): on paper the offline note prints in the page's flow, not fixed", () => {
    const globals = read("src/app/globals.css");
    const print = globals.slice(globals.indexOf("@media print {\n  [data-wf-offline-note] {"));
    const rule = print.slice(0, print.indexOf("}"));
    expect(rule).toContain("position: static !important");
    expect(rule).toContain("transform: none !important");
    const layout = read("src/app/ward-flow/ward-flow-layout.module.css");
    const paper = layout.slice(layout.lastIndexOf("@media print {"));
    expect(paper).toMatch(/\[data-wf-offline-slot\]:first-child\)::after \{\s*display: none;/u);
  });

  it("K11 (PR #1474 review): a refused select takes no taps", () => {
    const css = read("src/components/wf/form.module.css");
    expect(block(css, ".refusedSelect")).toContain("pointer-events: none");
  });

  it("ST8 (PR #1474 review): the offline note lets taps through and the page ends with room for it", () => {
    const css = read("src/components/ward-management/shell/ward-offline-banner.module.css");
    expect(block(css, ".banner")).toContain("pointer-events: none");
    expect(block(css, ".banner :is(a, button)")).toContain("pointer-events: auto");
    const layout = read("src/app/ward-flow/ward-flow-layout.module.css");
    const room = block(layout, ".shellContent:has(> .bannerHolder > [data-wf-offline-slot]:first-child)::after");
    expect(room).toContain('content: ""');
    expect(room).toMatch(/block-size: \d/u);
  });

  it("ST6: the route error panel is drawn from kit tokens, not host classes", () => {
    const panel = read("src/app/ward-flow/ward-flow-error-panel.tsx");
    expect(panel).not.toMatch(/--surface-lux|--text-heading|--danger-soft|primaryControl/u);
    expect(panel).toContain('from "@/components/wf"');
    expect(read("src/app/ward-flow/ward-flow-error-panel.module.css")).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/iu);
  });

  it("D7: the Bed alerts tag shrinks and wraps, so the chevron stays inside the card", () => {
    const rule = block(
      read("src/components/ward-management/shell-next/next-rail.module.css"),
      ".capacityHead > :nth-child(2)",
    );
    expect(rule).toContain("min-width: 0");
    expect(rule).toContain("white-space: normal");
  });

  it("W34: a confirm whose dialog code fails to load keeps editing, never the browser box", () => {
    const confirm = read("src/components/wf/confirm-dialog.tsx");
    expect(confirm).toMatch(/function keepEditing\(current: Pending\) \{\s*settle\(current, false\);/u);
    // PR #1474 review: and says so (the toast provider passes `onUnavailable`).
    expect(confirm).toMatch(/keepEditing\(request\);\s*onUnavailable\?\.\(\);/u);
    // The only browser box left is the no-host fallback (a test or a page outside the app frame).
    expect(confirm.match(/window\.confirm\(/gu)).toHaveLength(1);
  });
});
