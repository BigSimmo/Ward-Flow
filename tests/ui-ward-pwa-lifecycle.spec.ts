import { expect, test as base, type Locator, type Page } from "playwright/test";
import { createWardPwaProxy } from "./support/ward-pwa-proxy";

const DRAFT_SENTINEL = "PWA draft recovery fixture";

async function fillDraft(field: Locator) {
  try {
    await field.fill(DRAFT_SENTINEL);
  } catch {
    throw new Error("The synthetic draft fixture could not be entered.");
  }
}

const test = base.extend<{
  pwa: Awaited<ReturnType<typeof createWardPwaProxy>>;
}>({
  pwa: async ({ baseURL, context, request }, runFixture) => {
    const identity = await request.get(new URL("/api/local-project-id", baseURL!).href);
    expect(identity.ok()).toBe(true);
    const project = await identity.json();
    expect(project.appName).toBe("Ward Flow");
    // The real registration is disabled in development. A dev-server pass cannot prove this lane.
    expect(project.localServer.runtimeMode).toBe("production");
    const pwa = await createWardPwaProxy(baseURL!);
    await context.addInitScript(() => {
      localStorage.setItem(
        "ward_flow_choice_tour_seen",
        "coordinator,ward,ed,community,officer,bed_manager,executive,admin",
      );
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === pwa.origin || ["blob:", "data:"].includes(url.protocol) ? route.continue() : route.abort();
    });
    try {
      await runFixture(pwa);
    } finally {
      // Close pages before Playwright builds failure context: no patient rows or typed fixture text.
      await context.close();
      await pwa.close();
    }
  },
});

test.use({
  serviceWorkers: "allow",
  viewport: { width: 390, height: 844 },
  trace: "off",
  screenshot: "off",
  video: "off",
});

async function ready(page: Page) {
  await expect(page.locator("html[data-wf-bar-ready]")).toHaveCount(1);
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0);
}

async function controlled(page: Page, origin: string) {
  await page.goto(`${origin}/ward-flow`, { waitUntil: "domcontentloaded" });
  await ready(page);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

test.describe("real-worker recovery and update ownership @mockup", () => {
  test("keeps only static responses, shows offline recovery, and reconnects through Try again", async ({
    page,
    context,
    pwa,
  }) => {
    await controlled(page, pwa.origin);
    // The first install claims an already loaded document. A real controlled reload populates assets.
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready(page);
    await page.evaluate(() => fetch("/api/health"));
    const cached = () =>
      page.evaluate(async () => {
        const names = (await caches.keys()).filter((name) => name.startsWith("ward-flow-static-"));
        const requests = (await Promise.all(names.map(async (name) => (await caches.open(name)).keys()))).flat();
        return requests.map((request) => new URL(request.url).pathname);
      });
    await expect.poll(async () => (await cached()).some((url) => url.startsWith("/_next/static/"))).toBe(true);
    const paths = await cached();
    expect(paths).toContain("/ward-flow-offline.html");
    expect(
      paths.every(
        (url) =>
          url.startsWith("/_next/static/") ||
          url === "/ward-flow-offline.html" ||
          url === "/icon.svg" ||
          url.startsWith("/icons/") ||
          url.startsWith("/apple-icon") ||
          url === "/manifest.webmanifest",
      ),
    ).toBe(true);
    expect(paths.some((url) => url === "/api/health" || url === "/ward-flow")).toBe(false);
    await context.setOffline(true);
    try {
      await page.goto(`${pwa.origin}/ward-flow/capacity`, {
        waitUntil: "domcontentloaded",
      });
      await expect(page.getByRole("heading", { name: "Ward Flow needs a connection" })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
    await page.getByRole("link", { name: "Try again" }).click();
    await ready(page);
    expect(new URL(page.url()).pathname).toBe("/ward-flow/capacity");
    await expect(page.getByRole("heading", { name: "Ward Flow needs a connection" })).toHaveCount(0);
  });

  for (const preload of [true, false]) {
    test(`recovers when ${preload ? "navigation preload" : "worker fetch"} stays pending`, async ({ page, pwa }) => {
      test.setTimeout(45_000);
      await controlled(page, pwa.origin);
      await page.evaluate(async (enabled) => {
        const registration = await navigator.serviceWorker.ready;
        if (!registration.navigationPreload) throw new Error("This Chromium lane needs navigation preload support.");
        await registration.navigationPreload[enabled ? "enable" : "disable"]();
      }, preload);
      pwa.state.heldPath = "/ward-flow/capacity";
      // No rejection/release is injected. The application deadline must commit its offline document.
      await page.goto(`${pwa.origin}/ward-flow/capacity`, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });
      await expect(page.getByRole("heading", { name: "Ward Flow needs a connection" })).toBeVisible();
      expect(pwa.state.requests.length).toBeGreaterThan(0);
      expect(pwa.state.requests.some((request) => request.preload)).toBe(preload);
    });
  }

  test("another tab's activation preserves this draft until its own explicit Reload", async ({
    page: first,
    context,
    pwa,
  }) => {
    test.setTimeout(60_000);
    await controlled(first, pwa.origin);
    const second = await context.newPage();
    await second.goto(`${pwa.origin}/ward-flow/referrals/new`, {
      waitUntil: "domcontentloaded",
    });
    await ready(second);
    // BA-12 (this PR): the sheet is named for its heading, New referral, as the restore check below reads it.
    const referral = second.getByRole("dialog", {
      name: "New referral",
      exact: true,
    });
    await referral
      .getByRole("group", { name: "Referral sections" })
      .getByRole("button", { name: "Referral", exact: true })
      .click();
    const field = referral.locator("#refDocInput");
    await fillDraft(field);
    // Keep comparison and raw storage inside the browser. Failed assertions print only a boolean.
    await expect
      .poll(() =>
        second.evaluate(() =>
          Object.entries(sessionStorage).some(([key, raw]) => {
            if (!key.startsWith("wf-draft:v2:")) return false;
            try {
              return JSON.parse(JSON.parse(raw).value).doctorNote === "PWA draft recovery fixture";
            } catch {
              return false;
            }
          }),
        ),
      )
      .toBe(true);
    await first.evaluate(() => document.documentElement.setAttribute("data-pwa-document", "first"));
    await second.evaluate(() => {
      document.documentElement.setAttribute("data-pwa-document", "second");
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          document.documentElement.setAttribute("data-pwa-controller-changed", "true");
        },
        { once: true },
      );
    });
    pwa.state.version = "B";
    await first.evaluate(async () => (await navigator.serviceWorker.ready).update());
    const update = "New version of Ward Flow ready";
    await expect(first.getByText(update, { exact: true })).toBeVisible();
    await expect(second.getByText(update, { exact: true })).toBeVisible();
    await expect(first.locator("html")).toHaveAttribute("data-pwa-document", "first");
    await expect(second.locator("html")).toHaveAttribute("data-pwa-document", "second");
    expect(await second.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))).toBe(true);
    await first.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(first.locator("html")).not.toHaveAttribute("data-pwa-document", "first");
    await ready(first);
    await expect(second.locator("html")).toHaveAttribute("data-pwa-controller-changed", "true");
    await expect(second.locator("html")).toHaveAttribute("data-pwa-document", "second");
    expect(
      await field.evaluate((element) => (element as HTMLInputElement).value === "PWA draft recovery fixture"),
    ).toBe(true);
    expect(await second.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))).toBe(false);
    await second.getByRole("button", { name: "Reload", exact: true }).click();
    await expect(second.locator("html")).not.toHaveAttribute("data-pwa-document", "second");
    await ready(second);
    await second
      .getByRole("group", { name: "Referral sections" })
      .getByRole("button", { name: "Referral", exact: true })
      .click();
    const restored = second.getByRole("dialog", { name: "New referral", exact: true }).locator("#refDocInput");
    await expect(restored).toBeVisible();
    expect(
      await restored.evaluate((element) => (element as HTMLInputElement).value === "PWA draft recovery fixture"),
    ).toBe(true);
  });
});
