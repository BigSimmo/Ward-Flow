import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "playwright/test";
import ts from "typescript";

import { WARD_VIEWS } from "@/components/ward-management/ward-nav";

// Read the authoritative declaration without importing its React/CSS component graph into
// Playwright's Node-side collector. The unit chrome contract also checks it against real routes.
const workspaceSource = ts.createSourceFile(
  "ward-management-modes.tsx",
  readFileSync(path.join(__dirname, "../src/components/ward-management/ward-management-modes.tsx"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const workspaceDeclarations = workspaceSource.statements.flatMap((statement) =>
  ts.isVariableStatement(statement) &&
  statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ? statement.declarationList.declarations.filter(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === "WARD_WORKSPACE_MODES",
      )
    : [],
);
if (workspaceDeclarations.length !== 1) throw new Error("Expected one exported WARD_WORKSPACE_MODES declaration");
let workspaceExpression = workspaceDeclarations[0]!.initializer;
while (
  workspaceExpression &&
  (ts.isAsExpression(workspaceExpression) ||
    ts.isSatisfiesExpression(workspaceExpression) ||
    ts.isParenthesizedExpression(workspaceExpression))
)
  workspaceExpression = workspaceExpression.expression;
if (!workspaceExpression || !ts.isArrayLiteralExpression(workspaceExpression))
  throw new Error("WARD_WORKSPACE_MODES must remain a literal array for browser collection");
const WARD_WORKSPACE_MODES = workspaceExpression.elements.map((element) => {
  if (!ts.isStringLiteral(element)) throw new Error("WARD_WORKSPACE_MODES must contain only string literals");
  return element.text;
});
if (new Set(WARD_WORKSPACE_MODES).size !== WARD_WORKSPACE_MODES.length)
  throw new Error("WARD_WORKSPACE_MODES must not contain duplicates");

const PATH = "/ward-flow";

/**
 * B1 (Josh, 19 Oct 2026): the rail shows the desk's own short menu and keeps every other page under
 * More, so a rail link is clicked where it is on screen, opening More first when it is not inline.
 */
async function clickRailLink(page: Page, href: string) {
  const link = page.locator(`[data-testid="ward-rail-link"][href="${href}"]:visible`).first();
  if (!(await link.isVisible())) await page.getByTestId("ward-rail-more").click();
  await link.click();
}

async function gotoWardFlow(page: Page) {
  await page.goto(PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="ward-coordinator"]:visible')).toHaveCount(1, { timeout: 15_000 });
  // The console is visible from the first paint, but this dev environment settles the route
  // shortly after (a second same-URL navigation event follows the first). A click issued in
  // that window can be lost even though every element is already visible and stable, so wait
  // for network activity to quiesce — the one reliable, non-arbitrary signal available here —
  // before the first interaction.
  await page.waitForLoadState("networkidle");
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
}

/**
 * `document.documentElement` can never report an overflow on the coordinator route — `.screen`
 * sets `overflow: hidden` — so `expectNoPageOverflow` alone cannot catch a track inside the
 * region grid running wider than its box (Task 3 review Important 1). Only meaningful on
 * /ward-flow itself, where the region grid testid exists.
 */
async function expectNoRegionGridOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const grid = document.querySelector('[data-testid="ward-coordinator-region-grid"]');
    if (!grid) return null;
    return grid.scrollWidth - grid.clientWidth;
  });
  expect(overflow).not.toBeNull();
  expect(overflow).toBeLessThanOrEqual(2);
}

test.describe("@mockup Ward Flow command view", () => {
  test.describe.configure({ timeout: 45_000 });

  // "supports role-aware queue review and human-confirmed destination choice" and "collapses
  // the queue, opens the action inbox, and reaches the patient workspace" asserted against
  // WardManagementConsole, which Task 3 stopped rendering at /ward-flow. That component is
  // unreferenced and Task 9 deletes it; the equivalent coverage on the coordinator screen has no
  // home yet. See the fixme placeholders in tests/ui-ward-coordinator.spec.ts.
  //
  // Task 9 retires Constellation into the coordinator screen. Its own behaviour (the
  // ward-constellation gate check, the WF-002 confirm journey) already has a home: the confirm
  // journey and the failing-gate icon guard both live in tests/ui-ward-coordinator.spec.ts
  // ("shows a failing gate as a failure and never auto-allocates"), so the Constellation step is
  // removed here rather than repointed — leaving it would assert a route that no longer exists.

  /**
   * This test performs one page load plus seven sequential route navigations. Against a dev
   * server, which compiles each route on demand, that costs ~3.8 s warm and ~15.2 s cold,
   * measured at HEAD `12f17b13a`. The failures previously recorded here as a flake are
   * consistent with budget exhaustion on a machine running the same gate ~6x slower — that
   * surfaces at whichever mode link the clock happens to expire on, and it is not a weakening
   * of any assertion here. CI runs this spec against a production build, which
   * scripts/run-playwright.mjs builds and serves, so no on-demand compilation happens there and
   * the larger allowance below costs CI nothing.
   *
   * What the larger allowance does cost: playwright.config.ts sets no actionTimeout or
   * navigationTimeout, so a genuinely hung navigation in this one test now burns 120 s rather
   * than 45 s before failing — worst case about +75 s on a Chromium-only PR shard and about
   * +225 s across the three browsers of verify:release, both well inside those jobs' budgets.
   */
  test("opens every Ward Flow mode", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoWardFlow(page);

    // This only proves every remaining mode link still opens its route; per-mode behaviour is
    // covered by each mode's own tests elsewhere.
    //
    // MERGE 01 (2026-09-05): "Priority queue" and "Exceptions" both used to answer "why is this
    // person still waiting?" from two different lenses. `DelaysScreen` now answers that question
    // once, at `/delays`, and the `queue`/`exceptions` mode links collapsed into a single "Delays"
    // link (see WARD_VIEWS in ward-nav.ts). `/delays` is a standalone route rather than a
    // WardModeWorkspace mode, so it carries its own `data-testid="ward-delays-page"` rather than a
    // `ward-mode-*` id.
    // ⚠️ LABELS COME FROM `WARD_VIEWS`, NOT FROM THIS FILE. A hand-listed label is a page-design
    // literal, and these screens are redesigned repeatedly — MERGE 01 alone broke eight assertions
    // across the suite, every one of them a count, a label or a route somebody had typed into a
    // test. Deriving the labels means a rename carries this test with it, while it still catches
    // the thing that matters: the rail rendering something other than what `ward-nav.ts` declares.
    //
    // Only the id-to-testid mapping stays local, because a test hook is a test concern and is
    // genuinely not navigation data. `queue` maps to `ward-delays-page` because MERGE 01 pointed
    // that entry at `/delays`, a standalone route rather than a WardModeWorkspace mode.
    const testIdByView: Record<string, string> = {
      /*
       * 🔴 **THIS KEY WAS `queue` AND THE SCREEN IT NAMES NEVER CHANGED.**
       *
       * MERGE 01 pointed the queue entry at `/delays` and relabelled it, leaving its id as `queue`;
       * the id was later renamed to `delays` in `WARD_VIEWS`. **The testid on the right is untouched
       * and `delays-screen.tsx` still renders it** — only the key went stale, so this journey has
       * been unable to open the Delays screen ever since, while being named "opens every Ward Flow
       * mode".
       *
       * ⚠️ **AND THE FAILURE MESSAGE SENT THREE SESSIONS THE WRONG WAY.** It says `WARD_VIEWS`
       * **GAINED** a destination with no mapping, which reads as a screen being ADDED — so the
       * agreed position became "do not map it, that is coverage for a screen about to be removed by
       * the Delays/Movements fold". **Nothing was gained and nothing needed writing.** A rename and
       * an addition are indistinguishable to a check that only asks which keys are missing, and the
       * word it chose decided the diagnosis. Deferring on that premise would have left a live screen
       * unopened indefinitely, waiting on a fold that has not been approved and is not being built.
       */
      delays: "ward-delays-page",
      /*
       * 🔴 **THESE TWO WERE `ward-mode-capacity` AND `ward-mode-movements`, AND MERGE 02 REPLACED
       * THE SCREENS THEY NAMED.**
       *
       * `ward-mode-${mode}` is rendered by `WardModeWorkspace` (`ward-management-modes.tsx:535`).
       * `/capacity` and `/movements` no longer render it — they render `CapacityScreen` and
       * `MovementsScreen`, whose own testids are below. `/network` and `/governance` still use the
       * workspace, which is why their `ward-mode-*` entries are correct and untouched.
       *
       * ⚠️ **THE MAPPING-KEY FIX ABOVE IS WHAT EXPOSED THESE.** While the `delays` key was stale the
       * assertion failed BEFORE the navigation loop ran, so four of the five modes were never
       * opened at all. **One stale key was masking two stale values**, and the journey named "opens
       * every Ward Flow mode" had been opening none of them.
       *
       * ⚠️ **AND NO GUARD IN THIS FILE COULD HAVE CAUGHT THESE TWO.** Both directions of the parity
       * check below are about KEYS — which views lack a key, which keys lack a view. **A key that is
       * present and correct, pointing at a testid that no longer exists, satisfies both.** Only
       * running the journey finds it, which is the argument for the ward lane running at all.
       */
      capacity: "ward-capacity-screen",
      movements: "ward-movements-page",
      governance: "ward-mode-governance",
    };
    /*
     * ⚠️ **`transport: "ward-mode-transport"` WAS HERE AND NOTHING READ IT.** `WARD_VIEWS` has no
     * `transport` entry — MERGE 03 folded it into Movements — so the key was dead in exactly the way
     * `queue` was, and for the same reason. **Removed rather than left**: a mapping that looks live
     * and is never read is the thing that gets trusted the day somebody re-adds the view, by which
     * point its testid may name nothing.
     */
    // "command" is the page this test already starts on, so it has no link to click here.
    const navigable = WARD_VIEWS.filter((view) => view.id !== "command");
    // Anti-vacuity, and it fails LOUDLY on the one change that would otherwise skip a screen: add a
    // view to WARD_VIEWS and forget its testid, and this names it rather than quietly walking a
    // shorter list.
    const unmapped = navigable.filter((view) => testIdByView[view.id] === undefined).map((view) => view.id);
    expect(
      unmapped,
      `WARD_VIEWS has a destination with no testid mapping: ${unmapped.join(", ")}. If the id was ` +
        `RENAMED rather than added, the mapping already exists under the old key — re-key it rather ` +
        `than writing new coverage.`,
    ).toEqual([]);
    /*
     * 🔴 **THE REVERSE DIRECTION, ADDED 2026-09-06 BECAUSE ITS ABSENCE COST THREE SESSIONS A WRONG
     * DIAGNOSIS.**
     *
     * The check above asks which VIEWS have no key. It cannot see a KEY with no view — and a rename
     * produces both halves at once. `queue` → `delays` left an orphan `queue` and a missing
     * `delays`, and only the missing half was visible, so the failure read as a screen being ADDED
     * and the agreed response became "do not map it". **One-directional parity does not merely miss
     * the orphan; it mis-describes the defect it does catch.**
     *
     * `tests/ward-nav.test.ts` already runs both directions over the nav arrays for the same reason,
     * and its own comment records that the missing direction is how three boards shipped with no
     * rail entry.
     *
     * ⚠️ **This will go red on any change that REMOVES a view**, whichever one and whenever. **That
     * is the intended signal: the map moves with the array, in the same commit.**
     *
     * A Delays→Movements fold would do exactly that. ⚠️ **It is PROPOSED TO THE OWNER, NOT APPROVED,
     * AND NO CODE HAS BEEN WRITTEN** — worded that way deliberately, because "pending the fold"
     * reads as scheduled work and invites the next person to plan around something that does not
     * exist. Three sessions today already treated that proposal as in-progress and deferred a real
     * repair behind it.
     */
    const viewIds = new Set<string>(WARD_VIEWS.map((view) => view.id));
    const orphanKeys = Object.keys(testIdByView).filter((id) => !viewIds.has(id));
    expect(
      orphanKeys,
      `testid mapping(s) for a view WARD_VIEWS no longer has: ${orphanKeys.join(", ")}. A mapping ` +
        `nothing reads looks live and gets trusted the day the view returns.`,
    ).toEqual([]);
    expect(navigable.length, "no navigable views — the loop below would prove nothing").toBeGreaterThan(3);
    // ⚠️ **BY `href`, NOT BY `view.label` — THE RAIL NO LONGER USES IT.** The owner-requested
    // grouped rail (`shell/ward-rail.tsx`'s `RAIL_GROUPS`, 2026-09-13) carries its own hand-picked
    // presentation labels rather than reading `WARD_VIEWS.label` — "Movement" (singular) for the
    // `movements` view being the case that actually broke this loop, hanging 120s on
    // `getByRole("link", { name: "Movements" })` finding nothing. This test's own comment used to
    // say "LABELS COME FROM WARD_VIEWS, NOT FROM THIS FILE" as the reason a rename could not break
    // it; that is no longer true of the RAIL's rendered text, only of the route it points at — so
    // this now matches on `href`, which both files still agree on, via the rail's own stable
    // `data-testid="ward-rail-link"`.
    const modes = navigable.map((view) => [view.href, testIdByView[view.id]] as const);
    for (const [href, testId] of modes) {
      await clickRailLink(page, href);
      await expect(page.getByTestId(testId)).toBeVisible({ timeout: 15_000 });
      await expectNoPageOverflow(page);
    }
  });

  /**
   * Task 9 review Critical 1: the mode links must retain the 3rem/48px tap-target floor on the
   * shortest supported phone viewport.
   *
   * MERGE 01 (2026-09-05): down to seven links. "Priority queue" and "Exceptions" collapsed into
   * one "Delays" link when the three screens behind them (queue, exceptions, escalation) folded
   * into `/delays` — see WARD_VIEWS in ward-nav.ts. The count below moved from 8 to 7 with it.
   *
   * 🔴 **THE DRAWER STEP CAME BACK, DIFFERENTLY, 2026-09-13.** The paragraph above described
   * `ward-rail.tsx` between 2026-09-11 and the owner-requested grouped rail
   * (`RAIL_GROUPS`/"More pages", same file): true then, false now. At 320px the rail shows only
   * three links inline (Command, Movement, Capacity — `compactPrimaryIds`) and puts the rest,
   * `WARD_VIEWS`' `network`/`delays`/`governance` among them, behind a "More pages" button that
   * opens a `Sheet` (a dialog nested inside this same `nav`, per that file's own closing tag).
   * "No interaction first" is exactly the property that changed — that is the redesign, not a
   * regression, and it is why the total link count under this landmark is no longer `WARD_VIEWS
   * .length`: the sheet also carries the Service Hubs / Care Coordination / Oversight groups, which
   * were never part of `WARD_VIEWS` at all. So this test now opens the sheet before measuring, and
   * checks the tap-target floor for the `WARD_VIEWS` subset specifically — by `href`, not by count
   * — leaving the extra hub links outside its scope, exactly as they always were.
   *
   * ⚠️ The `aria-label="Ward Flow views"` landmark this locator depends on survived the change of
   * owner deliberately: `ward-rail.tsx` splits its entries into two lists precisely so the six
   * core views keep that landmark on every route, which `tests/ward-nav.test.ts`'s D8 contract
   * pins by name.
   */
  test("keeps every rail mode link at the 3rem tap-target floor on a short, narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await gotoWardFlow(page);

    const nav = page.getByRole("navigation", { name: "Ward Flow views" });
    // cc4deaecaf (23 Sept): at 40rem and below "the phone starts with the task" — the views move
    // behind the rail's Menu button, which opens the same "More pages" sheet. The tap-target floor
    // is what this test guards, so open whichever door this width offers, then measure.
    // Phone (8 Oct 2026): at 48rem and below the rail is hidden and the header bar's Menu button
    // opens the same sheet.
    const opener = (await nav.isVisible())
      ? // B1: the rail's sheet button is "More pages" now (it was "All pages").
        page.getByRole("button", { name: /^More pages/iu })
      : page.getByTestId("ward-bar-phone-menu");
    if (await opener.isVisible()) {
      // Phone (10 Oct 2026): the bar's Menu opens the phone menu rather than the rail's sheet.
      // Retried as one step: a dev-server reload right after load can swallow the first tap, and
      // the property here is the tap-target floor, not that the first tap beats a reload.
      const sheet = page.getByTestId("ward-rail-more-pages").or(page.getByTestId("ward-phone-menu"));
      await expect(async () => {
        if (!(await sheet.isVisible())) await opener.click();
        await expect(sheet).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
    }

    // By `href`, not by counting every link this landmark now contains: the sheet also carries the
    // Service Hubs / Care Coordination / Oversight groups, which are real rail destinations but
    // were never members of `WARD_VIEWS`, so a raw count no longer describes "the six core views".
    const links = [];
    for (const view of WARD_VIEWS) {
      // From `page`, not `nav` — the sheet portals to `document.body` by default
      // (`components/wf/sheet.tsx`'s `Sheet`), so its copy of a non-primary view's link sits
      // outside `nav`'s own DOM subtree once open. `:visible` then picks whichever of the two
      // copies (the rail's own inline one, or the sheet's) is actually the one on screen.
      // Device audit (11 Oct 2026): the phone menu shows each page once. Home sits in the phone
      // dock, and a page with an urgent count moves under "Needs you", so a view is reachable
      // through whichever of those three link kinds carries it. Each is still measured below.
      // shell-9 (13 Oct 2026): a "Needs you" row may carry a filter query (Delays opens on
      // ?show=severe), so its href is matched with or without one.
      const link = page
        .locator(
          ["ward-rail-link", "ward-phone-dock-link", "ward-phone-menu-need"]
            .flatMap((testId) => [
              `[data-testid="${testId}"][href="${view.href}"]:visible`,
              `[data-testid="${testId}"][href^="${view.href}?"]:visible`,
            ])
            .join(", "),
        )
        .first();
      await expect(link, `${view.label} (${view.href}) must be reachable from this rail`).toBeVisible();
      links.push(link);
    }
    for (const link of links) {
      const box = await link.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      expect(box!.width).toBeGreaterThanOrEqual(48);
    }
  });

  test("provides a queue-first phone fallback without page overflow", async ({ page }) => {
    // The coordinator shell's own responsibility is not overflowing and keeping the priority
    // queue reachable at the narrowest supported width (320px, not the 390px this test used
    // against WardManagementConsole). The full phone composition — hiding the diagram column,
    // one-tap confirm — belongs to Task 8; this only proves the frame itself does not break.
    await page.setViewportSize({ width: 320, height: 820 });
    await gotoWardFlow(page);

    // Home v7: Home opens on My list; the priority queue is behind Everyone waiting.
    await expect(page.getByTestId("home-my-list")).toBeVisible();
    await expectNoPageOverflow(page);
    await expectNoRegionGridOverflow(page);
  });

  /*
   * This test is about the shared `WardModeWorkspace` chrome — sidebar hidden, brand still visible
   * — at tablet width, not about any one mode's content.
   *
   * ⚠️ **IT HAS NOW CHASED THAT CHROME ACROSS THREE SCREENS IN TWO DAYS, AND THAT IS THE FINDING.**
   *
   *   originally  /queue      MERGE 01 sent /queue to /delays, a standalone route with no chrome
   *   then        /capacity   MERGE 02 (bf563af9f) made Capacity standalone too — it renders its
   *                           OWN <header className={styles.pageHeader}> with the <h1>, and the
   *                           branded mode header is not on it at all
   *   now         /governance
   *
   * 🔴 **MEASURED 2026-09-06: exactly TWO routes still render `WardModeWorkspace` — /governance and
   * /network.** Every other ward screen has been folded into a standalone route. So the chrome this
   * test guards is nearly gone, and the previous failure was NOT a regression: it was this test
   * standing on the third screen to lose it.
   *
   * **There is no declared list of which modes render the workspace**, so this route cannot be
   * derived and is hard-coded — which is exactly why it keeps breaking. It is retargeted rather
   * than retired because the property is real and still true on the screens that have the chrome,
   * and a red test here would have been read as a visual regression by the next person.
   *
   * ⚠️ **The open question is the owner's and is recorded in
   * `docs/ward-flow/retired-browser-journeys-2026-09-06.md`: should every ward screen carry the
   * Ward Flow brand header, or is the chrome being retired on purpose?** If it is going, this test
   * goes with it. If it is staying, the modes that render it should be declared somewhere this test
   * can read, instead of being rediscovered by a failure every merge.
   */
  test("keeps the application named at tablet width when the remembered rail is closed", async ({ page }) => {
    /*
     * 🟢 **THE ROUTE IS DERIVED NOW, NOT TYPED — 2026-09-06. THIS IS THE FIX FOR THE CHASE ABOVE.**
     *
     * `WARD_WORKSPACE_MODES` (ward-management-modes.tsx) declares which modes render the branded
     * chrome, and `tests/ward-workspace-chrome.test.ts` checks that array against what the route
     * files actually render — in BOTH directions, so a merge that converts a screen to a standalone
     * route fails there, by name, instead of surfacing here as a confusing red.
     *
     * ⚠️ **THE HEADING COMES FROM `modeCopy[mode].title`, NOT FROM THE `WARD_VIEWS` LABEL, AND THAT
     * IS NOT INTERCHANGEABLE.** The retired `network` mode was labelled *"Network"* in the rail and
     * titled *"Network diagram"* on the page. Filtering on a rail label could look for text a screen
     * never renders — a trap this test would have walked into the first time it derived anything.
     *
     * If the chrome is ever retired entirely, `WARD_WORKSPACE_MODES` empties, the floor below fails
     * loudly, and THAT is the moment to delete this test — not a silent skip.
     */
    const mode = WARD_WORKSPACE_MODES[0];
    const view = WARD_VIEWS.find((entry) => entry.id === mode);
    expect(view, `no WARD_VIEWS entry for workspace mode "${mode}" — nothing to navigate to`).toBeDefined();

    /*
     * 🔴 **THE "REMEMBERED PANEL" CHANGED OWNER ON 2026-09-11, AND THE PROPERTY SURVIVED IT.**
     *
     * This used to seed `ward-flow-sidebar-collapsed` and then assert that
     * `role="complementary"` named *"Ward Flow sidebar"* was attached-but-hidden. That panel was
     * `ClinicalRail`'s, and no `<ClinicalRail>` is mounted anywhere in `src/` any more — so the
     * locator found nothing and this test failed on a premise rather than on the property.
     *
     * **The property was never about that particular panel.** It is: *when the navigation chrome
     * has put its own name away, the screen still says what application this is.* The
     * third-edition rail remembers exactly such a preference under `ward-flow-rail` (its own
     * `RAIL_OPEN_STORAGE_KEY`; anything other than the literal `"closed"` reads as open, per
     * standard §7.7 — a browser that refuses storage still gets the page open), and in the closed
     * shape it shortens its wordmark to "WF". So the premise is re-seeded against that key, the
     * put-away state is asserted on the rail itself, and the header assertion is unchanged.
     *
     * ⚠️ **THE TWO KEYS ARE DELIBERATELY UNRELATED AND HAVE OPPOSITE DEFAULTS** — the second
     * edition's sidebar started collapsed, this rail starts open (`ward-rail.tsx` says so beside
     * its own reader). Seeding the old key here would now do nothing at all and this test would
     * pass over whatever state the rail happened to be in.
     *
     * ⚠️ **820px NO LONGER REACHES THE CLOSED SHAPE AT ALL — STANDARD §7.7, `ward-rail.module.css`:
     * "Below 1000px the rail renders in the open shape as a wrapping row whatever is stored."**
     * Below that width the rail is forced open regardless of `ward-flow-rail`, specifically so a
     * narrow screen never loses its navigation behind an icon rail — `data-rail="closed"` still
     * lands on the element (the stored preference is real), but the `.brandShort`/"WF" swap this
     * test checks for is itself gated on the same breakpoint, so it stays hidden below 1000px no
     * matter what is stored. Raised to 1024px — landscape iPad, still a tablet — so the scenario
     * this test names ("the remembered panel is hidden") can actually occur.
     */
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.addInitScript(() => {
      window.localStorage.setItem("ward-flow-rail", "closed");
    });
    await page.goto(view!.href, { waitUntil: "domcontentloaded" });

    const rail = page.getByTestId("ward-rail");
    await expect(rail).toBeVisible({ timeout: 15_000 });
    await expect(
      rail,
      "the rail did not honour its remembered closed state, so this test never reached the " +
        "condition it exists to check",
    ).toHaveAttribute("data-rail", "closed");
    await expect(rail.locator('[class*="brandEmblem"]'), "the closed rail must show its brand emblem").toBeVisible();
    await expect(
      rail.locator('[class*="brandTitle"]'),
      "the closed rail must hide its brand title so the header brand below is the only thing naming the application",
    ).toBeHidden();
    // b93b3b07e3 (21 Sept) retired the workspace header ("eliminate duplicate headers"), and the
    // 25 Sept ruling keeps that design. With the rail closed, its emblem is what names the app.
    // Since 8 October 2026 (Josh) the closed emblem opens the full rail rather than going Home.
    const brandOpen = rail.getByRole("button", { name: "Ward Flow, open the menu" });
    await expect(
      brandOpen,
      "with the rail closed and the workspace header retired, nothing on screen names the application",
    ).toBeVisible();
    await brandOpen.click();
    // v10 shell (Josh, 10 Oct 2026): 1024px is tablet landscape, which always draws the icon rail;
    // its emblem opens the full sidebar over the page (the More sheet) rather than widening the rail.
    await expect(page.getByTestId("ward-rail-more-pages"), "the closed emblem must open the full menu").toBeVisible();
    await expect(rail).toHaveAttribute("data-rail", "closed");
  });

  // MERGE 01 (2026-09-05): /queue now redirects to /delays. The fixed-bar link this checks lived in
  // the shared ClinicalRail, which DelaysScreen mounted, so that assertion held and the path is
  // deliberately left pointing at /queue. It no longer exercises the queue mode.
  //
  // ⚠️ **THE REST OF THIS COMMENT DESCRIBED CODE THAT IS GONE, AND RATIONALISED IT — CORRECTED
  // 2026-09-09.** It used to explain that the "Priority queue" heading filter below matched no
  // header on this page and that this was "why the header-hidden assertion still passes too",
  // recorded as a noted state rather than as a defect. The filter and that assertion are gone; the
  // block comment inside the test says why. **A reader arriving here met the settled-sounding
  // rationalisation first and the correction second**, which is how a repaired defect gets read back
  // as a reasoned decision. Routed by the chat that had routed the assertion itself.
  //
  // ⚠️ **RE-DERIVED, Task 8, 2026-09-11.** ClinicalRail's own brand link carried no `aria-label`,
  // so its accessible name came from its visible text, "Ward Flow", and the first assertion below
  // checked that name directly. `shell/ward-rail.tsx`, the layout-mounted rail this task replaces
  // it with, is a component several other screens link against too (`WARD_HOME_HREF`) and gives
  // its own brand link an explicit `aria-label="Ward Flow home"` for that reason — so its
  // accessible name is "Ward Flow home", never "Ward Flow", regardless of the visible text this
  // rail swaps between "Ward Flow" and "WF" for its open/closed shape. Checked live at 320px:
  // exactly one link now carries that name. The second assertion (`getByText`, matching rendered
  // text rather than accessible name) is unaffected — the rail's own `<b>Ward Flow</b>` still
  // renders that exact text once, open by default, so it still finds exactly one match.
  // Rise phone navigation (10 Oct 2026): the owner locked a lean phone bar of Menu, page title,
  // search and Tasks, with no brand. The brand link this test used to count is gone from phones on
  // purpose, so it now checks the locked bar instead. Menu being visible is the positive anchor, so
  // the "no brand link" count cannot pass on an empty page.
  test("uses the lean bar on phone, with Menu first and no brand link", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 });
    await page.goto("/ward-flow/queue", { waitUntil: "domcontentloaded" });

    const menu = page.getByTestId("ward-bar-phone-menu");
    await expect(menu).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("link", { name: "Ward Flow home", exact: true }).filter({ visible: true }),
      "the locked phone bar carries no brand link",
    ).toHaveCount(0);
  });

  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoWardFlow(page);
    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByTestId("home-my-list")).toBeVisible();
    await expect(page.getByTestId("ward-coordinator-governance")).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByTestId("home-my-list")).toBeVisible();
    await expect(page.getByTestId("ward-coordinator-governance")).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-coordinator-governance"]:visible')).toBeVisible();
  });
});
