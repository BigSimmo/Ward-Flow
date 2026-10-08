import { expect, test, type Locator, type Page } from "playwright/test";

import { unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import {
  buildActionInbox,
  candidateReason,
  eligibleCandidatesAmong,
  isOpen,
} from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import { movementById, wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

async function gotoCoordinator(page: Page) {
  await page.goto("/mockups/ward-flow", { waitUntil: "domcontentloaded" });
  // A second same-URL navigation can leave a hidden duplicate of the screen
  // in the tree. Strict getByTestId then fails even though one copy is visible
  // — match the command-view helper, which waits for a single visible screen.
  await expect(page.locator('[data-testid="ward-coordinator"]:visible')).toHaveCount(1, { timeout: 15_000 });
  // The console is visible from the first paint, but this dev environment settles the route
  // shortly after (a second same-URL navigation event follows the first). A click issued in
  // that window can be lost even though every element is already visible and stable, so wait
  // for network activity to quiesce — the one reliable, non-arbitrary signal available here —
  // before the first interaction. Mirrors `gotoWardFlow` in ui-ward-management.spec.ts (Task 4
  // review Important 6: a retry loop around the click was masking this instead of fixing it).
  await page.waitForLoadState("networkidle");
}

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

/**
 * Resolves a movement id off a real, currently-rendered queue row rather than trusting whatever
 * the test author expected to be there — the same reasoning `movementById` itself documents
 * (never fall back to a different record on a miss).
 */
function requireMovement(movementId: string | undefined | null): Movement {
  const movement = movementId ? movementById(movementId) : undefined;
  if (!movement) throw new Error(`Fixture is missing movement ${String(movementId)}`);
  return movement;
}

/**
 * Pins the diagram's routed set to the SELECTED MOVEMENT'S OWN shortlist identity — not merely
 * its size. `eligibleCandidatesAmong` is computed independently here, against the same real fixture
 * the app renders against, so a hard-coded routed set of the wrong units (or the brief's own
 * tautological `toHaveCount(await routed.count())`, which compares a value to itself and passes
 * at any count including zero) both fail this. Called for two different movements with two
 * different shortlists in the main diagram test (review Important 3 — a single-movement proof
 * only rules out a hard-coded set that happens to match that one movement).
 *
 * Also asserts route connectors are counted and distinguished from demand connectors via
 * `data-connector-kind` (review Important 4) — deleting every route connector while leaving the
 * demand connectors alone must turn this red, proven manually against the pre-fix component
 * before this assertion was accepted (see the task report).
 */
async function assertRoutedMatchesShortlist(diagram: Locator, movementId: string) {
  const movement = requireMovement(movementId);
  const shortlist = eligibleCandidatesAmong(movement, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP);
  const expectedUnitIds = shortlist.map((candidate) => candidate.unit.id).sort();

  const routed = diagram.locator('[data-routed="true"]');
  const routedCount = await routed.count();
  expect(routedCount, `${movementId}: routed count`).toBeGreaterThan(0);
  expect(routedCount, `${movementId}: routed count vs PARALLEL_REFERRAL_CAP`).toBeLessThanOrEqual(
    PARALLEL_REFERRAL_CAP,
  );
  const routedUnitIds = (await routed.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid"))))
    .map((testId) => String(testId).replace("ward-diagram-unit-", ""))
    .sort();
  expect(routedUnitIds, `${movementId}: routed unit identity`).toEqual(expectedUnitIds);

  // Removed with Josh's approval on 7 Oct 2026, v6 Home bedflow: the v6 State bedflow draws no connectors or department nodes.
  // (Was: route connector count equals the routed count.)

  return { movement, shortlist };
}

/**
 * `.screen` sets `overflow: hidden`, so `document.documentElement` can never report an
 * overflow regardless of what breaks inside it — measuring the document was a test that could
 * not fail (Task 3 review Important 1). The region grid is the element whose track widths
 * actually constrain the five-region layout, so it is the element whose scroll box has to stay
 * within its client box.
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

test.describe("@mockup Ward Flow coordinator screen", () => {
  test.describe.configure({ timeout: 45_000 });

  test("presents the five coordination regions", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    // ⚠️ EXACT, NOT SUBSTRING — the third-edition visual upgrade (883ecfdfb4) gave the diagram's
    // own scroll container a second, more specific landmark, `aria-label="Statewide flow diagram"`
    // (`flow-diagram.tsx`'s `ward-diagram-scroll`), nested inside this outer section. A substring
    // match now resolves both and throws a strict-mode violation; `exact: true` keeps this
    // assertion scoped to the outer "Statewide flow" section it always meant to prove exists,
    // without weakening it — the inner diagram landmark is a real, deliberate addition, not a
    // duplicate to collapse away.
    await expect(page.getByRole("region", { name: "State Bedflow", exact: true })).toBeVisible();
    // ⚠️ **THE SHORTLIST NO LONGER MOUNTS UNCONDITIONALLY.** `coordinator-screen.tsx` now wraps
    // the whole `<aside aria-label="Explainable shortlist">` in `{hasPanelSubject ? ... : null}` —
    // with nothing selected, "Statewide flow"'s own header shows "Select a patient or referral to
    // open shortlist" instead, and the shortlist landmark simply is not in the document yet. A
    // click is therefore a real precondition for this region existing at all now, not an
    // incidental step.
    await page.locator('[data-testid^="ward-queue-row-"]').first().click();
    await expect(page.getByRole("complementary", { name: "Explainable shortlist" })).toBeVisible();
    // Owner, 8 Oct 2026: the four registers start closed and open as a strip under the hero from
    // its Exceptions count, so the toggle is clicked first. Scrolled into view before the
    // visibility check, as Playwright's `toBeVisible()` needs it in the viewport.
    await page.getByRole("button", { name: /Exceptions/, expanded: false }).click();
    const registers = page.getByRole("region", { name: "Declines, overrides and exceptions" });
    await registers.scrollIntoViewIfNeeded();
    await expect(registers).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Today’s answers" })).toBeVisible();

    await expectNoRegionGridOverflow(page);
  });

  // The equivalent coverage for these two lived on WardManagementConsole, which Task 3 stopped
  // rendering at /mockups/ward-flow. Task 9 deletes that component; until then the behaviour has
  // no home on the coordinator screen and these stay fixme so the gap is visible in the runner
  // (not just in a ledger row) rather than silently dropped.

  // The shortlist region is still a placeholder (Task 7 builds the real explainable shortlist),
  // but its placeholder text already names the selected movement, so the wiring this test is
  // actually about — a queue click driving `selectedMovementId` through to that region, and a
  // second click moving the selection rather than adding to it — is real Task 5 behaviour with
  // a real home, not a gap. Task 7 replaces the shortlist body without touching this contract.
  test("queue selection drives the explainable shortlist", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    // Before selection, the diagram header reports the fixture's ward count and
    // the shortlist is absent. Selecting a row mounts the matching shortlist.
    // 2026-10-07 (v6 Home): the State bedflow card head reads "22 wards", as the v6 Home mockup
    // draws it; the count itself is still the fixture's own `allUnits().length`.
    await expect(shortlist).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "State Bedflow", exact: true })
        .getByText(`${allUnits().length} wards`, { exact: true }),
    ).toBeVisible();

    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    const firstRow = rows.first();
    const firstId = (await firstRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    await firstRow.click();
    await expect(firstRow).toHaveAttribute("aria-pressed", "true");
    await expect(shortlist).toHaveAttribute("data-subject-movement", String(firstId));

    // A second selection replaces the first rather than accumulating.
    const secondRow = rows.nth(1);
    const secondId = (await secondRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    await secondRow.click();
    await expect(secondRow).toHaveAttribute("aria-pressed", "true");
    await expect(firstRow).toHaveAttribute("aria-pressed", "false");
    await expect(shortlist).toHaveAttribute("data-subject-movement", String(secondId));
  });

  // Task 8: the exceptions register is the coordinator's work list, not a report — its own count
  // and its own rendered rows must always agree (ruling 3 — the "48 open movements" defect in
  // miniature is a header count that disagrees with the rows beneath it); selecting a row drives
  // the same movement selection the queue does; and on a phone the diagram and pressure strip
  // disappear while the queue and the registers panel stay reachable.
  //
  // ⚠️ Task A (structured-wobbling-globe) moved the registers panel out of the bar pinned outside
  // `.body`'s own scroll and into `.midCol`, under the Statewide flow diagram — unconditionally
  // visible from 48rem up (no toggle to click any more at this width), collapsible only below it.
  // Two real behaviour changes follow, both named here rather than silently worked around:
  //   1. At desktop width the Exceptions tabpanel is already open — nothing to click first.
  //   2. "Every exception row is in the viewport" now needs the panel scrolled into view first —
  //      the task brief's own prediction. The assertion still proves what it always proved (no
  //      row is clipped by the panel's OWN internal scroll cap, the "8 over a box showing 4"
  //      shape ruling 3 guards against) — it is scoped to the panel's own scroll position, not
  //      the page's, which `scrollIntoViewIfNeeded()` plus `toBeInViewport()`'s own containing-
  //      block awareness both already give it.
  test("keeps exceptions reachable and collapses to a queue-first phone form", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    // Opens on the Exceptions tab by default. At this width the registers start closed and open
    // from the hero's Exceptions count (owner, 8 Oct 2026).
    await page.getByRole("button", { name: /Exceptions/, expanded: false }).click();
    const drawer = page.getByRole("tabpanel", { name: "Exceptions" });
    await drawer.scrollIntoViewIfNeeded();
    await expect(drawer).toBeVisible();
    const items = drawer.locator('[data-testid^="ward-exception-"]');
    await expect(items.first()).toBeVisible();

    // Ruling 3: the Exceptions tab's own count must be the true count — exactly what the panel
    // renders, computed independently here from the real fixture so a hard-coded number can't
    // pass by coincidence.
    // Whole-branch review Minor 6: the register is scoped to OPEN movements, so the independent
    // count here must be too — computing it over all 48 records would agree with a screen that
    // wrongly listed a closed patient's breached deadline.
    const expectedCount = buildActionInbox(wardMovements.filter(isOpen), NOW_ANCHOR, allUnits()).length;
    expect(expectedCount).toBeGreaterThan(1);
    await expect(items).toHaveCount(expectedCount);
    await expect(page.getByRole("tab", { name: "Exceptions" })).toContainText(String(expectedCount));

    // Review Important 2: "the true count" means every row the header claims is actually ON
    // SCREEN, not merely present in a DOM a nested scroller has clipped — a header reading "8"
    // over a box showing 4 is the same defect this ruling exists to prevent, just moved one
    // level down. Assert every row, not just the first, is really in the viewport — each one
    // scrolled to individually, since the panel's own `min(60vh, 40rem)` cap (re-measured for
    // Task A, `coordinator.module.css`'s own comment) can still put a later row below the fold of
    // the panel's OWN internal scroll even once the panel itself is on screen.
    const itemCount = await items.count();
    for (let index = 0; index < itemCount; index += 1) {
      await items.nth(index).scrollIntoViewIfNeeded();
      await expect(items.nth(index)).toBeInViewport();
    }

    // Review Critical 1: the shortlist `<aside>` renders unconditionally — it is already visible
    // before any click — so "is it visible" proves nothing about whether the register actually
    // drives selection. Click a SPECIFIC, known exception (WF-005) and assert both that the
    // shortlist names that exact movement and that the underlying queue row shows the same
    // movement as pressed, proving the register and the queue really are one shared selection.
    const wf005Item = drawer.locator('[data-testid*="-WF-005"]').first();
    await expect(wf005Item).toBeVisible();
    await wf005Item.click();
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await expect(shortlist).toBeVisible();
    await expect(shortlist).toContainText("WF-005");
    await expect(page.getByTestId("ward-queue-row-WF-005")).toHaveAttribute("aria-pressed", "true");

    // Phone: queue and the registers toggle survive, the diagram and the pressure strip do not
    // (Minor 6: the brief required both hidden, not just the diagram), and nothing overflows.
    await page.setViewportSize({ width: 390, height: 844 });
    // Below 48rem the shortlist is a bottom sheet over the page with its own backdrop (81553692fb,
    // 21 Sept). WF-005, selected above at desktop width, keeps it open across the resize, and it
    // covers the Registers toggle. A coordinator closes it first; so does this journey. Closing
    // clears the selection, so the last step below — selecting WF-005 again from the phone drawer
    // — now proves the drawer itself selects, rather than leaning on the leftover selection.
    await page.getByRole("button", { name: "Close shortlist and clear selection" }).click();
    await expect(page.getByRole("complementary", { name: "Explainable shortlist" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    // Task A: the toggle only exists below 48rem now — restored exactly at the width the diagram
    // disappears (`@media (max-width: 48rem)`, the same query in both places).
    const toggle = page.getByRole("button", { name: /Today’s answers/ });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("region", { name: "State Bedflow", exact: true })).toBeHidden();
    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);

    // Review Important 3: "one-tap confirm" means Confirm is actually reachable without a long
    // scroll once a movement is selected on the phone — not merely present somewhere on a page
    // that happens to be scrollable. Open the phone-only toggle, select via the panel again
    // (dismissing it in the same tap — Task A preserves this, the property the task brief's own
    // 🔴 ruling names as the one that must survive the move), and assert Confirm is in the
    // viewport with no scrolling.
    await toggle.click();
    const phoneDrawer = page.getByRole("tabpanel", { name: "Exceptions" });
    await expect(phoneDrawer).toBeVisible();
    await phoneDrawer.locator('[data-testid*="-WF-005"]').first().click();
    await expect(page.getByTestId("ward-shortlist-refer")).toBeInViewport();
  });

  test("orders by clinical tier first and labels the score as operational, not clinical", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    const rowCount = await rows.count();

    // A queue that renders zero rows must not be able to satisfy the ordering assertion below
    // by absence — `expect([]).toEqual([])` would otherwise pass silently if the tier badge
    // were ever removed from the row (Task 5 review Important 1). Pin the collected tier list
    // to the same length as the rendered rows, and require at least one row to exist.
    const tiers = await rows
      .locator("[data-tier]")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-tier"))));
    expect(rowCount).toBeGreaterThan(0);
    expect(tiers).toHaveLength(rowCount);

    // Commit bc7cb70fb (owner, 2026-08-30): a flagged-urgent patient outranks every tier, so the
    // full rendered list is no longer tier-ascending — WF-018 (tier 3, flagged) legitimately
    // leads unflagged tier-1 patients who have waited hours. The tier ladder still holds among
    // the UNFLAGGED, narrowed the same way that commit narrowed "every tier 1 above every tier
    // 2" in tests/ward-priority.test.ts.
    const unflaggedRows = rows.filter({ hasNot: page.locator('[data-testid^="ward-queue-flag-"]') });
    const unflaggedTiers = await unflaggedRows
      .locator("[data-tier]")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-tier"))));
    expect(unflaggedTiers.length, "the fixture must still hold unflagged rows to order").toBeGreaterThan(1);
    expect(unflaggedTiers).toEqual([...unflaggedTiers].sort((a, b) => a - b));

    // Within a tier, the wait must be non-increasing — the queue's core claim (Task 5 review
    // Important 2). Item 37 (2026-09-17) changed queueOrder's tie-break inside a tier from
    // operationalScore to the wait itself, uncapped, so this reads `data-wait` rather than
    // `data-score` — the same property-off-the-record discipline the original assertion had, now
    // pointed at the field that actually orders the queue. Inverting the tiebreak comparator in
    // `queueOrder` must turn this red.
    const rowKeys = await rows.evaluateAll((nodes) =>
      nodes.map((node) => ({
        tier: Number(node.querySelector("[data-tier]")?.getAttribute("data-tier")),
        wait: Number(node.getAttribute("data-wait")),
      })),
    );
    for (let i = 1; i < rowKeys.length; i++) {
      const prev = rowKeys[i - 1];
      const curr = rowKeys[i];
      if (curr.tier === prev.tier) {
        expect(
          curr.wait,
          `row ${i} (tier ${curr.tier}, wait ${curr.wait}) must not have waited longer than row ${i - 1} (wait ${prev.wait})`,
        ).toBeLessThanOrEqual(prev.wait);
      }
    }

    // The score must never read as clinical severity.
    await expect(queue).toContainText("Operational");
    await expect(queue).not.toContainText("Severity");
    await expect(queue).not.toContainText("Acuity");

    // The rendered score is the derived one, not a constant or a stale placeholder (Task 5
    // review Important 3) — compare the first row against itself rather than importing the
    // derivation into this spec.
    const firstRow = rows.first();
    const firstRowScore = await firstRow.getAttribute("data-score");
    await expect(firstRow).toContainText(`Operational ${firstRowScore}`);

    // The breach line used to be the row a coordinator must not miss (Task 5 review Important
    // 3, then Task 6A fix round 1, then the removal of the "Bed need confirmed" factor on
    // 2026-08-24 — see this test's history for how WF-017/WF-009/WF-303 used to be pinned here).
    //
    // 2026-08-23 correction: put to the product owner directly, the instruction was to drop the
    // legal countdown from this model entirely, not to get its deadline figure right — "please
    // can you leave the legal part and just start a clock once the patient arrives to ED. Keep
    // it simple for now." Neither a Form 1A nor a Form 3B carries a `dueAt` any longer (WF-303,
    // the one movement this suite used to pin as "the genuine breach", now carries none — see
    // `LegalForm`'s own doc comment in ward-model.ts). This supersedes ruling F17's requirement
    // that the assertion be satisfied by a genuine breach: there is no longer such a thing as a
    // legal breach for 1A/3B to prove, so the whole-page absence below replaces the old
    // firstRow/secondRow/breachedRow pin rather than repointing it at a different movement.
    // (Repointing at `ED_ACCESS_TARGET_MINUTES` instead was considered and rejected: measured
    // against this fixture at `NOW_ANCHOR`, the longest current wait is under it, so no movement
    // genuinely exceeds that target either — asserting one did would be a second fabrication of
    // the exact kind this correction exists to remove.) This is a whole-page check, not a
    // 1A/3B-scoped one, because the string itself is the thing that must not appear — on today's
    // fixture the only other legal-form kinds, the transport/transfer forms 4A/4C (out of scope
    // for this correction, still carrying a real `dueAt`), are not currently due in the past
    // either, so the assertion is true for the whole page, not merely for 1A/3B rows.
    await expect(queue).not.toContainText("passed its deadline");

    // Selecting a movement drives the rest of the screen.
    await firstRow.click();
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    const selectedId = await queue.locator('[aria-pressed="true"]').getAttribute("data-testid");
    await expect(shortlist).toContainText(String(selectedId).replace("ward-queue-row-", ""));
  });

  test("ranks emergency departments worst first and filters the queue when one is chosen", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const strip = page.getByRole("region", { name: "Emergency department pressure" });
    const cards = strip.locator('[data-testid^="ward-ed-"]');
    await expect(cards).toHaveCount(10);

    // The worst department leads, and says why it is worst.
    const worst = cards.first();
    await expect(worst).toContainText("waiting");
    // 2026-10-07 (v6 Home): Home's ED pressure card paints "{duration} longest" (the v6 Home
    // mockup's wording, `home-ed-pressure.tsx`), so the visible label is lower case now. This
    // still checks the rendered text, so it matches the visible label's casing.
    await expect(worst).toContainText("longest");

    // The rendered sequence itself is non-increasing on the two keys `edPressure` ranks by.
    // Asserting only that card 1 "contains some text" (above) stays true even if the rows were
    // reversed — this pins the ordering property instead (Task 4 review Important 1). It reads
    // the actual numeric sort keys off `data-breaching`/`data-longest-minutes` rather than
    // hard-coding "PEEL is first", so it keeps validating the rule if the fixture data changes.
    const sortKeys = await cards.evaluateAll((nodes) =>
      nodes.map((node) => ({
        breaching: Number(node.getAttribute("data-breaching")),
        longestMinutes: Number(node.getAttribute("data-longest-minutes")),
      })),
    );
    for (let i = 1; i < sortKeys.length; i++) {
      const prev = sortKeys[i - 1];
      const curr = sortKeys[i];
      const doesNotOutrankPrevious =
        curr.breaching < prev.breaching ||
        (curr.breaching === prev.breaching && curr.longestMinutes <= prev.longestMinutes);
      expect(
        doesNotOutrankPrevious,
        `card ${i} ${JSON.stringify(curr)} must not rank above card ${i - 1} ${JSON.stringify(prev)}`,
      ).toBe(true);
    }

    // Choosing one filters the queue to that department and says so — and to exactly that
    // department's own movements, not merely to some smaller set of the same rough size. A
    // filter that names the clicked department while quietly showing a different one's patients
    // is worse than no filter, and `after < before` alone cannot tell the two apart (Task 4
    // review Important 2).
    const worstEdId = (await worst.getAttribute("data-testid"))?.replace("ward-ed-", "");
    const worstWaiting = Number(await worst.getAttribute("data-waiting"));
    const queue = page.getByRole("region", { name: "Priority queue" });
    const before = await queue.locator('[data-testid^="ward-queue-row-"]').count();
    await worst.click();
    await expect(queue).toContainText("Filtered to");
    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    await expect(rows).toHaveCount(worstWaiting);
    const originIds = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-origin-ed")));
    for (const originId of originIds) {
      expect(originId).toBe(worstEdId);
    }
    expect(worstWaiting).toBeLessThan(before);

    // And clearing restores it.
    await queue.getByRole("button", { name: /Clear filter/ }).click();
    await expect(queue.locator('[data-testid^="ward-queue-row-"]')).toHaveCount(before);
  });

  test("draws the selected movement's routes from its department to its shortlisted units", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const diagram = page.getByRole("region", { name: "State Bedflow", exact: true });
    // 2026-10-07 (v6 Home): State bedflow is a grouped ward list with no SVG arrows; this guard
    // waits on its first ward node instead. Every assertion below reads the same node ids.
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]').first()).toBeAttached({ timeout: 15_000 });

    // Every one of the fixture units (22 since 26 Sept) renders as its own node regardless of selection — a unit
    // whose service-group lookup silently fails must not just vanish from the count (review
    // Minor 6; `flow-diagram.tsx` renders an explicit "Unresolved health service" anomaly card
    // for exactly that case rather than dropping the unit).
    //
    // 23, not the 22 this assertion carried from PR #2289: Phase 7 Task 1 (`5401a7121`) added the
    // youth unit at Bentley on the product owner's own instruction, and this count is deliberately
    // exact rather than a floor, so it goes red when the fixture grows. It did — caught by Task 7,
    // whose dispatch had wrongly asserted the branch was green because only the Vitest ward suite
    // had been re-run. `tests/ui-ward-roles.spec.ts` repeats the same figure in prose.
    //
    // 22 since 26 Sept 2026: the confirmed ward facts removed Kununurra's ward (the site stays with
    // no ward), so allUnits() on the seed returns 22 units, counted from the seed, not assumed.
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]')).toHaveCount(22);

    // No movement is selected yet, so nothing is routed.
    await expect(diagram.locator('[data-routed="true"]')).toHaveCount(0);
    // Removed with Josh's approval on 7 Oct 2026, v6 Home bedflow: the v6 State bedflow draws no connectors or department nodes.
    // (Was: ten demand connectors, department to hub, and zero route connectors by `data-connector-kind`.)

    // Excludes WF-009 by id. WF-009 leads tier 1 on the current fixture (28 waiting + 15
    // declines + 10 blocker = 53, the highest tier-1 operational score) and so renders at row 1,
    // and the contrast this test needs below only holds if the two clicked movements are
    // genuinely different. Without the exclusion, "row 1" and "WF-009" could silently become the
    // same movement and the second assertion would pass by tautology rather than by proof.
    const firstRow = page
      .getByRole("region", { name: "Priority queue" })
      .locator('[data-testid^="ward-queue-row-"]:not([data-testid="ward-queue-row-WF-009"])')
      .first();
    const movementId = (await firstRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    expect(movementId, "the first queue row must carry a real movement id").toBeTruthy();
    expect(movementId, "the exclusion above must keep this genuinely different from WF-009").not.toBe("WF-009");
    await firstRow.click();

    await assertRoutedMatchesShortlist(diagram, String(movementId));

    // Removed with Josh's approval on 7 Oct 2026, v6 Home bedflow: the v6 State bedflow draws no connectors or department nodes.
    // (Was: exactly one `data-origin` node, `ward-diagram-ed-<the movement's originEdId>`.)

    // Review Important 3: the identity assertion above must hold for more than the one movement
    // selected above. WF-009 has an entirely different shortlist (proven separately, in the
    // ineligible-routes test below, to also be an entirely different eligibility outcome) — a
    // hard-coded routed set that coincidentally matched the first movement's shortlist would
    // fail here instead of passing by coincidence.
    await page.getByRole("region", { name: "Priority queue" }).locator('[data-testid="ward-queue-row-WF-009"]').click();
    await assertRoutedMatchesShortlist(diagram, "WF-009");
  });

  test("marks an ineligible shortlisted unit as not currently placeable, not as a routed destination", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const diagram = page.getByRole("region", { name: "State Bedflow", exact: true });
    // 2026-10-07 (v6 Home): State bedflow is a grouped ward list with no SVG arrows; this guard
    // waits on its first ward node instead. Every assertion below reads the same node ids.
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]').first()).toBeAttached({ timeout: 15_000 });

    const movement = requireMovement("WF-009");
    const shortlist = eligibleCandidatesAmong(movement, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP);
    // This test's whole premise is a shortlist with ZERO eligible candidates — WF-009 has been
    // declined by five units, and its three cohort-matching candidates (since `eligibleCandidatesAmong`
    // sorts eligible-first but never filters) are all ineligible: two already declined it, one fails
    // the security gate. If the fixture ever changes so this stops being true, the assertions
    // below must fail loudly here rather than vacuously pass on an empty or partially-eligible
    // set.
    expect(shortlist.length).toBeGreaterThan(0);
    expect(shortlist.every((candidate) => !candidate.verdict.eligible)).toBe(true);

    await page.getByRole("region", { name: "Priority queue" }).locator('[data-testid="ward-queue-row-WF-009"]').click();

    // Every routed node is marked not-eligible on the node itself...
    const routed = diagram.locator('[data-routed="true"]');
    await expect(routed).toHaveCount(shortlist.length);
    const eligibleFlags = await routed.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-eligible")));
    for (const flag of eligibleFlags) {
      expect(flag).toBe("false");
    }

    // ...and states its own specific reason as real text (never colour alone — must survive
    // forced-colors — and never a generic "not eligible", proving `candidateReason(verdict)`
    // actually reaches the DOM for each unit, not just a shared placeholder).
    for (const candidate of shortlist) {
      const node = diagram.locator(`[data-testid="ward-diagram-unit-${candidate.unit.id}"]`);
      await expect(node).toContainText(candidateReason(candidate.verdict));
    }

    // Removed with Josh's approval on 7 Oct 2026, v6 Home bedflow: the v6 State bedflow draws no connectors or department nodes.
    // (Was: one route connector per shortlisted unit, each marked `data-eligible="false"`.)

    // The hub states the true eligible count — zero — never the shortlist size framed as routes.
    await expect(diagram).toContainText(`no eligible destination; ${shortlist.length} candidates, all excluded`);
  });

  test("distinguishes an accepted destination from an outstanding referral, and shows every parallel referral", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const diagram = page.getByRole("region", { name: "State Bedflow", exact: true });
    // 2026-10-07 (v6 Home): State bedflow is a grouped ward list with no SVG arrows; this guard
    // waits on its first ward node instead. Every assertion below reads the same node ids.
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]').first()).toBeAttached({ timeout: 15_000 });
    const queue = page.getByRole("region", { name: "Priority queue" });

    // WF-017 has an outstanding referral to BTY Adult Secure and no acceptance yet —
    // `destinationUnit`'s single conflated field (`acceptedUnitId ?? referredUnitIds[0]`) used
    // to badge this "Current recorded destination", which reads as an acceptance that has not
    // happened (review Important 2).
    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    const bty = diagram.locator('[data-testid="ward-diagram-unit-bty-adult-secure"]');
    await expect(bty).toHaveAttribute("data-referred", "true");
    await expect(bty).not.toHaveAttribute("data-accepted", "true");
    await expect(bty).toContainText("Outstanding referral");
    await expect(bty).not.toContainText("Accepted destination");

    // WF-013 carries two parallel referrals — both must be visible, not only
    // `referredUnitIds[0]`.
    await queue.locator('[data-testid="ward-queue-row-WF-013"]').click();
    await expect(diagram.locator('[data-testid="ward-diagram-unit-bty-older-adult"]')).toHaveAttribute(
      "data-referred",
      "true",
    );
    await expect(diagram.locator('[data-testid="ward-diagram-unit-gry-older-adult"]')).toHaveAttribute(
      "data-referred",
      "true",
    );

    // WF-003 has an actual acceptance — a different fact, with a different badge.
    await queue.locator('[data-testid="ward-queue-row-WF-003"]').click();
    const accepted = diagram.locator('[data-testid="ward-diagram-unit-rph-adult-secure"]');
    await expect(accepted).toHaveAttribute("data-accepted", "true");
    await expect(accepted).toContainText("Accepted destination");
    await expect(accepted).not.toContainText("Outstanding referral");
  });

  /**
   * Whole-branch review Important 3: routes were drawn only to the three candidates, so for 18 of
   * the 41 open movements the unit the patient is actually going to had no connector at all while
   * three arrows pointed at wards they are not going to — and the hub read "WF-004 — 3 eligible
   * destinations" for a movement whose bed is already held elsewhere.
   *
   * WF-004 is the case the review named: its accepted unit was NOT among its candidates, so before
   * the fix its destination connector count was zero. Both halves are asserted — the connector
   * exists and is its own kind, and the hub leads with the recorded fact rather than a candidate
   * count.
   *
   * 🔴 **2026-09-17: WF-004 NO LONGER FITS ITS OWN ASSUMPTION AND THE MOVEMENT WAS SWAPPED, NOT THE
   * PROPERTY.** The 17 September sample-data and capacity changes made `bty-adult-secure` (WF-004's
   * accepted unit) eligible again, so the guard below caught it rather than silently testing
   * nothing. WF-005 (`fre-adult-open`, genuinely excluded from its own candidate list) proves the
   * identical property; WF-004's own history stays in the comment above because that is still the
   * incident this test exists to guard against.
   */
  test("draws the recorded destination as its own connector and says so at the hub", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const diagram = page.getByRole("region", { name: "State Bedflow", exact: true });
    // 2026-10-07 (v6 Home): State bedflow is a grouped ward list with no SVG arrows; this guard
    // waits on its first ward node instead. Every assertion below reads the same node ids.
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]').first()).toBeAttached({ timeout: 15_000 });
    const queue = page.getByRole("region", { name: "Priority queue" });

    const wf005 = requireMovement("WF-005");
    const acceptedUnitId = wf005.acceptedUnitId;
    expect(acceptedUnitId, "fixture assumption: WF-005 has an accepted destination").toBeTruthy();
    const candidateIds = eligibleCandidatesAmong(wf005, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP).map(
      (candidate) => candidate.unit.id,
    );
    expect(
      candidateIds,
      "fixture assumption: WF-005's accepted unit is not one of its candidates, so only the destination connector can reach it",
    ).not.toContain(acceptedUnitId);

    await queue.locator('[data-testid="ward-queue-row-WF-005"]').click();

    // The v6 State bedflow draws no connectors (removal approved by Josh, 7 Oct 2026); this recorded fact is now checked on the unit nodes.
    // (Was: one destination connector with `data-recorded="accepted"`.) Exactly one unit is marked
    // accepted, and it is WF-005's own accepted unit, though it is not one of its candidates.
    const acceptedNodes = diagram.locator('[data-testid^="ward-diagram-unit-"][data-accepted="true"]');
    await expect(acceptedNodes).toHaveCount(1);
    await expect(acceptedNodes).toHaveAttribute("data-testid", `ward-diagram-unit-${acceptedUnitId}`);

    // The hub leads with the recorded destination, and never claims the movement is looking for
    // three of them.
    await expect(diagram).toContainText("accepted destination:");
    await expect(diagram).not.toContainText("WF-005 — 3 eligible destinations");

    // An outstanding referral is a different recorded fact and gets its own connector too —
    // WF-013 carries two, so a single-referral implementation (`referredUnitIds[0]`) fails here.
    const wf013 = requireMovement("WF-013");
    expect(wf013.referredUnitIds.length, "fixture assumption: WF-013 carries two parallel referrals").toBe(2);
    await queue.locator('[data-testid="ward-queue-row-WF-013"]').click();
    // The v6 State bedflow draws no connectors (removal approved by Josh, 7 Oct 2026); this recorded fact is now checked on the unit nodes.
    // (Was: two destination connectors marked `data-recorded="referred"`.) Both referred units are
    // marked referred, and nothing is marked accepted.
    const referredNodes = diagram.locator('[data-testid^="ward-diagram-unit-"][data-referred="true"]');
    await expect(referredNodes).toHaveCount(2);
    const referredIds = (
      await referredNodes.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")))
    )
      .map((testId) => String(testId).replace("ward-diagram-unit-", ""))
      .sort();
    expect(referredIds).toEqual([...wf013.referredUnitIds].sort());
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"][data-accepted="true"]')).toHaveCount(0);

    // A movement with no recorded destination draws none — the connector reports a fact, never a
    // suggestion dressed as one.
    const wf009 = requireMovement("WF-009");
    expect(wf009.acceptedUnitId).toBeUndefined();
    expect(wf009.referredUnitIds).toHaveLength(0);
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    // The v6 State bedflow draws no connectors (removal approved by Josh, 7 Oct 2026); this recorded fact is now checked on the unit nodes.
    // (Was: zero destination connectors.) No unit is marked accepted or referred.
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"][data-accepted="true"]')).toHaveCount(0);
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"][data-referred="true"]')).toHaveCount(0);
  });

  /**
   * Whole-branch review Important 5: `eligibility()` passes a Secure ward for an Open movement with
   * the affirmative detail "Secure ward meets an open requirement", marked "Met" — so the screen
   * offers a locked ward to a patient who does not need one, and can label it "Suggested
   * destination". `ward-eligibility.ts` is a protected surface, so the gate is deliberately
   * unchanged and the fact is surfaced instead. This pins that it really reaches the DOM, on the
   * shortlist and on the diagram, and that it does NOT appear where it would be false.
   */
  test("states plainly when a candidate ward is more restrictive than the movement requires", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    const diagram = page.getByRole("region", { name: "State Bedflow", exact: true });
    // 2026-10-07 (v6 Home): State bedflow is a grouped ward list with no SVG arrows; this guard
    // waits on its first ward node instead. Every assertion below reads the same node ids.
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]').first()).toBeAttached({ timeout: 15_000 });

    // WF-001 is an OPEN-status movement whose top candidate is a locked ward that passes every
    // gate — the exact pairing the review found.
    const wf001 = requireMovement("WF-001");
    expect(wf001.security, "fixture assumption: WF-001 is an open-status movement").toBe("Open");
    const candidates = eligibleCandidatesAmong(wf001, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP);
    // Wholly locked only, matching `isMoreRestrictiveThanRequired`'s own semantics (2026-09-04): a
    // mixed ward is not "a locked ward" and does not render this notice.
    const locked = candidates.filter((candidate) => !unitHasOpenBeds(candidate.unit));
    const open = candidates.filter((candidate) => unitHasOpenBeds(candidate.unit));
    expect(locked.length, "fixture assumption: WF-001 has at least one locked-ward candidate").toBeGreaterThan(0);
    expect(
      open.length,
      "fixture assumption: WF-001 also has an open-ward candidate, so this is not blanket text",
    ).toBeGreaterThan(0);

    await queue.locator('[data-testid="ward-queue-row-WF-001"]').click();
    await openShortlistSections(shortlist);

    // The locked candidates say so on their own rows; the open one does not. Both the shortlist
    // row and the diagram node now read `restrictionNotice`'s own wording (flow-diagram fix:
    // the diagram used to read the older, superseded `MORE_RESTRICTIVE_NOTE` text and diverge
    // from the shortlist here — it no longer does, so both assertions use the same string).
    for (const candidate of locked) {
      await expect(shortlist.locator(`[data-testid="ward-shortlist-candidate-${candidate.unit.id}"]`)).toContainText(
        "More restrictive than this movement requires",
      );
      await expect(diagram.locator(`[data-testid="ward-diagram-unit-${candidate.unit.id}"]`)).toContainText(
        "More restrictive than this movement requires",
      );
    }
    for (const candidate of open) {
      await expect(
        shortlist.locator(`[data-testid="ward-shortlist-candidate-${candidate.unit.id}"]`),
      ).not.toContainText("More restrictive than this movement requires");
    }

    // And it is stated at the moment of decision — above the gate list, where the security check
    // reads "Met" — for whichever unit's gates are on screen.
    await shortlist.locator(`[data-testid="ward-shortlist-candidate-${locked[0].unit.id}"]`).click();
    await expect(shortlist.getByTestId("ward-shortlist-restrictive-note")).toBeVisible();
    await expect(shortlist.locator('[data-testid="ward-gate-security"][data-pass="true"]')).toHaveCount(1);
    await shortlist.locator(`[data-testid="ward-shortlist-candidate-${open[0].unit.id}"]`).click();
    await expect(shortlist.getByTestId("ward-shortlist-restrictive-note")).toHaveCount(0);

    // A Secure movement on a Secure ward is a plain match — the note must not appear there, or it
    // would be noise a coordinator learns to ignore.
    await queue.locator('[data-testid="ward-queue-row-WF-004"]').click();
    await openShortlistSections(shortlist);
    await expect(shortlist).not.toContainText("More restrictive than this movement requires");
  });

  /**
   * Flow-diagram fix: `flow-diagram.tsx` used to compute its restriction badge with the
   * superseded `isMoreRestrictiveThanRequired`, which only recognises Open-movement-on-Secure-
   * ward. It returns false for a Voluntary movement on a Secure ward, so the diagram rendered
   * nothing at all for the sharper case the shortlist already flags. The test above (WF-001,
   * Open/non-Voluntary) only ever exercised the milder `more_restrictive` level — this pins the
   * `voluntary_on_locked` one, which is the case this fix exists for.
   *
   * WF-301 is selected by id, never by queue rank — rank-based selection has broken three other
   * tests in this phase. Re-measured against the real fixture: 26 Voluntary movements exist, and
   * 4 of them also carry `security: "Secure"` — WF-301, WF-308, WF-322, WF-329. WF-301's cohort
   * is Adult, so its three shortlisted candidates are `rph-adult-secure`, `fsh-adult-secure` and
   * `rgh-adult-secure`, every one eligible — verified with `eligibleCandidatesAmong` below rather
   * than assumed, so this test fails loudly instead of silently no-op'ing if the fixture ever
   * changes underneath it.
   *
   * ⚠️ As of the 2026-09-04 locked/open split, `fsh-adult-secure` is genuinely MIXED
   * (`ward-sites.ts`'s `WARD_LOCKED_BED_SPLITS`), not wholly locked — so it is no longer one of
   * this test's wholly-locked `locked` candidates below and is not checked by this test at all.
   * `rph-adult-secure` and `rgh-adult-secure` stay wholly locked and still exercise the
   * `voluntary_on_locked` notice this test pins.
   */
  test("gives a voluntary patient on a locked ward its own, more prominent notice on the diagram", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    const diagram = page.getByRole("region", { name: "State Bedflow", exact: true });
    // 2026-10-07 (v6 Home): State bedflow is a grouped ward list with no SVG arrows; this guard
    // waits on its first ward node instead. Every assertion below reads the same node ids.
    await expect(diagram.locator('[data-testid^="ward-diagram-unit-"]').first()).toBeAttached({ timeout: 15_000 });

    const wf301 = requireMovement("WF-301");
    expect(wf301.legalStatus, "fixture assumption: WF-301 is a Voluntary movement").toBe("Voluntary");
    const candidates = eligibleCandidatesAmong(wf301, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP);
    // Wholly locked only — see the note on the WF-001 test above.
    const locked = candidates.filter((candidate) => !unitHasOpenBeds(candidate.unit));
    expect(locked.length, "fixture assumption: WF-301 has at least one Secure shortlisted candidate").toBeGreaterThan(
      0,
    );

    await queue.locator('[data-testid="ward-queue-row-WF-301"]').click();

    for (const candidate of locked) {
      const shortlistRow = shortlist.locator(`[data-testid="ward-shortlist-candidate-${candidate.unit.id}"]`);
      await expect(shortlistRow).toContainText(
        "Voluntary patient on a locked ward — review legal status before admission",
      );

      // The case that renders nothing today: the diagram node must carry the same
      // `restrictionNotice` wording as the shortlist, not silence.
      const diagramNode = diagram.locator(`[data-testid="ward-diagram-unit-${candidate.unit.id}"]`);
      await expect(diagramNode).toContainText(
        "Voluntary patient on a locked ward — review legal status before admission",
      );
      // And it must be the sharper, danger-toned variant, not the plain over-restrictive one —
      // the two levels are visually distinguished by `data-level`, not merely by wording.
      await expect(diagramNode.locator('[data-level="voluntary_on_locked"]')).toHaveCount(1);
    }
  });

  /**
   * Task 7's own controller finding: the whole-branch review found a green tick rendered beside
   * "SJGS Adult Open is not authorised under the Mental Health Act". This test pins the fix at the
   * DOM level, not just at the derivation level (`ward-eligibility.test.ts` already proves the
   * gate logic itself).
   *
   * The brief's own draft of this test clicked queue row 1 and only conditionally checked a
   * failing gate's icon (`if (await failing.count())`) — but WF-017's default candidate
   * (`rph-adult-secure`) passes all eleven gates, so that conditional block would silently skip
   * whenever row 1 lands on a clean movement like WF-017, exactly the "test that cannot fail"
   * shape Phase 1 shipped once already. WF-009 (declined by five units, whose own three
   * candidates are all ineligible — see `ward-derivations.ts`) is used instead to guarantee a
   * failing gate is actually on screen (Ruling 3), and the confirm journey is walked end to end
   * rather than merely checking a button is visible (Ruling 4).
   *
   * Task 6A fix round 1: queue row 1 used to be WF-017 only because a fabricated Form 3B
   * deadline (deleted in Task 6A) inflated its operational score. On 2026-08-24 the product
   * owner dropped the "Bed need confirmed" factor as well, so having been examined no longer
   * scores at all: WF-009 leads tier 1 on wait, declines and blocker alone (row 1) and WF-017
   * falls to row 5. This test selects both WF-017 and WF-009 explicitly by id rather than by row
   * position, so it does not depend on either fixture's ordering. WF-017's default candidate
   * still passes all eleven gates (re-verified against the current fixture), so the
   * clean-vs-failing contrast this test depends on still holds; WF-009 still guarantees a
   * failing gate on its own default candidate regardless of which row it renders in.
   */
  test("shows a failing gate as a failure and never auto-allocates", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // WF-017: selected explicitly by id, not by row position — it no longer ranks first in the
    // queue now that Task 6A deleted the fabricated deadline that used to inflate its score (see
    // comment above), but its default candidate still passes all eleven gates. Every gate row
    // states its own verdict in text, not only by icon, and all eleven gates are rendered — never
    // a `.slice()`.
    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    await openShortlistSections(shortlist);
    const wf017Gates = shortlist.locator('[data-testid^="ward-gate-"]');
    await expect(wf017Gates).toHaveCount(11);
    for (const gate of await wf017Gates.all()) {
      const pass = await gate.getAttribute("data-pass");
      await expect(gate).toContainText(pass === "true" ? "Met" : "Not met");
    }

    // Nothing is allocated until a human refers — before any candidate selection or click. The
    // single "No automatic allocation" banner sentence this used to check for is gone from the
    // component; `shortlist-panel.tsx` now states the same property on each button that would
    // otherwise act on a default — checked here through the Refer button's own blocked reason.
    await expect(shortlist).toContainText("nothing is referred against a default");
    await expect(shortlist).not.toContainText("Referred by a human coordinator");
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");
    // By testid, not `getByRole("button", { name: /Refer/ })`: RA1/item 18's already-referred,
    // locked candidate row (`data-live="true"`) can itself carry "Refer"-matching text once a
    // movement carries a live parallel referral, and a role+regex match then resolves both in
    // strict mode.
    await expect(shortlist.getByTestId("ward-shortlist-refer")).toBeVisible();

    // WF-009: guaranteed to surface a failing gate on its default candidate, unlike WF-017
    // above — this is the unconditional proof the brief's own guarded assertion could skip.
    // Selected by id, not by row position, so it does not matter which row it currently ranks.
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    await openShortlistSections(shortlist);
    const wf009Gates = shortlist.locator('[data-testid^="ward-gate-"]');
    await expect(wf009Gates).toHaveCount(11);
    for (const gate of await wf009Gates.all()) {
      const pass = await gate.getAttribute("data-pass");
      await expect(gate).toContainText(pass === "true" ? "Met" : "Not met");
    }

    // A failing gate never renders the success icon. Note the selector: lucide-react emits
    // `lucide-circle-check` for `CheckCircle2`, not `lucide-check-circle-2` — the class Phase 1
    // asserted on, which could never fail regardless of what the icon actually was. Paired with a
    // present-icon assertion on the same row so this cannot pass merely because both icons are
    // absent (Ruling 3).
    const failing = shortlist.locator('[data-testid^="ward-gate-"][data-pass="false"]');
    await expect(failing.first()).toBeVisible();
    await expect(failing.first().locator("svg.lucide-circle-check")).toHaveCount(0);
    await expect(failing.first().locator("svg.lucide-circle-alert")).toHaveCount(1);

    // Selecting an ineligible candidate (WF-009's default) leaves referring unavailable, with
    // the reason stated rather than the control silently vanishing. Nothing has been clicked on
    // this movement yet, so this is really "nothing selected" — the same guard the default-candidate
    // test below exercises directly.
    const referButton = shortlist.getByTestId("ward-shortlist-refer");
    await expect(referButton).toHaveAttribute("aria-disabled", "true");
    await expect(shortlist).not.toContainText("Referred by a human coordinator");

    // Selecting WF-017's own eligible candidate makes referring available, and referring
    // records a real human decision on screen — never an automatic allocation triggered by
    // merely selecting a row. Fix round 1: the record is `movement.referredUnitIds` itself
    // (the "Parallel referral" badge), never a local optimistic flag, so this also proves the
    // dispatch actually reached shared state rather than merely toggling local UI. WF-017
    // already carries its own pre-existing "Parallel referral: BTY Adult Secure" from the
    // fixture, so the pre-click assertion checks the SPECIFIC new referral is absent, not the
    // phrase overall.
    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    await openShortlistSections(shortlist);
    await shortlist.locator('[data-testid="ward-shortlist-candidate-rph-adult-secure"]').click();
    await expect(referButton).not.toHaveAttribute("aria-disabled", "true");
    await expect(shortlist).not.toContainText("Parallel referral: Dabakarn");
    await referButton.click();
    await expect(shortlist).toContainText("Parallel referral: Dabakarn");
  });

  /**
   * Whole-branch review Critical 2, carried into Task 5. `ShortlistPanel` defaults `activeUnit`
   * to `shortlist[0]` so the gate list is never empty, but Refer and Override now act only on
   * `referTargets` — the real, explicit multi-select state a candidate-row click drives — never
   * on that default. On WF-004 (stage `pulled`, accepted destination BTY Adult Secure) the
   * default is Dabakarn; a default that Refer could act on would be an auto-allocation
   * with one tap of consent, which is the single thing this phase claims it never does.
   *
   * Proven red before the fix: with `canRefer` restored to `activeUnit !== undefined && ...`,
   * the first `aria-disabled` assertion below fails on WF-017 (whose default candidate is
   * eligible), and the WF-004 half records a referral against a unit nobody selected.
   */
  test("never refers or overrides against a default candidate the coordinator did not choose", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    const referButton = shortlist.getByTestId("ward-shortlist-refer");
    const overrideToggle = shortlist.getByTestId("ward-shortlist-override-toggle");

    // WF-017's default candidate passes all eleven gates, so "unavailable" here cannot be an
    // accident of ineligibility — it can only be the missing human selection. Pinned against the
    // real fixture so this test fails loudly rather than passing vacuously if that changes.
    const wf017 = requireMovement("WF-017");
    const wf017Default = eligibleCandidatesAmong(wf017, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP)[0];
    expect(wf017Default, "fixture assumption: WF-017 has at least one candidate").toBeTruthy();
    expect(
      wf017Default.verdict.eligible,
      "fixture assumption: WF-017's default candidate is eligible, so only the missing selection can block Refer",
    ).toBe(true);

    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    await openShortlistSections(shortlist);

    // The default candidate's gates are shown (orientation is fine)...
    await expect(shortlist.locator('[data-testid^="ward-gate-"]')).toHaveCount(11);
    // ...but nothing on screen claims a human pressed anything — other than the one candidate the
    // FIXTURE itself already carries a live referral against (BTY Adult Secure, WF-017's own
    // "Parallel referral" badge). RA1 (item 18) added `data-live`/`aria-pressed` pre-selection and
    // locking for exactly that ward, deliberately and separately from a human's own click
    // (`shortlist-panel.tsx`'s `isLive`/`isSelected`), so this assertion now excludes it rather
    // than asserting zero pressed candidates outright — the property this test protects is that no
    // OTHER candidate reads as pressed by default, never that a real, pre-existing referral stops
    // announcing itself.
    await expect(
      shortlist.locator('[data-testid^="ward-shortlist-candidate-"][aria-pressed="true"]:not([data-live="true"])'),
    ).toHaveCount(0);

    // ...and BOTH halves of the human decision are unavailable, each saying why rather than
    // silently doing nothing. Override is not a lesser path — the governing rule is "a human
    // confirms OR overrides, always, with the reason recorded" — so a coordinator blocked from
    // referring an un-chosen default must not be able to override straight into it.
    await expect(referButton).toHaveAttribute("aria-disabled", "true");
    await expect(overrideToggle).toHaveAttribute("aria-disabled", "true");
    await expect(shortlist).toContainText("Choose at least one candidate ward before referring");
    await expect(shortlist).toContainText("Choose at least one candidate ward before overriding");
    // `force` because Playwright's actionability check already refuses an `aria-disabled` control.
    // Bypassing it is the stronger proof: even a real activation must record nothing, since the
    // repo's unavailable-control pattern keeps the button focusable and clickable by design (it is
    // `aria-disabled` + an inert handler, never native `disabled`, so the stated reason stays
    // reachable to a keyboard and screen-reader user).
    await referButton.click({ force: true });
    await expect(shortlist).not.toContainText("Referred by a human coordinator");

    // A forced activation of Override must not even open the reason form — if it opened, the
    // textarea would be addressed to the default unit and one submission would record an override
    // against a ward nobody picked.
    await overrideToggle.click({ force: true });
    await expect(overrideToggle).toHaveAttribute("aria-expanded", "false");
    await expect(shortlist.getByLabel(/Reason for overriding/)).toHaveCount(0);
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");

    // Choosing a candidate is what makes both available. Fix round 1: the record below is
    // `movement.referredUnitIds` itself (the "Parallel referral" badge), never a local
    // optimistic flag.
    await shortlist.locator(`[data-testid="ward-shortlist-candidate-${wf017Default.unit.id}"]`).click();
    await expect(referButton).not.toHaveAttribute("aria-disabled", "true");
    await expect(overrideToggle).not.toHaveAttribute("aria-disabled", "true");
    await referButton.click();
    await expect(shortlist).toContainText(`Parallel referral: ${wf017Default.unit.name}`);

    // WF-004 is the worst case the review found: a bed is already held elsewhere, and the default
    // candidate is a different ward entirely. The screen must never assert two destinations for
    // one patient off a single tap.
    const wf004 = requireMovement("WF-004");
    expect(wf004.acceptedUnitId, "fixture assumption: WF-004 has an accepted destination").toBeTruthy();
    const wf004Default = eligibleCandidatesAmong(wf004, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP)[0];
    expect(
      wf004Default.unit.id,
      "fixture assumption: WF-004's default candidate is NOT its accepted destination",
    ).not.toBe(wf004.acceptedUnitId);

    await queue.locator('[data-testid="ward-queue-row-WF-004"]').click();
    await openShortlistSections(shortlist);
    await expect(shortlist).toContainText("Accepted destination:");
    await expect(referButton).toHaveAttribute("aria-disabled", "true");
    await expect(overrideToggle).toHaveAttribute("aria-disabled", "true");
    await referButton.click({ force: true });
    await overrideToggle.click({ force: true });
    await expect(shortlist).not.toContainText("Referred by a human coordinator");
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");
  });

  /**
   * Task 7 review Important 1: reversing the gate-list comparator to put failures LAST left the
   * rest of the suite green, because every other assertion checks text/icon correctness per row,
   * not the row ORDER. This pins the order itself, independent of gate count or wording, so a
   * future edit that buries a failing gate anywhere but first is caught regardless of exactly how
   * many gates fail.
   */
  test("keeps failing gates ordered before passing gates", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // WF-009's default candidate (Dabakarn) fails exactly one of the eleven gates
    // (prior_decline) — enough to prove ordering without depending on how many gates fail.
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    const passFlags = await shortlist
      .locator('[data-testid^="ward-gate-"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-pass")));
    expect(passFlags).toHaveLength(11);
    const lastFalseIndex = passFlags.lastIndexOf("false");
    const firstTrueIndex = passFlags.indexOf("true");
    expect(
      lastFalseIndex,
      "at least one failing gate must be present for this assertion to mean anything",
    ).toBeGreaterThanOrEqual(0);
    expect(
      firstTrueIndex,
      "at least one passing gate must be present for this assertion to mean anything",
    ).toBeGreaterThanOrEqual(0);
    expect(lastFalseIndex, "every failing gate must render before every passing gate").toBeLessThan(firstTrueIndex);
  });

  /**
   * Task 7 review Important 2: adding `.slice(0, 3)` to the declines list silently dropped two of
   * WF-009's five recorded declines and the suite stayed green, because nothing previously counted
   * the rendered rows against the movement's own real decline count.
   */
  test("renders every recorded decline, never a truncated subset", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    const movement = requireMovement("WF-009");
    expect(movement.declines.length, "fixture assumption: WF-009 carries five declines").toBe(5);

    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    await expect(shortlist.locator('[data-testid="ward-decline-row"]')).toHaveCount(movement.declines.length);
  });

  /**
   * Task 7 review Important 3: replacing the eligible-only lookup with the shortlist's raw first
   * entry labels an INELIGIBLE unit "Suggested destination" on a movement like WF-009 (all three
   * candidates ineligible) — precisely what ruling 5 forbids, since it would recommend a
   * ward that already refused the patient. The suite stayed green under that mutation because
   * nothing previously asserted the label's absence on an all-ineligible movement.
   */
  test("never labels an ineligible candidate as the suggested destination", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // WF-009: every one of its three candidates is ineligible, so there is no unit this
    // panel may honestly suggest.
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    await expect(shortlist).not.toContainText("Suggested destination");
    await expect(shortlist).toContainText("No eligible destination found yet.");

    // WF-017: carries a recorded outstanding referral (a fact, never a computed suggestion), so
    // "Suggested destination" must not appear here either. That referral — BTY Adult Secure,
    // selectable via the diagram's shared selection state — passes every gate, so presenting it
    // as fact carries no hidden risk of recommending a failing unit.
    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    await expect(shortlist).toContainText("Parallel referral: BTY Adult Secure");
    await expect(shortlist).not.toContainText("Suggested destination");

    const diagram = page.getByRole("region", { name: "State Bedflow", exact: true });
    await diagram.locator('[data-testid="ward-diagram-unit-bty-adult-secure"]').click();
    const btyGates = shortlist.locator('[data-testid^="ward-gate-"]');
    await expect(btyGates).toHaveCount(11);
    await expect(shortlist.locator('[data-testid^="ward-gate-"][data-pass="false"]')).toHaveCount(0);
  });

  /**
   * Task 7 review Important 4: override is half of the phase's central governance claim ("a human
   * confirms OR overrides, always, with the reason recorded"), and previously had zero test
   * coverage in either ward spec — proven only by reading the source. This walks it end to end:
   * reachable, reason-gated (an empty submission records nothing), and the recorded reason is
   * visible on screen afterwards.
   */
  test("the override path is a real, reason-gated confirmation path", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // WF-009: every candidate is ineligible, so override is the only human path that can
    // place a patient here — exactly the scenario the control exists for.
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    await openShortlistSections(shortlist);

    const overrideToggle = shortlist.getByTestId("ward-shortlist-override-toggle");
    await expect(overrideToggle).toBeVisible();
    // Override, like Confirm, acts only on a candidate a human explicitly chose — never on the
    // panel's default (whole-branch review Critical 2, extended to the other half of the control
    // pair). Choosing Dabakarn is what a coordinator would really do before overriding into
    // it, and it is the same unit the recorded override below must name.
    await expect(overrideToggle).toHaveAttribute("aria-disabled", "true");
    await shortlist.locator('[data-testid="ward-shortlist-candidate-rph-adult-secure"]').click();
    await expect(overrideToggle).not.toHaveAttribute("aria-disabled", "true");
    await overrideToggle.click();

    const reasonField = shortlist.getByLabel(/Reason for overriding/);
    const submitButton = shortlist.getByRole("button", { name: "Record override" });
    await expect(reasonField).toBeVisible();

    // A reason is required — submitting empty must record nothing.
    await submitButton.click();
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");

    // A real reason produces a real, human-attributed record, visible on screen.
    // OD-3 made this a fixed picker: a coordinator chooses a reason rather than typing one, so a
    // free-text sentence is exactly the value the picker exists to make impossible. Selecting the
    // established option instead, patterned on the escalation-contact conversion below in this file.
    // The value must be a real member of OVERRIDE_REASONS, because it is asserted back on screen.
    const reasonText = "Clinical urgency outweighs the mismatch";
    await reasonField.selectOption(reasonText);
    await submitButton.click();
    await expect(shortlist).toContainText("Overridden by a human coordinator");
    await expect(shortlist).toContainText(reasonText);
    await expect(shortlist).toContainText("Dabakarn");
  });

  /**
   * Task 5: the screen goes live. Selecting a candidate row is what makes Refer available —
   * never a default — and Refer dispatches a real `REFER_TO_UNITS` event through the provider,
   * so the referral is a fact in shared state (`movement.referredUnitIds`), not merely a local
   * "you clicked a button" note. The Correction applied to this task's brief: the candidate rows
   * use `data-testid="ward-shortlist-candidate-<unit id>"` (never `ward-candidate-`), and the
   * primary control is `data-testid="ward-shortlist-refer"` labelled "Refer" — Tasks 7 and 12
   * both select on that testid.
   */
  test("refers a patient to up to three wards and records what it did", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    // Task 6A note: this used to click the queue's top row, which happened to always be WF-017
    // — not because WF-017 legitimately ranks first, but because its now-deleted fabricated
    // Form 3B deadline artificially inflated its operational score to the top. With that fixed,
    // the genuine top-ranked movement can legitimately be in any stage (today it is a generated
    // movement in a non-referable stage), which this test — about the refer/shortlist mechanism,
    // not queue rank — was never meant to depend on. WF-002 (destination_review, no legal form
    // at all) is a stable, always-referable movement, selected explicitly by id like every other
    // test in this file already does.
    await queue.locator('[data-testid="ward-queue-row-WF-002"]').click();

    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await openShortlistSections(shortlist);

    // Nothing is referable until a human picks a ward.
    const refer = shortlist.getByTestId("ward-shortlist-refer");
    await expect(refer).toHaveAttribute("aria-disabled", "true");

    await shortlist.locator('[data-testid^="ward-shortlist-candidate-"]').first().click();
    await expect(refer).not.toHaveAttribute("aria-disabled", "true");
    await refer.click();

    // The referral is recorded on the screen, and the parallel cap is stated.
    await expect(shortlist).toContainText(/parallel referral/i);
    await expect(shortlist).not.toContainText(/Confirm placement/);
  });

  /**
   * Task 5 fix round 1, Finding 1. `REFER_TO_UNITS` only accepts a movement at
   * `placement_requested` or `destination_review`; WF-004 sits at `pulled` — still open, still
   * offering an eligible-shaped candidate on its shortlist — so Refer must never be reachable
   * there, and must never claim success even under a forced activation. `force` is the stronger
   * proof than merely checking `aria-disabled`: it proves the handler itself is inert, not only
   * that the control looks disabled (the repo's `aria-disabled` pattern keeps a control
   * focusable and clickable by design, so a forced click is a real, reachable activation).
   */
  test("never claims a referral succeeded on a non-referable movement", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const wf004 = requireMovement("WF-004");
    expect(wf004.stage, "fixture assumption: WF-004 sits in a non-referable stage").toBe("pulled");
    const wf004Default = eligibleCandidatesAmong(wf004, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP)[0];
    expect(
      wf004Default,
      "fixture assumption: WF-004 still has a candidate on offer despite being non-referable",
    ).toBeTruthy();

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    await queue.locator('[data-testid="ward-queue-row-WF-004"]').click();
    await openShortlistSections(shortlist);
    await shortlist.locator(`[data-testid="ward-shortlist-candidate-${wf004Default.unit.id}"]`).click();

    const refer = shortlist.getByTestId("ward-shortlist-refer");
    await expect(refer).toHaveAttribute("aria-disabled", "true");
    // The stated reason names the movement's own real stage, never a generic string.
    await expect(refer).toHaveAttribute("title", /bed pulled/i);

    await refer.click({ force: true });
    await expect(shortlist).not.toContainText("Parallel referral");
    await expect(shortlist).not.toContainText("Referred by a human coordinator");
  });

  /**
   * Task 5 fix round 1, Finding 3: the first version of this test opened Exceptions with zero
   * rejections ever raised and asserted `/refus/i`, which the empty-state copy itself contains —
   * it could only ever catch the whole region disappearing. This raises a genuine refusal first
   * (WF-004 again: Refer is unreachable there, but Override is deliberately NOT stage-gated —
   * see the comment above `canOverride` in `shortlist-panel.tsx` — so it dispatches the same
   * `REFER_TO_UNITS` event and the reducer refuses it for real) and then asserts the refusal's
   * own specific content, including the reducer's real reason text.
   */
  test("shows a refused transition instead of swallowing it", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const wf004 = requireMovement("WF-004");
    const wf004Default = eligibleCandidatesAmong(wf004, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP)[0];
    expect(wf004Default, "fixture assumption: WF-004 has a candidate to override into").toBeTruthy();

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

    // ⚠️ PRE-EXISTING, found running this deliberate spec for Task A (structured-wobbling-globe)
    // rather than caused by it: owner ruling 2026-09-07 (commit 952ef55cb1, landed on this branch
    // before Task A started) made the refusal badge render at EVERY value, including nought —
    // "0 refused" is itself the answer to "have any been refused today", the same reasoning
    // already applied to Declines/Overrides/Exceptions. That commit's own message admits no test
    // pinned the change either way ("all 50 existing cases passed before this change and after
    // it"), and this assertion — asserting the badge is ABSENT before any refusal — is exactly
    // the one it left stale. Fixed here as the same kind of correction the task brief's own
    // verification section asks for ("move the pin... if the assertion is now wrong, and say
    // so"), not a Task A behaviour change.
    //
    // Task A itself: checked against the NEW persistent marker
    // (`ward-coordinator-refusal-marker`, `coordinator-screen.tsx`'s governance banner) rather
    // than the phone-only toggle badge this test used to read — that badge is `display: none`
    // from 48rem up now (see `.exceptionsToggle`'s own comment), so it is no longer the surface
    // that stays visible without opening anything at this test's 1600px width. The marker reads
    // the same `rejections.length`, so it cannot disagree with whichever badge is actually shown.
    const refusalMarker = page.getByTestId("ward-coordinator-refusal-marker");
    await expect(refusalMarker).toHaveText("0 refused");

    await queue.locator('[data-testid="ward-queue-row-WF-004"]').click();
    await openShortlistSections(shortlist);
    await shortlist.locator(`[data-testid="ward-shortlist-candidate-${wf004Default.unit.id}"]`).click();

    const overrideToggle = shortlist.getByTestId("ward-shortlist-override-toggle");
    await expect(overrideToggle).not.toHaveAttribute("aria-disabled", "true");
    await overrideToggle.click();
    // OD-3: a fixed picker, not free text. This override is REFUSED by the reducer, so the reason
    // is never rendered and any real option serves — but it must still be a real one.
    await shortlist.getByLabel(/Reason for overriding/).selectOption("The bed information is known to be out of date");
    await shortlist.getByRole("button", { name: "Record override" }).click();

    // The override never claims success — it was refused, and nothing here may say otherwise.
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");

    // Whole-branch review I4, Task A: the refusal is now visible on the PERSISTENT governance-
    // banner marker, without scrolling to the registers panel and without opening anything — the
    // exact gap the review's own Proof 2 found (a refused PULL_PATIENT was invisible until the
    // bar was explicitly opened), preserved across the move per the task brief's own 🔴 ruling.
    await expect(refusalMarker).toHaveText("1 refused");

    // The refusal is visible, with its own real content — not merely the word "refus" surviving
    // from an empty-state placeholder.
    //
    // Task 5: refusals moved out of the Exceptions panel into their own "Refused actions" tab —
    // see `exception-drawer.tsx`'s own file comment on why the two were split. On desktop the
    // registers open from the hero's Exceptions count (owner, 8 Oct 2026), so open them first.
    await page.getByRole("button", { name: /Exceptions/, expanded: false }).click();
    const refusedTab = page.getByRole("tab", { name: /Refused/ });
    await refusedTab.scrollIntoViewIfNeeded();
    await refusedTab.click();
    const refused = page.getByRole("tabpanel", { name: "Refused" });
    await expect(refused).toContainText(/refus/i);
    await expect(refused).toContainText("REFER_TO_UNITS");
    // ⚠️ O-16.8: the refusal now names the stage by its coordinator-facing label rather than
    // interpolating the raw identifier, so the identifier is deliberately no longer asserted
    // here — it is no longer on screen, which is the point of the ruling.
    await expect(refused).toContainText("cannot refer a movement at its current stage");
  });

  /**
   * Task 7 (historical). The coordinator used to chase the referral control into view on a phone
   * with a double-`requestAnimationFrame` `scrollIntoView` effect, later deleted once
   * `.shortlistActionRow` was pinned to the viewport bottom by CSS.
   *
   * ⚠️ **THE PIN ITSELF IS GONE, BY DESIGN, SINCE THE THIRD-EDITION VISUAL UPGRADE (883ecfdfb4,
   * 2026-09-13).** `.shortlistActionRow`'s phone-width rule (`coordinator.module.css`,
   * `@media (max-width: 48rem)`) now reads `position: static` — "Keep every record-action row in
   * natural flow on phones, so an opened record form never stacks controls at the viewport edge."
   * That is a real, deliberate redesign (the class is shared by the primary Refer/Override row and
   * two record-update rows further down the panel), not a regression: a fixed bottom bar was the
   * wrong shape once those other rows could open above it. So "selecting a patient moves nothing"
   * is no longer a true property of this screen, and asserting it would be testing a mechanism the
   * screen no longer has. What survives from Task 7's original intent — the control must still be
   * reachable, not lost below an unreachable fold or clipped — is what this test now checks, by
   * scrolling to it exactly the way a phone user would, and confirming it is then fully visible.
   *
   * Task 7 addendum R24: select the movement explicitly by `data-testid`, never `.first()` — Task
   * 6A had to remove exactly that fragility from two other tests in this file once the fabricated
   * Form 3B deadline that used to inflate WF-017's score to rank 1 was deleted. WF-002 is used
   * instead of a rank-derived row, verified against the current fixture rather than assumed: its
   * fixture record (`ward-movements.ts`) sets `stage: "destination_review"`, and the reducer's
   * `REFERRABLE_MOVEMENT_STAGES` (`ward-flow-reducer.ts`) is `["placement_requested",
   * "destination_review"]` — so WF-002 is genuinely referable, matching the "refers a patient to
   * up to three wards" test above, which documents the same fact and selects the same row.
   *
   * Task 7 addendum R25: `expect(page.evaluate(...)).resolves.toBe(...)` is Jest/Vitest
   * vocabulary Playwright's `expect` may not carry — written here as `expect(await
   * page.evaluate(...)).toBe(...)` instead, so a missing `.resolves` chain cannot silently no-op
   * this assertion into an unconditional pass.
   *
   * Fix round 1, R50: the original code here read `window.scrollY`, which mutation testing
   * proved cannot fail — `.screen` is `height: 100dvh; overflow: hidden`, so the real
   * `<html>`/`<body>` never has any scroll range at all, and `window.scrollY` is `0` before and
   * after on every run regardless of what the code does. R25 only checked the matcher's *style*
   * (`.resolves` vs. the plain form), never whether the asserted quantity could actually change.
   * `.body` (`.shortlistBody`'s ancestor, `overflow: auto`) is the real scroll container — the one
   * the deleted `scrollIntoView({ block: "nearest" })` actually moved — so this now reads that
   * element's `scrollTop` through its own stable `data-testid` rather than a CSS-module class name
   * (which is hashed at build time and not a stable selector).
   */
  test("keeps the referral control reachable on a phone, in the panel's natural flow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    await queue.locator('[data-testid="ward-queue-row-WF-002"]').click();

    // No longer pinned (see this test's own doc comment) — the control sits in normal document
    // flow once the shortlist opens, so reaching it is an ordinary scroll, exactly like a phone
    // user's thumb would do. The property this protects is that the scroll actually gets there:
    // not clipped by an ancestor's `overflow: hidden`, not left behind an element with a higher
    // `z-index`, not sized to zero.
    const referButton = page.getByTestId("ward-shortlist-refer");
    await referButton.scrollIntoViewIfNeeded();
    await expect(referButton).toBeInViewport();
    await expect(referButton).toBeVisible();

    // And the queue keeps the room it was previously losing to a nested scroller: every movement
    // the fixture holds is still really rendered, not truncated to make room for anything else.
    const rows = await queue.locator('[data-testid^="ward-queue-row-"]').count();
    expect(rows).toBeGreaterThan(4);
  });

  /**
   * Whole-branch review I2 (spec §11): "when every candidate is ineligible, the coordinator can
   * record that it happened — what was tried, why each failed, and who is being contacted."
   * WF-009 is pinned as the fixture case (verified below against the real `eligibleCandidatesAmong`,
   * never assumed): five declines have exhausted every cohort-matching candidate.
   *
   * WF-009's fixture (`ward-movements.ts`) already carries a pre-authored `escalation` — the
   * model has held this field since the fixture was written, but nothing could ever write a NEW
   * one (I2's actual finding: `grep -rn "RECORD_ESCALATION" src/` returned only the events file
   * and the reducer). So the real proof here is not "absent, then present" — it is that
   * submitting a fresh escalation genuinely dispatches and OVERWRITES the pre-authored one with
   * live data, the same live-write proof `overrideSucceeded` elsewhere in this file gives for
   * REFER_TO_UNITS.
   */
  test("records an escalation when no eligible destination exists, and it persists on the movement", async ({
    page,
  }) => {
    await gotoCoordinator(page);

    const wf009 = requireMovement("WF-009");
    const candidates = eligibleCandidatesAmong(wf009, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP);
    expect(
      candidates.some((c) => c.verdict.eligible),
      "fixture assumption: WF-009 has no eligible candidate",
    ).toBe(false);
    expect(wf009.escalation, "fixture assumption: WF-009 already carries a pre-authored escalation").toBeDefined();
    expect(wf009.declines.length, "fixture assumption: WF-009 carries five declines").toBe(5);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();

    // The pre-authored fixture record renders correctly before anything is dispatched.
    const record = shortlist.getByTestId("ward-shortlist-escalation-record");
    await expect(record).toContainText(wf009.escalation!.contact);
    const toggle = shortlist.getByTestId("ward-shortlist-escalation-toggle");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveText("Update escalation");

    await toggle.click();
    // The escalation contact became a fixed picker (Phase 4 item 11): the coordinator chooses a
    // role or service rather than typing one, so the synthetic-data promise holds by construction
    // instead of by a label asking nicely. This step used to `.fill()` a free-text sentence — the
    // exact class of value the picker exists to make impossible — so it selects instead. "Duty
    // psychiatrist" is deliberately a DIFFERENT option from the fixture's authored "State bed
    // coordination desk", which is what makes the change below observable.
    const NEW_CONTACT = "Duty psychiatrist";
    expect(NEW_CONTACT, "the test must change the contact, or it proves nothing").not.toBe(wf009.escalation!.contact);
    await shortlist.getByTestId("ward-shortlist-escalation-contact").selectOption(NEW_CONTACT);
    await shortlist.getByTestId("ward-shortlist-escalation-submit").click();

    // A real dispatch, not a local echo of the chosen option: the record now reads the NEW contact,
    // and `triedUnitIds` is `movement.declines` (never the panel's capped `shortlist`), so the
    // count matches the real five declines exactly.
    await expect(record).toContainText(NEW_CONTACT);
    await expect(record).not.toContainText(wf009.escalation!.contact);
    await expect(record).toContainText(`tried ${wf009.declines.length} unit`);

    // Persists across a selection change and back — this is a fact stamped on the movement
    // (`movement.escalation`), not local component state that a re-render could lose.
    await queue.locator('[data-testid="ward-queue-row-WF-017"]').click();
    await queue.locator('[data-testid="ward-queue-row-WF-009"]').click();
    await expect(shortlist.getByTestId("ward-shortlist-escalation-record")).toContainText(NEW_CONTACT);
    await expect(shortlist.getByTestId("ward-shortlist-escalation-toggle")).toHaveText("Update escalation");
  });
});
