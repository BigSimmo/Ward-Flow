import { expect, test, type Locator, type Page } from "playwright/test";

import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";

/**
 * BROWSER COVERAGE OF THE WARD FLOW SHELL BAR (`WardBar`, `shell/ward-bar.tsx`, mounted with
 * `WardRail` in `src/app/mockups/ward-flow/layout.tsx` above every ward route).
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **THIS FILE CHANGED OWNER ON 2026-09-11. IT DID NOT CHANGE CONTRACT.**
 *
 * It was written against `WardChromeHeader` — the 2026-09-06 header the owner approved — and it
 * caught three measured faults in it. The third-edition shell replaces that header (master plan
 * §1.3 item 1.2: the shell mounts *"in place of `WardChromeHeader` + `WardShellHeader`"*; owner
 * question Q-6, *"may that spec be retired in favour of the third-edition shell test?"*, answered
 * **Yes**). **The properties below are not the old header's properties. They are the properties a
 * coordinator's header must have, whichever component draws it** — a visible search, a first
 * result that a real click actually reaches and navigates to, controls that open what they say
 * they open at every supported width, a last control that does not hide off the side of a phone,
 * a first control nothing is painted on top of, and a 48px tap-target floor. So every one of them
 * was re-pointed at `WardBar`, and **none of them was deleted to make the replacement land.**
 *
 * Two re-points had to change shape, and both are named here rather than quietly narrowed:
 *
 *   - **The old fault-3 test measured the PRIMARY ACTION staying on screen at 375px.** `WardBar`
 *     renders a primary action only when its caller resolves one, and `layout.tsx` resolves none
 *     yet (`ward-bar.tsx`'s own header records why: `WARD_PRIMARY_ACTIONS` is a different type of
 *     the same name and three of its five kinds carry no `href`). The action was the RIGHTMOST
 *     control, and "the rightmost control is not pushed off the side" is the property that
 *     actually broke. It is asserted here against whichever control is rightmost — today the Tools
 *     trigger — plus the same direct check that the bar carries no hidden horizontal overflow.
 *   - **The old pin-4 test measured `ClinicalRail`'s FIXED phone bar painting over the header.**
 *     No `<ClinicalRail>` is mounted anywhere in `src/` any more, and the third-edition rail is
 *     ordinary in-flow content at phone width (it reflows to a wrapping row above the bar). The
 *     property — *a tap at the first control's own centre reaches the first control* — is
 *     unchanged and still measured with `document.elementFromPoint`, which is the only instrument
 *     that knows about paint order. It simply no longer names a particular culprit.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **AND ONE PROPERTY IS NEW, BECAUSE ITS ABSENCE COST A FOLD.**
 *
 * The first attempt at this mount (`961ab6117a`) added the shell bar and left `WardChromeHeader`
 * mounted. Both render `WardGlobalSearch`, so **every ward route carried two search boxes, two
 * task controls and two place labels.** The offline suite (369 files, 4384 passing) and `tsc`
 * were both green throughout — neither can see a duplicated DOM node — and the fold was reverted
 * within the hour (`fbfc2bb00f`) off one line from a spec that had not been run:
 *
 *     strict mode violation: getByTestId('ward-global-search-input') resolved to 2 elements
 *
 * **"Exactly one", never "at least one".** Every presence check in this repository — including the
 * CONTROL test that used to head this file — passed happily while there were two of everything.
 * A count is the only assertion whose failure message can say *how many*, and the two tests below
 * that carry it also assert a count of ZERO for each retired control by name, so re-mounting the
 * old chrome reddens them from both directions.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * THE THREE ORIGINAL FAULTS, KEPT HERE BECAUSE THE EVIDENCE IS WHAT MAKES THE ASSERTIONS THE
 * RIGHT SHAPE, and because two of the three recurred on the new owner and were fixed in the same
 * change as this rewrite:
 *
 *   1. The search results popup was clipped and unclickable at every width. At 1440x900 on
 *      `/mockups/ward-flow/delays` with a query typed, the popup ran from y=108 to y=492 while its
 *      scroll-container ancestor was only 114.5px tall — 377px of the popup was clipped, and
 *      `document.elementFromPoint` at the popup's own centre resolved to the sidebar, not the
 *      popup. 12 results existed; 0 were reachable by mouse. Asserted below as an actual
 *      Playwright `.click()` on the first result followed by a real navigation, never a mere
 *      DOM-presence check — a `.toBeVisible()`-only test would have passed throughout the entire
 *      defect, because the clipped element was still visible inside its own (invisible) overflow.
 *
 *   2. The search box escaped its own container and covered the buttons below ~1024px. Measured
 *      at 768x900 on the old header: the search control overlapped two buttons and
 *      `elementFromPoint` at the centre of both resolved to the search input. Asserted below as a
 *      real click on each control followed by proof that the thing it opens actually opened —
 *      reachability, not presence.
 *
 *   3. The header overflowed horizontally and pushed its last control off-screen on a phone. On
 *      the OLD header: `scrollWidth` 490 against `clientWidth` 375. **On the NEW bar, measured
 *      2026-09-11 before this rewrite: `scrollWidth` 506 against `clientWidth` 375, the search
 *      input 0px wide, and the Tasks and Tools triggers at x=368 and x=449 — off a 375px screen,
 *      with `documentElement.scrollWidth` still 375, so the page never scrolled and the overflow
 *      hid inside the bar's own box.** `ward-bar.module.css` gained `flex-wrap: wrap` and the
 *      drawing's own `flex: 1 1 14rem; min-width: 10rem` on `.searchWrap` in the same change; 768,
 *      1024, 1280 and 1440 re-measured byte-identical to before it.
 *
 * PIN 5 (unchanged in substance): every interactive control meets this repository's **48px**
 * production tap-target floor — not the generic 44px WCAG minimum (`AGENTS.md`'s own note on the
 * `ui-smoke` flake that reintroducing 44px caused) — asserted with `toBeGreaterThanOrEqual` so a
 * legitimately taller control never reddens this file.
 *
 * FIXTURE: `/mockups/ward-flow/delays` is the exact route the original audit measured faults 1-3
 * against. The click test searches "Halloway", the family name on PT-001 (Talia Halloway,
 * `ward-patients-seed.ts`). A single letter "a" now ranks word-start names ahead of a buried
 * match and keeps six people, so Talia is no longer in that short list. The family name still
 * renders `ward-global-search-result-person-PT-001` and is what the click follows.
 *
 * Selectors are `data-testid` hooks (this codebase's own established convention — see every
 * `ui-ward-*.spec.ts`) or ARIA role/name, never a CSS Module class name, because those are hashed.
 */

const DELAYS_ROUTE = "/mockups/ward-flow/delays";
const PUBLISHED_CHECKS_ROUTE = "/mockups/ward-flow/movements";

/**
 * A spread of route SHAPES, not a sample of pages: the coordinator home (no place), the audit's
 * own fixture, a place-resolving ward route (the three routes where `wardPlaceFor` returns a name
 * are the only ones that ever carried TWO place labels), a form route, and a statistics route.
 * The duplication the count below exists for was global — it was on all thirty-six routes — so
 * this does not need to be exhaustive to catch it; it needs to span the shapes whose chrome
 * differs.
 */
const COUNTED_ROUTES = [
  "/mockups/ward-flow",
  DELAYS_ROUTE,
  "/mockups/ward-flow/ward/rph-adult-secure",
  "/mockups/ward-flow/referrals/new",
  "/mockups/ward-flow/statistics/overview",
  PUBLISHED_CHECKS_ROUTE,
] as const;

/**
 * One of each. `data-testid` is the unit, because it is the one thing a second mount of the same
 * component cannot help duplicating — a class name can be scoped away, a role can be relabelled,
 * but two `WardGlobalSearch` elements are two `ward-global-search-input`s.
 */
const EXACTLY_ONE: ReadonlyArray<readonly [string, string]> = [
  ["ward-rail", "the rail"],
  ["ward-bar", "the shell bar"],
  ["ward-global-search-input", "the search input"],
  ["ward-global-search", "the search control"],
  ["ward-bar-service-trigger", "the Service selector"],
  ["ward-bar-activity-trigger", "the Activity (figures) control"],
  ["ward-bar-tasks-trigger", "the Tasks control"],
  ["ward-bar-tools-trigger", "the Tools control"],
  ["ward-live-region", "the shell's polite announcer"],
];

/**
 * The retired second-edition chrome, named one control at a time. **A count of one on the shell's
 * own controls would not have caught the reverted fold on its own** — `ward-bar` was correctly
 * singular throughout it; what was doubled was the FUNCTION (a search box, a task control, a
 * place label), carried by a different component with different testids. So the zero-count is not
 * belt-and-braces: it is the half of the assertion that names the actual defect.
 */
const EXACTLY_ZERO: ReadonlyArray<readonly [string, string]> = [
  ["ward-chrome-header", "the retired 2026-09-06 header row"],
  ["ward-stats-toggle", "the retired Figures toggle"],
  ["ward-stats-panel", "the retired Figures panel"],
  ["ward-standing-strip", "the retired standing figures strip"],
  ["ward-tasks-opener", "the retired second task control"],
  ["ward-chrome-action", "the retired role-adaptive action"],
  ["ward-chrome-handover", "the retired Handover link"],
  ["ward-chrome-freshness", "the retired freshness sentence"],
  ["ward-shell-header", "the retired place-label row"],
  ["ward-shell-place", "the retired second place label"],
];

async function gotoWardChrome(page: Page, path: string = DELAYS_ROUTE): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  // The same streamed-content guard every other Ward Flow spec in this repo uses (see
  // ui-ward-search.spec.ts, ui-ward-discharges.spec.ts, ui-ward-roles.spec.ts): React's streaming
  // leaves a hidden staging copy of the whole screen in the document for a moment, duplicating
  // every testid and making both geometry and COUNTS measured against it meaningless.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("ward-bar")).toBeVisible({ timeout: 15_000 });
}

function searchInput(page: Page): Locator {
  return page.getByTestId("ward-global-search-input");
}

function searchPopup(page: Page): Locator {
  return page.getByTestId("ward-global-search-popup");
}

/**
 * Every control in the bar that opens something, paired with the thing it must open. The Service
 * selector is a popover the bar manages itself; the other three are `<Sheet placement="right">`
 * drawers, which render nothing at all while closed.
 *
 * ⚠️ **THE UNWIRED PRIMARY-ACTION POPOVER (item 43, `ward-bar-primary-action` /
 * `ward-bar-primary-panel` for the `record-decision` / `contact-team` / `export-figures` kinds)
 * IS DELIBERATELY NOT A ROW HERE.** Every row below is asserted against the SAME default route
 * (`DELAYS_ROUTE`, via `gotoWardChrome(page)`) across several tests in this file — the CONTROL
 * test, the fault-2 open/Escape loop and the tap-target floor test all iterate OPENERS at one
 * route. Delays resolves no primary action at all (`ward-nav.ts`'s `WARD_PRIMARY_ACTIONS` covers
 * only Movements, a Community team and Statistics for these three kinds), so adding that row here
 * would fail all three for a trigger Delays never renders. See the dedicated
 * "item 43: the unwired primary action's popover" suite at the end of this file instead, which
 * visits each kind's own route.
 */
const OPENERS: ReadonlyArray<readonly [string, string, string]> = [
  ["ward-bar-service-trigger", "ward-bar-service-panel", "the Service selector"],
  ["ward-bar-activity-trigger", "ward-bar-activity-sheet", "the Activity drawer"],
  ["ward-bar-tasks-trigger", "ward-bar-tasks-sheet", "the Tasks drawer"],
  ["ward-bar-tools-trigger", "ward-bar-tools-sheet", "the Tools drawer"],
];

test.describe("@mockup Ward shell bar", () => {
  test.describe.configure({ timeout: 90_000 });

  /**
   * THE CONTROL. Confirms the harness, the dev server and the route itself all work, and that
   * every control this file exercises is actually mounted, before any geometric assertion below
   * is trusted — the same method note `ui-ward-search.spec.ts` records: a red result from a broken
   * harness proves nothing about the faults this file exists to catch.
   */
  test("CONTROL: the shell bar renders search, the Service selector and the three drawer triggers", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWardChrome(page);

    await expect(searchInput(page)).toBeVisible();
    for (const [testId, label] of OPENERS.map(([t, , l]) => [t, l] as const)) {
      await expect(page.getByTestId(testId), `${label} is not visible`).toBeVisible();
    }
    await expect(page.getByTestId("ward-rail")).toBeVisible();
  });

  test("Action workspace keeps the shared navigation and page design", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/mockups/ward-flow/delays", { waitUntil: "networkidle" });
    const readChrome = async () => {
      const elements = ["ward-rail", "ward-bar", "ward-delays-page"];
      return Promise.all(
        elements.map((id) =>
          page.getByTestId(id).evaluate((element) => {
            const box = element.getBoundingClientRect();
            return { x: box.x, width: box.width, background: getComputedStyle(element).backgroundColor };
          }),
        ),
      );
    };
    const before = await readChrome();
    const graph = page.getByRole("region", { name: "Delay graphs", exact: true });
    const graphWidth = (await graph.boundingBox())!.width;
    await page.getByRole("tab", { name: /Action workspace/u }).click();
    await expect(page.getByRole("complementary", { name: "Responsible team queues" })).toBeVisible();
    await expect.poll(readChrome).toEqual(before);
    expect((await graph.boundingBox())!.width).toBe(graphWidth);
    await page.getByRole("tab", { name: /Focus table/u }).click();
    await expect(page.getByRole("complementary", { name: "Responsible team queues" })).toHaveCount(0);
    await expect.poll(readChrome).toEqual(before);
  });

  /**
   * 🔴 **THE CHECK THAT WOULD HAVE CAUGHT THE REVERTED FOLD.** `toHaveCount(1)`, never
   * `toBeVisible()`. Read this file's header for the full account; the short version is that the
   * fold shipped two of everything and every presence check in the repository stayed green.
   *
   * Both halves are load-bearing. The count of ONE catches a second mount of the SAME component;
   * the count of ZERO catches a second mount of a DIFFERENT component doing the same job, which
   * is what actually happened.
   */
  for (const width of [1440, 800, 375]) {
    test(`exactly one of each shell control, and none of the retired chrome, on every route shape at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });

      /*
       * 🔴 **THE ANTI-VACUITY FLOOR, AND IT IS ON THE POPULATION, NEVER ON THE FINDINGS.** Both
       * loops below iterate a list declared at the top of this file. An emptied list — or a route
       * list somebody trimmed while debugging — would make this test pass having counted nothing,
       * which is the failure that looks exactly like success and is precisely the shape of
       * blindness that let two search boxes ship. These three ask only whether there is still
       * something to count.
       */
      expect(COUNTED_ROUTES.length, "no routes to count on").toBeGreaterThan(2);
      expect(EXACTLY_ONE.length, "no shell controls are being counted").toBeGreaterThan(5);
      expect(EXACTLY_ZERO.length, "no retired control is being checked for absence").toBeGreaterThan(5);

      for (const route of COUNTED_ROUTES) {
        await gotoWardChrome(page, route);

        for (const [testId, label] of EXACTLY_ONE) {
          await expect(
            page.getByTestId(testId),
            `${label} (${testId}) must appear EXACTLY ONCE on ${route} at ${width}px. Two means ` +
              "the coordinator has two places to do one thing and no way to know which one the " +
              "screen is listening to; zero means the shell did not mount here at all.",
          ).toHaveCount(1);
        }

        for (const [testId, label] of EXACTLY_ZERO) {
          await expect(
            page.getByTestId(testId),
            `${label} (${testId}) is retired and must not render on ${route} at ${width}px — the ` +
              "shell bar owns this function now, and two owners on one screen is the defect that " +
              "reverted this mount the first time",
          ).toHaveCount(0);
        }

        // Keep the approved compact neutral status distinct from a published verdict.
        // Movements publishes actual checks, so its result must still appear once.
        const reconciliation = page.getByTestId("ward-reconciliation-line");
        if (route === PUBLISHED_CHECKS_ROUTE) {
          await expect(reconciliation, "the published reconciliation verdict must appear once").toHaveCount(1);
          await expect(reconciliation).toHaveText("Invented figures, reconciled with each other.");
          await expect(reconciliation).toHaveAttribute("data-tone", "good");
          if (width === 800) {
            await page.getByRole("button", { name: "Menu", exact: true }).focus();
            await page.keyboard.press("Enter");
            await expect(reconciliation).toHaveCount(1);
            await expect(reconciliation).toBeVisible();
            await expect(reconciliation).toHaveText("Invented figures, reconciled with each other.");
            await expect(reconciliation).toHaveAttribute("data-tone", "good");
            await page.keyboard.press("Escape");
            await expect(page.getByTestId("ward-rail-more-pages")).toHaveCount(0);
          }
        } else {
          await expect(reconciliation, "the unpublished status must appear once").toHaveCount(1);
          await expect(reconciliation).toHaveText("Reconciliation not published");
          await expect(reconciliation).toHaveAttribute("data-tone", "neutral");
        }
        await expect(page.getByText("No reconciliation is available for this page yet.", { exact: true })).toHaveCount(
          0,
        );
      }

      // Compact layouts keep shift context in Menu; measure the status where users read it.
      // Tablet coverage uses keyboard activation: its existing Menu pointer target sits outside the viewport.
      await gotoWardChrome(page, DELAYS_ROUTE);
      const menu = page.getByRole("button", { name: "Menu", exact: true });
      if (width === 800) {
        await menu.focus();
        await page.keyboard.press("Enter");
      } else if (width === 375) await menu.click();
      await expect(page.getByTestId("ward-reconciliation-line")).toHaveCount(1);
      const visibleStatus = page.getByTestId("ward-reconciliation-line").filter({ visible: true });
      await expect(visibleStatus).toHaveCount(1);
      await expect(visibleStatus).toHaveText("Reconciliation not published");
      const fits = await visibleStatus.evaluate((line) => {
        const text = line.querySelector("span:last-child");
        if (!text) return false;
        const range = document.createRange();
        range.selectNodeContents(text);
        const bounds = line.getBoundingClientRect();
        const rects = Array.from(range.getClientRects());
        return (
          rects.length > 0 &&
          rects.every(
            (rect) =>
              rect.width > 1 &&
              rect.left >= bounds.left - 1 &&
              rect.right <= bounds.right + 1 &&
              rect.left >= 0 &&
              rect.right <= window.innerWidth &&
              line.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)),
          )
        );
      });
      expect(fits, "the reconciliation sentence must wrap within its line and remain unobscured").toBe(true);
      if (width <= 1000) {
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("ward-rail-more-pages")).toHaveCount(0);
        await expect(menu).toBeFocused();
        await expect(page.getByTestId("ward-reconciliation-line")).toHaveCount(1);
        await expect(visibleStatus).toHaveCount(width === 800 ? 1 : 0);
      }
    });
  }

  /**
   * FAULT 1. The popup must be genuinely reachable, not merely present in the DOM. `.click()`
   * carries Playwright's own actionability checks (visible, stable, receives events, not covered
   * by another element) before it fires — exactly the property `elementFromPoint` measured as
   * broken in the audit, so a real click is the right instrument, and a click landing anywhere
   * other than the intended result would be an actionability timeout, not a silent false pass.
   *
   * The click is a real, unmodified left click on the actual `<a>` `next/link` renders (per
   * `ward-global-search.tsx`'s own doc comment, this control intercepts navigation only when a
   * test supplies `onNavigate`, which real usage — and this test — never does), so it proves the
   * FULL path: the row is visible, it is hittable, and the browser actually follows the link.
   * `expect(page).toHaveURL(...)` polls rather than trusting a fixed sleep, per this repo's
   * zero-retry Playwright policy.
   */
  test("the first search result is visible and clickable, and a click actually navigates to it", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWardChrome(page);

    await searchInput(page).fill("Halloway");
    await expect(searchPopup(page)).toBeVisible();

    const firstResult = page.getByTestId("ward-global-search-result-person-PT-001");
    await expect(
      firstResult,
      "the first result must be genuinely visible, not merely present behind a clipped ancestor",
    ).toBeVisible();

    // A real, unmodified click — not a DOM presence check. If the popup is clipped by an
    // ancestor's scroll box (fault 1's exact shape), Playwright's actionability check fails this
    // click outright rather than silently succeeding against an unreachable element.
    await firstResult.click();
    await expect(page, "clicking the first visible result must navigate to that person's own record").toHaveURL(
      /\/mockups\/ward-flow\/people\/PT-001(?:$|[/?#])/,
      { timeout: 10_000 },
    );
  });

  /**
   * FAULT 2. Below ~1024px the old header's search control used to escape its own grid column and
   * physically cover the buttons beside it, so `elementFromPoint` at the centre of both resolved
   * to the search input rather than either button. A real `.click()` on each — followed by proof
   * of what that control is actually supposed to open — is the right instrument for the same
   * reason as fault 1: reachability, not presence, is the property that broke.
   *
   * Four widths, not one: 1280 and 1024 bracket the point the old search control's `flex-basis`
   * used to derive itself from the header's own width; 768 is the exact width the audit measured
   * the overlap at; 375 is the narrowest supported width, where the bar has wrapped onto a second
   * line and the drawer triggers sit on their own row entirely.
   *
   * ⚠️ **EACH PANEL IS CLOSED BEFORE THE NEXT IS OPENED, AND THAT IS NOT TIDINESS.** The three
   * drawers are `<Sheet>`s, which mark the rest of the page `inert` while open (see
   * `sheet-focus.ts`) — a click on the next trigger would then fail as an actionability timeout
   * for a reason that has nothing to do with the property under test. Escape is the shell's own
   * documented close (`ward-bar.tsx`'s Escape order), so closing this way exercises the real path
   * rather than reaching around it.
   *
   * Each width gets a fresh navigation so no panel state can leak into the next width's
   * assertions.
   */
  for (const width of [1280, 1024, 768, 375]) {
    test(`every control in the bar is clickable and opens its own panel at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoWardChrome(page);

      for (const [triggerId, panelId, label] of OPENERS) {
        const trigger = page.getByTestId(triggerId);
        const panel = page.getByTestId(panelId);

        await expect(panel, `${label} must start closed`).toHaveCount(0);
        await trigger.click();
        await expect(
          panel,
          `${label} did not open after a real click on ${triggerId} at ${width}px — the control ` +
            "exists in the DOM but a real click could not reach it, or reached the wrong element",
        ).toBeVisible();

        await page.keyboard.press("Escape");
        await expect(panel, `${label} did not close on Escape at ${width}px`).toHaveCount(0);
      }
    });
  }

  /**
   * FAULT 3, on the new owner. Two properties, both about a control escaping the visible bar:
   *   - the RIGHTMOST control's bounding box must lie entirely inside the 375px viewport (not
   *     merely `toBeVisible()`, which is true for an element most of which is scrolled off-screen
   *     inside its own ancestor — exactly what was measured here on 2026-09-11: the Tools trigger
   *     at x=449 on a 375px screen);
   *   - the bar itself must carry no hidden horizontal overflow (`scrollWidth` no more than a
   *     rounding hair past `clientWidth`) — the root cause on both owners, and the reason the
   *     document's own scrollbar never appears to report it.
   *
   * ⚠️ **"RIGHTMOST", NOT "THE PRIMARY ACTION".** The old header always rendered a role-adaptive
   * action link and this test named it. `WardBar` renders a primary action only when its caller
   * resolves one and `layout.tsx` resolves none yet, so naming it here would make this test pass
   * by finding nothing. It is computed from the rendered boxes instead, which is the property the
   * audit actually measured and which survives whatever the last control turns out to be.
   */
  test("the bar's rightmost control stays fully on screen and the bar carries no hidden horizontal overflow at 375px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoWardChrome(page);

    const boxes: { label: string; x: number; right: number }[] = [];
    for (const [testId, , label] of OPENERS) {
      const box = await page.getByTestId(testId).boundingBox();
      expect(box, `${label} has no measurable box at 375px`).not.toBeNull();
      boxes.push({ label, x: box!.x, right: box!.x + box!.width });
    }
    expect(boxes.length, "no bar controls were measured, so this test compared nothing").toBeGreaterThan(0);

    const rightmost = boxes.reduce((worst, candidate) => (candidate.right > worst.right ? candidate : worst));
    expect(rightmost.x, `${rightmost.label} starts left of the viewport`).toBeGreaterThanOrEqual(0);
    expect(
      rightmost.right,
      `${rightmost.label} extends to ${Math.round(rightmost.right)}px, past the 375px viewport`,
    ).toBeLessThanOrEqual(376);

    const overflow = await page.getByTestId("ward-bar").evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(
      overflow.scrollWidth - overflow.clientWidth,
      `the bar's own scrollWidth (${overflow.scrollWidth}) exceeds its clientWidth ` +
        `(${overflow.clientWidth}) at 375px — content is hiding inside the bar's own scroll box ` +
        "rather than wrapping onto a new line or being visible",
    ).toBeLessThanOrEqual(2);
  });

  /**
   * PIN 4, generalised. The original named `ClinicalRail`'s `.phoneBar` (`position: fixed;
   * z-index: 30`) as the thing painting over the header's first control at phone width. No
   * `<ClinicalRail>` is mounted anywhere in `src/` any more, so the culprit is gone — but the
   * PROPERTY is about paint order, not about that one element, and a bar sitting under any fixed
   * sibling would be equally untappable.
   *
   * `elementFromPoint` at the first control's own centre is the direct instrument: it returns
   * whichever element the browser would actually deliver a real tap to at that point, which is
   * exactly the property a bounding-box-only check (which knows nothing about paint order or an
   * overlapping fixed sibling) cannot see.
   */
  test("the bar's first control is not painted over by anything at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoWardChrome(page);

    const firstControl = page.getByTestId("ward-global-search");
    await expect(
      firstControl,
      "`ward-bar.tsx` renders the search control as the first INTERACTIVE thing in the row — if " +
        "this fails, the bar's own render order changed and this test's premise (which control " +
        "is 'first') needs updating with it, not weakening",
    ).toBeVisible();

    const hit = await firstControl.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const target = document.elementFromPoint(cx, cy);
      return {
        reachesControl: target !== null && (el === target || el.contains(target)),
        hitDescription: target ? `${target.tagName.toLowerCase()}.${Array.from(target.classList).join(".")}` : null,
        rect: { top: Math.round(rect.top), bottom: Math.round(rect.top + rect.height) },
      };
    });

    expect(
      hit.reachesControl,
      "a tap at the bar's first control's own centre resolves to " +
        `${hit.hitDescription} instead of the control itself (control spans y=${hit.rect.top}-` +
        `${hit.rect.bottom}) — something else is painted on top of it`,
    ).toBe(true);
  });

  /**
   * PIN 5. This repository's production tap-target floor is 48px, not the generic 44px WCAG
   * minimum (`AGENTS.md`'s own note on the `ui-smoke` flake that reintroducing 44px caused) — and
   * it is a FLOOR, asserted with `toBeGreaterThanOrEqual`, never an exact equality, so a
   * legitimately taller control never reddens this test.
   *
   * Three widths: 1440 (no wrapping), 768 (the audit's own overlap width), and 375 (narrowest
   * supported, where the bar has wrapped onto a second line).
   */
  for (const width of [1440, 768, 375]) {
    test(`every interactive control in the bar meets the 48px tap-target floor at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoWardChrome(page);

      const controls: ReadonlyArray<readonly [Locator, string]> = [
        [searchInput(page), "the global search input"],
        ...OPENERS.map(([testId, , label]) => [page.getByTestId(testId), label] as const),
      ];

      const failures: string[] = [];
      for (const [control, label] of controls) {
        await expect(control, `${label} is not visible at ${width}px`).toBeVisible();
        const box = await control.boundingBox();
        expect(box, `${label} has no measurable box at ${width}px`).not.toBeNull();
        const smallerDimension = Math.min(box!.width, box!.height);
        if (smallerDimension < 48) {
          failures.push(`${label}: ${Math.round(box!.width)}x${Math.round(box!.height)}px`);
        }
      }

      expect(failures, `control(s) under the 48px production tap-target floor at ${width}px (width x height)`).toEqual(
        [],
      );
    });
  }
});

/**
 * ITEM 43 (build plan A1, owner answers 2026-09-17): the three "not wired" primary-action kinds
 * (`record-decision`, `contact-team`, `export-figures` — `ward-bar.tsx`'s D-16 comment) now open
 * their own popover, headed by the control's own label with the body EXACTLY "Not wired in this
 * prototype." — not only the SR-only announcement `tests/ward-primary-action.dom.test.tsx` and
 * `tests/ward-shell-third-edition.dom.test.tsx`'s offline suites already cover. This is the one
 * browser-level proof that a real click actually reaches the trigger and a real Escape actually
 * closes the popover and returns focus, the same reachability property the rest of this file
 * exists to prove for the bar's other controls (see the file header).
 *
 * The community route uses `COMMUNITY_TEAM_PAGES[0]` — a REAL derived team, never a hand-typed
 * placeholder id that could stop matching `ward-nav.ts`'s `community/[teamId]` route.
 */
const UNWIRED_PRIMARY_ROUTES: ReadonlyArray<readonly [string, string, string]> = [
  ["/mockups/ward-flow/movements", "Record a decision", "Movements"],
  [`/mockups/ward-flow/community/${COMMUNITY_TEAM_PAGES[0]!.id}`, "Contact a team", "a community team"],
  ["/mockups/ward-flow/statistics", "Export the figures", "Statistics"],
];

test.describe("@mockup Ward shell bar — item 43: the unwired primary action's popover", () => {
  test.describe.configure({ timeout: 90_000 });

  // Anti-vacuity: if a route stopped resolving one of these three kinds, every test below would
  // simply find no trigger and fail loudly at the first `toBeVisible()` — but that failure would
  // name the wrong thing, so state the premise once, explicitly.
  test("CONTROL: all three routes are still covered by this list", () => {
    expect(UNWIRED_PRIMARY_ROUTES.length).toBe(3);
    expect(new Set(UNWIRED_PRIMARY_ROUTES.map(([, label]) => label)).size).toBe(3);
  });

  for (const [route, label, routeLabel] of UNWIRED_PRIMARY_ROUTES) {
    test(`on ${routeLabel}, clicking "${label}" shows the visible text exactly "Not wired in this prototype.", and Escape closes it with focus returning to the button`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoWardChrome(page, route);

      const trigger = page.getByTestId("ward-bar-primary-action");
      await expect(trigger, `the primary action is not visible on ${route}`).toBeVisible();
      await expect(trigger).toHaveText(label);

      const panel = page.getByTestId("ward-bar-primary-panel");
      await expect(panel, `${label}'s popover must start closed`).toHaveCount(0);

      // A real click, not a DOM presence check — the same instrument the rest of this file uses
      // for the identical reason: reachability, not presence, is the property that matters.
      await trigger.click();
      await expect(panel, `${label}'s popover did not open after a real click on its trigger`).toBeVisible();
      await expect(
        panel.getByText("Not wired in this prototype.", { exact: true }),
        `${label}'s popover must show the visible text exactly "Not wired in this prototype."`,
      ).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(panel, `${label}'s popover did not close on Escape`).toHaveCount(0);
      await expect(trigger, "focus did not return to the trigger after Escape").toBeFocused();
    });
  }
});

test("@mockup drawer workspace keeps Figures focus and every task reachable on a short phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await gotoWardChrome(page);
  const bar = page.getByTestId("ward-bar");
  await expect(bar.getByTestId("ward-bar-figures-trigger")).toHaveCount(0);
  await page.getByTestId("ward-bar-tools-trigger").click();
  const tools = page.getByRole("dialog", { name: "Tools" });
  await tools.getByTestId("ward-bar-figures-trigger").click();
  const figures = tools.getByRole("button", { name: "Figures", exact: true });
  await expect(figures).toHaveAttribute("aria-pressed", "true");
  await expect(figures).toBeFocused();
  await expect(tools.getByTestId("ward-stats-drawer-content")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("ward-bar-tools-trigger")).toBeFocused();

  await page.getByTestId("ward-bar-tasks-trigger").click();
  const tasks = page.getByRole("dialog", { name: "Tasks", exact: true });
  expect(await tasks.locator("li").count()).toBeGreaterThan(0);
  const scroller = tasks.locator('[class*="drawerBody"]');
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const lastCard = tasks.locator("li").last();
  await expect(lastCard).toBeInViewport();
  await expect(tasks.getByRole("button", { name: "Close tasks panel" })).toBeInViewport();
  await lastCard.getByRole("button", { name: "Open patient" }).click();
  await expect(page).toHaveURL(/\/movements\/WF-/u);
  await expect(tasks).toHaveCount(0);
});

test("@mockup compact Referrals opens from Tools and retains a draft across sections", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await gotoWardChrome(page, "/mockups/ward-flow/delays");
  const toolsTrigger = page.getByTestId("ward-bar-tools-trigger");
  await toolsTrigger.click();
  const tools = page.getByRole("dialog", { name: "Tools", exact: true });
  const toolsBox = await tools.boundingBox();
  expect(toolsBox?.height).toBeGreaterThanOrEqual(566);
  await tools.getByRole("button", { name: /Raise a referral/u }).click();
  const referral = page.getByRole("dialog", { name: "Referrals", exact: true });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const sections = referral.getByRole("group", { name: "Referral sections" });
  await sections.getByRole("button", { name: "Referral", exact: true }).click();
  await referral.locator("#refDocInput").fill("Synthetic draft clinician");
  await sections.getByRole("button", { name: "Locations", exact: true }).click();
  await expect(referral.getByRole("list", { name: "Placement Destination Options" })).toBeVisible();
  await sections.getByRole("button", { name: "Referral", exact: true }).click();
  await expect(referral.locator("#refDocInput")).toHaveValue("Synthetic draft clinician");
  await sections.getByRole("button", { name: "Locations", exact: true }).click();
  await page.keyboard.press("/");
  await expect(sections.getByRole("button", { name: "Patient", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(referral.getByRole("searchbox", { name: "Search sample patients" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(referral).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(referral).toHaveCount(0);
  await expect(toolsTrigger).toBeFocused();
});
