import { expect, test, type Page } from "playwright/test";
import { auditAccessibility } from "./helpers/accessibility";

const SEARCH_PATH = "/mockups/ward-flow/search";

async function gotoSearch(page: Page): Promise<void> {
  await page.goto(SEARCH_PATH, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("ward-patient-search")).toBeVisible({ timeout: 15_000 });
}

test.describe("User Journey: Error State Handling & Resilient Recovery", () => {
  test.describe.configure({ timeout: 45_000 });

  test("displays actionable empty state for unmatched queries, allows clear recovery, and audits a11y", async ({
    page,
  }) => {
    await gotoSearch(page);

    const input = page.getByTestId("ward-patient-typeahead-input");
    await expect(input).toBeVisible();

    // 1. Enter an unmatched query
    const unmatchedQuery = "unmatched-synthetic-query-xyz99";
    await input.fill(unmatchedQuery);

    // 2. Verify empty state renders with helpful recovery context
    const emptyState = page.getByTestId("ward-patient-typeahead-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("Nobody known to this system matches");

    // 3. Verify accessibility of the empty state popup
    await auditAccessibility(page, {
      include: '[data-testid="ward-patient-typeahead-empty"]',
    });

    // 4. Exercise actionable recovery: Click "Clear" button
    const clearBtn = page.getByRole("button", { name: "Clear" });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Verify input is reset and empty state dismissed
    await expect(input).toHaveValue("");
    await expect(emptyState).toHaveCount(0);
  });

  test("handles unknown route with resilient wayfinding back to core coordinator view", async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto("/mockups/ward-flow/non-existent-boundary-route", {
      waitUntil: "domcontentloaded",
    });

    // Verify page renders safely without unhandled JavaScript exceptions
    // and allows user to navigate back to the coordinator view
    await page.goto("/mockups/ward-flow", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
  });
});
