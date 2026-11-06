import { expect, test } from "playwright/test";

import { HELP_TIPS_OFF_KEY } from "@/components/ward-management/help-content/ward-help-tips-off";
import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";

/**
 * TE-01 (front-end audit, 5 Nov 2026): image baselines for ten key screens, so a change that
 * moves or restyles a screen shows up as a picture diff instead of in the next visual review.
 * Desktop Chrome at 1440 and phone WebKit at 390x844, light theme only (the visual-desktop and
 * visual-phone projects in playwright.config.ts).
 *
 * Nightly only, never on a pull request (.github/workflows/ward-flow-nightly-browsers.yml). The
 * baselines live in tests/visual-baselines/<project>/ and are made on the same hosted Linux runner
 * that compares them, because fonts and anti-aliasing differ between machines. A baseline made on a
 * laptop would fail on CI. To make or refresh them, run that workflow by hand with "update
 * baselines" ticked, download its baselines artifact and commit the files in a pull request.
 * A missing baseline fails the compare run (nothing is skipped), so a missing set never reads as a
 * pass.
 *
 * What keeps the pictures still: the browser clock is fixed (Wed 4 Nov 2026, 10:42 in Perth), so
 * the board day and time are the same every night. The board time is the scenario anchor (10:42)
 * plus time since load, and the seeded synthetic records follow the board day. Motion is off and
 * tip cards are turned off for the device, as the axe sweep does. A small pixel allowance absorbs
 * anti-aliasing noise.
 */
const FIXED_BOARD_MOMENT = new Date("2026-11-04T02:42:00.000Z");

const SCREENS = [
  ["home", "", "ward-coordinator"],
  ["referrals", "/referrals", "ward-referral-board-screen"],
  ["ed", "/ed", "ward-ed-index"],
  ["ward", "/ward/rph-adult-secure", "ward-unit-screen"],
  ["movement", `/movements/${encodeRecordAddress("WF-001")}`, "ward-person-screen"],
  ["capacity", "/capacity", "ward-capacity-screen"],
  ["discharges", "/discharges", "ward-discharge-board"],
  ["legal-forms", "/legal-forms", "ward-legal-forms-page"],
  ["statistics", "/statistics", "ward-statistics-screen"],
  ["search", "/search", "ward-patient-search"],
] as const;

test.use({ reducedMotion: "reduce", colorScheme: "light" });
test.describe.configure({ timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_BOARD_MOMENT);
  await page.addInitScript((key) => window.localStorage.setItem(key, "yes"), HELP_TIPS_OFF_KEY);
});

for (const [name, route, screenId] of SCREENS) {
  test(`picture: ${name} matches its baseline`, async ({ page }) => {
    const response = await page.goto(`/ward-flow${route}`, { waitUntil: "load" });
    expect(response?.ok(), `/ward-flow${route} answered`).toBe(true);
    await expect(page.locator("html[data-wf-bar-ready]")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId(screenId)).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
  });
}
