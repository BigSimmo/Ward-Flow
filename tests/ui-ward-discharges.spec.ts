import { expect, test, type Locator, type Page } from "playwright/test";

import { bedReleases } from "@/components/ward-management/ward-movements";

/**
 * Task 8 (Phase 5). One journey: a ward flags a bed coming free, confirms it, blocks it with a
 * reason from the fixed list, then releases it — and the coordinator's capacity board reflects
 * each of those changes on the very next render, with no `page.goto()` anywhere after the first
 * navigation. Modelled on `tests/ui-ward-roles.spec.ts`'s "a ward confirming zero allocatable
 * beds updates its own screen, then the coordinator" journey — the same discipline applies here
 * for the same reason: a `goto` is a full page load that re-mounts `WardFlowProvider` and resets
 * every unit and bed release back to the seed fixture, which would make every assertion below
 * pass whether or not a ward's own bed-release action actually reaches the coordinator's board.
 *
 * ⚠️ **RETARGETED 2026-09-06.** This journey used to read six per-unit bed-state spans off the
 * old `CapacityView` (`ward-management-modes.tsx`, `data-testid="ward-capacity-view"`), reached
 * by clicking the rail's "Capacity" link. MERGE 02 (owner-approved 2026-09-05) repointed that
 * same link at a real route, `/mockups/ward-flow/capacity` → `CapacityScreen`
 * (`capacity-screen.tsx`, `data-testid="ward-capacity-page"`) — confirmed nothing routes
 * `mode === "capacity"` into `ModeBody` any more (`ward-management-modes.tsx`; only `network` and
 * `governance` still reach `WardModeWorkspace`), so `CapacityView` and its old testid are
 * unreachable by any URL a user can open.
 *
 * `CapacityScreen` does not carry that old Ready/Held/Confirmed/Expected/Blocked/Occupied
 * breakdown — its "Every ward in the network" table reads a different, coarser pair of live
 * per-unit figures instead (`capacity-derivations.ts`'s `networkWardRows`):
 * `ward-capacity-network-ready` (`lockedBedsFree(unit) + openBedsFree(unit)`, which reduces to
 * exactly `unit.allocatable.value` — the same figure `unitCapacity().available` reads on the
 * ward's own screen, and the one that only moves once a bed is truly, physically released) and
 * `ward-capacity-network-freeing` (every one of this unit's bed releases still due today and not
 * yet discharged, confirmed or expected alike — it rises the moment a release is flagged for
 * today, holds through confirm/block/unblock, and falls the moment the release is discharged).
 * Those two are what this journey now checks on the board; the release's own stage and blocked
 * flag are checked where they always were, on `releaseRow` a few lines below each board check.
 *
 * The round trip between the ward screen and the capacity board uses the icon rail's own
 * `<Link>`s (`ClinicalRail` in `ward-management-navigation.tsx`, sourced from `ward-nav.ts`),
 * which are mounted on every Ward Flow route rather than only the coordinator's — "Capacity" is
 * one of the six listed `WARD_VIEWS`, and "Ward — Dabakarn" is `WARD_NAV`'s one named,
 * always-present entry point back into this unit's own screen (`exampleOnly: true`). Neither is
 * the `WardRoleSwitcher` this file's model test uses, because that control's own "Ward" menu
 * group is driven by `focusMovementId` (a selected coordinator movement) and stays disabled with
 * no movement selected — this journey never selects one, so the rail's static links are the real
 * way back, not a substitute for one. `CapacityScreen` reads the same `useWardFlow()` state, so
 * the client-side navigation this helper drives does not remount it or reset anything.
 */

const UNIT_ID = "rph-adult-secure";

async function gotoWard(page: Page) {
  await page.goto(`/mockups/ward-flow/ward/${UNIT_ID}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  // The same streamed-content guard the containment test below already uses, and that
  // `tests/ui-ward-referrals.spec.ts` uses twice, applied here for the identical reason: React's
  // streaming leaves a hidden staging copy of the whole screen in the document for a moment, so
  // `ward-unit-screen` resolves to two elements and a strict-mode locator throws. This helper was
  // left behind when the containment test got the wait, so the journey below failed on its very
  // first navigation. Waiting the staging subtree out is the fix rather than relaxing the locator
  // to `.first()`, which would leave the journey asserting against whichever copy came first —
  // possibly the inert server-rendered one, which no click ever reaches.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
  await openBedRecordsTab(page);
}

/**
 * Every control this journey drives on the ward screen — the "Flag a bed coming free" form and
 * each release card's confirm/block/unblock/release buttons — lives on the ward screen's
 * Decisions tab (3ac951fcd1, 22 Sept, split the screen into five tabs; an inactive tab panel is
 * `display: none`). 53105ca6ea (25 Sept) removed the old "Update ward figures and bed records"
 * `<details>` wrapper, so there is no disclosure to open any more. The screen opens on Home every
 * time it (re)mounts — after the first `gotoWard` and after every `goBackToWard` — so both call
 * this rather than selecting the tab once at the top.
 */
async function openBedRecordsTab(page: Page) {
  const decisions = page.getByRole("tab", { name: "Decisions (Ward record)" });
  await decisions.click();
  await expect(decisions).toHaveAttribute("aria-selected", "true");
}

async function goToCapacityBoard(page: Page) {
  /*
   * 🔴 **ANCHORED, NOT EXACT — 2026-09-11, WHEN THE RAIL CHANGED OWNER.** This was
   * `{ name: "Capacity", exact: true }` against `ClinicalRail`, which is no longer mounted
   * anywhere in `src/`. The third-edition rail (`shell/ward-rail.tsx`) composes each link's
   * accessible name through `wardNavCountLabel`, which appends the count AND THE NOUN THAT SAYS
   * WHAT IT COUNTS ("Capacity, 27 beds available") — deliberately, so a screen-reader user hears
   * the meaning rather than a digit adrift from its label (`ward-nav-counts.ts`'s own header).
   * An exact match therefore finds nothing and times out, which is how this journey failed.
   *
   * ⚠️ **`/^Capacity\b/`, NOT `/Capacity/`.** The `^` and the word boundary keep this from
   * matching a future rung whose name merely CONTAINS the word — the same discipline
   * `ui-ward-referrals.spec.ts` already applies to its own rail lookups. Relaxing to a bare
   * substring would make the selector silently ambiguous the first time a second Capacity-ish
   * destination is added.
   */
  await page.getByRole("link", { name: /^Capacity\b/u }).click();
  // MERGE 02 (`bf563af9f`, 2026-09-05) renamed the Capacity screen's root from `ward-capacity-view`
  // to `ward-capacity-page`. The screen and this journey are both intact and reachable — only the
  // handle moved — so this is a re-point, not a retirement.
  //
  // ⚠️ The old name still appears once in `src/`, inside a COMMENT in `capacity-derivations.ts`
  // naming the test file `ward-capacity-view.dom.test.tsx`. A grep for the old handle therefore
  // finds a live-looking hit that renders nothing; the render is at `capacity-screen.tsx:87`.
  await expect(page.getByTestId("ward-capacity-page")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

async function goBackToWard(page: Page) {
  // ⚠️ **RETARGETED.** The rail's own fixed "Ward — Dabakarn" example-unit link is gone
  // from the owner-requested grouped rail (`shell/ward-rail.tsx`'s `RAIL_GROUPS`, 2026-09-13) —
  // its "Service Hubs" group carries only the wards INDEX ("Ward Hub" -> `/wards`), not a direct
  // link to any one unit. Reaching this specific ward from the rail is therefore two real clicks
  // now, through the index `ward-index.tsx` already provides for exactly this purpose
  // (`data-testid="ward-index-link-${unit.id}"`, one per ward).
  await page.locator('[data-testid="ward-rail-link"][href="/mockups/ward-flow/wards"]').click();
  await expect(page.getByTestId("ward-index")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId(`ward-index-link-${UNIT_ID}`).click();
  await expect(page.getByTestId("ward-unit-screen")).toBeVisible({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await openBedRecordsTab(page);
}

/**
 * 🔴 **RE-POINTED 2026-09-06 AFTER THIS JOURNEY FOUND A REAL GAP, NOT A STALE SELECTOR.**
 *
 * It used to read six `<span>`s from `ward-capacity-bed-states-${UNIT_ID}` — Ready, Held, Confirmed,
 * Expected, Blocked, Occupied — rendered by `CapacityView`. **MERGE 02 (`bf563af9f`) replaced that
 * screen and cut the board to Ward · Bed kinds · Ready · Locked · Freeing.** Measured the same day:
 * `ward-capacity-bed-states-*` existed nowhere in `src/`, and neither did
 * `ward-capacity-headline-blocked-releases` — **so a release's stage stopped reaching the
 * coordinator at all, per-ward AND in the headline.** It reached the ward screen and stopped there.
 *
 * **Owner ruling 2026-09-06, put to him as a question rather than assumed:** _"Yes the coordinator
 * should still see confirmed and blocked releases."_ Two columns were added back to the network
 * table for exactly those two figures.
 *
 * ⚠️ **EXPECTED WAS NOT RESTORED AND ITS ASSERTIONS ARE DELIBERATELY GONE, NOT SILENTLY DROPPED.**
 * He ruled on confirmed and blocked; nobody asked him about Expected, Held or Occupied, and a test
 * is not the place to decide a fourth figure belongs on a clinical screen. The `Freeing` column
 * already answers a nearby question ("how many free up today") and is not the same figure.
 */
function networkCell(page: Page, testId: string) {
  return page.getByTestId(`ward-capacity-network-row-${UNIT_ID}`).getByTestId(testId);
}

/**
 * The blocked-count cell's own text, excluding its nested `ward-capacity-network-blocked-since`
 * annotation (WLQ-10, 2026-09-15). Reading `textContent` on the cell itself concatenates the
 * count with the nested note's text ("1held up since 16:30"); this reads only the cell's direct
 * text node, which is exactly the count `freeingCellText` rendered.
 */
async function blockedCountOwnText(page: Page): Promise<string> {
  return networkCell(page, "ward-capacity-network-blocked").evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelector('[data-testid="ward-capacity-network-blocked-since"]')?.remove();
    return clone.textContent?.trim() ?? "";
  });
}

/** A board cell's own number: "none" reads as 0. */
async function networkNumber(page: Page, testId: string): Promise<number> {
  const text = ((await networkCell(page, testId).textContent()) ?? "").trim();
  return text === "none" ? 0 : Number.parseInt(text, 10);
}

/** The blocked cell's own count, read without its nested "held up since" note. */
async function blockedNumber(page: Page): Promise<number> {
  const text = await blockedCountOwnText(page);
  return text === "none" || text === "" ? 0 : Number.parseInt(text, 10);
}

/**
 * A release row's own STAGE label — the first `<strong>{bedReleaseStateLabels[release.state]}</strong>`
 * in its `cardHeader` (`ward-screen.tsx`). Every row also carries a `WardFreshness` stamp that
 * literally reads "Confirmed HH:MM · NUM <ward>" for EVERY stage, not only `confirmed` — the
 * reducer sets `confirmedAt`/`confirmedBy` on every bed-release write regardless of the resulting
 * `state`, because those fields mean "last reported", not "currently in the confirmed stage". A
 * plain `toContainText("Confirmed")` on the row is therefore true at every step and asserts
 * nothing — this reads the stage label alone.
 *
 * `.first()` matters more since the bed-model rework of 2026-08-28: a blocked row renders a
 * SECOND `<strong>` for the flag, right after the stage. That is the change made visible — the
 * stage and the flag are two facts shown together, where the four-stage model showed one word
 * that erased the other.
 */
function releaseStateLabel(row: Locator) {
  return row.locator("strong").first();
}

test.describe("@mockup Ward discharges — a bed release's whole lifecycle reaches the coordinator live", () => {
  test.describe.configure({ timeout: 60_000 });

  // 🔴 REWRITTEN 25 September 2026 for the bed-release model (a release names the stay it belongs to,
  // and it completes when that person leaves). Two things made the old version impossible: the seed
  // now derives its releases from admissions (the hand-written WR-001 and its fixed board counts are
  // gone), and flagging from the ward screen is refused until the patient picker exists (Josh chose
  // "Refuse"). So this journey takes a seeded expected release, reads every board figure BEFORE each
  // step and asserts the change, and completes the release the way the model now does: recording
  // that the person has left, on the ward board. The ward screen's old "Release" button path is
  // refused while the person is still in the bed; replacing or removing that button is Remove
  // invented data's plan 5b, so it is deliberately not driven here.
  test("a seeded expected release is confirmed, blocked, unblocked and completed by the person leaving, and the coordinator's capacity board reflects every step", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });

    // The earliest-due expected release at this ward with nothing blocking it: due now or overdue,
    // so it counts on the board's "freeing today" figures. Chosen from the seed, never by position.
    const release = bedReleases
      .filter(
        (candidate) => candidate.unitId === UNIT_ID && candidate.state === "expected" && candidate.blocker === null,
      )
      .sort((a, b) => a.expectedAt - b.expectedAt || a.id.localeCompare(b.id))[0];
    expect(release, `fixture assumption: ${UNIT_ID} seeds an unblocked expected release`).toBeDefined();
    const releaseId = release.id;

    await gotoWard(page);
    const releaseRow = page.getByTestId(`ward-bed-release-${releaseId}`);
    await expect(releaseStateLabel(releaseRow)).toHaveText("Expected");

    // --- Baseline on the coordinator's capacity board. ---
    await goToCapacityBoard(page);
    const confirmedBefore = await networkNumber(page, "ward-capacity-network-confirmed");
    const blockedBefore = await blockedNumber(page);
    const readyBefore = await networkNumber(page, "ward-capacity-network-ready");

    // --- Step 1: the ward confirms the release. ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-confirm-${releaseId}`).click();
    await expect(releaseStateLabel(releaseRow)).toHaveText("Confirmed");
    await goToCapacityBoard(page);
    await expect.poll(() => networkNumber(page, "ward-capacity-network-confirmed")).toBe(confirmedBefore + 1);
    // Confirming is a record about a future bed, not the bed becoming free.
    await expect.poll(() => networkNumber(page, "ward-capacity-network-ready")).toBe(readyBefore);

    // --- Step 2: block it with a reason from the fixed list, never free text (binding spec §4). ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-block-toggle-${releaseId}`).click();
    await page.getByTestId(`ward-bed-release-blocker-${releaseId}`).selectOption("Awaiting clean");
    await page.getByTestId(`ward-bed-release-block-submit-${releaseId}`).click();
    // Blocking is a FLAG (bed-model rework, 2026-08-28): the stage stays "Confirmed" and the row also
    // reads "Blocked".
    await expect(releaseStateLabel(releaseRow)).toHaveText("Confirmed");
    await expect(page.getByTestId(`ward-bed-release-blocked-flag-${releaseId}`)).toHaveText("Blocked");
    await expect(releaseRow).toContainText("Awaiting clean");
    await goToCapacityBoard(page);
    // 🔴 THE LOAD-BEARING PAIR: confirmed must HOLD while blocked rises. The defect the 2026-08-28
    // rework closed was a block dropping the confirmed count, so the figures improved at the moment
    // the ward got stuck. Either assertion alone passes on the old behaviour.
    await expect.poll(() => networkNumber(page, "ward-capacity-network-confirmed")).toBe(confirmedBefore + 1);
    await expect.poll(() => blockedNumber(page)).toBe(blockedBefore + 1);

    // --- Step 3: the flag comes off again without touching the stage. ---
    await goBackToWard(page);
    await page.getByTestId(`ward-bed-release-unblock-${releaseId}`).click();
    await expect(page.getByTestId(`ward-bed-release-blocked-flag-${releaseId}`)).toHaveCount(0);
    await expect(releaseStateLabel(releaseRow)).toHaveText("Confirmed");
    await goToCapacityBoard(page);
    await expect.poll(() => networkNumber(page, "ward-capacity-network-confirmed")).toBe(confirmedBefore + 1);
    await expect.poll(() => blockedNumber(page)).toBe(blockedBefore);

    // --- Step 4: the person leaves, recorded on the ward board. Leaving completes this person's
    // release and is the one step here that frees a real bed. ---
    await goBackToWard(page);
    await page.getByRole("link", { name: "Bed board" }).click();
    await page.locator(`#ward-board-tile-${release.admissionId}`).click();
    await page.getByTestId("ward-board-record-leaving-submit").click();
    const departureDialog = page.getByRole("dialog", { name: "Confirm patient departure" });
    await expect(departureDialog).toBeVisible();
    await departureDialog.getByRole("button", { name: "Record departure", exact: true }).click();
    await expect(departureDialog).toHaveCount(0);

    await goBackToWard(page);
    // A completed release is terminal and drops off the ward's pending list (spec D10).
    await expect(releaseRow).toHaveCount(0);
    await goToCapacityBoard(page);
    // Ready rises by exactly one, and the completed release no longer counts as confirmed: the bed is
    // free and already counted in Ready, so counting it twice would inflate the board.
    await expect.poll(() => networkNumber(page, "ward-capacity-network-ready")).toBe(readyBefore + 1);
    await expect.poll(() => networkNumber(page, "ward-capacity-network-confirmed")).toBe(confirmedBefore);
  });

  /**
   * Phase 8, Task 10 fix round (F4). The discharges board's table, across every width it is
   * narrower at than it wants to be.
   *
   * ⚠️ **RETARGETED, 2026-09-17.** The board this test originally covered rendered up to four
   * SEPARATE per-group `<table>`s (`ward-discharge-table-${groupKey}`, one column set for
   * `blocked` with a `Blocker` column, a narrower one for the other three). It has since been
   * rebuilt around ONE unified "Bed release worklist" `<table>` with three columns (`Ward /
   * service`, `Timing`, `Stage / blocker` — blocker folded into the third column for every group
   * rather than broken out as its own), and grouped `<tbody data-testid="ward-discharge-group-
   * ${key}">` sections inside it rather than four independent scrollers. The geometric property
   * this test exists for — no column reachable only by scrolling sideways inside the table — is
   * unchanged and still worth protecting; only the shape of what it measures has moved.
   *
   * Real data rows carry `data-selected` (set on every release row, `true` or `false`); the
   * group-header row (`colSpan={3}`, a heading only) and the "None" empty-group row do not, so
   * `tbody tr[data-selected] td` reaches every real row's cells without the header rows'
   * `<th colSpan>` cells reporting a false-negative escape (a full-width cell whose right edge
   * always sits inside the scroller, whatever the real columns are doing).
   */
  test("no column of the discharges board's table is off the screen at any width the table is used at", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 641, height: 900 });
    await page.goto("/mockups/ward-flow/discharges", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    // The streamed-content guard `tests/ui-ward-referrals.spec.ts` uses, and for the same reason:
    // React's streaming leaves a hidden staging copy of the whole screen in the document for a
    // moment, so every testid on this page resolves to two elements and a strict-mode locator
    // throws. Measuring geometry against a staged duplicate would be meaningless even if it did
    // not throw, so this waits for the staging subtree to go rather than retrying through it.
    await expect(
      page.locator('div[hidden][id^="S:"]'),
      "React's streamed content is still staged, so the whole screen is duplicated in the document",
    ).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId("ward-discharge-board")).toBeVisible({ timeout: 15_000 });

    const scrollers = page.getByRole("region", { name: "Discharge worklist" });
    const scrollerCount = await scrollers.count();
    expect(
      scrollerCount,
      "the discharges board renders no 'Discharge worklist' region, so the containment assertion below would pass having measured nothing",
    ).toBeGreaterThan(0);

    /*
     * PRESENCE BEFORE CONTAINMENT — whole-branch review, W1.
     *
     * The geometric loop below measures whether a column ESCAPES its scroller. It says nothing
     * about whether the column is there at all, and two ways of removing one pass it silently:
     * delete the `th`/`td` pair and there is simply less to measure, or set `display: none` on it
     * and the cell keeps a zero-sized rect whose `right` is 0, which can never exceed the
     * scroller's. The `cells > 0` floor in the loop below does not close either. `toHaveText` with
     * an array pins the count, the order and the spelling in one assertion; it does NOT close the
     * hiding case (Playwright compares `textContent` regardless of `display`), which is what the
     * per-header `toBeVisible` loop is for.
     *
     * ⚠️ **ONE HEADER NOW, NOT FOUR.** The four independently-evolving per-group column sets this
     * comment used to describe (`Blocker` present only on the blocked table since Ward Lead ruling
     * E16) are gone with the four separate tables: the rebuilt worklist renders one `<thead>` for
     * every group, three columns wide, blocker folded into the third column instead of broken out
     * on its own.
     */
    const DISCHARGE_COLUMNS = ["Ward / service", "Timing", "Stage / blocker"];
    const table = page.getByRole("table");
    await expect(table, "the discharges board renders no table, so its column contract went unchecked").toBeVisible();
    const headers = table.locator("thead th");
    await expect(headers, "the worklist no longer carries exactly these columns, in this order").toHaveText([
      ...DISCHARGE_COLUMNS,
    ]);
    for (const [index, column] of DISCHARGE_COLUMNS.entries()) {
      await expect(
        headers.nth(index),
        `the worklist's \`${column}\` column is in the document but not on the screen`,
      ).toBeVisible();
    }

    for (const width of [641, 700, 760, 820]) {
      await page.setViewportSize({ width, height: 900 });
      const measured = await scrollers.evaluateAll((nodes) =>
        nodes.map((scroll) => {
          const right = scroll.getBoundingClientRect().right;
          // `tr[data-selected]` reaches every real release row (the attribute every row in
          // `discharge-board.tsx` carries) while excluding the group-header row (a heading-only
          // `<th colSpan={3}>`, whose full-width cell can never register as clipped, and would
          // silently satisfy the `cells > 0` floor without measuring a single real column) and the
          // "None" empty-group placeholder row.
          const cells = [...scroll.querySelectorAll("thead th, tbody tr[data-selected] td")];
          return {
            id: scroll.getAttribute("aria-label") ?? "(no aria-label)",
            cells: cells.length,
            clipped: cells
              .filter((cell) => cell.getBoundingClientRect().right > right + 1)
              .map(
                (cell) =>
                  `${(cell.textContent ?? "").trim()} (right edge ${Math.round(cell.getBoundingClientRect().right)} vs scroller ${Math.round(right)})`,
              ),
          };
        }),
      );
      for (const region of measured) {
        expect(region.cells, `${region.id} at ${width}px renders no cells to measure`).toBeGreaterThan(0);
        expect(
          region.clipped,
          `column(s) of ${region.id} are off the screen at ${width}px, reachable only by scrolling sideways inside the table`,
        ).toEqual([]);
      }
    }
  });
});
