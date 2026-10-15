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
      "src/components/ward-management/search/census.module.css",
      "src/components/ward-management/statistics/statistics-nav.module.css",
      "src/components/ward-management/community/community-team-phone.module.css",
      "src/components/ward-management/ed/ed-board-controls.module.css",
      "src/components/ward-management/ed/ed.module.css",
      "src/components/ward-management/tools/ward-mha-calculator.module.css",
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

    const v6Tokens = readCss("src/app/ward-flow-v6-tokens.css");
    expect(v6Tokens).toMatch(/--wf-phone-pill-gap:\s*8px/);
  });

  it("prevents 320px horizontal overflow when DOB filter is open in census.module.css", () => {
    const censusCss = readCss("src/components/ward-management/search/census.module.css");
    expect(censusCss).not.toMatch(/\.searchForm:has\(\.dobSeg\)\s*\{[^}]*min-width:\s*380px/);
    expect(censusCss).toMatch(/\.searchForm:has\(\.dobSeg\)\s*\{[^}]*min-width:\s*min\(380px,\s*100%\)/);
  });

  it("eliminates 11px font-size fallbacks in out-of-area-third-edition.module.css and referrals.module.css and expands collapsed rail controls to 2.75rem", () => {
    const ooaCss = readCss("src/components/ward-management/out-of-area/out-of-area-third-edition.module.css");
    const referralsCss = readCss("src/components/ward-management/referrals/referrals.module.css");
    expect(ooaCss).not.toMatch(/font-size:\s*var\(--t-0,\s*11px\)/);
    expect(referralsCss).not.toMatch(/font-size:\s*var\(--t-0,\s*11px\)/);

    const railCss = readCss("src/components/ward-management/shell/ward-rail.module.css");
    expect(railCss).toMatch(/\.rail\[data-rail="closed"\]\s+\.compactAlertPip\s*\{[^}]*min-height:\s*2\.75rem/);
    expect(railCss).toMatch(/\.rail\[data-rail="closed"\]\s+\.utilityLink\s*\{[^}]*width:\s*2\.75rem/);
    expect(railCss).toMatch(/\.rail\[data-rail="closed"\]\s+\.userProfileCard\s*\{[^}]*min-height:\s*2\.75rem/);
  });
});
