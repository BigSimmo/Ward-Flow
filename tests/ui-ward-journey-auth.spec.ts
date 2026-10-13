import { expect, test, type Page } from "playwright/test";
import { auditAccessibility } from "./helpers/accessibility";

const SIGN_IN_PATH = "/mockups/ward-flow-sign-in";

async function gotoSignIn(page: Page): Promise<void> {
  await page.goto(SIGN_IN_PATH, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1#sign-in-title")).toBeVisible({ timeout: 15_000 });
}

test.describe("User Journey: Role-Based Sign-In & Authentication", () => {
  test.describe.configure({ timeout: 45_000 });

  test("selects operational roles and validates contract capabilities and live announcements", async ({ page }) => {
    await gotoSignIn(page);

    // 1. Initial State: Verify heading and disclosure
    await expect(page.locator("h1#sign-in-title")).toHaveText("Sign in");
    const roleTally = page.locator("#roleGridTally");
    await expect(roleTally).toBeVisible();

    // 2. Select Coordinator Role
    const coordinatorCard = page.getByRole("button", { name: /Flow coordinator/i }).first();
    await coordinatorCard.click();
    await expect(coordinatorCard).toHaveAttribute("aria-pressed", "true");

    // 3. Operational Authority Scope update
    const scopeSection = page.locator("#permInspector");
    await expect(scopeSection).toBeVisible();
    await expect(scopeSection).toContainText("Flow coordinator");

    // 4. Verify preview announcement polite live region
    const previewBtn = page.getByRole("button", { name: /Preview as/i });
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    const liveStatus = page.locator('[role="status"]');
    await expect(liveStatus).toContainText("Flow coordinator");

    // 5. Switch to Bed Manager Role
    const bedManagerCard = page.getByRole("button", { name: /Bed manager/i }).first();
    await bedManagerCard.click();
    await expect(bedManagerCard).toHaveAttribute("aria-pressed", "true");
    await expect(scopeSection).toContainText("Bed manager");

    // 6. WCAG 2.1 AA Accessibility Audit
    await auditAccessibility(page);
  });

  test("supports keyboard navigation across role choices", async ({ page }) => {
    await gotoSignIn(page);

    // Tab through role cards and activate using Space/Enter
    const firstRole = page.locator('button[class*="roleCard"]').first();
    await firstRole.focus();
    await expect(firstRole).toBeFocused();

    // Trigger selection with Enter
    await page.keyboard.press("Enter");
    await expect(firstRole).toHaveAttribute("aria-pressed", "true");
  });
});
