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

test.describe("@mockup Ward phone scrolling", () => {
  test.use({ colorScheme: "light", hasTouch: true });

  test("phone header keeps its layout height while scrolling with motion enabled", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mockups/ward-flow", { waitUntil: "domcontentloaded" });
    const bar = page.getByTestId("ward-bar");
    await expect(page.getByTestId("ward-bar-phone-menu")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar).not.toHaveAttribute("data-scrolled", "true");
    const restingHeight = await bar.evaluate((element) => element.getBoundingClientRect().height);

    await page.evaluate(() => window.scrollTo(0, 200));
    await expect(bar).toHaveAttribute("data-scrolled", "true");
    // Wait for every frame of the actual transition; a reduced-motion run hid this reflow.
    const heights = await bar.evaluate(async (element) => {
      const samples: number[] = [];
      const end = performance.now() + 350;
      while (performance.now() < end) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        samples.push(element.getBoundingClientRect().height);
      }
      return samples;
    });
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(0.5);
    expect(heights.at(-1)).toBeCloseTo(restingHeight, 0);
    await expect.poll(() => bar.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);

    // Small scroll reversals must not repeatedly swap the scope and live count.
    await page.evaluate(() => window.scrollTo(0, 7));
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await expect(bar).toHaveAttribute("data-scrolled", "true");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(bar).not.toHaveAttribute("data-scrolled", "true");
  });

  test("phone menu fills the available bottom edge and restores scrolling after viewport changes", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mockups/ward-flow", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-bar-phone-menu")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const bar = page.getByTestId("ward-bar");
    await page.evaluate(() => window.scrollTo(0, 200));
    await expect(bar).toHaveAttribute("data-scrolled", "true");
    await expect.poll(() => bar.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
    const before = await page.evaluate(() => scrollY);
    // A real touch at the visible button centre avoids Playwright scrolling the sticky bar's
    // ancestors before clicking, which changes the scroll position this assertion measures.
    const trigger = await page.getByTestId("ward-bar-phone-menu").boundingBox();
    expect(trigger).not.toBeNull();
    await page.touchscreen.tap(trigger!.x + trigger!.width / 2, trigger!.y + trigger!.height / 2);
    const menu = page.getByTestId("ward-phone-menu");
    await expect(menu).toBeVisible();
    for (const height of [664, 844, 520, 844]) {
      await page.setViewportSize({ width: 390, height });
      await expect
        .poll(() => menu.evaluate((element) => Math.abs(element.getBoundingClientRect().bottom - innerHeight)))
        .toBeLessThanOrEqual(1);
      await expect(page.getByTestId("ward-phone-dock")).toBeInViewport();
    }
    await menu.getByRole("button", { name: /close/i }).click();
    await expect(menu).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
    await page.mouse.move(190, 400);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
  });

  test("short phone pages fill taller viewports and navigation returns to the top", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mockups/ward-flow", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-bar-phone-menu")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 200));
    await expect
      .poll(() => page.getByTestId("ward-bar").evaluate((element) => element.getBoundingClientRect().top))
      .toBe(0);
    const trigger = await page.getByTestId("ward-bar-phone-menu").boundingBox();
    expect(trigger).not.toBeNull();
    await page.touchscreen.tap(trigger!.x + trigger!.width / 2, trigger!.y + trigger!.height / 2);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await page.getByTestId("ward-phone-menu-search").fill("On-call");
    await page
      .getByTestId("ward-phone-menu")
      .getByRole("link", { name: /on.call/i })
      .click();
    await expect(page).toHaveURL(/\/on-call$/);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    for (const height of [664, 1100]) {
      await page.setViewportSize({ width: 390, height });
      await expect
        .poll(() =>
          page
            .locator("[data-wf-scroller]")
            .evaluate((element) => element.getBoundingClientRect().bottom - innerHeight),
        )
        .toBeGreaterThanOrEqual(-1);
    }
  });
});

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
