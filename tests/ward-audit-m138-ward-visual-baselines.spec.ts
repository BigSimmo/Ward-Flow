import { expect, test, type Page } from "playwright/test";

import { HELP_TIPS_OFF_KEY } from "@/components/ward-management/help-content/ward-help-tips-off";

/**
 * M138: visual baselines beyond light mode. Extends tests/ward-visual-baselines.spec.ts (ten
 * screens, light theme) with dark theme, one TV view, one print preview and the phone floating bar
 * (D-112). Same rules as that file: nightly only (visual-desktop and visual-phone projects), fixed
 * clock, motion and tips off, baselines made on the hosted runner that compares them. The file name
 * ends in ward-visual-baselines.spec.ts so the visual projects and the nightly "update baselines"
 * run pick it up with the original.
 *
 * Until the first hosted "update baselines" run commits these pictures, the nightly compare reports
 * each one as missing (a missing baseline fails; nothing is skipped). Refresh PRs show old and new
 * pictures through GitHub's image diff on each changed PNG.
 */
const FIXED_BOARD_MOMENT = new Date("2026-11-04T02:42:00.000Z");

test.use({ reducedMotion: "reduce" });
test.describe.configure({ timeout: 60_000 });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_BOARD_MOMENT);
  await page.addInitScript((key) => window.localStorage.setItem(key, "yes"), HELP_TIPS_OFF_KEY);
});

async function openSettled(page: Page, route: string, screenId: string) {
  const response = await page.goto(`/ward-flow${route}`, { waitUntil: "load" });
  expect(response?.ok(), `/ward-flow${route} answered`).toBe(true);
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId(screenId)).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

const SHOT = { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.01 } as const;

test.describe("dark theme", () => {
  // The theme follows the device until someone picks one, so a dark device shows the dark theme.
  test.use({ colorScheme: "dark" });
  for (const [name, route, screenId] of [
    ["home", "", "ward-coordinator"],
    ["ward", "/ward/rph-adult-secure", "ward-unit-screen"],
    ["referrals", "/referrals", "ward-referral-board-screen"],
  ] as const) {
    test(`picture: dark ${name} matches its baseline`, async ({ page }) => {
      await openSettled(page, route, screenId);
      await expect(page.locator("html[data-wf-bar-ready]")).toHaveCount(1, { timeout: 30_000 });
      expect(await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(true);
      await expect(page).toHaveScreenshot(`dark-${name}.png`, SHOT);
    });
  }
});

test.describe("light theme extras", () => {
  test.use({ colorScheme: "light" });

  test("picture: bed meeting TV (state view) matches its baseline", async ({ page }, testInfo) => {
    // A phone gets the larger-screen card over the TV until Show anyway (ward-phone-desktop-only).
    test.skip(testInfo.project.name === "visual-phone", "The TV view is a larger-screen page");
    await openSettled(page, "/bed-meeting?service=all", "bed-meeting-tv");
    await expect(page).toHaveScreenshot("tv-bed-meeting-all.png", SHOT);
  });

  test("picture: handover print preview matches its baseline", async ({ page }, testInfo) => {
    // A phone renders HandoverPhone, which has no printable sheet.
    test.skip(testInfo.project.name === "visual-phone", "The printed handover sheet is not on a phone");
    await openSettled(page, "/handover", "ward-handover-page");
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("ward-handover-sheet")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveScreenshot("print-handover.png", { ...SHOT, fullPage: true });
  });

  test("picture: phone floating bar (D-112) matches its baseline", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "visual-phone", "The floating bar is the phone dock (D-112)");
    await openSettled(page, "", "ward-coordinator");
    const dock = page.getByTestId("ward-phone-dock").first();
    await expect(dock).toBeVisible({ timeout: 15_000 });
    await expect(dock).toHaveScreenshot("phone-floating-bar.png", SHOT);
  });
});
