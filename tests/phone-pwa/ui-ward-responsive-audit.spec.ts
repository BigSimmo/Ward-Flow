import { expect, test } from "playwright/test";

test("@mockup global alert title remains readable on small and large phones", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ward-flow/alerts", { waitUntil: "networkidle" });
  // Alerts redesign (Q153, 1 Nov 2026): on a phone, Broadcast alert sits under "…", and the new
  // composer sends a directive from Tell areas something.
  await page.getByRole("button", { name: "More alert actions" }).click();
  await page.getByRole("menuitem", { name: /^Broadcast alert/u }).click();
  const composer = page.getByRole("dialog", { name: "New broadcast" });
  await composer.getByRole("radio", { name: /Tell areas something/u }).click();
  await composer.getByRole("button", { name: "HDU full", exact: true }).click();
  await composer.getByRole("checkbox", { name: /^I'm authorised to send this to/u }).check();
  await composer.getByTestId("ward-alerts-broadcast-confirm").click();
  const strip = page.getByTestId("ward-broadcast-banner");
  await expect(strip).toBeVisible();
  await expect(composer).not.toBeVisible();
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
