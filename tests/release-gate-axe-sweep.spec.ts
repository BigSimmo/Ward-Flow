import { expect, test } from "playwright/test";

import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { expectAccessible } from "./helpers/ward-release-gate";

/**
 * Every Ward Flow route passes an axe WCAG 2.1 AA scan with no serious or critical violation
 * (fix list 5.4 and 8.1, October 2026). The release-gate projects run it on desktop Chrome at
 * 1440px and on phone WebKit at 390x844, the same as the four journeys beside it.
 *
 * The journeys scan screens mid-task. This sweep opens each route fresh, so a screen no journey
 * reaches is still checked. Redirect-only routes (command, constellation, escalation, exceptions,
 * queue) are left out because they land on a route already listed. One seeded person and one
 * seeded movement stand in for the record pages, opened by their coded addresses.
 * Synthetic data only.
 */

const ROUTES = [
  "",
  "/alerts",
  "/bed-meeting",
  "/board/rph-adult-secure",
  "/capacity",
  "/community",
  "/community/midland",
  "/delays",
  "/discharges",
  "/ed",
  "/ed/peel-ed",
  "/governance",
  "/handover",
  "/hub",
  "/legal-forms",
  "/movements",
  `/movements/${encodeRecordAddress("WF-001")}`,
  "/network",
  "/on-call",
  "/out-of-area",
  "/people/new",
  `/people/${encodeRecordAddress("PT-001")}`,
  "/referrals",
  "/referrals/new",
  "/reports/chronology",
  "/reports/downtime",
  "/search",
  "/settings",
  "/statistics",
  "/statistics/community/bentley",
  "/statistics/compare",
  "/statistics/ed/rph-ed",
  "/statistics/eds",
  "/statistics/overview",
  "/statistics/service/North%20Metro",
  "/statistics/services",
  "/statistics/teams",
  "/statistics/ward/rph-adult-secure",
  "/statistics/wards",
  "/statistics/weekly",
  "/transport",
  "/transport/officer",
  "/ward/rph-adult-secure",
  "/ward/rph-adult-secure/answer",
  "/wards",
] as const;

test.describe.configure({ timeout: 60_000 });

for (const route of ROUTES) {
  test(`axe: ${route || "/"} has no serious or critical violation`, async ({ page }, testInfo) => {
    await page.goto(`/ward-flow${route}`, { waitUntil: "load" });
    // The header marks itself ready once the page's code runs; scan the live page, not the
    // server-drawn copy that is still waiting for it.
    await expect(page.locator("html[data-wf-bar-ready]")).toHaveCount(1, { timeout: 30_000 });
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    // A desktop-only page (the bed meeting TV) shows its "needs a larger screen" card on a phone
    // and hides the page itself, so the phone scans that card.
    await expect(page.locator("main:visible, [data-phone-desktop-only]:visible").first()).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForLoadState("networkidle");
    await expectAccessible(page, testInfo, route || "/");
  });
}
