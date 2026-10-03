import { expect, test } from "playwright/test";

test("@mockup on-call printing includes all coverage details and preserves screen expansion", async ({ page }) => {
  await page.goto("/mockups/ward-flow/on-call");
  const rows = page.locator('tr[id^="ward-coverage-"]');
  const toggles = page.getByRole("button", { name: "Coverage & handover" });
  const count = await rows.count();
  expect(count).toBeGreaterThan(1);
  for (let i = 0; i < count; i++) await expect(rows.nth(i)).toBeHidden();

  await toggles.first().click();
  await expect(rows.first()).toBeVisible();
  await expect(rows.nth(1)).toBeHidden();

  await page.emulateMedia({ media: "print" });
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    await expect(row).toBeVisible();
    await expect(row.getByText("Current cover", { exact: true })).toBeVisible();
    await expect(row.getByText("Not verified", { exact: true })).toBeVisible();
    await expect(row.getByText("Next confirmed contact", { exact: true })).toBeVisible();
    await expect(toggles.nth(i)).toBeHidden();
  }
  await page.emulateMedia({ media: "screen" });
  await expect(rows.first()).toBeVisible();
  for (let i = 1; i < count; i++) await expect(rows.nth(i)).toBeHidden();
  await expect(toggles.first()).toHaveAttribute("aria-expanded", "true");
});
