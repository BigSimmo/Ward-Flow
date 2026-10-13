import { expect, test, type Page } from "playwright/test";
import { auditAccessibility } from "./helpers/accessibility";

const COORDINATOR_PATH = "/mockups/ward-flow";
const WARD_UNIT_PATH = "/mockups/ward-flow/ward/rph-adult-secure";

async function gotoCoordinator(page: Page): Promise<void> {
  await page.goto(COORDINATOR_PATH, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[data-testid="ward-coordinator"]:visible')).toHaveCount(1, { timeout: 15_000 });
}

test.describe("User Journey: Core Bed Management & Dossier Inspection", () => {
  test.describe.configure({ timeout: 60_000 });

  test("coordinator reviews statewide flow, queues, and captures visual baseline", async ({ page }) => {
    await gotoCoordinator(page);

    // 1. Validate Core Command Overview landmarks
    const coordinatorView = page.getByTestId("ward-coordinator");
    await expect(coordinatorView).toBeVisible();

    const rail = page.getByTestId("ward-rail");
    await expect(rail).toBeVisible();

    // 2. Sparingly take visual regression snapshot of Key Page 1: Ward Flow Command Overview
    await expect(page).toHaveScreenshot("key-page-ward-overview.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });

    // 3. Accessibility audit across the coordinator command surface
    await auditAccessibility(page, {
      include: '[data-testid="ward-coordinator"]',
    });
  });

  test("navigates into unit beds matrix, opens daily sheet modal, verifies focus and closes", async ({ page }) => {
    await page.goto(WARD_UNIT_PATH, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    // 1. Verify unit beds screen mounted
    const trigger = page.getByTestId("ward-open-daily-sheet-btn");
    await expect(trigger).toBeVisible({ timeout: 15_000 });

    // 2. Open Daily Sheet modal/drawer
    await trigger.click();
    const modal = page.getByTestId("ward-daily-sheet-modal");
    await expect(modal).toBeVisible();

    // 3. Verify modal accessibility
    await auditAccessibility(page, {
      include: '[data-testid="ward-daily-sheet-modal"]',
    });

    // 4. Dismiss modal with Escape key and verify focus restoration
    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
