import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, type TestInfo } from "playwright/test";
import type { NodeResult, Result } from "axe-core";

/**
 * Shared steps for the four release-gate journeys (`tests/release-gate-journeys.spec.ts`).
 *
 * The waits and navigation moves here are the ones the longer per-screen journeys already rely on
 * (`ui-ward-full-journey.spec.ts`, `ui-ward-discharges.spec.ts`, `ui-ward-roles.spec.ts`), gathered
 * in one place so the gate reads as four short stories. Each move works on both release-gate
 * projects: the desktop rail and Tools drawer at 1440px, and the phone dock and Menu sheet at
 * 390x844, which is its own design rather than a squeezed desktop.
 */

/**
 * WCAG 2.0 and 2.1 A and AA, plus WCAG 2.2 AA. There is no `wcag22a` tag: axe-core 4.14 has no rule
 * tagged with it (its one WCAG 2.2 rule, target-size, is `wcag22aa`), so WCAG 2.2 A adds nothing to
 * scan for (checked 10 Nov 2026, M159). Best-practice rules are left out: the gate fails on
 * standards, not taste.
 */
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/**
 * Target size (WCAG 2.5.8) is scanned with the screen scrolled to the top. Mid-scroll, the pinned
 * header and view rows sit over whatever passes under them, and axe counts a button half under a
 * pinned bar as too small. That is a scroll position, not a small button: the page's
 * `scroll-padding-top` keeps focus and jumps clear of the pinned bars, and at the top every target
 * is laid out at its real size. The scroll is put back afterwards, so later steps are unchanged.
 */
const SCROLL_TOP_RULES = ["target-size"];
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/**
 * Runs axe on the page as it stands and fails on any serious or critical WCAG 2.2 AA violation
 * (the tags in `AXE_TAGS`: 2.0 and 2.1 A and AA, and 2.2 AA).
 * Moderate and minor findings are attached to the report but never fail the gate. The full result
 * is attached per step, so a red run says which rule failed on which element at which step.
 */
export async function expectAccessible(page: Page, testInfo: TestInfo, step: string) {
  const scan = async () => {
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).disableRules(SCROLL_TOP_RULES).analyze();
    const atTop = await atScrollTop(page, () => new AxeBuilder({ page }).withRules(SCROLL_TOP_RULES).analyze());
    results.violations.push(...(await withoutPinnedBarOverlap(page, atTop.violations)));
    const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ""));
    return { results, blocking };
  };
  await waitForAccessibleReadiness(page);
  const { results, blocking } = await scan();
  await testInfo.attach(`screen: ${step}`, {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
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

/** Wait for fonts, finite motion and three equal layout frames before measuring accessibility. */
export async function waitForAccessibleReadiness(page: Page) {
  await page.evaluate(async () => {
    // The settle budget starts at the browser's first rendering opportunity. A cold WebKit (the
    // first phone test of a run) can go seconds after load without producing a frame; until it
    // does, neither requestAnimationFrame nor CSS transitions advance (every transition reads
    // localTime 0), so that start-up time is not motion and must not consume the budget. The
    // test's own timeout still bounds a browser that never renders.
    //
    // Count leak (D-137, 11 Nov 2026): a fresh device is now held, so the server sends a small
    // loading page and the browser draws the full page itself after hydration. A cold WebKit can
    // then stall again after its first frame, while it lays out that page for the first time. The
    // budget therefore counts only time in which the browser draws frames (and the font wait): a
    // stalled renderer is not motion. Motion that keeps the browser drawing still fails after five
    // seconds, and the test's own timeout still bounds a renderer that never recovers.
    let frames = 0;
    const nextFrame = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          frames += 1;
          resolve();
        }),
      );
    await nextFrame();
    let cancelled = false;
    let phase = "fonts";
    let timer: ReturnType<typeof setInterval>;
    const deadline = new Promise<never>((_, reject) => {
      let used = 0;
      let framesAtLastTick = frames;
      timer = setInterval(() => {
        if (phase === "fonts" || frames !== framesAtLastTick) used += 100;
        framesAtLastTick = frames;
        if (used < 5_000) return;
        clearInterval(timer);
        const animations = document.getAnimations().map((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return {
            name: (animation as CSSAnimation).animationName,
            state: animation.playState,
            timing: animation.effect?.getComputedTiming(),
            tag: target instanceof Element ? target.tagName : null,
            undoBar: target instanceof Element && target.hasAttribute("data-undo-bar"),
            undo: target instanceof Element ? target.closest("[data-undo]")?.getAttribute("data-undo") : null,
          };
        });
        reject(
          new Error(
            `Accessibility layout did not settle within five seconds: ${JSON.stringify({ phase, animations })}`,
          ),
        );
      }, 100);
    });
    const settled = async () => {
      await document.fonts?.ready;
      const motionIsRunning = () =>
        document.getAnimations().some((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          // The Undo hairline measures its availability window, not screen readiness.
          // Scan while Undo is still available; keep waiting for the toast's entry motion.
          if (
            target instanceof Element &&
            target.matches('[data-undo-bar][aria-hidden="true"]') &&
            target.closest('[data-undo="running"]')
          )
            return false;
          const timing = animation.effect?.getComputedTiming();
          return animation.playState === "running" && timing && Number.isFinite(Number(timing.endTime));
        });
      phase = "geometry";
      let previous = "";
      let equalFrames = 0;
      while (!cancelled && equalFrames < 3) {
        await nextFrame();
        // CSS transitions can disappear without settling a previously captured `finished`
        // promise. Observe the current animations so removed motion cannot strand readiness.
        if (motionIsRunning()) {
          phase = "animations";
          equalFrames = 0;
          continue;
        }
        phase = "geometry";
        const geometry = JSON.stringify(
          Array.from(document.querySelectorAll("header, [role=dialog], [data-wf-scroller], main")).map((element) => {
            const rect = element.getBoundingClientRect();
            return [rect.x, rect.y, rect.width, rect.height, element.scrollTop];
          }),
        );
        equalFrames = geometry === previous ? equalFrames + 1 : 0;
        previous = geometry;
      }
    };
    try {
      await Promise.race([settled(), deadline]);
    } finally {
      cancelled = true;
      clearInterval(timer!);
    }
  });
}

/**
 * Runs `action` with the window and the work column (`[data-wf-scroller]`, which scrolls on a
 * phone) at the top, then puts both back where they were.
 */
/**
 * The bottom twin of the scroll-top rule above. A pinned bottom bar (Handover's Copy summary, the
 * phone dock) always sits over whatever row is passing under it, at any scroll position, so axe
 * counts that row's button as too small. Only a target whose size check failed solely because a
 * `position: sticky` or `fixed` bar covers part of it is set aside; a target that is small, or
 * covered by anything else, still fails.
 */
async function withoutPinnedBarOverlap(page: Page, violations: Result[]): Promise<Result[]> {
  const kept: Result[] = [];
  for (const violation of violations) {
    if (violation.id !== "target-size") {
      kept.push(violation);
      continue;
    }
    const nodes: NodeResult[] = [];
    for (const node of violation.nodes) {
      const size = node.any.find((check) => check.id === "target-size");
      const covers = (size?.relatedNodes ?? []).map((related) => related.target.join(" "));
      const obscured = (size?.data as { messageKey?: string } | null)?.messageKey === "partiallyObscured";
      const pinned =
        obscured &&
        covers.length > 0 &&
        (await page.evaluate(
          (selectors) =>
            selectors.every((selector) => {
              for (let el = document.querySelector(selector); el; el = el.parentElement) {
                const position = getComputedStyle(el).position;
                if (position === "sticky" || position === "fixed") return true;
              }
              return false;
            }),
          covers,
        ));
      if (!pinned) nodes.push(node);
    }
    if (nodes.length > 0) kept.push({ ...violation, nodes });
  }
  return kept;
}

async function atScrollTop<T>(page: Page, action: () => Promise<T>): Promise<T> {
  const saved = await page.evaluate(() => {
    const column = document.querySelector("[data-wf-scroller]");
    const before = { window: window.scrollY, column: column?.scrollTop ?? 0 };
    window.scrollTo(0, 0);
    if (column) column.scrollTop = 0;
    return before;
  });
  // The phone header condenses on scroll; let it settle back to its full face first.
  await waitForAccessibleReadiness(page);
  try {
    return await action();
  } finally {
    await page.evaluate((before) => {
      const column = document.querySelector("[data-wf-scroller]");
      if (column) column.scrollTop = before.column;
      window.scrollTo(0, before.window);
    }, saved);
  }
}

/** True on the phone release-gate project (390px wide), where the header Menu replaces the rail. */
export function isPhoneLayout(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 744;
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
 * Phone Menu redesign (approved 31 Oct 2026): the open phone Menu shows only the desk's own pages;
 * every other group sits behind one "More pages" row that opens them in place. Taps that row, as a
 * person would, when the Menu is open and the row is closed. Does nothing otherwise.
 */
export async function openPhoneMenuMorePages(page: Page) {
  const morePages = page.getByTestId("ward-phone-menu").getByTestId("ward-phone-menu-more-pages");
  if (!(await morePages.isVisible())) return;
  if ((await morePages.getAttribute("aria-expanded")) === "true") return;
  await morePages.click();
  await expect(morePages).toHaveAttribute("aria-expanded", "true");
}

/**
 * Opens a page through the app's own navigation, matched by `href`: the desktop rail, the phone
 * dock, or the phone Menu sheet, whichever this layout shows.
 */
export async function goViaNav(page: Page, href: string, screenTestId: string) {
  const rail = page.getByTestId("ward-rail");
  const railLink = rail.locator(`[data-testid="ward-rail-link"][href="${href}"]`);
  const dockLink = page.getByTestId("ward-phone-dock").locator(`a[href="${href}"]`);
  // B1 (19 Oct 2026): the rail shows the desk's own menu; every other page is under More.
  const railMore = rail.locator('[data-testid="ward-rail-more"], [data-testid="ward-rail-tablet-more"]').first();
  // Straight after a desk switch the phone dock can draw a beat late (seen on WebKit), and the Menu
  // sheet need not list a dock page, so give the direct links a moment before falling back to it.
  await railLink
    .or(railMore)
    .or(dockLink)
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined);
  if (await railLink.isVisible()) {
    await railLink.click();
  } else if (await railMore.isVisible()) {
    await railMore.click();
    await page.locator(`[data-testid="ward-rail-link"][href="${href}"]:visible`).first().click();
  } else if (await dockLink.isVisible()) {
    await dockLink.click();
  } else {
    await page.getByTestId("ward-bar-phone-menu").click();
    const menu = page.getByTestId("ward-phone-menu");
    await expect(menu).toBeVisible();
    const link = menu.locator(`a[href="${href}"]`).first();
    if (!(await link.isVisible())) await openPhoneMenuMorePages(page);
    await link.click();
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
    // On a phone drill-down the header Back takes Menu's place (20 Oct 2026), so step back to a
    // starting page first, as a person would.
    const back = page.getByTestId("ward-bar-phone-back");
    for (let step = 0; step < 5 && (await back.isVisible()); step += 1) {
      const from = page.url();
      await back.click();
      await page.waitForURL((url) => url.href !== from, { timeout: 15_000 });
    }
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
 * the Ward flow row in Ward home's Needs you card opens the same card as a sheet.
 */
export async function openWardList(page: Page, list: "Admissions" | "Discharges") {
  await openWardFlow(page, list);
  // "All discharges · N open" carries its open count, so it is matched by its start.
  const button = list === "Admissions" ? /^All arrivals$/u : /^All discharges\b/u;
  await page.getByTestId("ward-coming-and-going").getByRole("button", { name: button }).click();
  await expect(page.locator(list === "Admissions" ? "#tab-coming" : "#tab-out")).toHaveAttribute("data-active", "true");
}

/**
 * Shows one part of the ward's Coming and going card: Referrals (awaiting this ward's answer),
 * Arrivals or Discharges. Wave 4 (D-191): the card sits in place on the Home tab on a phone and a
 * computer alike, with no list switch and no phone sheet, so this opens Home and finds the part.
 */
export async function openWardFlow(page: Page, pane: "Referrals" | "Admissions" | "Discharges") {
  const home = page.locator("#tabBtn-attn");
  if ((await home.getAttribute("aria-selected")) !== "true") await home.click();
  const card = page.getByTestId("ward-coming-and-going");
  // A list already open (All arrivals or All discharges) covers the card: go back to Ward home.
  const back = page.getByRole("button", { name: "Back to Ward home" });
  if (!(await card.isVisible()) && (await back.isVisible())) await back.click();
  await expect(card).toBeVisible();
  const heading = {
    Referrals: "ward-coming-referrals",
    Admissions: "ward-coming-arrivals",
    Discharges: "ward-coming-out",
  }[pane];
  await card.locator(`#${heading}`).scrollIntoViewIfNeeded();
}

/** Back to the ward's Home tab, where its bed figures live. */
export async function openWardHome(page: Page) {
  await page.locator("#tabBtn-attn").click();
  await expect(page.locator("#tabBtn-attn")).toHaveAttribute("aria-selected", "true");
}

/**
 * A ward's own occupied or ready figure, as its header shows it. Integration QA (3 Nov 2026): Ready
 * and Occupied sit once, in the hero, so desktop and phone both read the header's figures.
 */
export async function wardFigure(page: Page, figure: "occupied" | "ready"): Promise<number> {
  const wardScreen = page.getByTestId("ward-unit-screen");
  const region = wardScreen.getByRole("region", { name: "This ward", exact: true });
  if (figure === "occupied") {
    const match = /(\d+)\s*occupied/iu.exec(await region.innerText());
    expect(match, "the phone ward header must state how many beds are occupied").not.toBeNull();
    return Number(match![1]);
  }
  // H-0181: the name may end ", N being made ready" when a bed is being prepared. Page tops (9 Nov
  // 2026): the figure's word is lower case ("2 ready now") and its button is named by the figure and
  // the word together, so the number is read from that name.
  const ready = region.getByRole("button", { name: /^\d+ ready now\b/iu });
  const name = await ready.evaluate((element) => {
    const ids = (element.getAttribute("aria-labelledby") ?? "").split(/\s+/u).filter(Boolean);
    const parts = ids.map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "");
    return ids.length > 0 ? parts.join(" ") : (element.getAttribute("aria-label") ?? element.textContent ?? "");
  });
  const match = /^(\d+)/u.exec(name.trim());
  expect(match, "the phone ward header must state how many beds are ready now").not.toBeNull();
  return Number(match![1]);
}

/**
 * One ward's card on the coordinator's capacity board, as text. Since the Capacity redesign (31 Oct
 * 2026) every ward is a card on the bed map, on a computer and in the phone's Wards view alike, and
 * the card carries the ward's id.
 */
async function capacityCardText(page: Page, unitId: string, unitName: string): Promise<string> {
  if (isPhoneLayout(page)) {
    const wards = page.getByRole("radio", { name: /^Wards/u });
    if ((await wards.getAttribute("aria-checked")) !== "true") await wards.click();
  }
  const map = page.locator("#capacity-bed-map");
  await expect(map, `the bed map must show for ${unitId}`).toBeVisible();
  // Services past the first few start folded; open every one so the ward's card is drawn.
  // Each toggle is found by the panel it controls, which stays the same once it opens. Re-counting
  // folded buttons raced the re-render on a slow phone run: the count still saw the last one folded,
  // then the click waited the whole test for a button that had already opened (4 Nov 2026).
  const folded = await map
    .locator('button[aria-expanded="false"][aria-controls^="capacity-map-"]')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-controls") ?? ""));
  for (const panel of folded) {
    const toggle = map.locator(`button[aria-controls="${panel}"]`);
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
  // Found by the ward's id, not its text: the card spells out a site code in the name ("BTY
  // (Bentley Health Service) Adult Secure"), so the text does not start with the plain ward name.
  const card = map.locator(`button[aria-haspopup="dialog"][data-unit-id="${unitId}"]`).first();
  await expect(card, `the bed map must draw ${unitName}`).toBeVisible();
  return (await card.textContent()) ?? "";
}

/** Ready beds for one ward on the capacity board: a card reads "<ward> <N> ready", zero spelt "None". */
export async function capacityReady(page: Page, unitId: string, unitName: string): Promise<number> {
  const text = await capacityCardText(page, unitId, unitName);
  const match = /(\d+|None) ready/u.exec(text);
  expect(match, `the ${unitName} card must state its ready count: "${text}"`).not.toBeNull();
  return match![1] === "None" ? 0 : Number(match![1]);
}

/**
 * Beds one ward is still making ready, from its capacity card's note ("<N> being made ready", its
 * spaces non-breaking), shown only when there is one, so no note reads as 0. D-179 item 8: these
 * beds are not counted in Ready.
 */
export async function capacityBeingMadeReady(page: Page, unitId: string, unitName: string): Promise<number> {
  const match = /(\d+)\s+being\s+made\s+ready/u.exec(await capacityCardText(page, unitId, unitName));
  return match ? Number(match[1]) : 0;
}

/**
 * At a ward desk, opens the panel of the one bed still being made ready, where its Ready button
 * offers it again (A4-24); only then does it count as ready (D-179 item 8). Desktop: the bed's tile
 * in Ward home's Every bed board. Phone: its row in Ward home's round list opens the bed's round
 * card, whose Update this bed opens the same panel. Returns the open panel.
 */
export async function openBedBeingMadeReady(page: Page, unitName: string): Promise<Locator> {
  await openWardHome(page);
  const wardScreen = page.getByTestId("ward-unit-screen");
  // The bed's state word, capitalised, as only a bed's tile or row says it (the hero's figure says
  // "being made ready" in lower case).
  const beingMadeReady = /Being made ready/u;
  if (isPhoneLayout(page)) {
    const showMore = wardScreen.getByRole("button", { name: /^Show \d+ more beds?$/u });
    if (await showMore.isVisible()) await showMore.click();
    await wardScreen.getByTestId("ward-phone-round-list").getByRole("button", { name: beingMadeReady }).click();
    await wardScreen
      .getByTestId("ward-walk-round")
      .getByRole("button", { name: "Update this bed", exact: true })
      .click();
  } else {
    await wardScreen
      .getByRole("list", { name: `Beds at ${unitName}`, exact: true })
      .getByRole("button", { name: beingMadeReady })
      .click();
  }
  const bed = page.getByTestId("bed-telemetry-drawer");
  await expect(bed).toBeVisible();
  return bed;
}
