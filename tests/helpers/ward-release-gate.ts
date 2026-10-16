import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type TestInfo } from "playwright/test";

import { escapeForRegExp } from "./ward-place-names";

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
  const scan = async () => {
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ""));
    return { results, blocking };
  };
  let { results, blocking } = await scan();
  // A screen still settling after a client-side move (a sheet closing, a header repainting for the
  // new desk) can measure a colour against a background that is not there a moment later. Scan once
  // more after it settles; a real violation is still there and fails.
  if (blocking.length > 0) {
    await page.waitForTimeout(1_000);
    ({ results, blocking } = await scan());
  }
  // For a contrast failure, record what the browser itself reports for each flagged element and its
  // ancestors, so a red run on a slower CI runner can be diagnosed without reproducing it.
  const contrastTargets = blocking
    .filter((violation) => violation.id === "color-contrast")
    .flatMap((violation) => violation.nodes.map((node) => String(node.target[0])));
  const computed =
    contrastTargets.length > 0
      ? await page.evaluate((selectors) => {
          const read = (element: Element) => {
            const style = getComputedStyle(element);
            return {
              tag: element.tagName.toLowerCase(),
              className: String(element.getAttribute("class") ?? ""),
              attributes: Object.fromEntries(
                Array.from(element.attributes)
                  .filter((attribute) => attribute.name.startsWith("data-"))
                  .map((attribute) => [attribute.name, attribute.value]),
              ),
              color: style.color,
              background: style.backgroundColor,
              opacity: style.opacity,
            };
          };
          return selectors.map((selector) => {
            const element = document.querySelector(selector);
            const chain: ReturnType<typeof read>[] = [];
            for (let node = element; node && chain.length < 8; node = node.parentElement) chain.push(read(node));
            return { selector, chain, rootClass: document.documentElement.className };
          });
        }, contrastTargets)
      : [];
  await testInfo.attach(`axe: ${step}`, {
    body: JSON.stringify({ url: page.url(), violations: results.violations, computed }, null, 2),
    contentType: "application/json",
  });
  if (computed.length > 0) console.log(`[release-gate] computed styles at "${step}": ${JSON.stringify(computed)}`);
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
  // Tools review (15 Oct 2026): one sheet, Change view at its top, so no tab to pick.
  await page
    .getByRole("dialog", { name: "Tools" })
    .getByRole("button", { name: /^Change view/ })
    .waitFor();
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

/**
 * Opens the ward's full Arrivals or Discharges list. Desktop: the Home tab's Ward flow card. Phone:
 * the Ward flow button in the ward's own toolbar opens the same card as a sheet.
 */
export async function openWardList(page: Page, list: "Admissions" | "Discharges") {
  await openWardFlow(page, list);
  const button = list === "Admissions" ? "All arrivals" : "All discharges";
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page.locator(list === "Admissions" ? "#tab-coming" : "#tab-out")).toHaveAttribute("data-active", "true");
}

/**
 * Shows one pane of the ward's Ward flow card: Referrals (awaiting this ward's answer), Admissions
 * or Discharges. On a phone the card is a sheet opened from the ward's toolbar.
 */
export async function openWardFlow(page: Page, pane: "Referrals" | "Admissions" | "Discharges") {
  if (isPhoneLayout(page)) {
    const sheet = page.getByRole("dialog", { name: "Ward flow" });
    if (!(await sheet.isVisible())) {
      await page
        .getByRole("toolbar", { name: "Ward actions" })
        .getByRole("button", { name: "Ward flow", exact: true })
        .click();
    }
    await expect(sheet).toBeVisible();
  } else {
    await page.locator("#tabBtn-attn").click();
  }
  const radio = page.getByRole("radio", { name: new RegExp(`^${pane}`, "u") });
  if ((await radio.getAttribute("aria-checked")) !== "true") await radio.click();
}

/** Back to the ward's Home tab, where its bed figures live. */
export async function openWardHome(page: Page) {
  await page.locator("#tabBtn-attn").click();
  await expect(page.locator("#tabBtn-attn")).toHaveAttribute("aria-selected", "true");
}

/**
 * A ward's own occupied or ready figure, as its Home tab shows it. Desktop reads the bed grid's
 * chip; the phone header carries the same figures in its summary line and Ready now button.
 */
export async function wardFigure(page: Page, figure: "occupied" | "ready"): Promise<number> {
  const wardScreen = page.getByTestId("ward-unit-screen");
  const grid = wardScreen.getByTestId("ward-unit-beds");
  if (await grid.isVisible()) {
    // The grid's Ready chip carries data-state="available".
    const state = figure === "occupied" ? "occupied" : "available";
    return Number((await grid.locator(`[data-state="${state}"] strong`).first().innerText()).trim());
  }
  const region = wardScreen.getByRole("region", { name: "This ward", exact: true });
  if (figure === "occupied") {
    const match = /(\d+) occupied/u.exec(await region.innerText());
    expect(match, "the phone ward header must state how many beds are occupied").not.toBeNull();
    return Number(match![1]);
  }
  const ready = region.getByRole("button", { name: /Ready now$/u });
  const match = /^(\d+)/u.exec(((await ready.getAttribute("aria-label")) ?? (await ready.innerText())).trim());
  expect(match, "the phone ward header must state how many beds are ready now").not.toBeNull();
  return Number(match![1]);
}

/**
 * Ready beds for one ward on the coordinator's capacity board. Desktop reads the bed map's Table
 * layout; the phone shows the same figure in the Wards view, in each ward's bed strip label.
 */
export async function capacityReady(page: Page, unitId: string, unitName: string): Promise<number> {
  if (isPhoneLayout(page)) {
    const wards = page.getByRole("radio", { name: /^Wards/u });
    if ((await wards.getAttribute("aria-checked")) !== "true") await wards.click();
    const strip = page.getByRole("img", { name: new RegExp(`^${escapeForRegExp(unitName)}: `, "u") }).first();
    await expect(strip).toBeVisible();
    const label = (await strip.getAttribute("aria-label")) ?? "";
    const match = /: (\d+) ready/u.exec(label);
    expect(match, `the ${unitName} bed strip must state its ready count: "${label}"`).not.toBeNull();
    return Number(match![1]);
  }
  await openCapacityTable(page, unitId);
  return capacityFigure(page, unitId, "ward-capacity-network-ready");
}

/** The capacity board's per-ward table is the bed map's Table layout; press until it shows. */
async function openCapacityTable(page: Page, unitId: string) {
  const table = page.getByRole("group", { name: "Bed map layout" }).getByRole("button", { name: "Table", exact: true });
  await expect(async () => {
    if ((await table.getAttribute("aria-pressed")) !== "true") await table.click();
    await expect(table).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId(`ward-capacity-network-row-${unitId}`)).toBeVisible();
}

/** A capacity table cell's own figure. "none" reads as 0; the "still being made ready" note is ignored. */
async function capacityFigure(page: Page, unitId: string, testId: string): Promise<number> {
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
