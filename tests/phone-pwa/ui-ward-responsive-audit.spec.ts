import { expect, test } from "playwright/test";

test("@mockup global alert title remains readable on small and large phones", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ward-flow/alerts", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Broadcast", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I confirm this directive is clinically authorised for immediate statewide network broadcast.",
    })
    .check();
  await page.getByRole("button", { name: "Dispatch", exact: true }).click();
  const strip = page.getByTestId("ward-broadcast-banner");
  await expect(strip).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Broadcast network alert" })).not.toBeVisible();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const title = strip.locator("strong");
    await expect(title).toContainText("check discharges");
    await page.screenshot({ path: testInfo.outputPath(`alert-${width}.png`) });
    const geometry = await title.evaluate((element) => ({
      rendered: element.clientWidth,
      required: element.scrollWidth,
      clipped: getComputedStyle(element).overflow === "hidden",
    }));
    expect(geometry.clipped, `alert title must remain fully readable at ${width}px`).toBe(false);
    expect(geometry.required).toBeLessThanOrEqual(geometry.rendered + 1);
    await expect(strip).toContainText("Critical directive");
    await expect(strip).toContainText("0 of 32 acknowledged");
    const link = strip.getByRole("link");
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await strip.boundingBox())!.height).toBeLessThan(120);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
