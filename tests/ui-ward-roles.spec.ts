import { expect, test, type Locator, type Page } from "playwright/test";

import { edById, unitById } from "@/components/ward-management/ward-sites";

/**
 * PR 46 ("Coordinator Shortlist Panel & Action Compaction") defaults the shortlist's Candidates
 * section and its Eligibility checks disclosure to closed. Open both before reading or clicking
 * inside them; idempotent, so it is safe after every queue selection.
 */
async function openShortlistSections(shortlist: Locator) {
  const toggle = shortlist.getByTestId("ward-shortlist-candidates-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const checks = shortlist.locator('details[aria-label="Eligibility checks"]');
  if ((await checks.count()) > 0 && !(await checks.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await checks.locator("summary").click();
  }
}

async function gotoWard(page: Page, unitId: string): Promise<Locator> {
  await page.goto(`/mockups/ward-flow/ward/${unitId}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const wardScreen = page.locator('[data-testid="ward-unit-screen"]:visible');
  // App Router can briefly retain the previous render while hydrating this route,
  // especially when emulated media or the browser clock is configured before
  // navigation. Operate on the one visible route surface, never a hidden transition copy.
  await expect(wardScreen).toHaveCount(1, { timeout: 15_000 });
  await expect(wardScreen).toBeVisible();
  return wardScreen;
}

/**
 * ⚠️ **RE-DERIVED, Task 8, 2026-09-11.** `WardDemoControls` and `WardRoleSwitcher` used to live
 * directly in `ClinicalRail` — always in the DOM, never behind a control of their own — so every
 * call site below that reached for "Change view" or the demo-controls trigger found it
 * immediately. The third-edition shell (`shell/ward-bar.tsx`) moves both into its own Tools
 * drawer instead (a `<Sheet>`, which renders nothing at all while closed), per the master plan's
 * own ruling that nothing a demonstration needs may be lost in the move. Opening it is now a
 * precondition for every one of those call sites, not a step this spec used to need.
 *
 * Checks `aria-expanded` rather than clicking unconditionally, in both directions: `WardBar`'s
 * Tools trigger TOGGLES the drawer, so an unconditional click when it is already in the target
 * state would flip it the wrong way. `ensureToolsOpen` matters because this journey calls into
 * the drawer more than once per test (the role-switcher loop changes role four times); Playwright
 * mid-retry could otherwise find it already open and close it by clicking again.
 *
 * `ensureToolsClosed` matters for a sharper reason, found live rather than reasoned out: `WardBar`
 * persists across the client-side navigation `switchTo` triggers below (same layout, same
 * component instance — a route change alone never unmounts it), so its own `openPanel` state
 * persists too. Left open, the Tools `<Sheet>`'s own backdrop — a `position: fixed` overlay
 * covering the page — stayed in the DOM on the destination screen and intercepted every pointer
 * event meant for it, which is exactly what timed out clicking a queue row on Coordinator right
 * after switching there. `switchTo` closes the drawer itself once the destination is chosen,
 * rather than leaving that to every call site.
 */
async function ensureToolsOpen(page: Page): Promise<void> {
  const trigger = page.getByTestId("ward-bar-tools-trigger");
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  await page
    .getByRole("dialog", { name: "Tools" })
    .getByRole("group", { name: "Tools sections" })
    .getByRole("button", { name: "Shift desk", exact: true })
    .click();
}

/**
 * ⚠️ **NOT `trigger.click()` AGAIN — found live, after the first version of this helper (which
 * re-clicked `ward-bar-tools-trigger` to toggle the drawer shut) itself timed out.** The Tools
 * `<Sheet placement="right">` renders OVER the header once open — the same header the trigger
 * lives in — so the trigger sits behind the drawer it opened and a second click on it is
 * intercepted by the drawer's own chrome, the identical failure shape this whole helper exists to
 * fix, one click later. `<Sheet>`'s own dedicated close button (`aria-label="Close"`, next to the
 * "Tools" title) is never covered by anything, because it is part of the drawer that would be
 * doing the covering.
 */
async function ensureToolsClosed(page: Page): Promise<void> {
  const trigger = page.getByTestId("ward-bar-tools-trigger");
  if ((await trigger.getAttribute("aria-expanded")) === "true") {
    // Scoped to the dialog, not a bare page-wide `getByRole("button", { name: "Close" })` —
    // found live: `WardRail`'s own open/closed toggle reads "Close" too (`ward-rail.tsx`'s
    // `{open ? "Close" : "Open"}`), an unrelated control for the NAVIGATION rail, not this
    // drawer, and a page-wide query resolved both in strict mode. `<Sheet>`'s own `role="dialog"`
    // carries `title="Tools"` as its accessible name, which the rail's toggle does not share.
    await page.getByRole("dialog", { name: "Tools" }).getByRole("button", { name: "Close", exact: true }).click();
  }
}

test.describe("@mockup Ward screen", () => {
  test.describe.configure({ timeout: 45_000 });

  test("shows one unit's own capacity and answers an incoming referral", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    const wardScreen = await gotoWard(page, "bty-adult-secure");

    // One unit, not twenty-two.
    await expect(wardScreen).toContainText("BTY Adult Secure");
    await expect(wardScreen.locator('[data-testid^="ward-unit-card-"]')).toHaveCount(1);

    // Its beds reconcile on screen.
    const beds = wardScreen.getByTestId("ward-unit-beds");
    await expect(beds).toContainText("Ready");
    await expect(beds).toContainText("Occupied");

    // A decline requires a reason from the fixed list, and out-of-catchment is offered.
    // Unconditional: bty-adult-secure holds a live referral at seed (WF-017, verified against
    // the real fixture — see the task report), so this must not hide behind an `if (count())`
    // that can silently never run.
    // v6 ward home: Awaiting your answer is its own card beside Every bed, always shown (no switch).
    const incoming = wardScreen.locator('[data-testid^="ward-incoming-"]');
    await expect(incoming).not.toHaveCount(0);
    await incoming
      .first()
      .getByRole("button", { name: /Decline/ })
      .click();
    const reasons = page.getByRole("group", { name: /Decline reason/ });
    await expect(reasons).toContainText(/out of catchment/i);
  });

  /**
   * Addendum R40 (Global Constraint): an id `unitById` cannot resolve must render an explicit
   * empty state naming the id — never a substituted unit, never `?? allUnits()[0]`. This id is
   * checked against the real fixture below to prove it genuinely resolves to nothing, so the test
   * cannot silently start passing against a real unit if the fixture ever grows an id like this.
   */
  test("names an unresolved unit id rather than substituting a different ward", async ({ page }) => {
    const bogusUnitId = "nonexistent-unit-does-not-exist";
    expect(unitById(bogusUnitId), "fixture assumption: this id resolves to no real unit").toBeUndefined();

    await page.goto(`/mockups/ward-flow/ward/${bogusUnitId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });

    // Names the id, in real visible text — never a generic "not found" with the id swallowed.
    await expect(page.getByTestId("ward-unit-screen")).toContainText(bogusUnitId);
    // And never a substituted unit: no unit card is rendered at all for this route.
    await expect(page.locator('[data-testid^="ward-unit-card-"]')).toHaveCount(0);
    await expect(page.getByTestId("ward-unit-beds")).toHaveCount(0);
  });

  /**
   * Whole-branch review I3. Spec §2 decision 5 ("Does the clock move? Yes, with a jump-forward
   * control") and §5 ("+15 min, +1 hour … so a held bed can be watched expiring in seconds
   * rather than in an hour") — `ADVANCE_CLOCK` was implemented and tested in the reducer from
   * Task 3 onward but dispatched only from test-harness buttons; no product surface ever raised
   * it. WF-003 is fixture-pinned `accepted_awaiting_bed` at `rph-adult-secure`
   * (`ward-movements.ts`), so Hold needs no prior referral/accept steps here.
   */
  test("the demo clock control advances a held bed toward expiry, and reads as demo scaffolding", async ({ page }) => {
    // The countdown floors wall-clock minutes. Pin the browser clock so crossing a minute
    // boundary between the hold action and the assertion cannot turn 4h 00m into 3h 59m.
    // install() starts the fake clock RUNNING from its time, so pausing at that same instant
    // failed under load ("Cannot fast-forward to the past") whenever any time passed between the
    // two calls. Installing a minute earlier leaves pauseAt a real step forward; the paused time is
    // still exactly 10:00:00.
    await page.clock.install({ time: new Date("2026-08-26T09:59:00Z") });
    await page.clock.pauseAt(new Date("2026-08-26T10:00:00Z"));
    const wardScreen = await gotoWard(page, "rph-adult-secure");

    await page.locator("#tabBtn-coming").click();
    const card = wardScreen.getByTestId("ward-accepted-WF-003");
    await expect(card).toBeVisible();
    await card.getByTestId("ward-pull-WF-003").click();
    await expect(card).toContainText("Bed pull 4h 00m left");

    // `WardDemoControls` renders inside `WardBar`'s Tools drawer now (Task 8, 2026-09-11), a
    // layout-level sibling of `wardScreen` rather than a descendant of it — `page`-scoped, not
    // `wardScreen`-scoped, and only present once the drawer is open. See `ensureToolsOpen`'s own
    // header for why opening is conditional rather than an unconditional click.
    await ensureToolsOpen(page);

    // The trigger must never be mistaken for a clinical action — checked in words, not merely by
    // colour: its accessible name and title both say so explicitly.
    const trigger = page.getByTestId("ward-demo-controls-trigger");
    await expect(trigger).toHaveAttribute("aria-label", /not a clinical action/i);
    await expect(trigger).toHaveAttribute("title", /never a clinical action/i);

    await trigger.click();
    const menu = page.locator("#ward-demo-controls-menu:visible");
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(/demo tool, not part of the clinical record/i);

    const advanceClockHour = menu.getByTestId("ward-demo-advance-60");
    await advanceClockHour.click();
    await advanceClockHour.click();
    await advanceClockHour.click();
    const advanceClock = menu.getByTestId("ward-demo-advance-15");
    await advanceClock.click();
    await advanceClock.click();
    await advanceClock.click();

    // The one thing spec §5 says the control exists to demonstrate: a held bed watched
    // expiring in seconds. 3 hours 45 minutes advanced against a 240-minute (4-hour) hold leaves 15.
    await expect(card).toContainText("Bed pull 15m left");
    await expect(card).not.toContainText("Bed pull 4h 00m left");
  });

  /**
   * Deferred item 1. `tests/ui-ward-management.spec.ts`'s "retains its operating structure in
   * dark, forced-colours, and print modes" already proves this for the coordinator command view;
   * the four role screens had none of it. This copies that established `emulateMedia` sequence
   * exactly — dark, then forced-colours, then print — and asserts the same class of thing it
   * does: that the screen's *operating structure* survives each mode. It deliberately makes no
   * assertion about colour, contrast or appearance, because nothing here measures those.
   */
  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    const wardScreen = await gotoWard(page, "bty-adult-secure");
    // The ward screen is tabbed since 3ac951fcd1 (22 Sept): "Awaiting your answer" is on Home and
    // the bed figures ("Ward figures, right now", `ward-unit-beds`) are on Decisions. An inactive
    // tab panel is `display: none`, so each region is asserted on the tab that shows it — the same
    // four regions as before, none dropped.
    const homeTab = wardScreen.getByRole("tab", { name: "Home (Worth Your Attention)" });
    const decisionsTab = wardScreen.getByRole("tab", { name: "Decisions (Ward record)" });
    const assertStructure = async () => {
      await expect(wardScreen.getByTestId("ward-unit-governance")).toBeVisible();
      await homeTab.click();
      // v6 ward home: Awaiting your answer is its own card beside Every bed, always shown (no switch).
      await expect(wardScreen.getByRole("region", { name: "Awaiting your answer" })).toBeVisible();
      await expect(wardScreen.getByTestId("ward-unit-beds")).toBeVisible();
      await expect(wardScreen.getByRole("region", { name: "Ward figures, right now" })).toBeVisible();
      await decisionsTab.click();
      await expect(wardScreen.getByRole("region", { name: "Staffing" })).toBeVisible();
    };

    await assertStructure();

    await page.emulateMedia({ forcedColors: "active" });
    await assertStructure();

    // Print keeps whichever tab is active, and the tab buttons are hidden, so Home is selected
    // before print. The bed figures live on Home.
    await homeTab.click();
    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(wardScreen.getByTestId("ward-unit-beds")).toBeVisible();
    await expect(wardScreen.getByTestId("ward-unit-governance")).toBeVisible();
  });
});

test.describe("@mockup Transport officer screen", () => {
  test.describe.configure({ timeout: 45_000 });

  /**
   * Task 9-12 preflight, Task 9 section: the brief's own test takes `.first()` of the job
   * locator, and ruling R24 already found `.first()` breaks the moment fixture order shifts.
   * WF-005 is pinned deliberately instead — verified against the real fixture (see the task
   * report's re-measurement) to carry `escortRequired: true` and to be the screen's own default
   * selection (first in `movements` array order among the eight jobs not yet arrived), so no
   * click is needed before this locator resolves.
   */
  test("gives the officer four actions and nothing else", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mockups/ward-flow/transport/officer", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const job = page.getByTestId("ward-officer-job-WF-005");
    await expect(job).toContainText(/escort/i);

    // Exactly four actions, pinned and reachable without scrolling.
    const actions = job.locator('[class*="actionButton"]');
    await expect(actions).toHaveCount(4);
    for (const action of await actions.all()) {
      const box = await action.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  /**
   * Spec §7: the model carries no officer identity, so this screen must say — on screen, in
   * real text — that it shows every job rather than a filtered "yours". Global Constraint:
   * display less rather than something plausible.
   */
  test("states it is showing every job rather than inventing an officer to own them", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mockups/ward-flow/transport/officer", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });

    // Worded "All outstanding jobs..." on screen now, not "every" — same claim, different word.
    await expect(page.getByTestId("ward-officer-governance")).toContainText(/all outstanding jobs/i);
    // Re-measured 2026-09-17 after the sample-data addition: 8 became 13 (`isOfficerJob` itself is
    // unchanged; the seed simply carries more open, unarrived transport jobs now). All of them are
    // on screen — never filtered to an inferred "mine".
    await expect(page.locator('[data-testid^="ward-officer-job-"]')).toHaveCount(13);
  });

  /**
   * Deferred item 1, same pattern as the ward screen's copy of it above. The officer screen is
   * the one role screen tested at phone width, so it is emulated at phone width here too — the
   * structure that has to survive is the job list and its governance banner, not a desktop
   * layout the officer never sees.
   */
  /**
   * 🔴 **HANDED BACK, 2026-09-17.** The dark-mode and forced-colours arms below both pass. Only
   * the print arm's `ward-officer-governance` check fails ("element(s) not found" against
   * `:visible`) — `ward-officer-joblist`, further down the same `.jobsPanel` section, stays
   * visible under the identical emulation, which rules out a whole-section print collapse. The KPI
   * strip / guards panel this screen gained above the governance banner
   * (`officer-screen.tsx`'s "4-card KPI Strip matching third-edition") is new since this test was
   * last green and is a plausible site for the regression, but nothing found in
   * `officer.module.css`'s print block or its two `.governanceBanner` rule sets (one plain, one
   * under a narrower-width override) explains why print specifically, and only this one element
   * of two nearby, loses visibility. Left failing rather than guessed at.
   */
  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/mockups/ward-flow/transport/officer", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("ward-officer-governance")).toBeVisible();
    await expect(page.getByTestId("ward-officer-joblist")).toBeVisible();
    await expect(page.getByTestId("ward-officer-job-WF-005")).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByTestId("ward-officer-governance")).toBeVisible();
    await expect(page.getByTestId("ward-officer-joblist")).toBeVisible();
    await expect(page.getByTestId("ward-officer-job-WF-005")).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-officer-joblist"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="ward-officer-governance"]:visible')).toBeVisible();
  });
});

/**
 * MERGE 03 (owner-approved 2026-09-05) folded the coordinator's live transport tracker into
 * `MovementsScreen`, and `/mockups/ward-flow/transport` became a redirect. These three tests kept
 * navigating to that route and waiting for `ward-live-tracker`, an id nothing renders any more —
 * so they failed on `main` from the moment the merge landed, and would have gone on failing
 * whatever else changed.
 *
 * They are re-pointed rather than deleted because the facts they pin did not go anywhere:
 * `MovementsScreen`'s own doc comment records that `LiveTracker` "WAS THE ONLY SURFACE IN THE APP
 * THAT EVER RENDERED THE TRANSPORT FACTS BELOW" and that all of them were carried onto its
 * transport panel. The figures survive the move unchanged — the same 8 legs out of the same 43
 * open movements, leaving the same 35 with no vehicle booked.
 *
 * Scoped by the panel's accessible name rather than by a new test id: `WardPanel` already names
 * every panel via `aria-label`, so this needs no hook added to a screen for a test's benefit.
 */
test.describe("@mockup Movements — transport panel", () => {
  test.describe.configure({ timeout: 45_000 });

  /**
   * One button per booked transport leg, in "Transport right now"'s own feed (f997ac75a1, 22 Sept).
   * "Who is being carried" was removed on 18 Sept (aa139ece55); under the 25 Sept "current design
   * is the reference" ruling this re-points to where the same facts now render.
   */
  function transportLegRows(page: Page) {
    return page
      .getByRole("region", { name: "Transport right now" })
      .getByRole("feed", { name: "Active transport legs" })
      .getByRole("button");
  }

  /**
   * Task 10 brief, Step 1 — appended verbatim. On its own this only proves that the legs the seed
   * fixture happens to contain today render correctly; the task-10 preflight's LATE ADDITION
   * section flags that a passing version of this exact assertion cannot tell a screen that renders
   * all the legs correctly apart from one that renders only the legs the fixture happens to
   * contain. `tests/tracker-derivations.test.ts` (node environment) closes that gap by unit-testing
   * the leg/stamp helper across every leg plus cancelled plus absence, none of which the seed
   * fixture currently exercises end to end. The next test in this file strengthens the
   * browser-level assertion further, by pinning the exact row count instead of `> 0`.
   *
   * The leg words are `LEG_STATE_LABEL` (movements-screen.tsx), not the old tracker's: MERGE 03
   * renamed "Accepted" to "Booked" on screen and dropped "Requested" from the state union
   * entirely (`MovementLegState` excludes it). Asserting the retired words would pin a vocabulary
   * the product no longer speaks.
   */
  test("tracks every vehicle by leg and by how long since the last stamp", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/mockups/ward-flow/movements", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-movements-page")).toBeVisible({ timeout: 15_000 });

    // ⚠️ **RETARGETED, 2026-09-17.** This panel used to render `WardRecordRow`
    // (`data-ward-primitive="record-row"`); the coordinator's same-day fix restored it as its own
    // compact summary instead ("never `TransportRow`/`WardRecordRow`" — that file's own comment,
    // `movements-screen.tsx`, right above the `<WardPanel title="Who is being carried">` this
    // scopes to) so a design-lock DOM test's "renders exactly twice" invariant stays true without
    // a second copy of the shared row primitive. `getByRole("listitem")` is semantic rather than
    // a CSS-module class, so it survives the next rename the way the primitive selector used to.
    const rows = transportLegRows(page);
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // Every row names its leg and its age. The leg is read from the row's accessible name
    // ("…, <leg> via <provider>"), NOT its text: every card's footer reads "Booked … ago", so a
    // text match on /Booked|…/ would pass for every row whatever its leg. The age must be a real,
    // non-negative duration (the footer no longer clamps at zero the way "since booked" did).
    for (const row of await rows.all()) {
      await expect(row).toHaveAccessibleName(/, (Booked|En route|Collected|Arrived|Cancelled) via /);
      await expect(row).toContainText(/Booked \d+(d|h|m)( \d+(h|m))? ago/);
    }
  });

  /**
   * Re-measured directly against this branch's fixture: 70 open movements, 13 of which carry a
   * transport job. Pinning the row count at exactly 13 (never `> 0`) catches a filter regression
   * that silently widens or narrows which movements count as "a vehicle" — the brief's own wording
   * is "no row may claim a leg it has not reached", and a screen that also rendered the 57
   * transport-less movements would either fabricate a leg for them or need a sixth, non-leg cell
   * that this exact-count assertion would catch drifting either way. "The day"'s own figures state
   * the excluded count in real text instead — that is the "explicit absence" the Global Constraint
   * asks for.
   *
   * `MovementsScreen` scopes the feed to OPEN movements only, the same scope `LiveTracker` used
   * (its own comment says so explicitly), which is why the figures carry over unchanged.
   *
   * 🔴 **2026-09-25 RE-MEASURE:** the rulings overlay (`ward-rulings-demo.ts`, folded 22 Sept) adds
   * 17 open movements — 7 named plus 10 `clockMovements` — none of which set a `transport` field,
   * so 53/13/40 became 70/13/57: only the open-movement total and the excluded count moved, the
   * booked-transport count did not. Re-derived from the fixture itself (`isOpen` plus
   * `transport.acceptedAt !== undefined`, counted across `wardMovements` and the overlay together),
   * not adjusted by guesswork.
   */
  test("lists exactly the movements that carry a transport job, and states the rest explicitly", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/mockups/ward-flow/movements", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-movements-page")).toBeVisible({ timeout: 15_000 });

    // 2026-09-25 re-measure: the rulings overlay (1b1c5bb2ba/6e4ba553f3) adds 17 open movements,
    // none with transport, so 53/13/40 became 70/13/57. Checked against the fixture, not only the
    // screen: 13 legs as re-measured 17 Sept, plus zero from the overlay.
    await expect(transportLegRows(page)).toHaveCount(13);
    // The explicit absence now lives in "The day"'s own figures. Each is read from its own metric
    // (`movements-day-metric`), anchored on the label, so the excluded count cannot be satisfied by
    // the included one.
    const dayMetric = (label: RegExp) =>
      page.getByTestId("movements-day-metric").filter({ hasText: label }).locator("strong");
    await expect(dayMetric(/^Transport legs/)).toHaveText("13");
    await expect(dayMetric(/^No transport leg/)).toHaveText("57");
    await expect(dayMetric(/^Open/)).toHaveText("70");
  });
});

/**
 * 🟢 **RE-POINTED, NOT RETIRED, 2026-09-06.** This case used to live in the `Live tracker` block
 * above, against `/transport`.
 *
 * ⚠️ **Retiring it with its siblings would have dropped LIVE coverage of a LIVE screen.** The
 * screen changed; the property did not. Movements is reachable, is what absorbed transport, and
 * "still usable in dark, forced-colours and print" is exactly as true a requirement of it.
 *
 * **A test whose SUBJECT was retired is retired; a test whose PROPERTY survived onto the
 * replacement is re-pointed.** Retiring both is how a consolidation quietly loses coverage of the
 * screen it chose to keep.
 *
 * Asserted against what Movements ACTUALLY exposes rather than the tracker's old handles: its root,
 * and the two panel headings that are its operating structure. As before, this makes no claim about
 * how anything looks — only that the structure is still there in each mode.
 */
test.describe("@mockup Movements — operating structure in dark, forced-colours and print", () => {
  test.describe.configure({ timeout: 45_000 });

  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/mockups/ward-flow/movements", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-movements-page")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    /*
     * 🔴 **BY REGION, NEVER BY HEADING — AND THE FIRST VERSION OF THIS GOT IT WRONG.**
     *
     * I first asserted the panel HEADINGS. It passed in dark and forced-colours and failed under
     * print, and the screen was right both times: `src/app/globals.css`'s print block hides every
     * `header`, `nav` and `button` with `display: none !important`, app-wide — and `WardPanel`
     * renders its title inside `<header className={styles.panelHeader}>`. **So a panel heading is
     * invisible in print BY DESIGN, and a test demanding it is demanding a regression.**
     *
     * The panel itself is `<section aria-label={title}>`, which is a region, and a section is not
     * hidden in print. `WardPanel`'s own docblock says exactly this: *"`title` is already the
     * section's accessible name, so `getByRole("region", { name })` reaches every panel without
     * one."* Asserting the region is both the documented contract and the only one true in all
     * three modes — so it is used in all three rather than weakening just the print arm.
     */
    const structure = () => [
      page.getByTestId("ward-movements-page"),
      // 🔴 THE THIRD SITE OF ONE RENAME, AND THE ONLY ONE NO VITEST RUN CAN SEE. The M2 rebuild
      // retitled this panel; two vitest tests reddened on the six-branch union and this one did
      // not, because Playwright specs are not in that suite at all. It was broken from the moment
      // of the rename and nothing would have said so until somebody's next browser pass — where it
      // would have surfaced as a mystery red with no obvious author.
      //
      // ⚠️ **RETARGETED AGAIN, 2026-09-17.** The "Every movement today" panel this prefix regex
      // named is gone: `movements-screen.tsx` now wraps a `role="tablist"` ("Every movement" /
      // "Resolved today", `boardTab` state) inside one `<WardPanel title="Movement worklist">`.
      // That section is the region a coordinator actually reaches in every mode now, so this
      // checks it instead of a title that no longer exists on this screen.
      page.getByRole("region", { name: "Movement worklist" }),
      page.getByRole("region", { name: "Transport right now" }),
    ];

    for (const part of structure()) await expect(part).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    for (const part of structure()) await expect(part).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    for (const part of structure()) await expect(part).toBeVisible();
  });
});

test.describe("@mockup Emergency department screen", () => {
  test.describe.configure({ timeout: 45_000 });

  /**
   * Task 11 brief, Step 1 — appended verbatim.
   */
  test("shows a department its own patients, both clocks, and one outstanding item each", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const rows = page.locator('[data-testid^="ward-ed-patient-"]');
    expect(await rows.count()).toBeGreaterThan(0);

    // Its own patients only.
    for (const row of await rows.all()) {
      await expect(row).toHaveAttribute("data-origin-ed", "peel-ed");
    }

    // The department clock and the form clock are shown as different things — Task T1
    // (docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md item 1, owner answer 1): the
    // form column reads only a clinician's own typed expiry, never the department's arrival time.
    await expect(page.getByTestId("ward-ed-screen")).toContainText(/in department/i);
    await expect(page.getByTestId("ward-ed-screen")).toContainText(
      /expiry written on the form|no expiry recorded from the form/i,
    );

    // At least one patient carrying a legal form shows the form-expiry line — the form column is
    // rendered as its own thing, not folded into the department clock above it.
    const formExpiryLines = page.locator('[data-testid^="ward-ed-form-expiry-"]');
    expect(await formExpiryLines.count()).toBeGreaterThan(0);

    // A department can raise a referral.
    await expect(page.getByRole("button", { name: /Raise referral/ })).toBeVisible();
  });

  /**
   * Addendum R40 (Global Constraint), the same rule `ward-screen.tsx`'s unresolved-unit test
   * proves: an id `edById` cannot resolve must render an explicit empty state naming the id —
   * never a substituted department. Checked against the real fixture first so this test cannot
   * silently start passing against a real department if one is ever added with this id.
   */
  test("names an unresolved emergency department id rather than substituting a different one", async ({ page }) => {
    const bogusEdId = "nonexistent-ed-does-not-exist";
    expect(edById(bogusEdId), "fixture assumption: this id resolves to no real department").toBeUndefined();

    await page.goto(`/mockups/ward-flow/ed/${bogusEdId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("ward-ed-screen")).toContainText(bogusEdId);
    await expect(page.locator('[data-testid^="ward-ed-card-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="ward-ed-patient-"]')).toHaveCount(0);
  });

  /**
   * 🔴 **RE-POINTED, Task T1 (docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md item 1),
   * NOT DELETED — its premise (a merged "legal clock" dated from `formedAt` or `openedAt`) is gone,
   * but the fixture facts it was pinned to are still true and still worth proving on a rendered
   * page.**
   *
   * `peel-ed` carries WF-005 and WF-009, both a legal form with no `dueAt` recorded (re-measured
   * against this branch's fixture, pinned by id rather than `.first()`, the same discipline ruling
   * R24 asked for). Both must now show the SAME form-expiry line — "No expiry recorded from the
   * form." — because that line reads only `legalForm.dueAt`, never `formedAt` and never which
   * department clock a patient happens to carry. `data-minutes-in-department` is untouched by any
   * of this: it still reads only `openedAt`, so WF-005's figure stays exactly 330, the same number
   * the test this replaces pinned. And the two deleted attributes, `data-community-formed` and
   * `data-minutes-legal-clock`, must not have quietly come back on either row.
   */
  test("a form with no recorded expiry reads identically for every patient who carries one, and the department clock is unmoved", async ({
    page,
  }) => {
    // Keep the fixture's exact department duration stable across hydration and network waits.
    // Install before the paused instant so pauseAt cannot race the running fake clock.
    await page.clock.install({ time: new Date("2026-08-26T09:59:00Z") });
    await page.clock.pauseAt(new Date("2026-08-26T10:00:00Z"));
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const communityRow = page.getByTestId("ward-ed-patient-WF-005");
    await expect(communityRow).toHaveAttribute("data-minutes-in-department", "330");
    await expect(page.getByTestId("ward-ed-form-expiry-WF-005")).toHaveText("No expiry recorded from the form.");
    await expect(communityRow).not.toHaveAttribute("data-community-formed");
    await expect(communityRow).not.toHaveAttribute("data-minutes-legal-clock");

    const plainRow = page.getByTestId("ward-ed-patient-WF-009");
    await expect(page.getByTestId("ward-ed-form-expiry-WF-009")).toHaveText("No expiry recorded from the form.");
    await expect(plainRow).not.toHaveAttribute("data-community-formed");
    await expect(plainRow).not.toHaveAttribute("data-minutes-legal-clock");
  });

  /**
   * WF-005 (task report finding): carries an un-examined Form 1A AND an already-accepted
   * transport job at the same time. The honest single outstanding item is the transport that is
   * actually in motion — not the older, non-blocking examination gap — because stage governs
   * `outstandingItem`'s priority before the examination check ever runs (see that function's own
   * comment in `ed-screen.tsx`). Pinned by id, per the task's own warning not to assume.
   */
  test("names transport, not examination, as WF-005's honest outstanding item", async ({ page }) => {
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const outstanding = page.getByTestId("ward-ed-outstanding-WF-005");
    await expect(outstanding).toHaveAttribute("data-kind", "transport");
    await expect(outstanding).toContainText(/Accepted/);
  });

  /**
   * `HANDOVER_READY` requires stage `pulled` and nothing else (`ward-flow-reducer.ts`'s own
   * `case "HANDOVER_READY"`). WF-016 (`peel-ed`, `pulled`) proves the control is live and that
   * dispatching it actually changes the outstanding item to transport; WF-303 (`peel-ed`,
   * `accepted_awaiting_bed`) proves the control never advertises an action the reducer would
   * refuse — `aria-disabled`, never native `disabled`, naming the movement's real stage.
   */
  test("marks handover ready only once a bed is pulled and transport is booked, mirroring the reducer's own precondition", async ({
    page,
  }) => {
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    // Interacting (the click below) before hydration completes silently no-ops — a plain DOM
    // click with no React listener attached yet throws nothing and changes nothing. Every other
    // interactive test in this file waits for `networkidle` before its first click (see
    // `gotoWard`'s own such wait above); this test originally omitted it and the click reliably
    // did nothing as a result — diagnosed directly against the live app (see the task report),
    // not assumed. The other four tests in this describe block are read-only against static
    // server-rendered attributes and do not need it, but this is the one that clicks.
    await page.waitForLoadState("networkidle");

    const blockedHandover = page.getByTestId("ward-ed-handover-WF-303");
    await expect(blockedHandover).toHaveAttribute("aria-disabled", "true");
    await expect(blockedHandover).toHaveAttribute("title", /accepted, awaiting bed/i);

    const readyHandover = page.getByTestId("ward-ed-handover-WF-016");
    // HANDOVER_READY now refuses a movement with no transport booked — the reducer's own
    // `case "HANDOVER_READY"` says so, dated 2026-08-31, and `handoverBlockedReason` mirrors it on
    // this screen. WF-016 sits at `pulled` with no transport in the fixture, so the control is
    // blocked before booking and states the real reason, exactly like the WF-303 case above.
    //
    // ⚠️ The repair BOOKS transport rather than asserting less. Relaxing the assertion would have
    // made the test green against a precondition it no longer exercises; this satisfies the
    // precondition and adds two assertions the test did not previously make.
    await expect(readyHandover).toHaveAttribute("aria-disabled", "true");
    await expect(readyHandover).toHaveAttribute("title", /no transport booked/i);

    const unfoldEd16 = page.getByTestId("ward-ed-unfold-WF-016");
    if (await unfoldEd16.isVisible()) await unfoldEd16.click();
    await page.getByTestId("ward-ed-book-transport-toggle-WF-016").click();
    await page.getByTestId("ward-ed-transport-provider-WF-016").selectOption("Ambulance service");
    await page.getByTestId("ward-ed-transport-escort-no-WF-016").check();
    // Owner's third ruling, 2026-09-17: the three phone-logged facts, required and never defaulted.
    await page.getByTestId("ward-ed-transport-cad-number-WF-016").fill("CAD-ROLES-0016");
    await page.getByTestId("ward-ed-transport-legal-status-voluntary-WF-016").check();
    await page.getByTestId("ward-ed-transport-estimated-time-WF-016").fill("14:30");
    await page.getByTestId("ward-ed-book-transport-confirm-WF-016").click();

    await expect(readyHandover).not.toHaveAttribute("aria-disabled", "true");
    if ((await unfoldEd16.getAttribute("aria-expanded")) !== "true") await unfoldEd16.click();
    await readyHandover.click();

    // `HANDOVER_READY` writes a brand-new `transport` object with no timestamps at all
    // (`ward-flow-reducer.ts`'s own `case "HANDOVER_READY"`), so `transportLeg` resolves it to
    // the "Requested" leg — never `undefined` (that value is reserved for a movement with no
    // `transport` object at all — reachable in the reducer's own type, `movement.transport` being
    // optional, though ruling R64 established that no fixture record actually reaches
    // "handover_ready" without one: HANDOVER_READY is the only producer of that stage and it
    // always creates the job in the same update. WF-319 used to be exactly that unreachable
    // state — a fixture defect this ruling corrected — so it is no longer this case's example).
    // Re-measured directly against the live app (see the task report) rather than assumed, after
    // an earlier version of this assertion got it wrong.
    const outstanding = page.getByTestId("ward-ed-outstanding-WF-016");
    await expect(outstanding).toHaveAttribute("data-kind", "transport");
    await expect(outstanding).toContainText(/Requested/);
  });

  /**
   * Exactly one police arrival exists in the whole 48-movement fixture, and it is WF-009 at
   * `peel-ed` (re-measured against this branch's fixture — see the task report). Pinned by id so
   * a fixture change that removes it fails loudly rather than this count silently reading zero.
   */
  test("flags exactly the one police arrival at peel-ed, and no other patient", async ({ page }) => {
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Wait for the first record trigger to hydrate, as in openDesignShowcase below.
    await page.waitForFunction(() => {
      const trigger = document.querySelector('button[title^="View patient details"]');
      return trigger?.isConnected === true && Object.keys(trigger).some((key) => key.startsWith("__reactProps$"));
    });
    // Police presence belongs to the recorded detail, as requested for the compact board.
    // Check every patient record: exactly WF-009 carries this information.
    const rows = page.locator('[data-testid^="ward-ed-patient-"]');
    const rowIds = await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-testid")!),
    );
    expect(rowIds).toContain("ward-ed-patient-WF-009");
    for (const id of rowIds) {
      await page.getByTestId(id).locator('button[title^="View patient details"]').click();
      const record = page.getByRole("dialog");
      await expect(record).toBeVisible();
      await expect(record.getByText("Police presence", { exact: true })).toHaveCount(
        id === "ward-ed-patient-WF-009" ? 1 : 0,
      );
      if (id === "ward-ed-patient-WF-009")
        await expect(record.getByText("Police in attendance", { exact: true })).toBeVisible();
      await record.getByRole("button", { name: "Close patient details" }).click();
    }
  });

  /**
   * Deferred item 1, completing the four role screens. The ED screen's operating structure is its
   * two working sections — raising a referral, and the department's own patient list — plus the
   * governance banner; each must still be present in dark, forced-colours and print.
   */
  test("retains its operating structure in dark, forced-colours, and print modes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("ward-ed-governance")).toBeVisible();
    if ((await page.getByTestId("ward-ed-raise-referral-toggle").getAttribute("aria-expanded")) !== "true") {
      await page.getByTestId("ward-ed-raise-referral-toggle").click();
    }
    await expect(page.getByRole("region", { name: "New referral" })).toBeVisible();
    await expect(page.getByRole("region", { name: "This department's patients" })).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByTestId("ward-ed-governance")).toBeVisible();
    if ((await page.getByTestId("ward-ed-raise-referral-toggle").getAttribute("aria-expanded")) !== "true") {
      await page.getByTestId("ward-ed-raise-referral-toggle").click();
    }
    await expect(page.getByRole("region", { name: "New referral" })).toBeVisible();
    await expect(page.getByRole("region", { name: "This department's patients" })).toBeVisible();

    await page.emulateMedia({ colorScheme: "light", forcedColors: "none", media: "print" });
    await expect(page.locator('[data-testid="ward-ed-governance"]:visible')).toBeVisible();
    await expect(page.locator('[data-testid="ward-ed-patient-WF-005"]:visible')).toBeVisible();
  });

  /**
   * RF-009 exists to make this screen demonstrable, and until now nothing had looked at it.
   *
   * It was added 2026-08-30 because every emergency department's psychiatry inbox was empty and the
   * screen was "indistinguishable from a working one with nothing to show". `rph-ed` was the ONLY
   * department whose inbox was non-empty at the time, and `rph-ed` appeared in **zero** of the 46
   * `ui-*.spec.ts` files before this test, against a control of `peel-ed` appearing 13 times in this
   * one. A fixture added to make a screen demonstrable, and no browser ever opened the screen.
   *
   * ⚠️ **`peel-ed`'s inbox stopped being empty on 2026-09-03, and this test asserted the old state
   * for eight days without anybody noticing** (no routine gate runs a `@mockup` spec). `RF-013` —
   * the origin of `WF-009`, `police` arrival at `peel-ed` — carries a `triagedAt` and one
   * destination, `{ kind: "emergency_department", edId: "peel-ed", purpose: "psychiatric_review" }`,
   * `state: "accepted"`. `edArrivedFor` (`ward-referrals.ts`) admits `queued` AND `accepted` rows —
   * the owner's ruling that accepting a referral does not make anybody arrive, so acceptance alone
   * cannot drop a row off this list — and `hasArrivedInDepartment` reads `inDepartmentAt ??
   * triagedAt`, which `RF-013`'s `triagedAt` satisfies. Every condition
   * `edArrivedFor(referrals, "peel-ed", "psychiatric_review")` checks is met.
   *
   * ⚠️ Confirmed by RENDERING the department, not by this reasoning alone: two causes fit the old
   * failure equally well from the seed side — a stale fixture assumption (this one) or a genuine
   * regression that stopped filtering the inbox by department — and only opening the screen tells
   * them apart. `peel-ed` shows "Referrals · 1 patient", `RF-013`, "In department", "7h 20m since
   * triage" — one row, matching the predicate above exactly.
   *
   * The proof this test exists for — that each department's list is SELECTED for it, not rendered
   * for every department alike — now needs both directions stated, since neither department's inbox
   * is empty any more: `rph-ed` must show its own referral and never `peel-ed`'s, and `peel-ed` must
   * show its own and never `rph-ed`'s.
   *
   * ⚠️ **THE TWO ROWS ARE IN DIFFERENT STATES, WHICH IS WHY THIS TEST'S NAME DOES NOT SAY
   * "QUEUED".** `RF-009` at `rph-ed` is `queued` — nobody has answered it. `RF-013` at `peel-ed` is
   * `accepted`, answered by "ED mental health" at the moment `WF-009`'s journey opened. This list is
   * `edArrivedFor` — the people who are HERE — and NOT a worklist, so it holds both; the section's
   * own heading is "Referrals" rather than "Inbox" for exactly that reason, and the decline control
   * renders only on a `queued` row. A name calling both rows queued would say, of `peel-ed`, that a
   * patient is waiting on an answer their department has already given.
   */
  test("shows rph-ed and peel-ed each their own arrived psychiatric-review referral, and never the other's", async ({
    page,
  }) => {
    expect(edById("rph-ed"), "fixture assumption: rph-ed resolves to a real department").toBeDefined();
    expect(edById("peel-ed"), "fixture assumption: peel-ed resolves to a real department").toBeDefined();

    await page.goto("/mockups/ward-flow/ed/rph-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Exact, not `> 0`: RF-009 is the only referral this department's inbox should hold.
    await expect(page.locator('[data-testid^="ward-ed-inbox-row-"]')).toHaveCount(1);

    const rphRow = page.getByTestId("ward-ed-inbox-row-RF-009");
    await expect(rphRow).toBeVisible();
    await expect(rphRow).toHaveAttribute("data-ed-id", "rph-ed");
    await expect(rphRow).toHaveAttribute("data-purpose", "psychiatric_review");
    await expect(page.getByTestId("ward-ed-inbox-purpose-RF-009")).toContainText("For psychiatric review");

    // Both clocks render. Their VALUES are deliberately not pinned: the provider ticks every 30s and
    // `now` is live in the browser, so 245 and 35 minutes increment while the page is open. Asserting
    // the numbers would buy nothing and would flake on a slow load.
    await expect(page.getByTestId("ward-ed-inbox-department-clock-RF-009")).toBeVisible();
    await expect(page.getByTestId("ward-ed-inbox-referral-clock-RF-009")).toBeVisible();

    // And never peel-ed's own referral — the scoping property this test exists to prove.
    await expect(page.getByTestId("ward-ed-inbox-row-RF-013")).toHaveCount(0);

    await page.goto("/mockups/ward-flow/ed/peel-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Exact, not `> 0`: RF-013 is the only referral this department's inbox should hold.
    await expect(page.locator('[data-testid^="ward-ed-inbox-row-"]')).toHaveCount(1);

    const peelRow = page.getByTestId("ward-ed-inbox-row-RF-013");
    await expect(peelRow).toBeVisible();
    await expect(peelRow).toHaveAttribute("data-ed-id", "peel-ed");
    await expect(peelRow).toHaveAttribute("data-purpose", "psychiatric_review");
    await expect(page.getByTestId("ward-ed-inbox-purpose-RF-013")).toContainText("For psychiatric review");
    await expect(page.getByTestId("ward-ed-inbox-department-clock-RF-013")).toBeVisible();
    await expect(page.getByTestId("ward-ed-inbox-referral-clock-RF-013")).toBeVisible();

    // And never rph-ed's own referral.
    await expect(page.getByTestId("ward-ed-inbox-row-RF-009")).toHaveCount(0);
  });

  /**
   * The decline control, landed 2026-09-01 and until now covered by unit tests only.
   *
   * ⚠️ Three things here would each produce a confusing red if assumed rather than checked, and all
   * three are behaviour rather than markup:
   *
   *  - The confirm is `aria-disabled`, NEVER natively `disabled`, so a Playwright `toBeDisabled()`
   *    fails against a control that is working correctly. The control keeps its tab stop on purpose,
   *    so the reason it is unavailable can be reached by a screen reader.
   *  - No reason is preselected, deliberately. The owner ruled the reason list likely incomplete, so
   *    a default would have a clinician record the closest available reason and thereby file a
   *    clinical fact nobody chose.
   *  - Only two of the six decline reasons are offered here, derived by filtering rather than
   *    hand-listed: this screen answers a request for REVIEW, and the other four answer a request for
   *    a BED. Asserting their absence is the closest a browser can get to "this screen is not
   *    answering a bed question".
   *
   * On confirm the row LEAVES the inbox — `edReferralsFor` keeps only `queued` addressings — so the
   * proof of success is disappearance, not a changed state in place. What the browser cannot show is
   * WHO was recorded as deciding, or the reason stored against it: nothing renders `decidedBy` or the
   * reason anywhere on this screen. That half stays a DOM test, and this test does not pretend to it.
   */
  test("rph-ed cannot record a decline without a reason, and the referral leaves the inbox once it can", async ({
    page,
  }) => {
    await page.goto("/mockups/ward-flow/ed/rph-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await expect(page.locator('[data-testid^="ward-ed-inbox-row-"]')).toHaveCount(1);

    await page
      .getByTestId("ward-ed-inbox-row-RF-009")
      .getByRole("button", { name: /View referral/u })
      .click();
    await page.getByTestId("ward-ed-inbox-decline-RF-009").click();
    await expect(page.getByTestId("ward-ed-inbox-decline-panel-RF-009")).toBeVisible();

    const confirm = page.getByTestId("ward-ed-inbox-decline-confirm-RF-009");
    await expect(confirm, "unavailable-with-a-reason uses aria-disabled, never native disabled").toHaveAttribute(
      "aria-disabled",
      "true",
    );

    const reason = page.getByTestId("ward-ed-inbox-decline-reason-RF-009");
    // Exact set, not a subset: the assertion that matters is that the four BED-shaped reasons are
    // absent, and a `toContainText` on the two present ones would pass whether or not they were.
    // ⚠️ A FOURTH OPTION ARRIVED ON 2026-09-02 AND THIS EXACT-SET ASSERTION IS WHY THAT IS SAFE.
    // The owner added a catch-all to `REFERRAL_DECLINE_REASONS`; `ED_DECLINE_REASONS` derives by
    // EXCLUDING the four bed-shaped reasons, so a non-bed-shaped member arrives here on its own
    // rather than being silently dropped — which is the whole point of writing that filter as an
    // exclusion. The exact set is KEPT, not relaxed to a subset: the property pinned is still that
    // the four bed-shaped reasons are ABSENT, and a subset check would pass either way.
    //
    // ⚠️ ADDED BY WARD BUILDER TWO, WHICH CANNOT RUN PLAYWRIGHT. This line is REASONED from the
    // filter and the label, never observed. If the rendered text differs, trust this line least.
    await expect(reason.locator("option")).toHaveText([
      "Choose a reason",
      "Belongs to another service",
      "Referred elsewhere",
      "Another reason — needs follow-up",
    ]);

    // Pressing it while unavailable must change nothing — the handler is inert, not merely styled.
    //
    // ⚠️ `force` IS LOAD-BEARING AND ITS ABSENCE READS AS FLAKE, NOT AS FAILURE. Playwright's
    // actionability check treats `aria-disabled="true"` as not-enabled and refuses to click, so
    // without `force` this line does not fail loudly — it retries for 45s and times out. That is
    // the repo convention working against the test: `aria-disabled` + an inert handler is chosen
    // precisely so the control KEEPS its tab stop and its stated reason, and the only way to prove
    // the handler is inert is to dispatch the click anyway. Same shape as
    // `ui-caring-contact-mockup.spec.ts:276` and five sites in `ui-ward-coordinator.spec.ts`.
    await confirm.click({ force: true });
    await expect(page.getByTestId("ward-ed-inbox-row-RF-009")).toBeVisible();

    await reason.selectOption({ label: "Referred elsewhere" });
    await expect(confirm).not.toHaveAttribute("aria-disabled", "true");

    await confirm.click();

    await expect(page.getByTestId("ward-ed-inbox-row-RF-009")).toHaveCount(0);
    await expect(page.getByTestId("ward-ed-inbox-empty")).toBeVisible();
  });

  /*
   * THE THIRD PROPERTY THIS JOURNEY WAS ASKED FOR — that an emergency department may not decline a
   * WARD bed — is deliberately not tested here, because this screen cannot express the violation.
   *
   * The inbox is built from `edReferralsFor(referrals, edId, "psychiatric_review")`, which drops any
   * addressing whose kind is not `emergency_department`, so a ward-addressed row can never render and
   * there is no control to click. `submitDecline` then hardcodes `destinationKind:
   * "emergency_department"`, so even a row that somehow rendered would dispatch the ED kind.
   *
   * The rule itself lives in the reducer's `answerableBy` map and is pinned in
   * `tests/ward-referral-decision-scope.test.ts`, in BOTH directions: "REFUSES AN EMERGENCY DEPARTMENT
   * DECIDING ON A PSYCHIATRIC WARD'S BED" and "REFUSES A WARD DECIDING ON AN EMERGENCY
   * DEPARTMENT'S REFERRAL — the same rule, mirrored". A browser step here would assert the filter, not
   * the rule, while reading as though it proved the rule — which is worse than leaving it out.
   */
});

test.describe("@mockup Role switcher — the loop", () => {
  test.describe.configure({ timeout: 60_000 });

  /**
   * Task 12 (addendum R41/R42/R48/R52/R67). One patient, WF-315, walked through all four roles
   * in a single browser window — the journey that proves Ward Flow Phase 3 actually works, not
   * just that eleven screens each work in isolation.
   *
   * WF-315 was chosen and verified against the real fixture and reducer, not assumed (see the
   * task report): seed stage `placement_requested`, `originEdId: "arm-ed"`, a 1A form with no
   * examination recorded yet, and exactly three eligible candidates
   * (`rph-adult-secure`/`fsh-adult-secure`/`rgh-adult-secure`). The whole ten-dispatch chain
   * below was driven through `wardFlowReducer` directly from a fresh seed before this test was
   * written, with `state.rejections` staying empty at every step.
   *
   * THE ONE RULE THAT MATTERS MORE THAN ANY SINGLE ASSERTION HERE: this journey navigates by
   * CLICKING the role switcher, never by `page.goto()`. A `goto` is a full page load — it
   * re-mounts `WardFlowProvider` and resets every movement back to the seed fixture, so the
   * journey would pass or fail for reasons entirely unrelated to the code while still looking
   * like it proved the loop. The one permitted `goto` below is the very first navigation, which
   * opens the ED screen the journey starts from (R67: a patient is reviewed before a bed is
   * sought).
   */
  test("walks WF-315 through all four roles in one browser window without ever reloading", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });

    // Fixture assumptions, checked against the real data rather than assumed — if either ever
    // stops resolving, this test should fail loudly here rather than several steps later against
    // a confusing downstream symptom.
    const originEd = edById("arm-ed");
    const destinationUnit = unitById("rph-adult-secure");
    expect(originEd, "fixture assumption: arm-ed resolves to a real department").toBeDefined();
    expect(destinationUnit, "fixture assumption: rph-adult-secure resolves to a real unit").toBeDefined();

    function switcherTrigger() {
      return page.getByRole("button", { name: "Change view" });
    }

    /**
     * Opens the switcher and clicks the named menu item — never a rank (ruling R41 retired
     * `.first()` for the whole phase). Each name passed below is checked, immediately below this
     * function, to be a substring of exactly one menu item's accessible name, so a Playwright
     * substring match here can never silently resolve to the wrong destination.
     *
     * `ensureToolsOpen`/`ensureToolsClosed` bracket the switch: the switcher lives inside
     * `WardBar`'s Tools drawer now (Task 8, 2026-09-11) — see those helpers' own header.
     */
    async function switchTo(menuItemName: string) {
      await ensureToolsOpen(page);
      await switcherTrigger().click();
      const matches = page.getByRole("menuitem", { name: menuItemName });
      await expect(matches, `"${menuItemName}" must resolve to exactly one menu item`).toHaveCount(1);
      const href = await matches.getAttribute("href");
      await matches.click();
      // Let the navigation commit before closing the drawer: closing calls history.back() while the
      // drawer's entry is current, which undid a slow pending navigation (roles:1030, 26 Sept).
      if (href) {
        const target = new URL(href, page.url()).pathname;
        await page.waitForURL((url) => url.pathname === target, { timeout: 15_000 });
      }
      await ensureToolsClosed(page);
    }

    // --- Step 1: ED — record the examination (R67). The one permitted `goto`. ---
    await page.goto("/mockups/ward-flow/ed/arm-ed", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Since 687f018d6d (24 Sept) every ED row action, the primary one included, sits in a folded
    // "Actions ▾" menu. Unfold it only if folded — the toggle flips, so an unconditional click on
    // an already-open menu would close it (same reason as `ensureToolsOpen`). Step 6 below unfolds
    // the same way for transport.
    const unfoldEd315AtStart = page.getByTestId("ward-ed-unfold-WF-315");
    if ((await unfoldEd315AtStart.getAttribute("aria-expanded")) !== "true") await unfoldEd315AtStart.click();
    await page.getByTestId("ward-ed-examine-toggle-WF-315").click();
    const examineForm = page.getByTestId("ward-ed-examine-form-WF-315");
    await expect(examineForm).toBeVisible();
    await examineForm.getByRole("radio", { name: "Inpatient treatment order" }).check();
    await examineForm.getByRole("button", { name: "Confirm examination outcome" }).click();
    // Since 2026-08-24 the examination does NOT change the form — WF-315 stays on its 1A — and
    // the movement remains referable. What changes is that the examination is now recorded, so
    // the outstanding item for WF-315 must no longer read "Examination" once this submits. The
    // assertion below is unchanged; only the reason it holds is different.
    await expect(page.getByTestId("ward-ed-outstanding-WF-315")).not.toHaveAttribute("data-kind", "examination");

    // --- Step 2: Coordinator — select WF-315, refer to all three candidates. ---
    await switchTo("Coordinator");
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await queue.getByTestId("ward-queue-row-WF-315").click();
    await openShortlistSections(shortlist);
    await shortlist.getByTestId("ward-shortlist-candidate-rph-adult-secure").click();
    // 🔴 2026-09-17: retargeted from `fsh-adult-secure` to `bty-adult-secure`. Re-measured against
    // the current fixture (`eligibleCandidatesAmong` for WF-315): the 17 September sample-data and
    // capacity changes moved Bunbury Adult Secure into WF-315's shortlist and Fremantle Hospital
    // Adult Secure out of it. The property this step proves — three live candidates, all
    // referable in parallel — is unchanged; only which third unit qualifies moved.
    await shortlist.getByTestId("ward-shortlist-candidate-bty-adult-secure").click();
    await shortlist.getByTestId("ward-shortlist-candidate-rgh-adult-secure").click();
    await shortlist.getByTestId("ward-shortlist-refer").click();
    // Three live referrals — exactly why the ward hop below cannot be inferred and must use the
    // picker (addendum R52). Whole-branch review M3: the old regex-based `toContainText` assertion
    // was satisfied by a single "Parallel referral" badge, so it never actually checked the claim
    // this comment makes. `toHaveCount(3)` on the real badge locator checks the stated claim.
    //
    // ⚠️ SPLIT 2026-09-02, AND THE SECOND LINE IS WHAT MAKES THE FIRST MEAN ANYTHING. Until today
    // `shortlist-panel.tsx` gave BOTH badge arms — the resolved one and the "referral to an
    // unresolved unit" one — the same testid, so this count summed two different kinds. It read
    // three and could not tell three resolved referrals from two resolved plus one unresolved,
    // which is the exact confusion the count exists to detect. All three units referred above
    // (RPH, BTY, RGH Adult Secure) are real and resolve, so the correct reading is 3 and 0.
    await expect(shortlist.getByTestId("ward-shortlist-referred-badge")).toHaveCount(3);
    await expect(shortlist.getByTestId("ward-shortlist-unresolved-referred-badge")).toHaveCount(0);

    // --- Step 3: Ward, reached via the picker (three live referrals — R52). ---
    await switchTo("Dabakarn");
    await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // v6 ward home: Awaiting your answer is its own card beside Every bed, always shown (no switch).
    const incoming = page.getByTestId("ward-incoming-WF-315");
    await expect(incoming).toBeVisible();
    await incoming.getByRole("button", { name: "Accept in principle" }).click();

    // --- Step 4: Ward — hold a bed. ---
    await page.locator("#tabBtn-coming").click();
    const accepted = page.getByTestId("ward-accepted-WF-315");
    await expect(accepted).toBeVisible();
    await accepted.getByRole("button", { name: "Pull a bed" }).click();

    // --- Step 5 (recommended): Coordinator — confirm the acceptance is visible from another
    // role. The shared `focusMovementId` (ward-flow-provider.tsx) re-selects WF-315 on this
    // remount without another click — proving the selection itself, not just the movement data,
    // survived the two role switches so far. ---
    await switchTo("Coordinator");
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("complementary", { name: "Explainable shortlist" })).toContainText(
      "Accepted destination: Dabakarn",
    );

    // --- Step 6: ED — book transport, then mark handover ready. Without a booked transport job,
    // every officer action below would be refused (addendum R42).
    //
    // Since commit 5cc23173a (2026-08-31), `HANDOVER_READY` REQUIRES a pre-booked transport job
    // instead of fabricating one on the spot — see `ward-flow-reducer.ts`'s own
    // `case "HANDOVER_READY"` and its screen-side mirror `handoverBlockedReason` in
    // `ed-screen.tsx`. WF-315 is a generated fixture movement (`routineMovements(30, 300)` index
    // 315), so `stageFields("placement_requested")` gives it no `transport` at seed, and
    // `PULL_PATIENT` (step 4 above) never sets one either — it only touches `stage`,
    // `pullExpiresAt` and `admissionId`. Without the booking sequence below, the handover click
    // would render `aria-disabled="true"` and do nothing, and the outstanding-item assertion that
    // used to follow it directly would time out waiting for a change that never happens. ---
    await switchTo("Armadale Hospital Emergency Department");
    await expect(page.getByTestId("ward-ed-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const handoverButton = page.getByTestId("ward-ed-handover-WF-315");
    const unfoldEd315 = page.getByTestId("ward-ed-unfold-WF-315");
    if (await unfoldEd315.isVisible()) await unfoldEd315.click();
    await page.getByTestId("ward-ed-book-transport-toggle-WF-315").click();
    await page.getByTestId("ward-ed-transport-provider-WF-315").selectOption("Patient transport service");
    await page.getByTestId("ward-ed-transport-escort-no-WF-315").check();
    // Owner's third ruling, 2026-09-17: the three phone-logged facts, required and never defaulted.
    await page.getByTestId("ward-ed-transport-cad-number-WF-315").fill("CAD-ROLES-0315");
    await page.getByTestId("ward-ed-transport-legal-status-voluntary-WF-315").check();
    await page.getByTestId("ward-ed-transport-estimated-time-WF-315").fill("14:30");
    await page.getByTestId("ward-ed-book-transport-confirm-WF-315").click();
    // Proves the booking actually landed rather than just asserting the clicks happened: before
    // this, `handoverBlockedReason` renders the control `aria-disabled="true"` and a click on it
    // is inert.
    await expect(handoverButton).not.toHaveAttribute("aria-disabled", "true");

    if ((await unfoldEd315.getAttribute("aria-expanded")) !== "true") await unfoldEd315.click();
    await handoverButton.click();
    await expect(page.getByTestId("ward-ed-outstanding-WF-315")).toHaveAttribute("data-kind", "transport");

    // --- Steps 7-10: Officer — Accepted, En route, Collected, Delivered. ---
    await switchTo("Officer");
    await expect(page.getByTestId("ward-officer-screen")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const job = page.getByTestId("ward-officer-job-WF-315");
    const selectJob = page.getByTestId("ward-officer-select-WF-315");
    // WF-315's transport job was only just created (step 6), so it is very unlikely to already
    // be the screen's default-selected job — the default is the first job in fixture array
    // order among the seed jobs (`ui-ward-roles.spec.ts`'s own "gives the officer four actions"
    // test pins that default to WF-005). Checked rather than assumed, so this journey does not
    // silently depend on an ordering coincidence either way.
    if (await selectJob.count()) {
      await selectJob.click();
    }
    await expect(job.locator('[class*="actionButton"]')).toHaveCount(4);
    // Item 31 (owner's 17 September answers): the officer's own fourth action reads "Delivered",
    // not "Arrived" — the event dispatched is still PATIENT_ARRIVED.
    for (const label of ["Accepted", "En route", "Collected", "Delivered"]) {
      await job.getByRole("button", { name: label }).click();
    }

    // --- Step 11: Coordinator — the patient has left the system. ---
    await switchTo("Coordinator");
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("region", { name: "Priority queue" }).getByTestId("ward-queue-row-WF-315")).toHaveCount(
      0,
    );
  });
});

/**
 * Whole-branch review Critical 1, permanent regression coverage. Reproduces the reviewer's own
 * decisive live proof, verbatim in shape: a ward drops its own confirmed capacity to zero, and
 * every screen that reads that unit's capacity — starting with the ward's own — must reflect it
 * on the very next render, with no `page.goto()` anywhere in the sequence. A `goto` would
 * re-mount `WardFlowProvider` and re-seed `state.units` from the frozen fixture, which would
 * make every assertion below pass whether or not the fix actually threads live `units` through —
 * exactly the class of test that could not have caught C1 in the first place.
 *
 * This is added as a permanent test, not a one-off manual probe: C1 was spec §4's own
 * predicted "correction that most changes the phase", so its rule (a ward's own bed grid, its
 * own Hold control, and the coordinator's own diagram/shortlist must never disagree about the
 * same unit at the same instant) is exactly the kind of property that regresses silently — the
 * whole-branch review found it was wrong for the entirety of Phase 3's development without a
 * single existing test noticing.
 */
test.describe("@mockup Live capacity — a ward's own action reaches every screen that reads it", () => {
  test.describe.configure({ timeout: 45_000 });

  test("a ward confirming zero allocatable beds updates its own screen, then the coordinator, without ever reloading", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });

    function switcherTrigger() {
      return page.getByRole("button", { name: "Change view" });
    }
    // `ensureToolsOpen`/`ensureToolsClosed` bracket the switch: the switcher lives inside
    // `WardBar`'s Tools drawer now (Task 8, 2026-09-11) — see those helpers' own header.
    async function switchTo(menuItemName: string) {
      await ensureToolsOpen(page);
      await switcherTrigger().click();
      const matches = page.getByRole("menuitem", { name: menuItemName });
      await expect(matches, `"${menuItemName}" must resolve to exactly one menu item`).toHaveCount(1);
      const href = await matches.getAttribute("href");
      await matches.click();
      // Let the navigation commit before closing the drawer: closing calls history.back() while the
      // drawer's entry is current, which undid a slow pending navigation (roles:1030, 26 Sept).
      if (href) {
        const target = new URL(href, page.url()).pathname;
        await page.waitForURL((url) => url.pathname === target, { timeout: 15_000 });
      }
      await ensureToolsClosed(page);
    }

    // --- Step 1: the ward's own screen, before the drop. Dabakarn seeds with
    // allocatable = 1 (Ready 1 · Closed 1) and carries WF-003 accepted-awaiting-bed, whose Hold
    // control is therefore fully live: no `aria-disabled`, no `title`. ---
    const wardScreen = await gotoWard(page, "rph-adult-secure");

    const bedGrid = wardScreen.getByTestId("ward-unit-beds");
    await expect(bedGrid).toContainText("Ready 1");
    await expect(bedGrid).toContainText("Closed 1");

    // ⚠️ The testid below is the PULL one, not the older spelling. The merge with main took
    // main's copy of this line, and main predates this line's rename of that control -- so the
    // query looked for a testid the ward screen no longer renders, while line 83 of this same
    // file already used the current one. The file contradicted itself and only a browser run
    // could see it.
    await page.locator("#tabBtn-coming").click();
    const pullButton = wardScreen.getByTestId("ward-pull-WF-003");
    await expect(pullButton).toBeVisible();
    await expect(pullButton).not.toHaveAttribute("aria-disabled");
    await expect(pullButton).not.toHaveAttribute("title");

    // --- Step 2: confirm zero allocatable beds, on this same page, no reload. ---
    // The capacity form opens from "Confirm numbers". It is not on the Decisions queue.
    await wardScreen.getByRole("button", { name: /Confirm (today.s )?numbers/ }).click();
    await wardScreen.getByTestId("ward-capacity-input").fill("0");
    await wardScreen.getByTestId("ward-capacity-submit").click();

    // --- Step 3: the ward's own screen must move. This is the exact proof the reviewer
    // performed and found failing: "typing 0 into Confirm allocatable beds ... beds: Ready 2
    // ... Currently confirmed 2" — the screen that raised the event never moved. ---
    await expect(bedGrid).toContainText("Ready 0");
    await expect(bedGrid).toContainText("Closed 2"); // the physically-empty pool is unchanged; it is now not offered rather than ready
    await expect(wardScreen.getByText(/Currently confirmed 0 at/)).toBeVisible();
    await wardScreen
      .getByRole("dialog", { name: /Confirm capacity figures/ })
      .getByRole("button", { name: "Done" })
      .click();

    // --- Step 4: the Hold control must stop advertising an action the reducer would now
    // refuse — the reviewer's Proof 2 ("hold button ... aria-disabled = null ... nothing
    // happened"). It must carry BOTH aria-disabled and a stated reason naming this ward. ---
    await page.locator("#tabBtn-coming").click();
    await expect(pullButton).toHaveAttribute("aria-disabled", "true");
    await expect(pullButton).toHaveAttribute("title", /No allocatable bed remains at Dabakarn/);

    // --- Step 5: click through to the coordinator — the role switcher's real <Link>, never a
    // goto. Coordinator is never ambiguous (spec §9: "Statewide — no ward or department"). ---
    await switchTo("Coordinator");
    await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // --- Step 6: the reviewer's Proof 3. Select any open movement (the diagram renders every
    // one of the 23 units' own capacity regardless of which movement is selected, so which
    // movement is picked here does not matter to this proof), then select Dabakarn's
    // own node in the statewide flow diagram. ---
    // ⚠️ EXACT, NOT SUBSTRING — see `ui-ward-coordinator.spec.ts`'s own comment on the same
    // ambiguity: the diagram's scroll container carries a second, more specific
    // `aria-label="Statewide flow diagram"` nested inside this section since the third-edition
    // visual upgrade (883ecfdfb4).
    // 2026-10-07 re-point (v6 Home): Home's State bedflow card is a grouped ward list with no SVG
    // arrows, so "the diagram has rendered" now waits on its first ward node instead of the old
    // `svg path[marker-end]`. The nodes keep the old diagram's `ward-diagram-unit-<id>` ids.
    const diagram = page.getByRole("region", { name: "State Bedflow", exact: true });
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]').first()).toBeAttached({ timeout: 15_000 });

    await page
      .getByRole("region", { name: "Priority queue" })
      .locator('[data-testid^="ward-queue-row-"]')
      .first()
      .click();

    const rphNode = diagram.getByTestId("ward-diagram-unit-rph-adult-secure");
    // The diagram's own unit node reads the unit's live capacity directly (Critical 1 also named
    // `flow-diagram.tsx`'s `serviceGroups`/`unplacedUnits`, which used to be grouped from the
    // frozen `allUnits()` rather than the live `units` this diagram now receives as a prop).
    await expect(rphNode).toContainText("Ready 0");
    await rphNode.click();

    // --- Step 7: the shortlist's own explainable gate row for this exact unit — the reviewer's
    // literal proof text: "Allocatable bed / Met / 1 allocatable" while the ward had just said
    // zero. It must now read the opposite: Not met, 0 allocatable. `ward-eligibility.ts` is a
    // protected surface — this is not a change to what the gate judges, only to which unit's
    // live data it is judging. ---
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await expect(shortlist).toContainText("Dabakarn");
    const allocatableGate = shortlist.getByTestId("ward-gate-allocatable_bed");
    await expect(allocatableGate).toHaveAttribute("data-pass", "false");
    await expect(allocatableGate).toContainText("0 allocatable");
  });
});

const SHOWCASE_ROUTE = "/mockups/ward-flow/sovereign";
const SHOWCASE_TABLE_NAME = "Synthetic rows showing shared table, kind and status components";
const SHOWCASE_DRAWERS = [
  { label: "Referral", testId: "ward-bar-referral-sheet", role: "dialog" },
  { label: "Tasks", testId: "ward-bar-tasks-sheet", role: "dialog" },
  { label: "Activity", testId: "ward-bar-activity-sheet", role: "dialog" },
  { label: "Tools", testId: "ward-bar-tools-sheet", role: "dialog" },
  { label: "Service selector", testId: "ward-bar-service-panel", role: "group" },
] as const;

async function openDesignShowcase(page: Page) {
  await page.goto(SHOWCASE_ROUTE, { waitUntil: "domcontentloaded" });
  // Streamed content may briefly leave a hidden duplicate of the screen in the tree.
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Design system showcase" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  // Until hydration finishes, a click lands on a button whose handlers are not attached. React stamps
  // its props onto a host node only once it owns it, so wait for that on the control the tests use.
  // (This wait was added while the ward layout still remounted itself after load; that remount was
  // removed on 3 Oct 2026, and the hydration wait is still the right guard for the first click.)
  await page.waitForFunction(() => {
    const apply = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Apply example");
    return apply?.isConnected === true && Object.keys(apply).some((key) => key.startsWith("__reactProps$"));
  });
}

async function showcaseTableState(page: Page) {
  return page.getByRole("table", { name: SHOWCASE_TABLE_NAME }).evaluate((table) => {
    const rows = [...(table as HTMLTableElement).tBodies[0]!.rows];
    return {
      firstLabel: rows[0]!.querySelector("th")?.textContent?.trim(),
      firstPadding: getComputedStyle(rows[0]!.cells[0]!).paddingTop,
      secondPadding: getComputedStyle(rows[1]!.cells[0]!).paddingTop,
      density: getComputedStyle(table).getPropertyValue("--ward-table-cell-inset").trim(),
    };
  });
}

async function expectShowcaseNoPageOverflow(page: Page) {
  const amount = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(amount, "the document must fit the viewport without horizontal page scrolling").toBeLessThanOrEqual(1);
}

test.describe("@mockup Ward Flow design system showcase", () => {
  test.describe.configure({ timeout: 60_000 });

  test("desktop anchors, local example states, and existing drawers are usable", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openDesignShowcase(page);
    await expectShowcaseNoPageOverflow(page);
    await expect(page.getByText("Synthetic examples", { exact: true })).toBeVisible();

    const links = page.getByRole("navigation", { name: "Showcase sections" }).locator('a[href^="#"]');
    await expect(links).toHaveCount(4);
    for (let index = 0; index < 4; index++) {
      const link = links.nth(index);
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^#[a-z-]+$/);
      await link.focus();
      await page.keyboard.press("Enter");
      const target = page.locator(href!);
      await expect(target).toBeFocused();
      const top = await target.evaluate((element) => element.getBoundingClientRect().top);
      expect(top, `${href} must clear the fixed 56px WardBar`).toBeGreaterThanOrEqual(55);
      expect(top, `${href} must land in the viewport`).toBeLessThan(1080);
    }

    const input = page.getByRole("textbox", { name: "Example row label" });
    const density = page.getByRole("combobox", { name: "Table density" });
    const before = await showcaseTableState(page);
    await input.fill("");
    await density.selectOption("compact");
    await page.getByRole("button", { name: "Apply example" }).click();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveValue("");
    await expect(density).toHaveValue("compact");
    await expect(page.getByText("Enter a label to apply the example.", { exact: true })).toBeVisible();
    expect(await showcaseTableState(page), "invalid input must preserve the last accepted label and density").toEqual(
      before,
    );

    await input.fill("QA example row");
    await page.getByRole("button", { name: "Apply example" }).click();
    await expect(page.getByText(/Example applied locally\. The first row label and table density/)).toBeVisible();
    // The success message and the density custom property update in the same render, but on a slow
    // runner the cells' computed padding has been read while still at the comfortable value (CI saw
    // "12px" for both). Wait on the rendered padding itself — the property this test is about — before
    // snapshotting, then assert the full snapshot exactly as before.
    for (const key of ["firstPadding", "secondPadding"] as const) {
      await expect
        .poll(async () => (await showcaseTableState(page))[key], {
          message: `applied compact density must change the ${key} computed padding`,
          timeout: 10_000,
        })
        .not.toBe(before[key]);
    }
    const applied = await showcaseTableState(page);
    expect(applied.firstLabel).toBe("QA example row");
    expect(applied.density).not.toBe(before.density);
    expect(applied.firstPadding).not.toBe(before.firstPadding);
    expect(applied.secondPadding).not.toBe(before.secondPadding);
    expect(applied.firstPadding).toBe(applied.secondPadding);

    const unavailable = page.getByRole("button", { name: "Save preset" });
    await expect(unavailable).toHaveAttribute("aria-disabled", "true");
    await expect(unavailable).toHaveAttribute("aria-describedby", "showcase-disabled-reason");
    await expect(page.locator("#showcase-disabled-reason")).toContainText("unavailable");
    await unavailable.focus();
    await expect(unavailable).toBeFocused();
    await page.keyboard.press("Enter");
    // Bypass Playwright's aria-disabled actionability gate to check pointer activation stays inert.
    await unavailable.click({ force: true });
    expect(await showcaseTableState(page), "unavailable Save preset must not change the local example").toEqual(
      applied,
    );

    for (const { label, testId, role } of SHOWCASE_DRAWERS) {
      await test.step(`${label} opens and Escape closes`, async () => {
        await page.getByRole("button", { name: `Open ${label}` }).click();
        const overlay = page.getByTestId(testId);
        await expect(overlay).toBeVisible();
        await expect(overlay).toHaveAttribute("role", role);
        await page.keyboard.press("Escape");
        await expect(overlay).toBeHidden();
        // Sheet restores focus on the next animation frame, after the overlay hides.
        await expect
          .poll(
            async () =>
              page.evaluate(() => {
                const element = document.activeElement;
                const box = element?.getBoundingClientRect();
                const style = element && getComputedStyle(element);
                return (
                  !!element?.isConnected &&
                  element.tagName !== "BODY" &&
                  !!box &&
                  box.width > 0 &&
                  box.height > 0 &&
                  style?.display !== "none" &&
                  style?.visibility !== "hidden"
                );
              }),
            { message: `${label} must return usable focus` },
          )
          .toBe(true);
      });
    }
  });

  test("phone and dark desktop retain the showcase layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDesignShowcase(page);
    await expectShowcaseNoPageOverflow(page);
    await expect(page.getByRole("button", { name: "Apply example" })).toBeVisible();

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ colorScheme: "light" });
    await openDesignShowcase(page);
    const lightSurface = await page
      .locator("main")
      .evaluate((element) => getComputedStyle(element).getPropertyValue("--surface").trim());
    await page.emulateMedia({ colorScheme: "dark" });
    await openDesignShowcase(page);
    await expectShowcaseNoPageOverflow(page);
    const darkSurface = await page
      .locator("main")
      .evaluate((element) => getComputedStyle(element).getPropertyValue("--surface").trim());
    expect(darkSurface, "dark mode must resolve a different surface token").not.toBe(lightSurface);
  });
});

test("@mockup on-call printing includes all coverage details and preserves screen expansion", async ({ page }) => {
  await page.goto("/mockups/ward-flow/on-call");
  const rows = page.locator('tr[id^="ward-coverage-"]');
  const toggles = page.getByRole("button", { name: /^Coverage and handover for /, includeHidden: true });
  const count = await rows.count();
  expect(count).toBeGreaterThan(1);
  for (let i = 0; i < count; i++) await expect(rows.nth(i)).toBeHidden();

  await toggles.first().click();
  await expect(rows.first()).toBeVisible();
  await expect(rows.nth(1)).toBeHidden();

  await page.emulateMedia({ media: "print" });
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    await expect(row).toBeVisible();
    await expect(row.getByText("Current cover", { exact: true })).toBeVisible();
    await expect(row.getByText("Not verified", { exact: true })).toBeVisible();
    await expect(row.getByText("Next confirmed contact", { exact: true })).toBeVisible();
    await expect(toggles.nth(i)).toBeHidden();
  }
  await page.emulateMedia({ media: "screen" });
  await expect(rows.first()).toBeVisible();
  for (let i = 1; i < count; i++) await expect(rows.nth(i)).toBeHidden();
  await expect(toggles.first()).toHaveAttribute("aria-expanded", "true");
});
