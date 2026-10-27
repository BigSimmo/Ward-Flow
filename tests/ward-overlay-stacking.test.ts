import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Josh, 25 Oct 2026 ("buttons don't work here"): the phone referral sheet sat at z-index 1000, above
// the shared modal layer (--z-modal, 100). Summary opened its sheet underneath, out of sight, and
// that hidden sheet inerted the page, so every button on the referral looked live but did nothing.
// An in-page slide-over must sit on the overlay rung, under any sheet or dialog it opens.
const css = (file: string) =>
  readFileSync(path.join(process.cwd(), "src/components/ward-management", file), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

function zIndexOf(source: string, selector: string): string[] {
  const values: string[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rule.exec(source))) {
    if (!match[1].includes(selector)) continue;
    const z = /z-index:\s*([^;]+);/.exec(match[2]);
    if (z) values.push(z[1].trim());
  }
  return values;
}

describe("in-page slide-overs stay under the modal layer", () => {
  it.each([
    ["referrals/referrals.module.css", '.registerDetail[data-has-selection="true"]'],
    ["referrals/referrals.module.css", ".detailBackdrop"],
    ["coordinator/coordinator.module.css", ".shortlistColumn"],
    ["coordinator/coordinator.module.css", ".shortlistBackdrop"],
    ["coordinator/home.module.css", ".shortlistColumn"],
    ["coordinator/home.module.css", ".shortlistBackdrop"],
    ["coordinator/shortlist-panel.module.css", ".shortlistColumn"],
    ["coordinator/shortlist-panel.module.css", ".shortlistBackdrop"],
    ["ed/ed.module.css", ".fullscreenBoard"],
  ])("%s %s uses the overlay rung", (file, selector) => {
    const values = zIndexOf(css(file), selector);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value).toMatch(/var\(--z-overlay\)/);
  });
});

// H-0876 (A1K-03, 26 Oct 2026): 16 overlays sat on hard-coded layers above the dialog layer (120,
// 900, 990, 1000, 9999, 99999). Any sheet opened from one of them would open underneath, the same
// dead-button pattern as above. Toasts sit on the toast rung, dialogs on the modal rung and in-page
// drawer backdrops on the overlay rung.
describe("overlays use the shared layers, not hard-coded ones", () => {
  it.each([
    ["community/community.module.css", ".actionToast", "--z-toast"],
    ["community/community.module.css", ".clinicalToast", "--z-toast"],
    ["community/community.module.css", ".modalOverlay", "--z-modal"],
    ["ward/ward.module.css", ".actionToast", "--z-toast"],
    ["ward/ward.module.css", ".modalOverlay", "--z-modal"],
    ["ward/ward-answer-view.module.css", ".modalOverlay", "--z-modal"],
    ["ward/ward-answer-view.module.css", ".toast", "--z-toast"],
    ["delays/delays.module.css", ".toastNotice", "--z-toast"],
    ["settings/settings-modals.module.css", ".modalOverlay", "--z-modal"],
    ["referrals/ward-referral-drawer.module.css", ".drawerBackdrop", "--z-overlay"],
    ["referrals/arrival-time-modal.module.css", ".overlay", "--z-modal"],
    ["ward-tasks-drawer.module.css", ".drawerBackdrop", "--z-overlay"],
    ["ward-standing-strip.module.css", ".hudAnchor", "--z-toast"],
    ["board/board.module.css", ".toast", "--z-toast"],
    ["board/board.module.css", ".modalBackdrop", "--z-modal"],
    ["ed/ed.module.css", ".modalBackdrop", "--z-modal"],
  ])("%s %s uses %s", (file, selector, token) => {
    const values = zIndexOf(css(file), selector);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value).toBe(`var(${token})`);
  });
});
