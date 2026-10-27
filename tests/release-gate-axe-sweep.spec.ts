import { devices, expect, test, type Browser, type Page } from "playwright/test";

import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { expectAccessible, isPhoneLayout } from "./helpers/ward-release-gate";

/**
 * Every Ward Flow route passes an axe WCAG 2.1 AA scan with no serious or critical violation
 * (fix list 5.4 and 8.1, October 2026). The release-gate projects run it on desktop Chrome at
 * 1440px and on phone WebKit at 390x844, the same as the four journeys beside it.
 *
 * The journeys scan screens mid-task. This sweep opens each route fresh, so a screen no journey
 * reaches is still checked. Redirect-only routes (command, constellation, escalation, exceptions,
 * network, queue) are left out because they land on a route already listed. One seeded person and one
 * seeded movement stand in for the record pages, opened by their coded addresses.
 * The demonstration sign-in page is a sibling of `/ward-flow` with no rail or header, so it is
 * scanned on its own below (audit UI-8, 19 October 2026). It stays unlinked; this only checks it.
 * Synthetic data only.
 */

const ROUTES = [
  ["", "ward-coordinator"],
  ["/alerts", "ward-alerts-page"],
  ["/bed-meeting", "bed-meeting-tv-off"],
  ["/board/rph-adult-secure", "ward-board"],
  ["/capacity", "ward-capacity-page"],
  ["/community", "community-index"],
  ["/community/midland", "ward-community-screen"],
  ["/waiting", "ward-delays-page"],
  ["/discharges", "ward-discharge-board"],
  ["/ed", "ward-ed-index"],
  ["/ed/peel-ed", "ward-ed-screen"],
  ["/governance", "ward-mode-governance"],
  ["/handover", "ward-handover-page"],
  ["/hub", "ward-hub-page"],
  ["/legal-forms", "ward-legal-forms-page"],
  ["/movements", "ward-movements-page"],
  [`/movements/${encodeRecordAddress("WF-001")}`, "ward-person-screen"],
  ["/on-call", "ward-on-call-screen"],
  ["/out-of-area", "ward-out-of-area-board"],
  ["/people/new", "ward-add-patient-screen"],
  [`/people/${encodeRecordAddress("PT-001")}`, "ward-person-screen"],
  ["/referrals", "ward-referral-board-screen"],
  ["/referrals/new", "ward-referral-board-screen"],
  ["/reports/chronology", "ward-patient-chronology"],
  ["/reports/downtime", "ward-downtime-pack"],
  ["/search", "ward-patient-search"],
  ["/settings", "ward-settings-screen"],
  ["/statistics", "ward-statistics-screen"],
  ["/statistics/community/bentley", "ward-statistics-community-screen"],
  ["/statistics/compare", "ward-statistics-compare-screen"],
  ["/statistics/ed/rph-ed", "ward-statistics-ed-screen"],
  ["/statistics/eds", "ward-statistics-eds-index"],
  ["/statistics/service/North%20Metro", "ward-statistics-service-screen"],
  ["/statistics/services", "ward-statistics-services-index"],
  ["/statistics/teams", "ward-statistics-teams-index"],
  ["/statistics/ward/rph-adult-secure", "ward-statistics-ward-screen"],
  ["/statistics/wards", "ward-statistics-wards-index"],
  ["/statistics/weekly", "ward-weekly-report"],
  ["/transport", "ward-officer-screen", "/transport/officer"],
  ["/transport/officer", "ward-officer-screen"],
  ["/ward/rph-adult-secure", "ward-unit-screen"],
  ["/ward/rph-adult-secure/answer", "ward-unit-screen"],
  ["/wards", "ward-index"],
] as const;

test.describe.configure({ timeout: 60_000 });

for (const [route, screenId, destination = route] of ROUTES) {
  test(`axe: ${route || "/"} has no serious or critical violation`, async ({ page }, testInfo) => {
    const expectedUrl = new URL(`/ward-flow${destination}`, testInfo.project.use.baseURL).href;
    const response = await page.goto(`/ward-flow${route}`, { waitUntil: "load" });
    expect(response, "route navigation must return an HTTP response").not.toBeNull();
    expect(response!.ok(), `route returned HTTP ${response!.status()}`).toBe(true);
    await expect(page).toHaveURL(expectedUrl);
    // The header marks itself ready once the page's code runs; scan the live page, not the
    // server-drawn copy that is still waiting for it.
    await expect(page.locator("html[data-wf-bar-ready]")).toHaveCount(1, { timeout: 30_000 });
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    // A desktop-only page (the bed meeting TV) shows its "needs a larger screen" card on a phone
    // and hides the page itself, so the phone scans that card.
    if (route === "/bed-meeting" && isPhoneLayout(page)) {
      const fallback = page.locator("[data-phone-desktop-only]");
      await expect(fallback).toBeVisible();
      await expect(fallback.getByRole("heading", { level: 1 })).toHaveText("Bed meeting TV needs a larger screen");
    } else {
      // The TV route is feature-gated; both its disabled screen and enabled TV identify this route.
      const screen =
        route === "/bed-meeting"
          ? page.getByTestId(screenId).or(page.getByTestId("bed-meeting-tv"))
          : page.getByTestId(screenId);
      await expect(screen).toBeVisible({ timeout: 15_000 });
    }
    await expect(page.getByRole("heading", { name: /not found$/i })).toHaveCount(0);
    await expect(page).toHaveURL(expectedUrl);
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, testInfo, route || "/");
  });
}

/** Routes outside the `/ward-flow` shell: no header, so no header-ready mark to wait for. */
const UNSHELLED_ROUTES = ["/ward-flow-sign-in"] as const;

for (const route of UNSHELLED_ROUTES) {
  test(`axe: ${route} has no serious or critical violation`, async ({ page }, testInfo) => {
    await page.goto(route, { waitUntil: "load" });
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator("main:visible").first()).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, testInfo, route);
  });
}

/**
 * Design audit DA-20 (19 October 2026): the sweep above scans each screen at rest, so a structure
 * that only exists while something is open went unchecked. These scan the header search palette
 * with results showing and the ED actions menu open, the two places DA-05 fixed (buttons inside the
 * results list, headings inside the menu). The search types one letter; no name is typed.
 */
async function openShell(page: Page, route: string, screenId: string) {
  await page.goto(`/ward-flow${route}`, { waitUntil: "load" });
  await expect(page.locator("html[data-wf-bar-ready]")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId(screenId)).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test("axe: the header search palette with results open has no serious or critical violation", async ({
  page,
}, testInfo) => {
  await openShell(page, "/wards", "ward-index");
  const input = page.getByTestId("ward-global-search-input");
  await input.click();
  await input.fill("a");
  const popup = page.getByTestId("ward-global-search-popup");
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("option").first()).toBeVisible();
  // Rows drawn from a deferred (stale) query are aria-disabled and ignore the keyboard by design;
  // press only once the results belong to the typed query.
  await expect(popup.getByRole("option").first()).not.toHaveAttribute("aria-disabled", "true");
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", /.+/);
  await expectAccessible(page, testInfo, "header search open");
});

test("axe: the ED actions menu when open has no serious or critical violation", async ({ page }, testInfo) => {
  // The phone ED board opens each row's actions in a sheet rather than this menu.
  test.skip(isPhoneLayout(page), "The actions menu is the desktop ED board's");
  await openShell(page, "/ed/fsh-ed", "ward-ed-screen");
  await page.locator('[data-testid^="ward-ed-unfold-"]:visible').first().click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expectAccessible(page, testInfo, "ED actions menu open");
});

/**
 * DA-20, the third open structure: a ward's bed drawer (Bed, Plan to leave and the rest) only
 * exists once a bed is opened. It opens from Place or move on Ward home, which desktop and phone both show,
 * and is scanned with its first tab showing.
 */
test("axe: a ward's bed drawer when open has no serious or critical violation", async ({ page }, testInfo) => {
  await openShell(page, "/ward/rph-adult-secure", "ward-unit-screen");
  await page.getByTestId("ward-open-bed-board").click();
  await page.getByTestId("ward-board-bed-1").click();
  await expect(page.getByTestId("bed-telemetry-drawer")).toBeVisible();
  await expectAccessible(page, testInfo, "ward bed drawer open");
});

/**
 * NC-05 (design reassessment 20 Oct 2026, H-0168): everything above runs in the light theme. This
 * pass runs again with the device asking for dark, on a spread of desks and the open sheets and
 * menus, so a dark colour that fails contrast is caught too. The bed drawer is left to the light
 * pass above, which opens it the way the Ward page does now.
 */
test.describe("dark theme", () => {
  test.use({ colorScheme: "dark" });

  const DARK_ROUTES = [
    ["", "ward-coordinator"],
    ["/community/midland", "ward-community-screen"],
    ["/discharges", "ward-discharge-board"],
    ["/ed/peel-ed", "ward-ed-screen"],
    ["/referrals/new", "ward-referral-board-screen"],
    ["/settings", "ward-settings-screen"],
    ["/statistics", "ward-statistics-screen"],
    ["/transport/officer", "ward-officer-screen"],
    ["/ward/rph-adult-secure", "ward-unit-screen"],
  ] as const;

  async function openDark(page: Page, route: string, screenId: string) {
    await openShell(page, route, screenId);
    await expect(page.locator("html.dark"), "the device asks for dark, so the app must draw dark").toHaveCount(1);
  }

  for (const [route, screenId] of DARK_ROUTES) {
    test(`axe dark: ${route || "/"} has no serious or critical violation`, async ({ page }, testInfo) => {
      await openDark(page, route, screenId);
      await expectAccessible(page, testInfo, `dark ${route || "/"}`);
    });
  }

  test("axe dark: the header search palette with results open", async ({ page }, testInfo) => {
    await openDark(page, "/wards", "ward-index");
    const input = page.getByTestId("ward-global-search-input");
    await input.click();
    await input.fill("a");
    const popup = page.getByTestId("ward-global-search-popup");
    await expect(popup.getByRole("option").first()).not.toHaveAttribute("aria-disabled", "true");
    await expectAccessible(page, testInfo, "dark header search open");
  });

  test("axe dark: the ED actions menu when open", async ({ page }, testInfo) => {
    test.skip(isPhoneLayout(page), "The actions menu is the desktop ED board's");
    await openDark(page, "/ed/fsh-ed", "ward-ed-screen");
    await page.locator('[data-testid^="ward-ed-unfold-"]:visible').first().click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expectAccessible(page, testInfo, "dark ED actions menu open");
  });

  test("axe dark: the Tools sheet, or the phone Menu sheet, when open", async ({ page }, testInfo) => {
    await openDark(page, "/wards", "ward-index");
    if (isPhoneLayout(page)) {
      await page.getByTestId("ward-bar-phone-menu").click();
      await expect(page.getByTestId("ward-phone-menu")).toBeVisible();
    } else {
      await page.getByTestId("ward-bar-tools-trigger").click();
      await expect(page.getByRole("dialog", { name: "Tools" })).toBeVisible();
    }
    await expectAccessible(page, testInfo, "dark Tools or Menu open");
  });
});

/**
 * DA-38 (design reassessment 20 Oct 2026, H-0196): nothing in CI caught a screen that jumps once its
 * code runs. These open a spread of desks fresh, at desktop and phone size, and add up every layout
 * shift the page makes on its own until it settles. 0.1 is the "good" line for cumulative layout
 * shift. On 27 Oct 2026 the worst desk measured 0.07 on a phone and 0.004 on a desktop. Only
 * Chromium reports layout shifts, so the phone pass runs as a phone-sized Chromium page inside the
 * desktop project, sent with a phone's user agent so the server draws the phone layout first, as it
 * does for a real phone.
 */
test.describe("layout shift", () => {
  const SHIFT_ROUTES = [
    ["", "ward-coordinator"],
    ["/community/midland", "ward-community-screen"],
    ["/discharges", "ward-discharge-board"],
    ["/ed/peel-ed", "ward-ed-screen"],
    ["/movements", "ward-movements-page"],
    ["/people/new", "ward-add-patient-screen"],
    ["/referrals", "ward-referral-board-screen"],
    ["/statistics", "ward-statistics-screen"],
    ["/transport/officer", "ward-officer-screen"],
    ["/waiting", "ward-delays-page"],
    ["/ward/rph-adult-secure", "ward-unit-screen"],
    ["/wards", "ward-index"],
  ] as const;
  const SHIFT_BUDGET = 0.1;
  const TOURS_SEEN = "coordinator,ward,ed,community,officer,bed_manager,executive,admin";

  async function settledShift(page: Page, route: string, screenId: string) {
    await page.addInitScript((toursSeen) => {
      try {
        window.localStorage.setItem("ward_flow_choice_tour_seen", toursSeen);
      } catch {
        // Storage can be blocked; the tour then shows, which the shift total would catch.
      }
      const shifts: { value: number; at: number }[] = [];
      (window as unknown as { __wfShifts: typeof shifts }).__wfShifts = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          startTime: number;
          hadRecentInput: boolean;
        }[]) {
          if (!entry.hadRecentInput) shifts.push({ value: entry.value, at: Math.round(entry.startTime) });
        }
      }).observe({ type: "layout-shift", buffered: true });
    }, TOURS_SEEN);
    await openShell(page, route, screenId);
    // Late data and fonts land after network idle; give them a moment before adding up.
    await page.waitForTimeout(1_000);
    const shifts = await page.evaluate(
      () => (window as unknown as { __wfShifts: { value: number; at: number }[] }).__wfShifts,
    );
    return { total: shifts.reduce((sum, shift) => sum + shift.value, 0), shifts };
  }

  async function phonePage(browser: Browser, baseURL: string | undefined) {
    const context = await browser.newContext({ ...devices["Pixel 7"], baseURL, viewport: { width: 390, height: 844 } });
    return { context, page: await context.newPage() };
  }

  for (const [route, screenId] of SHIFT_ROUTES) {
    test(`layout shift: ${route || "/"} stays still as it loads, desktop and phone`, async ({
      browser,
      browserName,
      page,
    }, testInfo) => {
      test.skip(browserName !== "chromium", "Only Chromium reports layout shifts");
      test.skip(isPhoneLayout(page), "The desktop project measures both sizes");
      const desktop = await settledShift(page, route, screenId);
      expect(desktop.total, `desktop shifts ${JSON.stringify(desktop.shifts)}`).toBeLessThan(SHIFT_BUDGET);
      const phone = await phonePage(browser, testInfo.project.use.baseURL);
      try {
        const measured = await settledShift(phone.page, route, screenId);
        expect(measured.total, `phone shifts ${JSON.stringify(measured.shifts)}`).toBeLessThan(SHIFT_BUDGET);
      } finally {
        await phone.context.close();
      }
    });
  }
});
