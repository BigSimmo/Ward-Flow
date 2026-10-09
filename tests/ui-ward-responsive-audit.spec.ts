import { expect, test, type Page } from "playwright/test";

const routes = [
  ["ED overview", "/ed"],
  ["ED workspace", "/ed/rph-ed"],
  ["Movement workspace", "/movements/WF-001"],
  ["On-call directory", "/on-call"],
  ["Referral intake", "/referrals/new"],
  ["Ward statistics", "/statistics/ward/rph-adult-secure"],
  ["Service statistics", "/statistics/service/East%20Metro"],
] as const;

async function assertKeyboardTableScroll(page: Page) {
  const regions = page.getByRole("region", { name: /scrollable table/ });
  for (const region of await regions.all()) {
    if (!(await region.evaluate((element) => element.scrollWidth > element.clientWidth + 1))) continue;
    await expect(region).toHaveAttribute("tabindex", "0");
    await region.focus();
    await expect(region).toBeFocused();
    await region.press("ArrowRight");
    await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const position = await region.boundingBox();
    expect(position).not.toBeNull();
    expect(position!.x + position!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
}

test.describe("@mockup Ward responsive containment", () => {
  test.use({ colorScheme: "light" });
  for (const [label, route] of routes) {
    test(`${label} fits phone and tablet without concealing its local scrolling regions`, async ({
      page,
      browser,
    }, testInfo) => {
      // CI serves a built application. The explicit local proof also permits first-route dev
      // compilation without classifying compilation time as a layout failure.
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/mockups/ward-flow${route}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

      const geometry: { viewport: number; document: number }[] = [];
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
          .toBeLessThanOrEqual(1);
        await assertKeyboardTableScroll(page);
        geometry.push(
          await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })),
        );
      }

      if (route === "/statistics/service/East%20Metro") {
        await expect(page.getByTestId("ward-statistics-service-identity")).toContainText("Royal Perth Hospital");
      }

      // One phone evidence image per affected route, kept with the test result, never committed.
      await page.setViewportSize({ width: 390, height: 844 });
      const screenshot = testInfo.outputPath("phone-layout.png");
      await page.screenshot({ path: screenshot });
      await testInfo.attach("phone-layout", { path: screenshot, contentType: "image/png" });
      await testInfo.attach("viewport-evidence", {
        body: JSON.stringify({ route, geometry, browserVersion: browser.version(), colourScheme: "light" }),
        contentType: "application/json",
      });

      // Check the remaining service fix in dark appearance once, without repeating the
      // superseded phone-design screenshot matrix.
      if (route === "/statistics/service/East%20Metro") {
        await page.emulateMedia({ colorScheme: "dark" });
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
          .toBeLessThanOrEqual(1);
        const darkScreenshot = testInfo.outputPath("phone-layout-dark.png");
        await page.screenshot({ path: darkScreenshot });
        await testInfo.attach("phone-layout-dark", { path: darkScreenshot, contentType: "image/png" });
      }
    });
  }
});
