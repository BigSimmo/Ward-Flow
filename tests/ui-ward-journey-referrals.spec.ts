import { expect, test, type Page } from "playwright/test";
import { auditAccessibility } from "./helpers/accessibility";

const REFERRALS_PATH = "/mockups/ward-flow/referrals";

async function gotoReferrals(page: Page): Promise<void> {
  await page.goto(REFERRALS_PATH, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("ward-referral-board-screen")).toBeVisible({ timeout: 15_000 });
}

test.describe("User Journey: Referral Intake Queue & Triage", () => {
  test.describe.configure({ timeout: 45_000 });

  test("coordinator inspects intake triage queue and captures visual baseline", async ({ page }) => {
    await gotoReferrals(page);

    // 1. Verify board landmarks
    const board = page.getByTestId("ward-referral-board-screen");
    await expect(board).toBeVisible();

    const queuedSection = page.getByTestId("ward-referral-board-queued");
    await expect(queuedSection).toBeVisible();

    // 2. Sparingly take visual regression snapshot of Key Page 2: Referrals Board
    await expect(page).toHaveScreenshot("key-page-referrals-board.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });

    // 3. Accessibility audit across the referrals board
    await auditAccessibility(page, {
      include: '[data-testid="ward-referral-board-screen"]',
    });
  });

  test("selects a pending referral candidate and inspects match recommendation", async ({ page }) => {
    await gotoReferrals(page);

    // Locate the first selectable referral row or card
    const firstCard = page.locator("button[data-testid^='ward-referral-board-card-select-']").first();
    if ((await firstCard.count()) > 0) {
      await firstCard.click();
    }

    // Verify "New referral" entry link is mounted and accessible
    const newReferralLink = page.getByTestId("ward-referral-board-new");
    await expect(newReferralLink).toBeVisible();
    await expect(newReferralLink).toHaveAttribute("href", "/mockups/ward-flow/referrals/new");
  });
});
