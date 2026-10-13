import { expect, test } from "playwright/test";
import { auditAccessibility } from "./helpers/accessibility";

test.describe("@smoke User Journey: Preview Deployment Smoke Test", () => {
  test.describe.configure({ timeout: 60_000 });

  test("validates preview deployment health, root redirect, and absence of console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Visit Root URL: Verify redirect to coordinator command center
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);

    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/.*\/mockups\/ward-flow/);

    // 2. Validate Essential Semantic Landmarks
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 15_000 });

    const rail = page.getByTestId("ward-rail");
    await expect(rail).toBeVisible();

    // 3. Confirm zero unhandled console runtime exceptions
    const criticalErrors = consoleErrors.filter(
      (err) => !err.includes("Download the React DevTools") && !err.includes("favicon"),
    );
    expect(criticalErrors).toEqual([]);

    // 4. Run automated WCAG 2.1 AA audit on preview entrypoint
    await auditAccessibility(page);
  });

  test("validates Capacity Overview page and captures visual baseline", async ({ page }) => {
    // 1. Navigate to Capacity view
    await page.goto("/mockups/ward-flow/capacity", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const capacityScreen = page.locator('[data-testid="ward-capacity-screen"], [data-testid="ward-coordinator"]');
    await expect(capacityScreen.first()).toBeVisible({ timeout: 15_000 });

    // 2. Sparingly take visual regression snapshot of Key Page 3: Capacity Overview
    await expect(page).toHaveScreenshot("key-page-capacity-overview.png", {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
    });

    // 3. Accessibility audit on capacity view
    await auditAccessibility(page);
  });
});
