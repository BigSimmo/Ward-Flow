import { expect, test, type Locator, type Page } from "playwright/test";

import { unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import { buildActionInbox, eligibleCandidatesAmong, isOpen } from "@/components/ward-management/ward-derivations";
import type { Movement } from "@/components/ward-management/ward-model";
import { PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { movementById } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { showEveryoneWaitingOn } from "./helpers/ward-home-page";

/**
 * Home placement redesign (Josh, 19 Oct 2026): desktop Home lists the queue's top 10 and "Show all
 * (N)" reveals the rest in place. Pick a row the way a coordinator would: open the whole queue
 * first when the row is further down.
 */
async function pickQueueRow(queue: Locator, movementId: string): Promise<Locator> {
  const row = queue.getByTestId(`ward-queue-row-${movementId}`);
  const showAll = queue.getByTestId("ward-queue-show-all");
  if (
    !(await row.isVisible()) &&
    (await showAll.isVisible()) &&
    (await showAll.getAttribute("aria-expanded")) !== "true"
  ) {
    await showAll.click();
  }
  await row.click();
  return row;
}

async function gotoCoordinator(page: Page) {
  await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
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
  // Network idle does not prove the shell has settled. The server renders the "Data mode" bar above
  // the app; once hydrated, the header's Prototype pill takes its place and the whole screen moves
  // up by the bar's height. A queue click issued across that re-render takes the pointerdown on one
  // row and the pointerup on the grid, so no row is selected (seen 11 Oct 2026, intermittently).
  // Wait until the pill is in the header and the bar is gone before the first interaction.
  await expect(page.locator("[data-wf-data-mode-slot]")).not.toBeEmpty({ timeout: 15_000 });
  await expect(page.getByRole("region", { name: "Ward Flow data mode" })).toHaveCount(0);
  // Home v7 (Josh, 22 Oct 2026): Home opens on My list; these journeys read the priority queue.
  await showEveryoneWaitingOn(page);
}

/**
 * PR 46 ("Coordinator Shortlist Panel & Action Compaction") defaults the shortlist's Candidates
 * section and its Eligibility checks disclosure to closed. Open both before reading or clicking
 * inside them; idempotent, so it is safe after every queue selection.
 */
async function openShortlistSections(shortlist: Locator) {
  // L3 (site review, 12 Oct 2026): once a ward has accepted, the card leads with the next step and
  // keeps the bed list behind "Find another bed".
  const findAnother = shortlist.getByTestId("ward-shortlist-find-another-bed");
  const toggle = shortlist.getByTestId("ward-shortlist-candidates-toggle");
  // Home v7 (Josh, 22 Oct 2026): Placement mounts only once a patient is chosen, so wait for the
  // card to render one of the two before deciding which it shows.
  await expect(findAnother.or(toggle).first()).toBeVisible();
  if ((await findAnother.count()) > 0) await findAnother.click();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const checks = shortlist.locator('details[aria-label="Eligibility checks"]');
  if ((await checks.count()) > 0 && !(await checks.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await checks.locator("summary").click();
  }
}

/**
 * Option B (Josh, 13 Oct 2026; D-30): Refer on Home's placement shortlist no longer offers the ward
 * at once. It opens the one referral slide-out for this person (the referral then reaches the
 * coordinator queue), clears the Home selection, and is never greyed for the coordinator. This
 * proves the slide-out opened, closes it untouched, and reselects the movement so the caller can
 * check that nothing was offered directly.
 */
async function expectReferralSheetFromRefer(page: Page, movementId: string) {
  const sheet = page.getByTestId("ward-bar-referral-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close referral side drawer" }).first().click();
  await expect(sheet).toHaveCount(0);
  const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });
  await page
    .getByRole("region", { name: "Priority queue" })
    .locator(`[data-testid="ward-queue-row-${movementId}"]`)
    .click();
  await openShortlistSections(shortlist);
  return shortlist;
}

/**
 * Resolves a movement id off a real, currently-rendered queue row rather than trusting whatever
 * the test author expected to be there — the same reasoning `movementById` itself documents
 * (never fall back to a different record on a miss).
 */
function requireMovement(movementId: string | undefined | null): Movement {
  // The rulings-demo overlay's movements (WF-RD…) are only in the seeded state, and wait order
  // (Audit 1, D-71) can put one at the top of the queue.
  const movement = movementId
    ? (movementById(movementId) ?? seedWardFlowState().movements.find((candidate) => candidate.id === movementId))
    : undefined;
  if (!movement) throw new Error(`Fixture is missing movement ${String(movementId)}`);
  return movement;
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
    // Home v7 (Josh, 22 Oct 2026): State bedflow moved to the foot of Capacity; Beds that fit
    // takes its place on Home.
    await expect(page.getByRole("region", { name: "State Bedflow", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("home-beds-gap")).toBeVisible();
    // ⚠️ **THE SHORTLIST NO LONGER MOUNTS UNCONDITIONALLY.** `coordinator-screen.tsx` now wraps
    // the whole `<aside aria-label="Placement">` in `{hasPanelSubject ? ... : null}` —
    // with nothing selected, "Statewide flow"'s own header shows "Select a patient or referral to
    // open shortlist" instead, and the shortlist landmark simply is not in the document yet. A
    // click is therefore a real precondition for this region existing at all now, not an
    // incidental step.
    await page.locator('[data-testid^="ward-queue-row-"]').first().click();
    await expect(page.getByRole("complementary", { name: "Placement", exact: true })).toBeVisible();
    // Owner, 8 Oct 2026: the four registers start closed and open as a strip under the hero. Home
    // v7 (Josh, 22 Oct 2026): the Registers link beside Alerts history opens them. Scrolled into
    // view before the visibility check, as Playwright's `toBeVisible()` needs it in the viewport.
    await page.getByTestId("ward-home-registers").click();
    const registers = page.getByRole("region", { name: "Declines, overrides and exceptions" });
    await registers.scrollIntoViewIfNeeded();
    await expect(registers).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Today’s answers" })).toBeVisible();

    await expectNoRegionGridOverflow(page);
  });

  // The equivalent coverage for these two lived on WardManagementConsole, which Task 3 stopped
  // rendering at /ward-flow. Task 9 deletes that component; until then the behaviour has
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });
    // Home v7 (Josh, 22 Oct 2026): nothing is pre-selected. Placement stays empty, with a prompt
    // to choose a patient, until a row is chosen.
    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    const firstRow = rows.first();
    const firstId = (await firstRow.getAttribute("data-testid"))?.replace("ward-queue-row-", "");
    await expect(shortlist).toHaveCount(0);
    await expect(page.getByTestId("home-placement-prompt")).toBeVisible();
    await expect(firstRow).toHaveAttribute("aria-pressed", "false");
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

    // Opens on the Exceptions tab by default. At this width the registers start closed (owner,
    // 8 Oct 2026).
    // Home v7 (Josh, 22 Oct 2026): the Registers link beside Alerts history opens them.
    await page.getByTestId("ward-home-registers").click();
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
    // The same call the screen makes (coordinator-screen.tsx): open movements, the seeded planned
    // admissions (stream D: an overdue booking is a row too), plus the whole record so the advisory
    // carer/PSP/MHAS notification rows are counted too.
    const seed = seedWardFlowState();
    const expectedCount = buildActionInbox(seed.movements.filter(isOpen), NOW_ANCHOR, seed.units, {
      movements: seed.movements,
      admissions: seed.admissions,
      patients: seed.patients,
      referrals: seed.referrals,
      supportNotifications: seed.supportNotifications,
      plannedAdmissions: seed.plannedAdmissions,
    }).length;
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });
    await expect(shortlist).toBeVisible();
    // D-39: the Placement panel names the patient (and UMRN), never the WF journey number.
    // Selection is still keyed by the journey id on the panel and the queue row. Simplification A8:
    // the panel writes the name "Surname, First", as the queue beside it does.
    await expect(shortlist).toHaveAttribute("data-subject-movement", "WF-005");
    await expect(shortlist).toContainText("Tremalow, Noor");
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
    await expect(page.getByRole("complementary", { name: "Placement", exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    // Task A: the toggle only exists below 48rem now — restored exactly at the width the diagram
    // disappears (`@media (max-width: 48rem)`, the same query in both places).
    // v10 phone Home (Josh, 10 Oct 2026, direction A queue first): the old "Today's answers"
    // toggle is gone. The hero's Exceptions chip opens the registers as a sheet instead.
    await expect(page.getByRole("region", { name: "State Bedflow", exact: true })).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);

    // Review Important 3: once a movement is selected from the phone's Exceptions sheet, Confirm
    // is reachable without a long scroll.
    // Home v7 (Josh, 22 Oct 2026): the Registers link opens them, as a sheet on a phone.
    await page.getByTestId("ward-home-registers").click();
    await expect(page.getByTestId("ward-home-exceptions-sheet")).toBeVisible();
    const phoneDrawer = page.getByRole("tabpanel", { name: "Exceptions" });
    await expect(phoneDrawer).toBeVisible();
    await phoneDrawer.locator('[data-testid*="-WF-005"]').first().click();
    // L3: an accepted movement leads with its next step instead of Refer.
    await expect(
      page.getByTestId("ward-shortlist-refer").or(page.getByTestId("ward-shortlist-next-step")).first(),
    ).toBeInViewport();
  });

  test("orders by longest wait only and shows no score", async ({ page }) => {
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

    // Audit 1, Josh 20 Oct (CS-04), superseding D-32: every row is longest wait first. Flags,
    // act-now marks and tiers are badges and do not move a row. No row carries a score.
    const waits = await rows.evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-wait"))));
    expect(waits.length).toBeGreaterThan(1);
    for (let i = 1; i < waits.length; i++) {
      expect(waits[i], `row ${i} must not have waited longer than row ${i - 1}`).toBeLessThanOrEqual(waits[i - 1]);
    }
    await expect(queue.locator("[data-score]")).toHaveCount(0);

    // The score must never read as clinical severity, and the "Operational" leftover is gone (U3).
    await expect(queue).not.toContainText("Operational");
    await expect(queue).not.toContainText("Severity");
    await expect(queue).not.toContainText("Acuity");

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
    await rows.first().click();
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });
    const selectedId = await queue.locator('[aria-pressed="true"]').getAttribute("data-testid");
    const selectedMovementId = String(selectedId).replace("ward-queue-row-", "");
    // D-39: the journey id stays on the panel attribute; visible text is the patient, not WF-…
    await expect(shortlist).toHaveAttribute("data-subject-movement", selectedMovementId);
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
    // 8 Oct 2026 (owner): the visible "longest" word was cut off on the tile, so it was dropped.
    // The tile's accessible name still says which figure is the longest wait.
    await expect(worst).toHaveAccessibleName(/longest/);

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
    // Home shows the top 10 first; open the whole queue so the counts compare every row.
    await queue.getByTestId("ward-queue-show-all").click();
    await expect(queue.getByTestId("ward-queue-show-all")).toHaveAttribute("aria-expanded", "true");
    const before = await queue.locator('[data-testid^="ward-queue-row-"]').count();
    // The tile counts people physically waiting in the department; the filtered queue lists every
    // queued movement that came from it, including one already moving on. So the queue is compared
    // with its own unfiltered rows for that origin, and the tile may not exceed it.
    const expectedFiltered = await queue
      .locator(`[data-testid^="ward-queue-row-"][data-origin-ed="${worstEdId}"]`)
      .count();
    await worst.click();
    await expect(queue).toContainText("Filtered to");
    const rows = queue.locator('[data-testid^="ward-queue-row-"]');
    await expect(rows).toHaveCount(expectedFiltered);
    expect(worstWaiting).toBeLessThanOrEqual(expectedFiltered);
    const originIds = await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-origin-ed")));
    for (const originId of originIds) {
      expect(originId).toBe(worstEdId);
    }
    expect(worstWaiting).toBeLessThan(before);

    // And clearing restores it.
    await queue.getByRole("button", { name: /Clear filter/ }).click();
    await expect(queue.locator('[data-testid^="ward-queue-row-"]')).toHaveCount(before);
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

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

    await pickQueueRow(queue, "WF-001");
    await openShortlistSections(shortlist);

    // The locked candidates say so on their own rows; the open one does not. Home v7 (Josh, 22 Oct
    // 2026): State bedflow left Home, so the shortlist row is the one place this is read.
    for (const candidate of locked) {
      await expect(shortlist.locator(`[data-testid="ward-shortlist-candidate-${candidate.unit.id}"]`)).toContainText(
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
    await pickQueueRow(queue, "WF-004");
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
  test("gives a voluntary patient on a locked ward its own, more prominent notice in Placement", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

    const wf301 = requireMovement("WF-301");
    expect(wf301.legalStatus, "fixture assumption: WF-301 is a Voluntary movement").toBe("Voluntary");
    const candidates = eligibleCandidatesAmong(wf301, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP);
    // Wholly locked only — see the note on the WF-001 test above.
    const locked = candidates.filter((candidate) => !unitHasOpenBeds(candidate.unit));
    expect(locked.length, "fixture assumption: WF-301 has at least one Secure shortlisted candidate").toBeGreaterThan(
      0,
    );

    await pickQueueRow(queue, "WF-301");

    for (const candidate of locked) {
      const shortlistRow = shortlist.locator(`[data-testid="ward-shortlist-candidate-${candidate.unit.id}"]`);
      await expect(shortlistRow).toContainText(
        "Voluntary patient on a locked ward — review legal status before admission",
      );
      // Home v7 (Josh, 22 Oct 2026): State bedflow left Home, so its node's copy of this notice is
      // no longer on this screen; the shortlist row carries it.
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

    // WF-017: selected explicitly by id, not by row position — it no longer ranks first in the
    // queue now that Task 6A deleted the fabricated deadline that used to inflate its score (see
    // comment above), but its default candidate still passes all eleven gates. Every gate row
    // states its own verdict in text, not only by icon, and all eleven gates are rendered — never
    // a `.slice()`.
    await pickQueueRow(queue, "WF-017");
    await openShortlistSections(shortlist);
    const wf017Gates = shortlist.locator('[data-testid^="ward-gate-"]');
    await expect(wf017Gates).toHaveCount(11);
    for (const gate of await wf017Gates.all()) {
      const pass = await gate.getAttribute("data-pass");
      const mark = await gate.getAttribute("data-mark");
      await expect(gate).toContainText(mark === "info" ? "For information" : pass === "true" ? "Met" : "Not met");
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
    await pickQueueRow(queue, "WF-009");
    await openShortlistSections(shortlist);
    const wf009Gates = shortlist.locator('[data-testid^="ward-gate-"]');
    await expect(wf009Gates).toHaveCount(11);
    for (const gate of await wf009Gates.all()) {
      const pass = await gate.getAttribute("data-pass");
      const mark = await gate.getAttribute("data-mark");
      await expect(gate).toContainText(mark === "info" ? "For information" : pass === "true" ? "Met" : "Not met");
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
    // Option B (13 Oct 2026): the coordinator is never blocked, so Refer is not greyed even here;
    // the reason stays stated (screen-reader text), and Refer opens the referral slide-out rather
    // than offering a ward.
    const referButton = shortlist.getByTestId("ward-shortlist-refer");
    await expect(referButton).not.toHaveAttribute("aria-disabled", "true");
    await expect(shortlist.locator("#ward-shortlist-refer-unavailable")).toContainText(/\S/u);
    await expect(shortlist).not.toContainText("Referred by a human coordinator");

    // Selecting WF-017's own eligible candidate makes referring available, and referring
    // records a real human decision on screen — never an automatic allocation triggered by
    // merely selecting a row. Fix round 1: the record is `movement.referredUnitIds` itself
    // (the "Parallel referral" badge), never a local optimistic flag, so this also proves the
    // dispatch actually reached shared state rather than merely toggling local UI. WF-017
    // already carries its own pre-existing "Parallel referral: BTY Adult Secure" from the
    // fixture, so the pre-click assertion checks the SPECIFIC new referral is absent, not the
    // phrase overall.
    await pickQueueRow(queue, "WF-017");
    await openShortlistSections(shortlist);
    await shortlist.locator('[data-testid="ward-shortlist-candidate-rph-adult-secure"]').click();
    await expect(referButton).not.toHaveAttribute("aria-disabled", "true");
    await expect(shortlist).not.toContainText("Parallel referral: Dabakarn");
    await referButton.click();
    // Option B: Refer writes a referral through the slide-out; it never offers the ward directly.
    const afterRefer = await expectReferralSheetFromRefer(page, "WF-017");
    await expect(afterRefer).not.toContainText("Parallel referral: Dabakarn");
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });
    const referButton = shortlist.getByTestId("ward-shortlist-refer");
    const overrideToggle = shortlist.getByTestId("ward-shortlist-override-toggle");

    // WF-017's default candidate passes all eleven gates, so "unavailable" here cannot be an
    // accident of ineligibility — it can only be the missing human selection. Pinned against the
    // real fixture so this test fails loudly rather than passing vacuously if that changes.
    const wf017 = requireMovement("WF-017");
    // Candidates are in a fixed order (Audit 1, D-71), so the first may be the ward WF-017 is
    // already referred to; the test needs one nobody has asked yet.
    const wf017Default = eligibleCandidatesAmong(wf017, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP).find(
      (candidate) => !wf017.referredUnitIds.includes(candidate.unit.id),
    )!;
    expect(wf017Default, "fixture assumption: WF-017 has at least one candidate").toBeTruthy();
    expect(
      wf017Default.verdict.eligible,
      "fixture assumption: WF-017's default candidate is eligible, so only the missing selection can block Refer",
    ).toBe(true);

    await pickQueueRow(queue, "WF-017");
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

    // ...and Override is unavailable, saying why rather than silently doing nothing. Override is
    // not a lesser path — the governing rule is "a human confirms OR overrides, always, with the
    // reason recorded" — so it must not override straight into an un-chosen default.
    //
    // Option B (13 Oct 2026): Refer is never greyed for the coordinator. It no longer offers any
    // ward: it opens the referral slide-out, so it cannot refer against a default either. Its
    // reason with nothing chosen is still stated (screen-reader text).
    await expect(referButton).not.toHaveAttribute("aria-disabled", "true");
    await expect(overrideToggle).toHaveAttribute("aria-disabled", "true");
    await expect(shortlist).toContainText("Choose at least one candidate ward before referring");
    await expect(shortlist).toContainText("Choose at least one candidate ward before overriding");

    // A forced activation of Override must not even open the reason form — if it opened, the
    // textarea would be addressed to the default unit and one submission would record an override
    // against a ward nobody picked. `force` because Playwright's actionability check already
    // refuses an `aria-disabled` control.
    await overrideToggle.click({ force: true });
    await expect(overrideToggle).toHaveAttribute("aria-expanded", "false");
    await expect(shortlist.getByLabel(/Reason for overriding/)).toHaveCount(0);
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");

    // Refer with nothing chosen opens the slide-out and records nothing against the default.
    await referButton.click();
    await expectReferralSheetFromRefer(page, "WF-017");
    await expect(shortlist).not.toContainText("Referred by a human coordinator");
    await expect(shortlist).not.toContainText(`Parallel referral: ${wf017Default.unit.name}`);

    // Choosing a candidate is what makes Override available. Refer still goes through the
    // slide-out, so the badge (`movement.referredUnitIds`) does not appear from it.
    await shortlist.locator(`[data-testid="ward-shortlist-candidate-${wf017Default.unit.id}"]`).click();
    await expect(referButton).not.toHaveAttribute("aria-disabled", "true");
    await expect(overrideToggle).not.toHaveAttribute("aria-disabled", "true");
    await referButton.click();
    await expectReferralSheetFromRefer(page, "WF-017");
    await expect(shortlist).not.toContainText(`Parallel referral: ${wf017Default.unit.name}`);

    // WF-004 is the worst case the review found: a bed is already held elsewhere, and the default
    // candidate is a different ward entirely. The screen must never assert two destinations for
    // one patient off a single tap.
    const wf004 = requireMovement("WF-004");
    expect(wf004.acceptedUnitId, "fixture assumption: WF-004 has an accepted destination").toBeTruthy();
    const wf004Other = eligibleCandidatesAmong(wf004, allUnits(), NOW_ANCHOR, PARALLEL_REFERRAL_CAP).find(
      (candidate) => candidate.unit.id !== wf004.acceptedUnitId,
    );
    expect(
      wf004Other,
      "fixture assumption: WF-004 has an eligible ward other than its accepted destination",
    ).toBeTruthy();

    await pickQueueRow(queue, "WF-004");
    await openShortlistSections(shortlist);
    await expect(shortlist).toContainText("Accepted destination:");
    await expect(overrideToggle).toHaveAttribute("aria-disabled", "true");
    await overrideToggle.click({ force: true });
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");
    // Option B: Refer is not greyed and opens the slide-out; it never records a second destination.
    await expect(referButton).not.toHaveAttribute("aria-disabled", "true");
    await referButton.click();
    await expectReferralSheetFromRefer(page, "WF-004");
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

    // WF-009's default candidate (Dabakarn) fails exactly one of the eleven gates
    // (prior_decline) — enough to prove ordering without depending on how many gates fail.
    const selectedRow = await pickQueueRow(queue, "WF-009");
    await expect(selectedRow).toHaveAttribute("aria-pressed", "true");
    // Home v7 (Josh, 22 Oct 2026): Placement mounts only once a patient is chosen, so wait for its
    // gate list to render in full before reading the order.
    await expect(shortlist.locator('[data-testid^="ward-gate-"]')).toHaveCount(11);
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

    const movement = requireMovement("WF-009");
    expect(movement.declines.length, "fixture assumption: WF-009 carries five declines").toBe(5);

    await pickQueueRow(queue, "WF-009");
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
    // The queue is server-rendered before its click handlers and hero geometry settle.
    await expect(page.getByTestId("ward-bar")).toHaveAttribute("data-band", /ink|light/);

    const queue = page.getByRole("region", { name: "Priority queue" });
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

    // WF-009: every one of its three candidates is ineligible, so there is no unit this
    // panel may honestly suggest.
    const ineligibleRow = await pickQueueRow(queue, "WF-009");
    await expect(ineligibleRow).toHaveAttribute("aria-pressed", "true");
    await expect(shortlist).not.toContainText("Suggested destination");
    await expect(shortlist).toContainText("No eligible destination found yet.");

    // WF-017: carries a recorded outstanding referral (a fact, never a computed suggestion), so
    // "Suggested destination" must not appear here either. That referral — BTY Adult Secure —
    // passes every gate, so presenting it as fact carries no hidden risk of recommending a failing
    // unit.
    const referredRow = await pickQueueRow(queue, "WF-017");
    await expect(referredRow).toHaveAttribute("aria-pressed", "true");
    await expect(shortlist).toContainText("Parallel referral: BTY Adult Secure");
    await expect(shortlist).not.toContainText("Suggested destination");

    // Home v7 (Josh, 22 Oct 2026): State bedflow left Home, so the ward is chosen in Placement.
    await shortlist.locator('[data-testid="ward-shortlist-candidate-bty-adult-secure"]').click();
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

    // WF-009: every candidate is ineligible, so override is the only human path that can
    // place a patient here — exactly the scenario the control exists for.
    await pickQueueRow(queue, "WF-009");
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

    // A reason is required: until then Record override is unavailable and says why.
    await expect(submitButton).toHaveAttribute("aria-disabled", "true");
    await expect(shortlist.getByText("Choose a reason first")).toBeVisible();
    await submitButton.click({ force: true });
    await expect(shortlist).not.toContainText("Overridden by a human coordinator");

    // A real reason produces a real, human-attributed record, visible on screen.
    // OD-3 made this a fixed picker: a coordinator chooses a reason rather than typing one, so a
    // free-text sentence is exactly the value the picker exists to make impossible. Selecting the
    // established option instead, patterned on the escalation-contact conversion below in this file.
    // The value must be a real member of OVERRIDE_REASONS, because it is asserted back on screen.
    const reasonText = "Clinical urgency outweighs the mismatch";
    await reasonField.selectOption(reasonText);
    // D-86 (Josh, 27 Oct 2026): no second approvers. The reason alone records the override.
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
    await pickQueueRow(queue, "WF-002");

    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });
    await openShortlistSections(shortlist);

    // Option B (13 Oct 2026): Refer is never greyed for the coordinator, and with a ward picked
    // it opens the referral slide-out for this person (the referral reaches the coordinator queue)
    // rather than offering the ward at once.
    const refer = shortlist.getByTestId("ward-shortlist-refer");
    await expect(refer).not.toHaveAttribute("aria-disabled", "true");

    await shortlist.locator('[data-testid^="ward-shortlist-candidate-"]').first().click();
    await expect(refer).not.toHaveAttribute("aria-disabled", "true");
    await refer.click();

    // The slide-out opened; nothing was offered or confirmed directly.
    const afterRefer = await expectReferralSheetFromRefer(page, "WF-002");
    await expect(afterRefer).not.toContainText(/Confirm placement/);
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

    await pickQueueRow(queue, "WF-004");
    await openShortlistSections(shortlist);
    await shortlist.locator(`[data-testid="ward-shortlist-candidate-${wf004Default.unit.id}"]`).click();

    // Option B (13 Oct 2026): Refer is never greyed for the coordinator; it opens the referral
    // slide-out instead of dispatching `REFER_TO_UNITS`. The stated reason still names the
    // movement's own real stage (screen-reader text), never a generic string.
    const refer = shortlist.getByTestId("ward-shortlist-refer");
    await expect(refer).not.toHaveAttribute("aria-disabled", "true");
    await expect(shortlist.locator("#ward-shortlist-refer-unavailable")).toContainText(/bed pulled/i);

    await refer.click();
    const afterRefer = await expectReferralSheetFromRefer(page, "WF-004");
    await expect(afterRefer).not.toContainText("Parallel referral");
    await expect(afterRefer).not.toContainText("Referred by a human coordinator");
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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });

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

    await pickQueueRow(queue, "WF-004");
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
    // Home v7 (Josh, 22 Oct 2026): the Registers link beside Alerts history opens them.
    await page.getByTestId("ward-home-registers").click();
    const refusedTab = page.getByRole("tab", { name: /Refused/ });
    await refusedTab.scrollIntoViewIfNeeded();
    await refusedTab.click();
    const refused = page.getByRole("tabpanel", { name: "Refused" });
    await expect(refused).toContainText(/refus/i);
    // H-0839: the refused action is named in words, never by its event code.
    await expect(refused).toContainText("Refer to units");
    await expect(refused).not.toContainText("REFER_TO_UNITS");
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
    // v10 phone Home lists the first rows with "Show all"; WF-002 sits further down.
    await queue.getByRole("button", { name: /^Show all/ }).click();
    await pickQueueRow(queue, "WF-002");

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
    const shortlist = page.getByRole("complementary", { name: "Placement", exact: true });
    await pickQueueRow(queue, "WF-009");

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
    await pickQueueRow(queue, "WF-017");
    await pickQueueRow(queue, "WF-009");
    await expect(shortlist.getByTestId("ward-shortlist-escalation-record")).toContainText(NEW_CONTACT);
    await expect(shortlist.getByTestId("ward-shortlist-escalation-toggle")).toHaveText("Update escalation");
  });
});
