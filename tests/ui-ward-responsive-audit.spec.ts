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

test.describe("@mockup Ward scroll geometry", () => {
  test.use({ colorScheme: "light", contextOptions: { reducedMotion: "no-preference" } });

  test("the shared header stays pinned with stable height on phone, tablet and desktop", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/mockups/ward-flow/search", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-patient-search")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const bar = page.getByTestId("ward-bar");
    await expect(bar).toHaveAttribute("data-band", /ink|light/);
    for (const width of [390, 820, 1000, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector<HTMLElement>("[data-wf-scroller]")!.scrollTop = 0;
      });
      await expect
        .poll(() => bar.evaluate((element) => element.getBoundingClientRect().height))
        .toBe(width <= 768 ? 56 : 60);
      for (const offset of [9, 12, 300, 600]) {
        await page.evaluate(
          ({ width, offset }) => {
            if (width <= 1000) window.scrollTo(0, offset);
            else document.querySelector<HTMLElement>("[data-wf-scroller]")!.scrollTop = offset;
          },
          { width, offset },
        );
        if (width <= 768) await expect(bar).toHaveAttribute("data-scrolled", "true");
        else await expect(bar).toHaveAttribute("data-band", "light");
        await expect
          .poll(() => bar.evaluate((element) => element.getBoundingClientRect().height))
          .toBe(width <= 768 ? 56 : 60);
      }
      const geometry = await bar.evaluate((element) => {
        const shell = element.closest<HTMLElement>("[data-wf-scroller]")!;
        const rect = element.getBoundingClientRect();
        return { top: rect.top, shellTop: shell.getBoundingClientRect().top, page: window.scrollY };
      });
      expect(geometry.top).toBeCloseTo(width <= 1000 ? 0 : geometry.shellTop, 0);
      if (width > 1000) expect(geometry.page).toBe(0);
    }
  });

  test("keyboard search reveals the last result without moving the page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mockups/ward-flow/search", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-patient-search")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => window.scrollTo(0, 500));
    const input = page.getByTestId("ward-global-search-input");
    await input.click();
    await input.fill("a");
    const popup = page.getByTestId("ward-global-search-popup");
    await expect(popup).toBeVisible();
    const before = await page.evaluate(() => window.scrollY);
    await input.press("End");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const field = document.querySelector<HTMLInputElement>('[data-testid="ward-global-search-input"]')!;
          const active = document.getElementById(field.getAttribute("aria-activedescendant") ?? "");
          const pane = document.querySelector<HTMLElement>('[class*="listPane"]');
          if (!active || !pane) return false;
          const row = active.getBoundingClientRect();
          const box = pane.getBoundingClientRect();
          return row.top >= box.top - 1 && row.bottom <= box.bottom + 1 && pane.scrollTop > 0;
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test("a desktop sheet holds the work column and restores its scroll position", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/mockups/ward-flow/search", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-patient-search")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const column = page.locator("[data-wf-scroller]");
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", /ink|light/);
    await column.evaluate((element) => {
      element.scrollTop = 420;
    });
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", "light");
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(420);
    // Click at the painted sticky control. Playwright's auto-scroll for Locator.click()
    // moves the header back to its original in-flow position before clicking it.
    const trigger = await page.getByTestId("ward-bar-tasks-trigger").boundingBox();
    expect(trigger).not.toBeNull();
    await page.mouse.click(trigger!.x + trigger!.width / 2, trigger!.y + trigger!.height / 2);
    await expect(page.getByTestId("ward-bar-tasks-sheet")).toBeVisible();
    await expect(column).toHaveCSS("overflow-y", "hidden");
    expect(await column.evaluate((element) => element.scrollTop)).toBe(420);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ward-bar-tasks-sheet")).toBeHidden();
    await expect(column).toHaveCSS("overflow-y", "auto");
    expect(await column.evaluate((element) => element.scrollTop)).toBe(420);
  });

  test("desktop Back returns to the previous position in the patient list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/mockups/ward-flow/search", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-patient-search")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const column = page.locator("[data-wf-scroller]");
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", /ink|light/);
    await column.evaluate((element) => {
      element.scrollTop = 420;
    });
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", "light");
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(420);
    await page.locator('nav a[href="/mockups/ward-flow/wards"]').first().click();
    await expect(page).toHaveURL(/\/wards$/);
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(0);
    await page.goBack();
    await expect(page.getByTestId("ward-patient-search")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(420);
  });
});
