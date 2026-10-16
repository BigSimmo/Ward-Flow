import { expect, test, type Page } from "playwright/test";

const HOME = "/mockups/ward-flow";

async function settled(page: Page) {
  await expect(page.locator("html[data-wf-bar-ready]")).toHaveCount(1);
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
  await page.waitForLoadState("networkidle");
}

async function navigate(page: Page, route: string) {
  await page.locator(`a[href="${HOME}${route}"]:visible`).first().click();
  await expect(page).toHaveURL(new RegExp(`${HOME}${route}$`));
  await settled(page);
}

test.use({ viewport: { width: 1440, height: 900 }, serviceWorkers: "block", screenshot: "off", trace: "off" });

test.describe("native history and handover print @mockup", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const origin = new URL(baseURL!).origin;
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
  });

  test.afterEach(async ({ page }) => {
    await page.close(); // Keep automatic failure context free of synthetic patient rows.
  });

  for (const direction of ["back", "forward"] as const) {
    test(`native ${direction} retains a cancelled booking draft and leaves only after acceptance`, async ({ page }) => {
      await page.goto(HOME);
      await settled(page);
      await navigate(page, "/capacity");
      await navigate(page, "/settings");
      await navigate(page, "/alerts");
      await page.goBack();
      await settled(page);
      await page.goBack();
      await settled(page);
      await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
      await page.getByTestId("ward-planned-book").click();
      await page.getByTestId("ward-planned-stay").fill("9");

      let prompts = 0;
      const dismiss = async (dialog: import("playwright/test").Dialog) => {
        prompts += 1;
        await dialog.dismiss();
      };
      page.on("dialog", dismiss);
      await page.evaluate((move) => window.history[move](), direction);
      await expect.poll(() => prompts).toBe(1);
      await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
      await expect(page.getByTestId("ward-planned-stay")).toHaveValue("9");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByTestId("ward-planned-stay")).toBeFocused();
      page.off("dialog", dismiss);
      page.once("dialog", (dialog) => dialog.accept());
      await page.evaluate((move) => window.history[move](), direction);
      await expect(page).toHaveURL(new RegExp(`${HOME}${direction === "back" ? "" : "/settings"}$`));
      await expect(page.getByTestId("ward-planned-stay")).toHaveCount(0);
    });
  }

  test("cancels Forward into a real Next entry without our index metadata", async ({ page }) => {
    // Emulate entries from the previous build: retain Next's own real state, omit only our new
    // numeric metadata at the browser boundary. No fabricated router tree or history indices.
    await page.addInitScript(() => {
      for (const key of ["pushState", "replaceState"] as const) {
        const original = History.prototype[key];
        History.prototype[key] = function (data: unknown, title: string, url?: string | URL | null) {
          const state = data && typeof data === "object" ? { ...data } : data;
          if (state && typeof state === "object") delete (state as Record<string, unknown>).__wfHistoryIndex;
          return original.call(this, state, title, url);
        };
      }
    });
    await page.goto(HOME);
    await settled(page);
    await navigate(page, "/capacity");
    await navigate(page, "/settings");
    await navigate(page, "/alerts");
    await page.goBack();
    await settled(page);
    await page.goBack();
    await settled(page);
    expect(await page.evaluate(() => window.history.state.__wfHistoryIndex)).toBeUndefined();
    expect(await page.evaluate(() => window.history.state.__NA)).toBe(true);
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("8");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.go(2));
    await expect.poll(() => prompts).toBe(1);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("8");
  });

  test("indexed fallback restores a skipped Forward traversal without Navigation API", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, "navigation", { value: undefined }));
    await page.goto(HOME);
    await settled(page);
    await navigate(page, "/capacity");
    await navigate(page, "/settings");
    await navigate(page, "/alerts");
    await page.goBack();
    await settled(page);
    await page.goBack();
    await settled(page);
    expect(await page.evaluate(() => typeof window.history.state.__wfHistoryIndex)).toBe("number");
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("7");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.go(2));
    await expect.poll(() => prompts).toBe(1);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("7");
  });

  test("unindexed legacy fallback without Navigation API keeps the form and restores its URL", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "navigation", { value: undefined });
      for (const key of ["pushState", "replaceState"] as const) {
        const original = History.prototype[key];
        History.prototype[key] = function (data: unknown, title: string, url?: string | URL | null) {
          const state = data && typeof data === "object" ? { ...data } : data;
          if (state && typeof state === "object") delete (state as Record<string, unknown>).__wfHistoryIndex;
          return original.call(this, state, title, url);
        };
      }
    });
    await page.goto(HOME);
    await settled(page);
    await navigate(page, "/capacity");
    await navigate(page, "/settings");
    await navigate(page, "/alerts");
    await page.goBack();
    await settled(page);
    await page.goBack();
    await settled(page);
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("6");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.go(2));
    await expect.poll(() => prompts).toBe(1);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("6");
    await expect(page.getByTestId("ward-planned-stay")).toBeFocused();
    expect(await page.evaluate(() => window.history.state.__NA)).toBe(true);
    expect(await page.evaluate(() => window.history.state.__wfHistoryUncertain)).toBe(true);
    // Once the cursor is uncertain, a second cancellation must also restore the form safely.
    await page.evaluate(() => window.history.back());
    await expect.poll(() => prompts).toBe(2);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("6");
  });

  test("native hash changes keep a booking form without a false leave prompt", async ({ page }) => {
    await page.goto(`${HOME}/capacity`);
    await settled(page);
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("5");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => {
      window.location.hash = "booking-control";
    });
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity#booking-control$`));
    await page.evaluate(() => window.history.back());
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("5");
    expect(prompts).toBe(0);
  });

  test("indexed fallback restores a multi-step traversal across a native hash entry", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, "navigation", { value: undefined }));
    await page.goto(HOME);
    await settled(page);
    await navigate(page, "/capacity");
    await page.evaluate(() => {
      window.location.hash = "booking-control";
    });
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity#booking-control$`));
    await navigate(page, "/settings");
    await navigate(page, "/alerts");
    await page.evaluate(() => window.history.go(-3));
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await settled(page);
    await page.getByTestId("ward-planned-book").click();
    await page.getByTestId("ward-planned-stay").fill("4");
    let prompts = 0;
    page.on("dialog", async (dialog) => {
      prompts += 1;
      await dialog.dismiss();
    });
    await page.evaluate(() => window.history.go(3));
    await expect.poll(() => prompts).toBe(1);
    await expect(page).toHaveURL(new RegExp(`${HOME}/capacity$`));
    await expect(page.getByTestId("ward-planned-stay")).toHaveValue("4");
  });

  test("long scoped desk attribution fits portrait handover pages", async ({ page }) => {
    await page.addInitScript(() =>
      sessionStorage.setItem(
        "wardflow:access-desk-v1",
        JSON.stringify({
          role: "ward",
          scope: { kind: "ward", unitIds: ["brm-adult-secure"] },
        }),
      ),
    );
    await page.goto(`${HOME}/handover?flags=role-access:on`);
    await settled(page);
    await page.getByTestId("ward-handover-more").click();
    await page.getByRole("menuitem", { name: "Print handover" }).click();
    await page.getByRole("radio", { name: "A4 portrait" }).click();
    await page.emulateMedia({ media: "print" });
    for (const paper of await page.locator("[data-wf-print-stack] article").all()) {
      const stamp = paper.getByTestId("ward-print-attribution");
      await expect(stamp).toBeVisible();
      await expect(stamp).toContainText("Nurse in charge, Mabu Liyan / Broome Mental Health Unit");
      expect(
        await stamp.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const page = element.closest("article")!.getBoundingClientRect();
          return element.scrollWidth <= element.clientWidth && box.left >= page.left && box.right <= page.right;
        }),
      ).toBe(true);
      expect(await paper.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    }
  });

  test("every isolated handover page prints its desk and place attribution", async ({ page }) => {
    await page.goto(`${HOME}/handover?flags=role-access:on`);
    await settled(page);
    await page.getByTestId("ward-handover-more").click();
    await page.getByRole("menuitem", { name: "Print handover" }).click();
    await page.emulateMedia({ media: "print" });
    const pages = page.locator("[data-wf-print-stack] article");
    expect(await pages.count()).toBeGreaterThan(1);
    for (const paper of await pages.all()) {
      const attribution = paper.getByTestId("ward-print-attribution");
      await expect(attribution).toBeVisible();
      await expect(attribution).toContainText("Printed by Flow coordinator, Statewide, at");
      await expect(attribution).toContainText("Synthetic data.");
      expect(await paper.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
    }
  });
});
