import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type TestInfo } from "playwright/test";

/**
 * Shared steps for the four release-gate journeys (`tests/release-gate-journeys.spec.ts`).
 *
 * The waits and navigation moves here are the ones the longer per-screen journeys already rely on
 * (`ui-ward-full-journey.spec.ts`, `ui-ward-discharges.spec.ts`, `ui-ward-roles.spec.ts`), gathered
 * in one place so the gate reads as four short stories. Each move works on both release-gate
 * projects: the desktop rail and Tools drawer at 1440px, and the phone dock and Menu sheet at
 * 390x844, which is its own design rather than a squeezed desktop.
 */

/** WCAG 2.1 A and AA. Best-practice rules are left out: the gate fails on standards, not taste. */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/**
 * Runs axe on the page as it stands and fails on any serious or critical WCAG 2.1 AA violation.
 * Moderate and minor findings are attached to the report but never fail the gate. The full result
 * is attached per step, so a red run says which rule failed on which element at which step.
 */
export async function expectAccessible(page: Page, testInfo: TestInfo, step: string) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ""));
  await testInfo.attach(`axe: ${step}`, {
    body: JSON.stringify({ url: page.url(), violations: results.violations }, null, 2),
    contentType: "application/json",
  });
  const summary = blocking
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes
          .slice(0, 5)
          .map((node) => `    ${node.target.join(" ")}`)
          .join("\n"),
    )
    .join("\n");
  expect(blocking, `serious or critical accessibility violations at "${step}":\n${summary}`).toEqual([]);
}

/** True on the phone release-gate project (390px wide), where the header Menu replaces the rail. */
export function isPhoneLayout(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

/**
 * React streaming leaves a hidden staging copy of the whole screen in the document for a moment,
 * so a test id can briefly match twice. Wait that out, then for the screen itself.
 */
export async function waitForScreen(page: Page, testId: string) {
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

const SENTINEL = "ward-flow-release-gate-sentinel";

/**
 * Every step after the first navigation is client-side. A full reload reseeds the reducer from the
 * fixture, which would make every "the next screen shows the change" assertion pass vacuously, so
 * the journeys plant a marker on `window` and check it survives each hop.
 */
export async function plantSentinel(page: Page) {
  await page.evaluate((value) => {
    (window as unknown as Record<string, string>).__wardFlowReleaseGateSentinel = value;
  }, SENTINEL);
}

export async function expectNoReloadSince(page: Page, step: string) {
  const survived = await page.evaluate(
    () => (window as unknown as Record<string, string | undefined>).__wardFlowReleaseGateSentinel,
  );
  expect(survived, `the page reloaded during "${step}", so the shared state was reset`).toBe(SENTINEL);
}

/**
 * Opens a page through the app's own navigation, matched by `href`: the desktop rail, the phone
 * dock, or the phone Menu sheet, whichever this layout shows.
 */
export async function goViaNav(page: Page, href: string, screenTestId: string) {
  const rail = page.getByTestId("ward-rail");
  const railLink = rail.locator(`[data-testid="ward-rail-link"][href="${href}"]`);
  const dockLink = page.getByTestId("ward-phone-dock").locator(`a[href="${href}"]`);
  if (await railLink.isVisible()) {
    await railLink.click();
  } else if (await dockLink.isVisible()) {
    await dockLink.click();
  } else {
    await page.getByTestId("ward-bar-phone-menu").click();
    const menu = page.getByTestId("ward-phone-menu");
    await expect(menu).toBeVisible();
    await menu.locator(`a[href="${href}"]`).first().click();
  }
  await page.waitForURL((url) => url.pathname === href, { timeout: 15_000 });
  await waitForScreen(page, screenTestId);
}

/** Desktop: the Go to a desk drawer opens from Tools, then Change view. */
async function ensureToolsOpen(page: Page) {
  const trigger = page.getByTestId("ward-bar-tools-trigger");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await page
    .getByRole("dialog", { name: "Tools" })
    .getByRole("group", { name: "Tools sections" })
    .getByRole("button", { name: "Shift desk", exact: true })
    .click();
}

async function ensureToolsClosed(page: Page) {
  const trigger = page.getByTestId("ward-bar-tools-trigger");
  if ((await trigger.isVisible()) && (await trigger.getAttribute("aria-expanded")) === "true") {
    await page.getByRole("dialog", { name: "Tools" }).getByRole("button", { name: "Close", exact: true }).click();
  }
}

/**
 * Moves to another desk (ED, coordinator, a ward, the transport officer) through the real Go to a
 * desk drawer, never a typed URL. `pick` returns the link inside the drawer to follow.
 */
export async function goToDesk(
  page: Page,
  pick: (drawer: Locator) => Locator | Promise<Locator>,
  screenTestId: string,
) {
  const phone = isPhoneLayout(page);
  if (phone) {
    await page.getByTestId("ward-bar-phone-menu").click();
    await page.getByTestId("ward-phone-menu-switch-workstation").click();
  } else {
    await ensureToolsOpen(page);
    await page.getByRole("button", { name: /^Change view/ }).click();
  }
  const drawer = page.getByRole("dialog", { name: "Go to a desk" });
  await expect(drawer).toBeVisible();
  const item = await pick(drawer);
  const href = await item.getAttribute("href");
  await item.click();
  // Let the navigation commit before anything closes: closing a drawer calls history.back(), which
  // undid a slow pending navigation in the full journey (26 September 2026).
  if (href) {
    const target = new URL(href, page.url()).pathname;
    await page.waitForURL((url) => url.pathname === target, { timeout: 15_000 });
  }
  if (!phone) await ensureToolsClosed(page);
  await waitForScreen(page, screenTestId);
}

/** A ward desk, found by name in the drawer's search, so it works whatever is in focus. */
export function wardDesk(unitId: string, unitName: string) {
  return async (drawer: Locator) => {
    await drawer.getByRole("textbox", { name: "Find a desk" }).fill(unitName);
    await drawer.getByTestId(`workstation-desk-${unitId}`).click();
    return drawer.getByTestId(`workstation-open-${unitId}`);
  };
}

/** The ward Home tab's Ward flow card opens the full Arrivals or Discharges list. */
export async function openWardList(page: Page, list: "Admissions" | "Discharges") {
  await page.locator("#tabBtn-attn").click();
  await page.getByRole("radio", { name: new RegExp(`^${list}`, "u") }).click();
  const button = list === "Admissions" ? "All arrivals" : "All discharges";
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page.locator(list === "Admissions" ? "#tab-coming" : "#tab-out")).toHaveAttribute(
    "data-active",
    "true",
  );
}

/** The capacity board's per-ward table is the bed map's Table layout; press until it shows. */
export async function openCapacityTable(page: Page, unitId: string) {
  const table = page.getByRole("group", { name: "Bed map layout" }).getByRole("button", { name: "Table", exact: true });
  await expect(async () => {
    if ((await table.getAttribute("aria-pressed")) !== "true") await table.click();
    await expect(table).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId(`ward-capacity-network-row-${unitId}`)).toBeVisible();
}

/** A capacity table cell's own figure. "none" reads as 0; the "still being made ready" note is ignored. */
export async function capacityFigure(page: Page, unitId: string, testId: string): Promise<number> {
  const text = (
    await page
      .getByTestId(`ward-capacity-network-row-${unitId}`)
      .getByTestId(testId)
      .evaluate((cell) => {
        const copy = cell.cloneNode(true) as HTMLElement;
        copy.querySelector('[data-testid="ward-capacity-network-pending"]')?.remove();
        return copy.textContent ?? "";
      })
  ).trim();
  return text === "none" ? 0 : Number.parseInt(text, 10);
}
