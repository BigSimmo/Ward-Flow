import { expect, test } from "playwright/test";

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
  ["/delays", "ward-delays-page"],
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
  ["/statistics/overview", "ward-statistics-overview-screen"],
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
