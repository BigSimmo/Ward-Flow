import { expect, test, type Page } from "playwright/test";

/**
 * Task 6 (Phase 6 fix line, Lane D — `docs/ward-flow/plans/2026-09-16-fix-plan-screens-and-drawings.md`,
 * Q4). Formerly this file's predecessor spec, covering the morning bed-state page
 * (`MorningPage`/`MorningTour` in `src/components/ward-management/morning/`) before MERGE 02
 * (owner-approved 2026-09-05) folded that board into `CapacityScreen` and turned
 * the Morning route into a bookmark-only redirect to this one.
 *
 * 🔴 **THE OWNER CONFIRMED ON 17 SEPT 2026 (Q4 of the fix plan above) THAT MORNING IS RETIRED FOR
 * REAL: ITS SURVIVING BROWSER COVERAGE MOVES TO CAPACITY, WITH NO 08:00 (FROZEN) VIEW AND NO PRINT
 * SHEET.** That closes outstanding issue #ZWJ71W (the morning/handover cross-link question tracked
 * in `docs/outstanding-issues.md`, and the reason `tests/ward-specs-never-navigate-into-redirect-
 * stubs.test.ts` carried a `PARKED` entry naming this file's old path) as a REPOINT, not a restore —
 * so that entry is deleted in the same change that produced this file. This file no longer
 * navigates to the Morning route at all — the route itself is now deleted, not just redirecting —
 * so nothing here needs exempting from that guard any more.
 *
 * ## What moved, and what did not
 *
 * The one surviving case below keeps the property `diff-integrity.json`'s prior entry for this
 * file's predecessor (approved 2026-09-06, before: 2, after: 1) already recorded as the plan: "the
 * render-and-rail test now proves the redirect lands on the real Capacity page and that the rail
 * can leave and return to it, in place of a headline and a link label that no longer exist."
 * `CapacityScreen` renders `data-testid="ward-capacity-page"` but no equivalent of
 * `ward-morning-headline` — Capacity's own `<h1>` carries no testid and is a different page, not a
 * repaint of Morning's — so the headline assertion is not moved, it is retired outright, along with
 * the `ClinicalRail`/"Morning bed state" link this case used to click: neither the component nor the
 * nav entry exists any more (`ClinicalRail` has been replaced by `shell/ward-rail.tsx` throughout
 * `src/`, and `morning` was dropped from `WARD_VIEWS` by MERGE 02 — see `ward-nav.ts`'s own comment).
 * What DOES survive is the shape of the check: a real navigation onto the page under test, then two
 * rail clicks away and back, proving the shared rail — which Capacity mounts exactly as Morning used
 * to — still navigates correctly and still remounts a fresh rail on the way back.
 *
 * The print case is retired outright, not moved: `capacity.module.css` carries zero `@media print`
 * rules and the per-site print testid it used to read no longer exists on any reachable route. See
 * `docs/ward-flow/retired-browser-journeys-2026-09-06.md` (this file's predecessor, findings 3 and 4)
 * for exactly what both retired assertions used to prove — written down before anything changed, so
 * the loss is recoverable from that record rather than only from git history. RETIRED, confirmed
 * 2026-09-17: the printed ward handover sheet and this page's own headline/08:00 view — confirmed
 * by the owner as staying gone, with nothing on any reachable screen replacing either.
 *
 * The print CSS-source-text coverage named above (the retired Morning print-CSS test) is retired
 * outright too, in the same change that deletes `morning.module.css` itself (item 41,
 * owner-approved 2026-09-17): there is no longer a stylesheet on disk for it to read, so the
 * WARD-COVERAGE-POINTER this comment used to carry for it is removed rather than left naming a
 * file that no longer exists.
 *
 * WARD-COVERAGE-POINTER: tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx
 * DOM-level coverage of the facts that survived MERGE 02's fold (partial — 3 of the retired Morning
 * DOM suite's 20 cases: a governance-banner check, the Ready-now headline's non-mixing property, and
 * each ward row's own confirmed/expected/held/occupied breakdown). Carried forward from this file's
 * own history rather than re-measured here.
 */

async function gotoCapacity(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mockups/ward-flow/capacity", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-capacity-page")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("@mockup Ward capacity — rail navigates away from the absorbed morning board and back", () => {
  test.describe.configure({ timeout: 60_000 });

  /**
   * MOVED from this file's predecessor's "the morning page renders its headline, and the
   * rail navigates away and back" (retired as a `ClinicalRail`/`/morning` journey 2026-09-06,
   * repointed here 2026-09-17). Deliberately never a second `page.goto()` for the round trip: a full
   * navigation would remount `WardFlowProvider` and reseed shared state, which would make a
   * client-side routing failure indistinguishable from a pass — the same reason the original case
   * gave for using rail `<Link>`s instead.
   */
  test("the rail navigates away from Capacity and back", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await gotoCapacity(page);

    // ⚠️ **ANCHORED, NOT EXACT** — the rail's own count labels (`wardNavCountLabel`) append the
    // figure AND its noun ("Delays, 3 at a time limit or with nowhere to go", "Capacity, 27 beds ready now"), the
    // same reason `ui-ward-discharges.spec.ts`'s `goToCapacityBoard` gives for its own `^Capacity\b`
    // match. `exact: true` here found nothing and hung the full 60s timeout on the click.
    await page.getByRole("link", { name: /^Delays\b/u }).click();
    await expect(page.getByTestId("ward-delays-page")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    await page.getByRole("link", { name: /^Capacity\b/u }).click();
    await expect(page.getByTestId("ward-capacity-page")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // The third click is not a repeat of the first: the rail was unmounted by the navigation away
    // and mounted fresh by the navigation back, so this exercises a newly-mounted rail after a
    // client-side return — a different condition from the first click, which was on the rail that
    // came with the server-rendered page. Same property the retired case proved, kept here.
    await page.getByRole("link", { name: /^Delays\b/u }).click();
    await expect(page.getByTestId("ward-delays-page")).toBeVisible({ timeout: 15_000 });
  });
});
