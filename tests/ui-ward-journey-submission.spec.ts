import { expect, test, type Page } from "playwright/test";
import { auditAccessibility } from "./helpers/accessibility";
import { wardSites } from "@/components/ward-management/ward-sites";

const INTAKE_PATH = "/mockups/ward-flow/referrals/new";

async function gotoIntake(page: Page): Promise<void> {
  await page.goto(INTAKE_PATH, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toContainText("Raise a referral", { timeout: 15_000 });
}

async function answerToggle(page: Page, testId: string) {
  const radio = page.getByTestId(testId);
  await page.locator("label", { has: radio }).click();
  await expect(radio).toBeChecked();
}

test.describe("User Journey: Referral Data Submission & Form Flow", () => {
  test.describe.configure({ timeout: 60_000 });

  test("validates required intake fields before allowing submission and audits form a11y", async ({ page }) => {
    await gotoIntake(page);

    // 1. Initial State: Submit button must be disabled before completing required fields
    const submitBtn = page.getByTestId("ward-referral-intake-submit");
    await expect(submitBtn).toHaveAttribute("aria-disabled", "true");

    const unavailableBanner = page.getByTestId("ward-referral-intake-unavailable");
    await expect(unavailableBanner).toBeVisible();

    // 2. Perform WCAG 2.1 AA accessibility audit on the active intake form
    await auditAccessibility(page, {
      include: "#ward-referral-intake-form",
    });
  });

  test("fills clinical referral intake form, submits, and verifies receipt confirmation", async ({ page }) => {
    await gotoIntake(page);

    // 1. Fill Required Questions
    await page.getByTestId("ward-referral-intake-ageBand").selectOption("Adult");
    await page.getByTestId("ward-referral-intake-sex").selectOption("Male");
    await page.getByTestId("ward-referral-intake-gender").selectOption("Male");
    await page.getByTestId("ward-referral-intake-homeRegion").selectOption("Perth Metropolitan");
    await page.getByTestId("ward-referral-intake-source").selectOption("police");
    await page.getByTestId("ward-referral-intake-urgency").selectOption("1");
    await page.getByTestId("ward-referral-intake-originSiteCode").selectOption(wardSites[0].code);

    // Answer Need and Acuity Toggles
    await answerToggle(page, "ward-referral-intake-secureBedNeeded-no");
    await answerToggle(page, "ward-referral-intake-involuntaryBedNeeded-no");
    await answerToggle(page, "ward-referral-intake-highAcuityNursingNeeded-no");
    await answerToggle(page, "ward-referral-intake-transportNeeded-no");

    // Destination and Suburb
    await page.getByTestId("ward-referral-intake-destination-psychiatric_ward").check();
    await page.getByTestId("ward-referral-intake-suburb").selectOption("Albany");

    // Clinical Narrative History
    await page
      .getByTestId("ward-referral-intake-history")
      .fill("Synthetic referral for acute psychiatric assessment and statewide flow placement.");

    // 2. Assert Submit Button is enabled
    const submitBtn = page.getByTestId("ward-referral-intake-submit");
    await expect(submitBtn).not.toHaveAttribute("aria-disabled", "true");

    // 3. Submit and Verify Confirmation Feedback
    await submitBtn.click();
    await expect(page.getByTestId("ward-referral-intake-confirmation")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("ward-referral-intake-rejection")).toHaveCount(0);
  });
});
