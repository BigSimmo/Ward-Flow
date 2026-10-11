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
      // The server renders the wide layout and the phone layout replaces it on hydration (v10), so
      // measure after the page has settled rather than a table that is about to be swapped out.
      await page.waitForLoadState("networkidle");

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

test("@mockup approved overdue queue treatment fits phone, tablet and desktop", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/mockups/ward-flow", { waitUntil: "domcontentloaded" });
  const overdueRows = page.locator('[data-testid^="ward-queue-row-"][data-overdue="true"]:visible');
  await expect(overdueRows.first()).toBeVisible();

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
        .toBeLessThanOrEqual(1);
      const row = overdueRows.first();
      await row.scrollIntoViewIfNeeded();
      const treatment = await row.evaluate((element) => {
        const style = getComputedStyle(element);
        const marker = getComputedStyle(element, "::before");
        const wait = element.querySelector('[role="timer"]')!.parentElement!.parentElement!;
        const bounds = element.getBoundingClientRect();
        const waitBounds = wait.getBoundingClientRect();
        return {
          markerWidth: marker.width,
          markerRadius: marker.borderRadius,
          markerHeight: parseFloat(marker.height),
          height: bounds.height,
          shadow: style.boxShadow,
          outline: style.outlineStyle,
          waitFits: waitBounds.right <= bounds.right && waitBounds.left >= bounds.left,
          label: wait.textContent,
          glyphs: wait.querySelectorAll("svg").length,
        };
      });
      expect(treatment.markerWidth).toBe("3px");
      expect(treatment.markerRadius).toBe("999px");
      expect(treatment.markerHeight).toBeGreaterThan(0);
      expect(treatment.markerHeight).toBeLessThan(treatment.height);
      expect(treatment.shadow).not.toMatch(/0px 0px 0px 1px/);
      expect(treatment.waitFits).toBe(true);
      expect(treatment.label).toContain("overdue");
      expect(treatment.glyphs).toBe(1);
      if (colorScheme === "dark") {
        await testInfo.attach(`overdue-${width}-${colorScheme}`, {
          body: await page.screenshot(),
          contentType: "image/png",
        });
      }
    }
  }

  const row = overdueRows.first();
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await row.focus();
  await expect(row).toBeFocused();
  await expect
    .poll(() => row.evaluate((element) => parseFloat(getComputedStyle(element).outlineWidth)))
    .toBeGreaterThanOrEqual(2);
  await page.emulateMedia({ forcedColors: "active" });
  await expect
    .poll(() => row.evaluate((element) => getComputedStyle(element, "::before").forcedColorAdjust))
    .toBe("none");
});

test("@mockup movement status stays inside phone, tablet and desktop viewports", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/mockups/ward-flow/movements/WF-001", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-patient-live-status")).toContainText("Stage");
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
  }
});
