import { expect, test, type Page } from "playwright/test";

import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { movementPath } from "./helpers/ward-record-url";
import { showEveryoneWaitingOn } from "./helpers/ward-home-page";

const routes = [
  ["ED overview", "/ed"],
  ["ED workspace", "/ed/rph-ed"],
  ["Movement workspace", `/movements/${encodeRecordAddress("WF-001")}`],
  ["On-call directory", "/on-call"],
  ["Referral intake", "/referrals/new"],
  ["Ward statistics", "/statistics/ward/rph-adult-secure"],
  ["Service statistics", "/statistics/service/East%20Metro"],
] as const;

// Phone (48rem and under) scrolls the work column, not the window, so iOS Safari's toolbar never
// collapses under the fixed dock (12 Oct 2026). These read and move that column.
async function scrollColumn(page: Page, top: number) {
  await page.evaluate((y) => {
    document.querySelector<HTMLElement>("[data-wf-scroller]")!.scrollTop = y;
  }, top);
}

function columnScrollTop(page: Page) {
  return page.evaluate(() => document.querySelector<HTMLElement>("[data-wf-scroller]")!.scrollTop);
}

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

  test("manual Reduce motion includes the portaled phone menu and preserves normal and OS motion choices", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("ward-flow-reduced-motion", "true"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "");
    const trigger = page.getByTestId("ward-bar-phone-menu");
    await trigger.click();
    const menu = page.getByTestId("ward-phone-menu");
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((element) => !!element.closest("[data-overlay-layer]"))).toBe(true);
    await expect.poll(() => menu.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    expect(await menu.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0s");
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(trigger).toBeFocused();

    await page.evaluate(() => localStorage.setItem("ward-flow-reduced-motion", "false"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).not.toHaveAttribute("data-reduced-motion");
    await trigger.click();
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => menu.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
  });

  test("phone header keeps its layout height while scrolling with motion enabled", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
    const bar = page.getByTestId("ward-bar");
    await expect(page.getByTestId("ward-bar-phone-menu")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await scrollColumn(page, 0);
    await expect(bar).not.toHaveAttribute("data-scrolled", "true");
    const restingHeight = await bar.evaluate((element) => element.getBoundingClientRect().height);

    await scrollColumn(page, 200);
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
    await scrollColumn(page, 7);
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await expect(bar).toHaveAttribute("data-scrolled", "true");
    await scrollColumn(page, 0);
    await expect(bar).not.toHaveAttribute("data-scrolled", "true");
    // The window itself never scrolls on phone.
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test("phone menu fills the available bottom edge and restores scrolling after viewport changes", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-bar-phone-menu")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const bar = page.getByTestId("ward-bar");
    await scrollColumn(page, 200);
    await expect(bar).toHaveAttribute("data-scrolled", "true");
    await expect.poll(() => bar.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
    const before = await columnScrollTop(page);
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
    await expect.poll(() => columnScrollTop(page)).toBeCloseTo(before, 0);
    await page.mouse.move(190, 400);
    await page.mouse.wheel(0, 100);
    await expect.poll(() => columnScrollTop(page)).toBeGreaterThan(before);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test("short phone pages fill taller viewports and navigation returns to the top", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-bar-phone-menu")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await scrollColumn(page, 200);
    await expect
      .poll(() => page.getByTestId("ward-bar").evaluate((element) => element.getBoundingClientRect().top))
      .toBe(0);
    const trigger = await page.getByTestId("ward-bar-phone-menu").boundingBox();
    expect(trigger).not.toBeNull();
    await page.touchscreen.tap(trigger!.x + trigger!.width / 2, trigger!.y + trigger!.height / 2);
    await expect.poll(() => columnScrollTop(page)).toBeGreaterThan(0);
    await page.getByTestId("ward-phone-menu-search").fill("On-call");
    await page
      .getByTestId("ward-phone-menu")
      .getByRole("link", { name: /on.call/i })
      .click();
    await expect(page).toHaveURL(/\/on-call$/);
    await expect.poll(() => columnScrollTop(page)).toBe(0);
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
      await page.goto(`/ward-flow${route}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      // The server renders the wide layout and the phone layout replaces it on hydration (v10), so
      // measure after the page has settled rather than a table that is about to be swapped out.
      await page.waitForLoadState("networkidle");

      const geometry: { viewport: number; document: number }[] = [];
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        // These widths use ServicePhone. Network idle can precede its hydration swap;
        // wait for the actual tree before enumerating its scrollable table regions.
        if (route === "/statistics/service/East%20Metro") {
          await expect(page.getByTestId("ward-statistics-service-phone")).toBeVisible();
        }
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
  await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
  await showEveryoneWaitingOn(page);
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
      // Keep the pointer off the row so the hover fill cannot stand in for the overdue tint.
      await page.mouse.move(0, 0);
      // No side edges (Josh, 31 Oct 2026; `home.module.css`): the overdue row is the act-now tint
      // with the danger glyph and the spoken word "overdue" beside the wait. The old inset coral
      // marker (`::before`, 3px) is gone, and nothing draws a coloured edge on one side.
      const treatment = await row.evaluate((element) => {
        const style = getComputedStyle(element);
        const marker = getComputedStyle(element, "::before");
        const wait = element.querySelector('[role="timer"]')!.parentElement!.parentElement!;
        const bounds = element.getBoundingClientRect();
        const waitBounds = wait.getBoundingClientRect();
        // The act-now tint as this row's own custom properties resolve it, in this colour scheme.
        const probe = document.createElement("span");
        probe.style.position = "absolute";
        probe.style.backgroundColor = "var(--wf-act-tint)";
        element.appendChild(probe);
        const actTint = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          markerContent: marker.content,
          background: style.backgroundColor,
          actTint,
          borderStart: style.borderLeftWidth,
          borderEnd: style.borderRightWidth,
          shadow: style.boxShadow,
          outline: style.outlineStyle,
          waitFits: waitBounds.right <= bounds.right && waitBounds.left >= bounds.left,
          label: wait.textContent,
          glyphs: wait.querySelectorAll("svg").length,
        };
      });
      expect(treatment.markerContent).toBe("none");
      expect(treatment.actTint).not.toBe("rgba(0, 0, 0, 0)");
      expect(treatment.background).toBe(treatment.actTint);
      expect(treatment.borderStart).toBe(treatment.borderEnd);
      expect(treatment.shadow).toBe("none");
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
  // Forced colours drop the tint, so the cue that must survive is the glyph and its spoken word,
  // never a stripe; selection keeps its Highlight outline.
  await page.emulateMedia({ forcedColors: "active" });
  await expect.poll(() => row.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  const forcedCue = await row.evaluate((element) => {
    const wait = element.querySelector('[role="timer"]')!.parentElement!.parentElement!;
    const glyph = wait.querySelector("svg");
    const glyphBounds = glyph?.getBoundingClientRect();
    return {
      label: wait.textContent,
      glyphVisible: glyphBounds !== undefined && glyphBounds.width > 0 && glyphBounds.height > 0,
      markerContent: getComputedStyle(element, "::before").content,
    };
  });
  expect(forcedCue.label).toContain("overdue");
  expect(forcedCue.glyphVisible).toBe(true);
  expect(forcedCue.markerContent).toBe("none");
});

test("@mockup movement status stays inside phone, tablet and desktop viewports", async ({ page }) => {
  test.setTimeout(120_000);
  // D-39: an old raw-id link still works. It is sent on to the coded address, which shows no number.
  await page.goto("/ward-flow/movements/WF-001", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(new RegExp(`${movementPath("WF-001")}$`, "u"));
  await expect(page).not.toHaveURL(/WF-001/u);
  // While the page streams in, React can hold a second, hidden copy in a <div hidden> until it
  // swaps it in, so check only the copy on screen.
  await expect(page.getByTestId("ward-patient-live-status").filter({ visible: true })).toContainText("Stage");
  for (const width of [320, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(1);
  }
});

test.describe("@mockup Ward scroll geometry", () => {
  test.use({ colorScheme: "light", contextOptions: { reducedMotion: "no-preference" } });

  // Movements redesign (1 Nov 2026): on a wide screen the worklist and Transport now stack at full
  // width and the page scrolls as one, so the transport feed no longer scrolls inside its card.
  test("the Movements transport panel ends on screen at the end of the page, with no inner scroll", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/ward-flow/movements", { waitUntil: "networkidle" });
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", /ink|light/);
    const panel = page.getByRole("region", { name: "Transport right now" });
    for (const width of [1361, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          page.evaluate(() => {
            const column = document.querySelector<HTMLElement>("[data-wf-scroller]")!;
            column.scrollTop = column.scrollHeight;
            return column.scrollTop;
          }),
        )
        .toBeGreaterThan(0);
      await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", "light");
      const box = await panel.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
      const body = panel.getByRole("region", { name: "Active transport legs" });
      await expect
        .poll(() => body.evaluate((element) => element.scrollHeight - element.clientHeight))
        .toBeLessThanOrEqual(1);
    }
  });

  test("statistics deep links reserve the header once, with a small section gap", async ({ page }) => {
    test.setTimeout(120_000);
    for (const width of [820, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/ward-flow/statistics#journey-stages", { waitUntil: "networkidle" });
      await expect(page.getByTestId("ward-statistics-journey-view")).toBeVisible();
      await expect
        .poll(() =>
          page.locator("#journey-stages").evaluate((element) => {
            const header = document.querySelector('[data-testid="ward-bar"]')!.getBoundingClientRect();
            return Math.round(element.getBoundingClientRect().top - header.bottom);
          }),
        )
        .toBe(16);
    }
  });

  test("Handover presentation selection leaves the background scroll positions unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 844 });
    await page.goto("/ward-flow/handover", { waitUntil: "networkidle" });
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", /ink|light/);
    // 1 Nov 2026 redesign: Present sits in the toolbar's More handover actions. The item reads
    // "Exit present" once presentation mode is on, which is the page's own record of the mode.
    const more = page.getByRole("button", { name: "More handover actions" });
    await more.click();
    await page.getByRole("button", { name: "Present on a screen", exact: true }).click();
    const exit = page.getByRole("button", { name: "Exit present", exact: true });
    if (!(await exit.isVisible())) await more.click();
    await expect(exit).toBeVisible();
    // Close the menu with its trigger: Escape would also leave presentation mode.
    await more.click();
    await expect(exit).toHaveCount(0);
    const position = () =>
      page.evaluate(() => ({
        page: document.querySelector<HTMLElement>("[data-wf-scroller]")!.scrollTop,
        table: document.querySelector<HTMLElement>('[aria-label="Handover patients"]')!.scrollTop,
      }));
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("[data-wf-scroller]")!.scrollTop = 320;
      document.querySelector<HTMLElement>('[aria-label="Handover patients"]')!.scrollTop = 400;
    });
    const before = await position();
    await page.keyboard.press("j");
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("ward-handover-flow-panel")).toBeVisible();
    expect(await position()).toEqual(before);
  });

  test("the shared header stays pinned with stable height on phone, tablet and desktop", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/ward-flow/search", { waitUntil: "domcontentloaded" });
    // The route's loading boundary streams the page into a hidden `S:` copy first; wait for the swap.
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
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
            // Phone and desktop scroll the work column; tablet (48rem to 1000px) the window.
            if (width > 768 && width <= 1000) window.scrollTo(0, offset);
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
      if (width <= 768 || width > 1000) expect(geometry.page).toBe(0);
    }
  });

  test("keyboard search reveals the last result without moving the page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // The Patients page keeps only its own search box, so the header search is tested on All wards.
    await page.goto("/ward-flow/wards", { waitUntil: "domcontentloaded" });
    // The route's loading boundary streams the page into a hidden `S:` copy first; wait for the swap.
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-index")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await scrollColumn(page, 500);
    const input = page.getByTestId("ward-global-search-input");
    await input.click();
    await input.fill("a");
    const popup = page.getByTestId("ward-global-search-popup");
    await expect(popup).toBeVisible();
    const before = await columnScrollTop(page);
    // Nothing is chosen until the arrow keys move (Smart Search, 28 Oct 2026), so End needs a
    // first ArrowDown to enter the list.
    await input.press("ArrowDown");
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
    expect(await columnScrollTop(page)).toBe(before);
  });

  test("a sheet follows responsive scroll owners and restores the desktop position", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ward-flow/search", { waitUntil: "domcontentloaded" });
    // The route's loading boundary streams the page into a hidden `S:` copy first; wait for the swap.
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
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
    // Phone scrolls the column like desktop, so it stays locked; tablet scrolls the window.
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(column).toHaveCSS("overflow-y", "hidden");
    await page.setViewportSize({ width: 820, height: 900 });
    await expect(column).toHaveCSS("overflow-y", "visible");
    await expect.poll(() => column.evaluate((element) => element.style.overflowY)).toBe("");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(column).toHaveCSS("overflow-y", "hidden");
    expect(await column.evaluate((element) => element.scrollTop)).toBe(420);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ward-bar-tasks-sheet")).toBeHidden();
    await expect(column).toHaveCSS("overflow-y", "auto");
    expect(await column.evaluate((element) => element.scrollTop)).toBe(420);
  });

  test("desktop Back returns to the previous position in the patient list", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/ward-flow/search", { waitUntil: "domcontentloaded" });
    // The route's loading boundary streams the page into a hidden `S:` copy first; wait for the swap.
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-patient-search")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const column = page.locator("[data-wf-scroller]");
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", /ink|light/);
    await column.evaluate((element) => {
      element.scrollTop = 420;
    });
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", "light");
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(420);
    // B1 (19 Oct 2026): Capacity is on the coordinator's own rail menu; Wards is now under More.
    await page.locator('nav a[href="/ward-flow/capacity"]').first().click();
    await expect(page).toHaveURL(/\/capacity$/);
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(0);
    await page.goBack();
    // The route's loading boundary streams the page into a hidden `S:` copy first; wait for the swap.
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-patient-search")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect.poll(() => column.evaluate((element) => element.scrollTop)).toBe(420);
  });
});

// These pages formerly positioned their phone controls against different resting and scrolled
// header heights. Cover direct canvas bands and the controls with an 8px painted canvas collar.
test.describe("@mockup phone navigation follows the stable header", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  const strips = [
    ["Patients", "/search", "census_phoneSeg__", 0],
    ["Capacity", "/capacity", "capacity-page_phoneTabs__", 0],
    ["Home", "", "home_queueTools__", 0],
    ["Community", "/community", "community_phonePanes__", 0],
    ["ED", "/ed/rph-ed", "ed_phonePanes__", 0],
    ["Ward statistics", "/statistics/ward/rph-adult-secure", "statistics-phone-body_stickySeg__", 0],
    ["Out-of-area", "/out-of-area", "out-of-area-board_phoneTabs__", 0],
  ] as const;
  for (const [label, route, classPrefix, collar] of strips) {
    test(`${label} keeps its navigation aligned while crossing the scroll threshold`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      await page.goto(`/ward-flow${route}`, { waitUntil: "networkidle" });
      const bar = page.getByTestId("ward-bar");
      await expect(bar).toHaveAttribute("data-band", /ink|light/);
      // Home v7 (Josh, 22 Oct 2026): Home opens on My list; its queue tools sit behind Everyone waiting.
      if (label === "Home") await showEveryoneWaitingOn(page);
      const strip = page.locator(`[class*="${classPrefix}"]`);
      await expect(strip).toBeVisible();
      for (const offset of [0, 12, 80, 500]) {
        await scrollColumn(page, offset);
        await expect(bar).toHaveCSS("height", "56px");
        // C1 (19 Oct 2026): once a hero scrolls away its one-line summary pins under the header,
        // and the page's own pinned row moves down by the line's height so it is never covered.
        await expect
          .poll(() =>
            strip.evaluate((element, base) => {
              const line = document.querySelector<HTMLElement>('[data-testid="wf-hero-condensed"][data-shown="true"]');
              const expected = `${base + (line?.offsetHeight ?? 0)}px`;
              const top = getComputedStyle(element).top;
              return top === expected ? "aligned" : `${top}, expected ${expected}`;
            }, 56 + collar),
          )
          .toBe("aligned");
      }
      if (collar) await expect(strip).not.toHaveCSS("box-shadow", "none");
      if (route === "/search") {
        await expect(page.getByRole("tablist", { name: "Patients now or history" })).toBeVisible();
        const bounds = await strip.boundingBox();
        const header = await bar.boundingBox();
        expect(bounds!.y).toBe(header!.y + header!.height);
        const screenshot = testInfo.outputPath("patients-sticky-tabs.png");
        await page.screenshot({ path: screenshot });
        await testInfo.attach("patients-sticky-tabs", { path: screenshot, contentType: "image/png" });
      }
    });
  }
});

test.describe("@mockup Movements timeline fits its rows on a ward desktop monitor (P194)", () => {
  // P194, approved by Josh in chat, 27 Oct 2026, 9:21 PM AWST: "P194: tune for a ward desktop
  // monitor, about 1920 by 1080, shrink the panel to fit its content". The panel used to hold a
  // fixed clamp(24.5rem, 57dvh, 36rem) height, so a short day left empty space under the last row.
  test("a service with few rows gets a panel that ends at its last row at 1920x1080", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/ward-flow/movements", { waitUntil: "networkidle" });
    const filter = page.getByRole("combobox", { name: "Filter movement horizon by health service" });
    const options = await filter.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: (node as HTMLOptionElement).value,
        count: Number(/\((\d+)\)\s*$/.exec(node.textContent ?? "")?.[1] ?? "0"),
      })),
    );
    const fewest = options
      .filter((option) => option.value !== "ALL" && option.count > 0)
      .sort((a, b) => a.count - b.count)[0];
    expect(fewest, "a health service with at least one movement lane").toBeDefined();
    await filter.selectOption(fewest!.value);
    const timeline = page.getByRole("region", { name: "Movements timeline" });
    await expect(timeline).toBeVisible();
    const geometry = await timeline.evaluate((wrap) => {
      const split = wrap.closest<HTMLElement>('[id$="-horizonSplit"]')!;
      // The timeline's rows and the scope footer under them are the panel's content.
      const content = wrap.parentElement!;
      const cells = [...content.querySelectorAll<HTMLElement>("*")].filter(
        (cell) =>
          cell.childElementCount === 0 && cell.offsetHeight > 0 && getComputedStyle(cell).position !== "absolute",
      );
      const rowsBottom = Math.max(...cells.map((cell) => cell.getBoundingClientRect().bottom));
      const splitBox = split.getBoundingClientRect();
      const oldFixedHeight = Math.min(Math.max(24.5 * 16, 0.57 * window.innerHeight), 36 * 16);
      return { height: splitBox.height, oldFixedHeight, empty: splitBox.bottom - rowsBottom };
    });
    expect(geometry.height).toBeLessThan(geometry.oldFixedHeight - 16);
    expect(geometry.empty).toBeLessThanOrEqual(24);
  });
});
