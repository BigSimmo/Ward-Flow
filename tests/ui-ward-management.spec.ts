import { expect, test, type Page } from "playwright/test";

import { WARD_WORKSPACE_MODES } from "@/components/ward-management/ward-management-modes";
import { WARD_VIEWS } from "@/components/ward-management/ward-nav";

const PATH = "/mockups/ward-flow";

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
 * /mockups/ward-flow itself, where the region grid testid exists.
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
  // WardManagementConsole, which Task 3 stopped rendering at /mockups/ward-flow. That component is
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
      network: "ward-mode-network",
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
      capacity: "ward-capacity-page",
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
      await page.locator(`[data-testid="ward-rail-link"][href="${href}"]`).click();
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
      ? page.getByRole("button", { name: /^All pages/iu })
      : page.getByTestId("ward-bar-phone-menu");
    if (await opener.isVisible()) {
      await opener.click();
      await expect(page.getByTestId("ward-rail-more-pages")).toBeVisible();
    }

    // By `href`, not by counting every link this landmark now contains: the sheet also carries the
    // Service Hubs / Care Coordination / Oversight groups, which are real rail destinations but
    // were never members of `WARD_VIEWS`, so a raw count no longer describes "the six core views".
    const links = [];
    for (const view of WARD_VIEWS) {
      // From `page`, not `nav` — the sheet portals to `document.body` by default
      // (`components/ui/sheet.tsx`'s `Sheet`), so its copy of a non-primary view's link sits
      // outside `nav`'s own DOM subtree once open. `:visible` then picks whichever of the two
      // copies (the rail's own inline one, or the sheet's) is actually the one on screen.
      const link = page.locator(`[data-testid="ward-rail-link"][href="${view.href}"]:visible`);
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

  test("routes a selected movement across the network diagram and explains the shortlist", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await page.goto("/mockups/ward-flow/network", { waitUntil: "domcontentloaded" });

    // ⚠️ **RETARGETED.** `/network` now opens on a two-tab split ("Network overview" /
    // "Placement workspace", `ward-management-network.tsx`'s `NetworkView`, default `"overview"`)
    // that did not exist when this journey was written. Everything this test drives — the
    // movement pipeline, the routed connectors, the explainable shortlist — is the PLACEMENT tab's
    // content (`data-testid="ward-network-view"` is only ever mounted there); the default overview
    // tab is a different, summary screen entirely. Selecting the tab is therefore a real, necessary
    // step now, not an incidental one.
    await page.getByRole("tab", { name: "Placement workspace" }).click();

    const network = page.getByTestId("ward-network-view");
    await expect(network).toBeVisible({ timeout: 15_000 });

    // Connector paths are drawn by a client layout effect, so their presence is the
    // hydration signal: before it fires, queue clicks would be swallowed.
    await expect(network.locator("svg path[marker-end]").first()).toBeAttached({ timeout: 15_000 });

    // Pipeline counts are derived from the movement records, so they must total the queue.
    await expect(network.getByRole("region", { name: "Movement pipeline" })).toContainText("Placement requested");

    // WF-001 is first in the queue; its eligible shortlist is Dabakarn, Mental Health Unit
    // and Moodjar. FSH Adult Secure is no longer in it: WF-001 is a Female Adult movement
    // and FSH Adult Secure is Male only, so the sex_designation gate added in 6cc80c774 excludes
    // it and Moodjar (next in unit order) takes the freed slot.
    const shortlist = network.getByRole("complementary", { name: "Explainable shortlist" });
    await expect(shortlist).toContainText("WF-001");
    await expect(shortlist.getByRole("columnheader", { name: /Dabakarn/ })).toBeVisible();
    // Eligibility is a binary verdict, not a score: gates are not commensurable, so no row
    // ever renders a "N of M passed" fraction.
    await expect(shortlist.getByRole("row", { name: /Eligibility/ })).toContainText("Eligible");
    // WF-001 has no recorded destination, so none of its three candidates — including the
    // first-ranked one — may inherit its (nonexistent) transport job.
    await expect(shortlist.getByRole("row", { name: /Transport state/ })).toContainText("Not yet booked");
    await expect(shortlist.getByRole("row", { name: /Transport state/ })).not.toContainText("Not yet requested");
    await expect(shortlist).toContainText("No automatic allocation");

    // Shortlisted services are marked as routed on the canvas. Armadale IS in WF-001's eligible
    // top three and FSH Adult Secure is NOT: FSH Adult Secure is a Male-only ward, WF-001 is a
    // Female patient, and the sex_designation eligibility gate (6cc80c774) correctly excludes it
    // — this assertion is proving a clinical-safety gate works, not tolerating a broken one.
    await expect(network.getByTestId("ward-network-card-rph-adult-secure")).toHaveAttribute("data-routed", "true");
    await expect(network.getByTestId("ward-network-card-arm-adult-open")).toHaveAttribute("data-routed", "true");
    await expect(network.getByTestId("ward-network-card-fsh-adult-secure")).not.toHaveAttribute("data-routed", "true");

    // Broome is one of the services with no available beds. (Was Kununurra, which has no ward since
    // 26 Sept 2026: owner-approved ward facts.)
    await expect(network.getByTestId("ward-network-card-brm-adult-secure")).toContainText("Broome");

    // Selecting another movement re-routes the diagram and swaps the shortlist. WF-002 is
    // South Metro; Fremantle Older Adult is its one same-service eligible candidate.
    await network.getByTestId("ward-network-queue-WF-002").click();
    await expect(shortlist).toContainText("WF-002");
    await expect(network.getByTestId("ward-network-card-fre-older-adult")).toHaveAttribute("data-routed", "true");
    // This row compares health services against the *origin* ED, not the patient's catchment
    // (catchment is where a patient lives, not where they presented) — named for what it
    // actually measures rather than implying a judgement the model cannot make yet.
    //
    // Phase 8 Task 6 renamed the cells from "Best"/"Escalation" to "Same health service"/
    // "Different health service", because "Best" read as the system's opinion about which bed
    // this person should have. "Different health service" is asserted rather than "Same health
    // service" deliberately: the row header already contains the words "Same health service", so
    // asserting those would pass against the header alone and prove nothing about any cell.
    await expect(shortlist.getByRole("row", { name: /Same health service as origin/ })).toContainText(
      "Different health service",
    );

    // A service card opens its own detail block.
    await network.getByTestId("ward-network-card-fre-older-adult").click();
    await expect(shortlist.getByRole("region", { name: "Selected service detail" })).toContainText(
      "Wardong (Ward 4.3)",
    );
    await expectNoPageOverflow(page);
  });

  test("provides a queue-first phone fallback without page overflow", async ({ page }) => {
    // The coordinator shell's own responsibility is not overflowing and keeping the priority
    // queue reachable at the narrowest supported width (320px, not the 390px this test used
    // against WardManagementConsole). The full phone composition — hiding the diagram column,
    // one-tap confirm — belongs to Task 8; this only proves the frame itself does not break.
    await page.setViewportSize({ width: 320, height: 820 });
    await gotoWardFlow(page);

    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
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
     * ⚠️ **THE HEADING COMES FROM `wardWorkspaceModeTitle`, NOT FROM THE `WARD_VIEWS` LABEL, AND THAT
     * IS NOT INTERCHANGEABLE.** `network` is labelled *"Network"* in the rail and titled *"Network
     * diagram"* on the page. Filtering on the rail label would look for text this screen never
     * renders — a trap this test would have walked into the first time it derived anything.
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
    await expect(rail, "the closed emblem must open the full rail").toHaveAttribute("data-rail", "open");
    await expect(rail.getByRole("link", { name: "Ward Flow home" })).toBeVisible();
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
  test("uses its fixed bar as the sole Ward Flow brand on phone", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 820 });
    await page.goto("/mockups/ward-flow/queue", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("link", { name: "Ward Flow home", exact: true })).toBeVisible({ timeout: 15_000 });

    /*
     * 🔴 **THIS ASSERTION USED TO PASS ON NOTHING, AND ITS OWN COMMENT SAID SO WITHOUT TREATING IT AS
     * A DEFECT.** It built `page.locator("header").filter({ has: heading "Priority queue" })` and
     * asserted that locator was hidden. `/queue` redirects to `/delays`, which renders no such
     * heading, so the filter matched ZERO elements — and `toBeHidden()` on an empty locator is
     * satisfied by the emptiness. The test could not have failed for any reason on any page.
     *
     * ⚠️ **A vacuous pass is not the same defect as a wrong expectation.** A wrong expectation goes
     * red when the code changes; this went green whatever the page did, including on a page that
     * grew a second brand. Routed here by the redirect-stub guard, which correctly excluded it:
     * navigating into a stub is a different class from an assertion that cannot fail.
     *
     * What the test's own NAME claims is a count — the fixed bar is the SOLE brand — so it is
     * asserted as one, over every visible element carrying the exact words rather than over a
     * header this page does not have. Anchored on a positive expectation, which cannot be satisfied
     * by an empty match.
     */
    await expect(
      page.getByText("Ward Flow", { exact: true }),
      "the phone shell shows more than one Ward Flow brand, so the fixed bar is no longer the sole one",
    ).toHaveCount(1);
  });

  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoWardFlow(page);
    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    await expect(page.getByTestId("ward-coordinator-governance")).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    await expect(page.getByTestId("ward-coordinator-governance")).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-coordinator-governance"]:visible')).toBeVisible();
  });
});
