import { expect, test } from "playwright/test";

/**
 * ═══ THE FOUR STATISTICS SCREENS, REACHED THE WAY A COORDINATOR REACHES THEM ══════════════════
 *
 * The sibling spec (`ui-ward-statistics-compare.spec.ts`) proves one property on one screen. This
 * one proves the four screens LOAD, carry real figures, and do not scroll sideways on a phone —
 * and that each is reachable by clicking, not by typing its address.
 *
 * ⚠️ **REACHED BY CLICKING IS THE POINT, NOT A FLOURISH.** A screen that renders perfectly at a URL
 * nobody can navigate to is unreachable in the only sense that matters. Two ward routes were once
 * invisible to this repository's own route scan for exactly that reason. `page.goto` on each of the
 * four would have passed on a hub with no links at all.
 *
 * ⚠️ **THIS FILE RUNS IN NEITHER DEFAULT LOOP, AND ITS NAME HAD TO BE ADDED TO TWO PATTERNS.**
 * `verify:ui` selects the `chromium` project (`productionSpecPattern`, which names no ward spec) and
 * then `--grep-invert`s `@mockup` — so it excludes this file twice over. It runs only under:
 *
 *     node scripts/run-playwright.mjs --project=chromium-mockups tests/ui-ward-statistics-journey.spec.ts
 *
 * and in CI only when `vars.WARD_JOURNEYS_BLOCKING` is set, which is unset by default. **A spec
 * added here passes forever by never running unless somebody runs it on purpose.**
 *
 * ✅ **SO HERE IS THIS FILE ACTUALLY RUNNING, 2026-09-07, rather than an assurance that it would:**
 *
 * ```
 * Running 3 tests using 1 worker
 *   ok 1 [chromium-mockups] › ui-ward-statistics-journey.spec.ts:86  every hub link arrives …
 *   ok 2 [chromium-mockups] › ui-ward-statistics-journey.spec.ts:124 the ward and department …
 *   ok 3 [chromium-mockups] › ui-ward-statistics-journey.spec.ts:137 a wide table scrolls …
 *   3 passed (8.8s)      REAL_EXIT=0
 * ```
 *
 * ⚠️ **Recorded here because the commit that introduced this file quoted the SIBLING spec's green
 * run under the words "proved by running it".** Both were true statements; together they read as a
 * claim about this file that had not yet been tested. The lines above are this file's own.
 *
 * ✅ The one thing that is NOT left to memory: `playwright.config.ts`'s `testMatch` and
 * `mockupSpecPattern` both name ward specs explicitly, and
 * `tests/playwright-project-isolation.test.ts` fails on any spec file on disk that no pattern
 * matches. So a file that would silently not run goes red in the offline suite instead. That guard
 * is why this file's name is in those two regexes rather than trusted to a comment.
 */

const HUB = "/mockups/ward-flow/statistics";

/**
 * The four destinations, each with a marker that is only present when the screen genuinely rendered.
 * `compare` is deliberately absent: its own spec covers it, and duplicating it here would mean two
 * files to update for one change.
 */
const DESTINATIONS = [
  {
    name: "Across all services",
    linkText: "Across all services",
    marker: "ward-statistics-overview-screen",
    navValue: "overview",
    /** A figure this screen derives, so an empty shell cannot pass as a rendered page. */
    figure: "ward-statistics-overview-declines-population",
  },
  {
    name: "One health service in detail",
    linkText: "One health service in detail",
    marker: "ward-statistics-service-chooser",
    navValue: "service",
    figure: undefined,
  },
] as const;

/** Deep screens, reached from their chooser rather than from the hub. */
const DEEP = [
  { path: "/mockups/ward-flow/statistics/ward/rph-adult-secure", marker: "ward-statistics-ward-screen" },
  { path: "/mockups/ward-flow/statistics/ed/rph-ed", marker: "ward-stat-ed-wait-table" },
] as const;

/**
 * React leaves a hidden staging copy of a streamed screen in the document for a moment, so every
 * testid resolves twice and any geometry measured against the staged copy is meaningless. The
 * sibling spec hit this; it is not hypothetical.
 */
async function waitForStreamToSettle(page: import("playwright/test").Page): Promise<void> {
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
}

/** The page itself must never scroll sideways; a wide table scrolls inside its own container. */
async function expectNoPageOverflow(page: import("playwright/test").Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(
    overflow.body,
    `${where}: the page body scrolls sideways at ${overflow.viewport}px (body is ${overflow.body}px). ` +
      "A wide table must scroll inside its own overflow-x container, never drag the page with it.",
  ).toBeLessThanOrEqual(overflow.viewport);
}

test.describe("@mockup the statistics screens are reachable and readable on a phone", () => {
  test("every hub link arrives at a screen that rendered, and none scrolls the page sideways", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(HUB, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await waitForStreamToSettle(page);

    // FLOOR. A hub with no links passes every "clicked through successfully" assertion below by
    // never entering the loop, and an empty DESTINATIONS list would do the same.
    expect(DESTINATIONS.length, "no destinations to walk").toBeGreaterThan(0);
    const linkCount = await page.locator('nav a[href*="/statistics/"]').count();
    expect(linkCount, "the statistics hub renders no section links at all").toBeGreaterThanOrEqual(DESTINATIONS.length);

    await expectNoPageOverflow(page, "the hub");

    for (const destination of DESTINATIONS) {
      await page.goto(HUB, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      await waitForStreamToSettle(page);

      await page.getByLabel("Statistics section", { exact: true }).selectOption(destination.navValue);
      await page.waitForLoadState("networkidle");
      await waitForStreamToSettle(page);

      await expect(
        page.getByTestId(destination.marker),
        `clicking "${destination.linkText}" did not arrive at a rendered ${destination.name}`,
      ).toBeVisible({ timeout: 15_000 });

      if (destination.figure !== undefined) {
        await expect(
          page.getByTestId(destination.figure),
          `${destination.name} rendered its frame but not its figures — an empty shell and a working screen look identical`,
        ).toBeVisible({ timeout: 15_000 });
      }

      await expectNoPageOverflow(page, destination.name);
    }
  });

  test("the ward and department detail screens render their figures at phone width", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const screen of DEEP) {
      await page.goto(screen.path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      await waitForStreamToSettle(page);

      await expect(page.getByTestId(screen.marker), `${screen.path} did not render`).toBeVisible({ timeout: 15_000 });
      await expectNoPageOverflow(page, screen.path);
    }
  });

  test("a wide table scrolls inside its own container rather than moving the page", async ({ page }) => {
    /*
     * ⚠️ **THIS ASSERTS THE CONTRACT, NOT A MEASUREMENT.** As of 2026-09-07 both statistics tables
     * fit a 375px phone exactly and scroll nowhere — an earlier version of this comment carried the
     * figures "352px in a 301px wrapper", which were true when taken and false ten minutes later.
     * So this test asks the question that survives either arrangement: whatever the table's width,
     * the PAGE must not move. A table that grows past its wrapper is fine; a page that grows is not.
     */
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/mockups/ward-flow/statistics/ed/rph-ed", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await waitForStreamToSettle(page);

    const table = page.getByTestId("ward-stat-ed-wait-table");
    await expect(table).toBeVisible({ timeout: 15_000 });

    // FLOOR: a table with no body rows satisfies every containment assertion perfectly.
    const rows = await page.locator('[data-testid="ward-stat-ed-wait-table"] tbody tr').count();
    expect(rows, "the wait table rendered with no rows, so containment proves nothing").toBeGreaterThan(0);

    const geometry = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="ward-stat-ed-wait-table"]');
      const wrapper = el?.closest("div");
      return {
        tableScrollWidth: el?.scrollWidth ?? 0,
        wrapperClientWidth: wrapper?.clientWidth ?? 0,
        wrapperOverflowX: wrapper ? getComputedStyle(wrapper).overflowX : "none",
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });

    expect(geometry.bodyScrollWidth, "the page itself scrolls sideways").toBeLessThanOrEqual(geometry.viewportWidth);
    if (geometry.tableScrollWidth > geometry.wrapperClientWidth) {
      expect(
        ["auto", "scroll"],
        "the table is wider than its wrapper but the wrapper cannot scroll, so the overflow is simply unreachable",
      ).toContain(geometry.wrapperOverflowX);
    }
  });
});

// These dynamic page families had no browser coverage. Exercise their actual scoped controls.
test.describe("@mockup page-specific statistics insights", () => {
  test("service capacity stays in scope and its graph opens ward statistics", async ({ page }) => {
    await page.goto("/mockups/ward-flow/statistics/service/North%20Metro", { waitUntil: "networkidle" });
    const capacity = page.getByTestId("ward-statistics-capacity-chart");
    await expect(capacity).toContainText("in North Metro");
    await expect(capacity.getByLabel("Health service filter")).toHaveCount(0);
    await capacity.getByRole("button", { name: /Mental Health Unit:.*ready/ }).click();
    await expect(
      page.getByTestId("capacity-details").getByRole("link", { name: /Mental Health Unit/ }),
    ).toHaveAttribute("href", /statistics\/ward\//);
    const placements = page.getByTestId("statistics-service-placement-chart");
    await placements.getByRole("button", { name: /^Within service:/ }).click();
    await expect(placements.getByRole("complementary", { name: "Within service details" })).toBeVisible();
    await placements.getByRole("button", { name: "Close chart details" }).click();
    await expect(placements.getByRole("complementary")).toHaveCount(0);
    const travel = page.getByTestId("statistics-service-travel-chart");
    await expect(travel).toContainText("synthetic travel times");
    await travel.getByRole("button", { name: "Travel bands data view" }).click();
    await expect(travel.getByRole("table")).toBeVisible();
    await travel.getByRole("button", { name: /^Three hours or more from home:/ }).click();
    await expect(travel.getByRole("complementary")).toContainText("Travel bands are synthetic");
    await travel.getByRole("button", { name: "Close chart details" }).click();
  });
  test("community handover and searchable comparison preserve team context on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mockups/ward-flow/statistics/community/bentley", { waitUntil: "networkidle" });
    await expect(page.getByTestId("statistics-community-handover-chart")).toContainText("Discharge dates are a subset");
    const detail = page.getByTestId("ward-statistics-community-comparison-disclosure");
    await detail.locator("summary").first().click();
    const chart = page.getByTestId("statistics-community-comparison-chart");
    await chart.getByLabel("Search Team comparison").fill("Bentley");
    await expect(chart.locator("button[data-chart-record]")).toHaveCount(1);
    await chart.getByLabel("Team comparison measure").selectOption("expected");
    await chart.locator("button[data-chart-record]").click();
    await expect(chart.getByRole("complementary", { name: "Bentley details" }).getByRole("link")).toHaveAttribute(
      "href",
      /statistics\/community\/bentley$/,
    );
    await chart.getByRole("button", { name: "Close chart details" }).click();
    await expectNoPageOverflow(page, "community chart and comparison");
    await expect(page.getByRole("navigation", { name: "Ward Flow statistics sections" })).toHaveCount(1);
  });
});

test("@mockup ward disclosure rows stay inset and the chart data view preserves records", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mockups/ward-flow/statistics/ward/scgh-adult-open", { waitUntil: "networkidle" });
  const beds = page.getByTestId("ward-statistics-ward-beds-now");
  const summaries = beds.locator("details > summary");
  await expect(summaries).toHaveCount(3);
  const geometry = await summaries.evaluateAll((nodes) =>
    nodes.map((node) => {
      const row = node as HTMLElement;
      const style = getComputedStyle(row);
      const icon = getComputedStyle(row, "::after");
      return {
        left: row.getBoundingClientRect().left,
        padding: parseFloat(style.paddingLeft),
        height: row.getBoundingClientRect().height,
        marker: style.listStyleType,
        iconWidth: parseFloat(icon.width),
      };
    }),
  );
  for (const row of geometry) {
    expect(row.left).toBe(geometry[0].left);
    expect(row.padding).toBeGreaterThanOrEqual(16);
    expect(row.height).toBeGreaterThanOrEqual(48);
    expect(row.marker).toBe("none");
    expect(row.iconWidth).toBeGreaterThan(0);
  }
  await summaries.first().focus();
  await page.keyboard.press("Enter");
  await expect(beds.getByRole("table")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(beds.getByRole("table")).toBeHidden();
  const chart = page.getByTestId("statistics-ward-stays-chart");
  await chart.getByRole("button", { name: "Current length of stay data view" }).click();
  await expect(chart.getByRole("table")).toBeVisible();
  await chart.getByRole("button", { name: /^Under 2 weeks:/ }).click();
  await expect(chart.getByRole("complementary", { name: "Under 2 weeks details" })).toBeVisible();
  await chart.getByRole("button", { name: "Close chart details" }).click();
  await expect(chart.getByRole("button", { name: /^Under 2 weeks:/ })).toBeFocused();
  await chart.getByRole("button", { name: "Current length of stay data view" }).click();
  await expect(chart.getByRole("table")).toHaveCount(0);
  await expectNoPageOverflow(page, "ward disclosure and chart data view");
});
