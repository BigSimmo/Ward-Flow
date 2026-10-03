import { expect, test } from "playwright/test";

/**
 * 🔴 **EVERY WARD TABLE'S SCROLL THRESHOLD, MEASURED AGAINST THE TABLE THAT IS ACTUALLY THERE.**
 *
 * Ward Lead's ruling, 2026-09-05, and the general form of the day's most expensive finding: **a
 * threshold measured against a table that has since changed shape is not a measurement any more.**
 * The comparisons screen's pin went stale three times in one day — a column removed on a ruling,
 * then a wrapping rule relaxed — and **every reading was correct when it was taken.** Nothing made
 * it wrong; a change elsewhere made it a measurement of a different table.
 *
 * ⚠️ **AN OVER-PIN IS WORSE THAN AN INERT ONE AND HIDES IN THE SAME PLACES.** An inert threshold
 * does nothing. An over-pin actively forces a horizontal scroll that was not required and pushes
 * columns off a scroller they would have fitted — manufacturing the very defect a threshold exists
 * to prevent — while the stylesheet reads deliberate, the pin map reads measured, and the page looks
 * perfect at desk width. **Neither is visible to a static check**, which is why this runs in a
 * browser.
 *
 * ⚠️ **IT ASSERTS ONLY THE TABLES I OWN AND REPORTS THE REST, DELIBERATELY.** Pinning another
 * screen's shape here would make my suite go red on somebody else's legitimate redesign, and a
 * guard that fires on correct work is one that gets deleted. Every other table is surfaced with its
 * numbers for its own owner.
 */

/**
 * 🔴 **WHY A PROBE THAT WORKS BY HAND RETURNED THE PIN IN HERE, AND WHAT IT ALSO CORRUPTED.**
 *
 * An earlier version of this file dropped its min-content measurement rather than ship it: it
 * returned a figure exactly equal to the threshold for every table on every route, and the reason
 * could not be explained. It was explained on 2026-09-05, and the explanation is worth more than the
 * measurement, because **it was silently corrupting the max-content number this file already
 * shipped, in the one direction that mattered.**
 *
 * **The mechanism is a CSS transition, created by the reduced-motion accessibility reset.**
 *
 *   1. `transition-property`'s INITIAL value is `all`. Nothing in this repository sets it on a ward
 *      table — measured: a walk of every rule in every stylesheet that matches the element finds no
 *      author declaration of `transition` or `transition-property` on it at all. It is `all` because
 *      that is the property's default, and it is normally inert because the default
 *      `transition-duration` is `0s`.
 *   2. `globals.css`'s reduced-motion block sets `transition-duration: 0.01ms !important` on `*`.
 *      It changes the DURATION only and leaves the `all` property list alone — so under reduced
 *      motion, every interpolable property change on every element becomes a real, 0.01ms-long
 *      transition.
 *   3. `playwright.config.ts` sets `contextOptions: { reducedMotion: "reduce" }` for the whole
 *      suite. **So that reset is in force in here and is not in force in a browser window**, which
 *      is the entire difference between this file and a hand probe in devtools.
 *   4. **A transition outranks even an `!important` author declaration** — it is the highest origin
 *      in the cascade. Writing `min-width: 0px` starts a transition FROM the pin, and inside one
 *      synchronous block no time has passed, so the transition's output is still its start value.
 *      The write lands — the inline `cssText` reads `min-width: 0px` — and the used value does not
 *      move. What comes back is the pre-mutation computed min-width, which IS the threshold, on
 *      every table, exactly, which is why it looked like a keyword bug in `width: min-content`.
 *
 * **The measured A/B — same browser, same page, same code, one variable** (`page.emulateMedia`):
 *
 *   reduce         transition-duration 1e-05s, a live CSSTransition on the element, min-width reads
 *                  480px after being set to 0px, min-content reads 480  ← the wrong answer on demand
 *   no-preference  transition-duration 0s, no animations at all, min-width reads 0px,
 *                  min-content reads 295  ← agrees with the devtools hand probe
 *
 * **Three tables were immune, and that is the confirming detail rather than a loose end.**
 * `/referrals` (`referrals.module.css`: `@media (prefers-reduced-motion: reduce) { .screen * {
 * transition: none !important } }`) and `/queue` (`WardModeWorkspace`, whose `.modeShell` composes
 * `descendantKillWithScroll` from `ward-reduced-motion.module.css` — the same kill) compute
 * `transition-property: none`, so no transition is ever created and the naive probe returned their
 * true widths: 403px and 300px on the two referral boards, matching Ward Builder Three's own
 * measurement to the pixel, while the other ten returned their pins. **The split is exactly the set
 * of screens carrying a reduced-motion transition kill**, which no coincidence produces.
 *
 * ⚠️ **AND IT WAS ALREADY POISONING max-content, IN THE ONE DIRECTION THAT MATTERS.** `width:
 * max-content` is a keyword, not a length: length→keyword is not interpolable, so it snaps and no
 * transition is created for it. That is why max-content "demonstrably varied" and looked healthy.
 * But the frozen `min-width` still floored the result, so **any table whose real max-content sits
 * BELOW its pin reported max-content == pin** — and `minWidthPx > maxContentPx` is precisely the
 * over-pin test below. **The detector was blind in the only case it exists to catch.** Escalation's
 * second table reported 704px (its pin) and actually measures 640px: a genuine over-pin this file
 * called healthy on every previous run. The comparisons tables reported 560/440 (their pins) and
 * actually measure 557/436.
 *
 * **The fix is one line and it is not the obvious one.** Setting `transition: none` inline works,
 * but NOT by zeroing the duration — the reset's `!important` duration outranks any inline
 * declaration. It works because the shorthand also sets `transition-property: none`, which the reset
 * never touches. This file writes that property explicitly, so the thing being relied on is the
 * thing being asked for.
 */

/**
 * The two tables on the comparisons screen, recorded with the browser measurement that set their
 * thresholds. **Recorded, not guessed** — a first draft of this file typed plausible numbers from
 * memory and the sweep's own assertion caught three of them wrong on its first run, including a
 * route that has two tables where I had written one.
 *
 * ⚠️ `ward-statistics-compare-wards` UPDATED 2026-09-12: the pin moved from 560px (35rem) to 640px
 * (40rem) — see `statistics-sections.module.css`'s own comment for why 560px had gone inert (3px
 * below the table's re-measured 563px min-content) and why 640px is the value, not a round number
 * chosen to clear it. This is the "moved in a commit that says which screen and why" case the file
 * header above describes, not drift.
 *
 * ⚠️ UPDATED AGAIN, 2026-09-17: 640px and 440px had both gone inert a second time — re-measured at
 * 679px/744px (wards) and 498px/555px (eds) min/max-content, both risen past their pins since the
 * last re-tuning. Raised to 760px (47.5rem) and 576px (36rem) respectively, in
 * `statistics-third-edition.module.css` — the copy `statistics-compare-screen.tsx` actually
 * imports; `statistics-sections.module.css` carries the same class names but is dead for this
 * screen, so editing it would have changed nothing rendered. See that file's own comment for the
 * full re-measurement.
 */
const OWNED = "/mockups/ward-flow/statistics/compare";
const OWNED_TABLES: readonly { readonly testId: string; readonly columns: number; readonly minWidthPx: number }[] = [
  { testId: "ward-statistics-compare-wards", columns: 5, minWidthPx: 760 },
  { testId: "ward-statistics-compare-eds", columns: 4, minWidthPx: 576 },
];

/**
 * Routes the sweep visits.
 *
 * ⚠️ **SEVEN OF THE ELEVEN WARD ROUTES THAT RENDER A TABLE, AND SAYING SO IS THE POINT.** A separate
 * read-only sweep of all 32 route files and their import graphs establishes the denominator: eleven
 * routes render at least one table, and this list reaches seven of them. **The four it misses are
 * named rather than left to be discovered:**
 *
 *   /capacity      `.dataTable` in `ward-management-modes.module.css` — a bare `<table>` with NO
 *                  wrapper element at all; overflow is handled by `.panel:has(.dataTable)` on an
 *                  ancestor, inside a media query. This selector cannot see it.
 *   /network       `.compareTable` in `ward-management-network.module.css` — rendered only while no
 *                  referral is selected, so it is state-conditional as well as unlisted.
 *   /ed/[edId]     `.capacityTable` in `ed/ed.module.css`
 *   /handover      four `<table>`s directly inside `<section>`, no wrapper of any kind; each renders
 *                  only when its own list is non-empty.
 *
 * ⚠️ **A FIFTH IS NOW MISSED FOR THE SAME REASON, ON A ROUTE THIS LIST DOES VISIT.** `/discharges`
 * used to render up to four separate `WardTable`s, one per release group, each wrapped in
 * `tableScroll` — the shape this sweep's selector was built to find, and the reason the estate
 * floor below used to sit above 8. The board was rebuilt around one unified "Bed release
 * worklist" `<table>` (grouped `<tbody data-testid="ward-discharge-group-${key}">` sections
 * inside it) whose scroll container is `.listBody`, a plain module class with neither
 * `data-ward-primitive="table"` nor a `tableScroll`-named class — so `/discharges` now
 * contributes zero tables to this sweep, exactly like `/capacity`/`/network`/`/ed`/`/handover`
 * above, for the identical structural reason. The floor below is re-measured against the current,
 * correct estate rather than left describing a table that no longer exists in that shape.
 *
 * **Three of the four share one reason: the table has no wrapper element**, so a sweep keyed on a
 * scroll wrapper finds nothing however many routes it visits. Widening the ROUTES list alone would
 * not reach them — the selector has to change too, and that is a separate piece of work rather than
 * an omission to fix by adding lines here.
 *
 * A table that renders only in some state is likewise absent from the count rather than silently
 * absent from the check, which is why the figure is printed on every run.
 */
const ROUTES = [
  OWNED,
  "/mockups/ward-flow/out-of-area",
  "/mockups/ward-flow/escalation",
  "/mockups/ward-flow/discharges",
  "/mockups/ward-flow/referrals",
  "/mockups/ward-flow/search",
  "/mockups/ward-flow/queue",
] as const;

/**
 * The table used for the instrument's two-method cross-check. It is somebody else's screen and this
 * file asserts NOTHING about its design — only that two unrelated ways of measuring it land on the
 * same number, which is a fact about the probe rather than about the table.
 */
const CROSS_CHECK_ROUTE = "/mockups/ward-flow/out-of-area";
const CROSS_CHECK_TESTID = "ward-out-of-area-table";

/** A width no ward table's content could coincidentally produce, so a match cannot be luck. */
const SENTINEL_PX = 1234;

type Measured = {
  readonly testId: string;
  readonly columns: number;
  readonly minWidthPx: number;
  readonly minContentPx: number;
  readonly maxContentPx: number;
  /** `min-content` again, measured by starving the WRAPPER instead of sizing the table. */
  readonly minContentBySqueezePx: number;
  /** What `min-width` actually computed to after the probe cleared it. Must be `0px`. */
  readonly clearedMinWidth: string;
  /** Width the table took when the probe pinned it to the sentinel. Must be the sentinel. */
  readonly sentinelWidthPx: number;
};

test.describe("@mockup every ward table's threshold still describes the table it was measured for", () => {
  test("sweeps the estate, holds the comparisons thresholds, and reports the rest", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const seen: Record<string, Measured[]> = {};
    let tablesWalked = 0;

    for (const route of ROUTES) {
      await page.goto(route, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      // React streams a hidden staging copy of the screen; measuring geometry against it would be
      // meaningless even where it does not double every locator.
      await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });

      const measured: Measured[] = await page.evaluate(
        (sentinel) =>
          [...document.querySelectorAll('[data-ward-primitive="table"], [class*="tableScroll"]')]
            // A table inside a visually hidden (.sr-only) block is not painted, and .sr-only's
            // `white-space: nowrap` inherits into it, so its "min-content" is its unwrapped width
            // and says nothing about a threshold. /search's movement table has lived there since
            // f93703edee (22 Sept).
            .filter((scroller) => scroller.closest(".sr-only") === null)
            .flatMap((scroller) => {
              const table = scroller.querySelector("table");
              if (!(table instanceof HTMLTableElement)) return [];
              const wrapper = scroller as HTMLElement;
              const width = () => table.getBoundingClientRect().width;

              const previousWidth = table.style.width;
              const previousMin = table.style.minWidth;
              const previousWrapperWidth = wrapper.style.width;
              const threshold = getComputedStyle(table).minWidth;
              const columns = table.querySelectorAll("thead th").length;

              /*
               * ⚠️ FIRST, AND BEFORE ANY GEOMETRY IS TOUCHED. Under the suite-wide
               * `reducedMotion: "reduce"`, `globals.css` gives every element a 0.01ms
               * `transition-duration` while the default `transition-property: all` stays in place,
               * so the first length written here would otherwise start a transition — and a
               * transition outranks `!important`, freezing the used value at the pin for the whole
               * synchronous block. See this file's head comment for the measured A/B.
               * `transition-property` is what has to go: the reset's `!important` DURATION cannot be
               * beaten from an inline declaration, and does not need to be.
               */
              table.style.setProperty("transition-property", "none", "important");
              wrapper.style.setProperty("transition-property", "none", "important");

              table.style.minWidth = "0px";
              const clearedMinWidth = getComputedStyle(table).minWidth;

              table.style.width = "min-content";
              const minContent = width();
              table.style.width = "max-content";
              const maxContent = width();

              // Second method, sharing nothing with the first: leave the table's own `width` alone
              // and starve it of space instead.
              table.style.width = previousWidth;
              wrapper.style.width = "1px";
              const minContentBySqueeze = width();
              wrapper.style.width = previousWrapperWidth;

              // Does a write to `min-width` move this table at all? A frozen probe fails here.
              table.style.width = "min-content";
              table.style.minWidth = `${sentinel}px`;
              const sentinelWidth = width();

              table.style.width = previousWidth;
              table.style.minWidth = previousMin;
              table.style.removeProperty("transition-property");
              wrapper.style.removeProperty("transition-property");

              return [
                {
                  testId: scroller.getAttribute("data-testid") ?? "(no testid)",
                  columns,
                  minWidthPx: threshold.endsWith("px") ? Math.round(Number.parseFloat(threshold)) : 0,
                  minContentPx: Math.round(minContent),
                  maxContentPx: Math.round(maxContent),
                  minContentBySqueezePx: Math.round(minContentBySqueeze),
                  clearedMinWidth,
                  sentinelWidthPx: Math.round(sentinelWidth),
                },
              ];
            }),
        SENTINEL_PX,
      );
      seen[route] = measured;
      tablesWalked += measured.length;
    }

    console.log(`ward-table threshold sweep: ${tablesWalked} tables across ${ROUTES.length} routes`, seen);

    /*
     * ⚠️ THE FLOOR IS ON THE SWEEP, AND IT IS THE ASSERTION MOST LIKELY TO SAVE THIS FILE. Everything
     * below is "the recorded shape still matches". A sweep that reached no tables — a route renamed,
     * the primitive's attribute dropped, a screen that renders its tables only with state this run
     * does not have — satisfies all of it and reports a clean estate.
     */
    // Re-measured at 5 (statistics/compare 2, out-of-area 1, referrals 2 — structurally present
    // but display:none in the live workspace since the "served register" rework, still counted
    // since this walks the DOM rather than checking visibility), down from the >8 this floor used
    // to hold before `/discharges` stopped contributing any: see this file's ROUTES comment above
    // for why. /search's table is now filtered out by the .sr-only exclusion above (f93703edee,
    // 22 Sept, moved it into a visually hidden block, and its nowrap inheritance made "min-content"
    // meaningless for a threshold check) rather than counted here. The floor stays a real one — 4,
    // not 0 — so a sweep that regressed to reaching nothing still fails loudly here rather than
    // reporting a clean estate.
    expect(tablesWalked, "the sweep reached no ward tables at all, so nothing below was checked").toBeGreaterThan(4);

    /*
     * 🔴 **THE INSTRUMENT CHECK, AND IT IS DELIBERATELY NOT AN `every()` OVER A DESIGN DECISION.**
     *
     * The control this replaces asked whether every pinned table's intrinsic width equalled its
     * threshold, and it let ten wrong readings through the moment one table legitimately differed.
     * The two assertions below are not about any screen's design, and no member of the population
     * may legitimately differ from them: **a `min-width` set to `0px` must compute to `0px`, and a
     * table pinned to a sentinel must be that wide.** Both are properties of the probe, not the page.
     *
     * ⚠️ **AND NOTE WHAT DOES NOT DISCRIMINATE, BECAUSE IT WAS MEASURED.** "Measure one table two
     * independent ways and fail if they disagree" is not sufficient on its own here: under the
     * transition freeze BOTH methods returned 480px, because both were floored by the same
     * un-clearable pin. Two agreeing methods behind one shared blocker agree on the wrong answer.
     * The cross-check below is kept — it catches a different class of fault, a table-sizing
     * assumption the wrapper-squeeze does not share — but the assertions that actually go red on the
     * state this file shipped with are these two.
     *
     * Proved by mutation, 2026-09-05: deleting the `transition-property` line above turns
     * `clearedMinWidth` into the pin on ten of the thirteen tables and the sentinel width into the
     * table's pre-write width, and both assertions fail naming them.
     */
    const frozen = Object.entries(seen).flatMap(([route, tables]) =>
      tables
        .filter((table) => table.clearedMinWidth !== "0px")
        .map(
          (table) =>
            `${route} ${table.testId}: min-width was set to 0px and computes to ${table.clearedMinWidth} — ` +
            `every width reported for it is the pin, not a measurement`,
        ),
    );
    expect(frozen, "the probe could not clear the pin, so nothing it measured is an intrinsic width").toEqual([]);

    /*
     * ⚠️ TWO NAMED EXEMPTIONS, ADDED 2026-09-17. The "served register" rework
     * (`referrals.module.css`) made `.tableScroll { display: none }` UNCONDITIONAL in the live
     * workspace — cards are now the sole on-screen representation of the referral board at every
     * width, and the table stays mounted only for its `@media print` contract (flipped back to
     * `display: block` there). `tablesWalked` above already counts these two tables, because that
     * walk is a DOM query, not a visibility check. But a `display: none` element is not laid out at
     * all, so no write to its `min-width` — including this probe's sentinel write — can ever move
     * its `getBoundingClientRect()`; that is a fact about being removed from layout, not about the
     * probe being broken. Exempted BY NAME, and only from this one check: the frozen-pin check
     * above, the cross-check, and the owned-table pin below all still run against every table
     * unexempted.
     */
    const DISPLAY_NONE_LIVE_TESTIDS = new Set([
      "ward-referral-board-queued-table",
      "ward-referral-board-decided-table",
    ]);

    const unmovedAll = Object.entries(seen).flatMap(([route, tables]) =>
      tables.filter((table) => table.sentinelWidthPx !== SENTINEL_PX).map((table) => ({ route, table })),
    );

    // Anti-vacuity floor: the exemption above must be hitting exactly the two tables it names — no
    // fewer (which would mean the redesign moved on and the exemption is now stale prose) and no
    // more (which would mean a different, unrelated table has gone inert and is silently hiding
    // inside somebody else's exemption instead of being investigated on its own).
    const exempted = unmovedAll.filter((entry) => DISPLAY_NONE_LIVE_TESTIDS.has(entry.table.testId));
    expect(
      exempted.map((entry) => entry.table.testId).sort(),
      "the display:none exemption is meant for exactly the two referral-board tables named above",
    ).toEqual([...DISPLAY_NONE_LIVE_TESTIDS].sort());

    const unmoved = unmovedAll
      .filter((entry) => !DISPLAY_NONE_LIVE_TESTIDS.has(entry.table.testId))
      .map(
        (entry) =>
          `${entry.route} ${entry.table.testId}: pinned to ${SENTINEL_PX}px and measured ${entry.table.sentinelWidthPx}px — ` +
          `this table does not respond to the probe's writes`,
      );
    expect(unmoved, "a write to min-width did not move the table, so the probe is not measuring it").toEqual([]);

    const crossCheck = (seen[CROSS_CHECK_ROUTE] ?? []).find((table) => table.testId === CROSS_CHECK_TESTID);
    expect(
      crossCheck,
      `${CROSS_CHECK_TESTID} is no longer on ${CROSS_CHECK_ROUTE}, so the two-method cross-check did not run`,
    ).toBeDefined();
    expect(
      Math.abs((crossCheck?.minContentPx ?? 0) - (crossCheck?.minContentBySqueezePx ?? -1)),
      `sizing the table and starving its wrapper disagree about ${CROSS_CHECK_TESTID}'s intrinsic width ` +
        `(${crossCheck?.minContentPx}px vs ${crossCheck?.minContentBySqueezePx}px)`,
    ).toBeLessThanOrEqual(1);

    const owned = seen[OWNED] ?? [];
    expect(
      owned.map((table) => table.testId),
      "the comparisons screen no longer renders the two tables this file was written for",
    ).toEqual(OWNED_TABLES.map((table) => table.testId));

    const drifted: string[] = [];
    for (const [index, expectation] of OWNED_TABLES.entries()) {
      const table = owned[index];
      if (table.columns !== expectation.columns) {
        drifted.push(
          `${table.testId}: threshold ${table.minWidthPx}px was measured against ${expectation.columns} columns and ` +
            `the table now renders ${table.columns}. It is a measurement of a table that no longer exists — ` +
            `re-measure it in a browser rather than editing this number`,
        );
      }
      if (table.minWidthPx !== expectation.minWidthPx) {
        drifted.push(
          `${table.testId}: threshold moved from ${expectation.minWidthPx}px to ${table.minWidthPx}px without its ` +
            `column count changing — the new value needs its own measurement`,
        );
      }
    }
    expect(drifted, "a comparisons table's threshold no longer describes the table it was measured for").toEqual([]);

    /*
     * REPORTED, NEVER ASSERTED, AND FOR EVERY TABLE INCLUDING MINE. A threshold above a table's
     * max-content forces a scroll that was not required. Whether that is wrong is a decision about a
     * specific screen and belongs to that screen's owner — and a table may legitimately be pinned
     * above its current content if its content is expected to grow.
     */
    const overPinned = Object.entries(seen).flatMap(([route, tables]) =>
      tables
        .filter((table) => table.minWidthPx > table.maxContentPx + 8)
        .map(
          (table) =>
            `${route} ${table.testId}: threshold ${table.minWidthPx}px exceeds max-content ${table.maxContentPx}px ` +
            `by ${table.minWidthPx - table.maxContentPx}px`,
        ),
    );
    if (overPinned.length > 0) {
      console.log(`thresholds wider than their table needs (${overPinned.length}):\n  ${overPinned.join("\n  ")}`);
    }

    /*
     * 🔴 ASSERTED, 2026-09-12 — THIS WAS `console.log`-ONLY UNTIL TODAY. It reported the exact
     * defect this file's own head comment names ("an over-pin... looks identical to a working
     * threshold... on the page at every width above it") and never failed on it. Ward Lead's owner
     * ruling 2026-09-12: two of three tables the ruling covered were genuinely inert by mistake
     * (`.compareWardTable` here, `referrals`'s `.table`, both raised in the same change as this
     * assertion) and one was inert on purpose (`discharges`'s blocked table). This turns the
     * former into a red and carves the latter out BY NAME, with its reason, rather than either
     * silently reddening on a deliberate design or silently staying a log forever.
     *
     * A threshold at or below a table's own min-content can never take effect: the table will not go
     * that narrow whatever the pin says. It does no harm, and it reads in the stylesheet exactly like
     * a working one, which is the whole reason for surfacing it — an owner re-measuring a screen has
     * no other way to tell a threshold that is holding a line from one that is decoration. The
     * comparison is deliberately exact rather than generous: a pin a few pixels above min-content
     * still binds, and calling that inert would be the same kind of overstatement this file exists to
     * prevent.
     */
    const inert = Object.entries(seen).flatMap(([route, tables]) =>
      tables
        .filter((table) => table.minWidthPx <= table.minContentPx)
        .map((table) => ({
          route,
          testId: table.testId,
          minWidthPx: table.minWidthPx,
          minContentPx: table.minContentPx,
        })),
    );

    /*
     * ⚠️ **THE FORMER NAMED EXEMPTION IS REMOVED, NOT LEFT STALE, 2026-09-17.** It named
     * `ward-discharge-table-blocked`, one of four separate per-group `WardTable`s the discharges
     * board used to render. The board was rebuilt around one unified "Bed release worklist"
     * `<table>` (see this file's ROUTES comment above) with no such testid anywhere, and — the
     * more important fact — `/discharges` now contributes ZERO tables to this sweep at all, so an
     * exemption naming any of its old per-group testids would name something this sweep can never
     * reach, which this block's own guard existed to refuse ("an allowlist entry that matches
     * nothing permits nothing... reads identically to one doing its job"). Following that guard's
     * own instruction — "remove the exemption or fix the walk" — this removes it. If the rebuilt
     * board's own threshold ever needs a deliberate exemption again, it earns one against
     * whatever it is actually shaped like now, not this one's ghost.
     *
     * ⚠️ **THE `ward-out-of-area-table` EXEMPTION ADDED THE SAME DAY IS ALSO REMOVED, 2026-09-17
     * SAMPLE-DATA ADDITION, NOT LEFT STALE.** It named `min-width: 30rem` (480px) as deliberately
     * below the table's then-measured ~585-499px header min-content, so the pin could never take
     * effect and the browser guard in `tests/ui-ward-referrals.spec.ts` did the real work instead.
     * Re-measured against the current fixture: the table's min-content is now 435px, BELOW the
     * 480px pin, so the pin genuinely binds now (it is no longer inert) — this is a real change in
     * the fixture's content width, not a regression, and `tests/ui-ward-referrals.spec.ts` (no
     * cell's right edge escapes the scroller at 641px) still passes at the current data. Per this
     * block's own guard ("an allowlist entry that matches nothing permits nothing... remove the
     * exemption or fix the walk"), the exemption is removed rather than kept as stale prose. If a
     * future content change pushes min-content back above 480px, this earns a fresh exemption
     * measured against whatever the table looks like then.
     */
    // 2026-09-25: 5fc6a5f664 made the ledger's headers uppercase, tracked and nowrap, so the header
    // row now sets this table's floor (~490px) above its 30rem pin. The pin is left in place as a
    // backstop; the real line is the geometric check at 641px in ui-ward-referrals.spec.ts.
    const KNOWN_DELIBERATELY_INERT = new Set<string>(["ward-out-of-area-table"]);

    // Anti-vacuity floor, same discipline as the display:none exemption above: the set must be
    // hitting exactly the table it names, or it has either gone stale (nothing left to exempt) or
    // is silently absorbing some other, uninvestigated inert table.
    const knownInertHit = inert.filter((entry) => KNOWN_DELIBERATELY_INERT.has(entry.testId));
    expect(
      knownInertHit.map((entry) => entry.testId).sort(),
      "the deliberately-inert exemption is meant for exactly the table named above",
    ).toEqual([...KNOWN_DELIBERATELY_INERT].sort());

    const unexplainedInert = inert
      .filter((entry) => !KNOWN_DELIBERATELY_INERT.has(entry.testId))
      .map(
        (entry) =>
          `${entry.route} ${entry.testId}: threshold ${entry.minWidthPx}px is at or below the table's own ` +
          `min-content ${entry.minContentPx}px, so it can never take effect`,
      );
    expect(
      unexplainedInert,
      `a ward table's scroll threshold can never take effect at its own min-content. Either raise ` +
        `the pin (measured against a browser, not chosen by eye) or, if it is deliberate, name it ` +
        `above with its reason instead of letting this list grow silently.`,
    ).toEqual([]);

    console.log(
      inert.length > 0
        ? `inert thresholds (${inert.length}): ` +
            inert
              .map((entry) => `${entry.route} ${entry.testId} (${entry.minWidthPx}px vs ${entry.minContentPx}px)`)
              .join(", ")
        : `no inert thresholds: all ${tablesWalked} tables are pinned above their own min-content`,
    );
  });
});

/**
 * ═══ THE 12px TYPE FLOOR, MEASURED WHERE IT IS ACTUALLY PAINTED ═══════════════════════════════
 *
 * ⚠️ **THIS BLOCK IS IN A FILE WHOSE NAME HAS OUTGROWN IT, AND THAT IS DELIBERATE.** A type-floor
 * sweep does not belong in a spec named for table thresholds. It is here because
 * `playwright.config.ts`'s `testMatch` is an explicit filename ALLOW-LIST rather than a glob, so a
 * new `ui-ward-*.spec.ts` matches nothing and **no runner ever opens it** — committed, looking
 * exactly like a gate, running never. **A badly-named gate that runs beats a well-named one that
 * does not.** Extending an already-listed filename is what makes that trade available.
 *
 * 🔴 **WHY IT SELECTS ON `data-ward-type-floor` AND NEVER ON A CLASS.** CSS-module class names keep
 * the source filename in the dev server and **drop it in a production build** — and the runner
 * builds production. `[class*="personCause"]` therefore returns ZERO elements on a page that
 * rendered perfectly, and an empty sweep reports no violations. That is not a hypothetical:
 * `tests/ui-ward-forced-colors.spec.ts:27` records three assertions passing over an empty set
 * before somebody caught it. **The attributes exist solely so this gate can fail.**
 *
 * 🔴 **AND WHY IT ASSERTS EQUALS, NEVER "BIGGER THAN BEFORE".** An unresolvable `var()` makes the
 * whole declaration invalid at computed-value time and `font-size` falls back to the INHERITED
 * value, which is LARGER than the 10px it replaced. **A broken token and a working one are both
 * "bigger".** Equality is the only condition that separates them, and it has closed that trapdoor
 * twice during this work.
 *
 * ⚠️ **COVERAGE, stated rather than left to be discovered.** This walks FOUR screens, named
 * directly: Delays, Command, Movements, Capacity. **The owner's ruling (O-16.2) was measured across
 * 31 screens; these four are a subset and the other twenty-seven are UNMEASURED here.** The sibling
 * `ROUTES` list above reaches six distinct screens from seven entries — `/escalation` and `/queue`
 * are both eleven-line redirects to Delays — and covers none of these four.
 */
const TYPE_FLOOR_PX = 12;

/**
 * Elements the current design deliberately paints ABOVE the floor. Still asserted by EQUALITY, so an
 * unresolvable var() (which inherits a larger size) stays red. 53105ca6ea (25 Sept) rebuilt the
 * Delays row as a card and the cause became its title at --t-1 (13px, weight 600). O-16.2 raised the
 * cause from 10px and required it to stay distinguishable from the demographics; 13px/600 does both.
 */
const TYPE_SIZE_BY_NAME: Readonly<Record<string, number>> = { "delays-cause": 13 };

/** Named directly, never through a redirect that would read as another screen's coverage. */
const TYPE_FLOOR_ROUTES = [
  {
    route: "/mockups/ward-flow/delays",
    expect: ["delays-cause", "delays-profile", "delays-wait", "delays-since", "banner", "badge"],
  },
  { route: "/mockups/ward-flow", expect: ["command-tier", "command-score", "banner", "badge"] },
  { route: "/mockups/ward-flow/movements", expect: ["banner", "badge"] },
  { route: "/mockups/ward-flow/capacity", expect: ["banner", "badge"] },
] as const;

test.describe("@mockup the ward type floor is met where it is painted, not where it is declared", () => {
  test("every ruled element computes to 12px on its own route", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const misses: string[] = [];
    let measured = 0;

    for (const { route, expect: expected } of TYPE_FLOOR_ROUTES) {
      await page.goto(route, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });

      const found = await page.evaluate(() =>
        [...document.querySelectorAll("[data-ward-type-floor]")].map((element) => ({
          name: element.getAttribute("data-ward-type-floor") ?? "",
          px: Number.parseFloat(getComputedStyle(element).fontSize),
        })),
      );

      /*
       * 🔴 THE FLOOR, AND IT IS LOAD-BEARING RATHER THAN COURTESY. Every assertion below is over
       * what the selector found; a selector that finds nothing asserts nothing and passes. This is
       * what turns that into "delays-cause never rendered" instead of a silent green.
       */
      for (const name of expected) {
        const hits = found.filter((entry) => entry.name === name);
        expect(
          hits.length,
          `${route} rendered no [data-ward-type-floor="${name}"]. Either the attribute was removed ` +
            `as decoration, or the element stopped rendering. Until this is non-zero the size ` +
            `assertions below this line are vacuous and prove nothing.`,
        ).toBeGreaterThan(0);

        for (const hit of hits) {
          measured += 1;
          const expectedPx = TYPE_SIZE_BY_NAME[name] ?? TYPE_FLOOR_PX;
          if (hit.px !== expectedPx) misses.push(`${route} ${name} ${hit.px}px (expected ${expectedPx}px)`);
        }
      }
    }

    expect(measured, "the sweep measured nothing at all across four routes").toBeGreaterThan(10);
    expect(
      misses,
      `an element the owner ruled to the ${TYPE_FLOOR_PX}px floor does not compute to it. A value ` +
        `LARGER than ${TYPE_FLOOR_PX} is not a pass: an unresolvable var() makes font-size invalid ` +
        `at computed-value time and inherits, which is also larger. Read the declared token before ` +
        `concluding the screen is fine.`,
    ).toEqual([]);
  });

  /**
   * 🔴 THE NARROW-WIDTH PASS, because one rule survived the raise at this width only. The Delays
   * phone block once set a hard-coded chip size inside `@media (max-width: 40rem)`; the base rule
   * now resolves to 12px and that override would have kept painting smaller below 40rem — desktop
   * fixed, diff complete, narrow width still in violation, invisible to both.
   */
  test("the badge still meets the floor below 40rem, where a phone override once undid it", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/mockups/ward-flow/delays", { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });

    const badges = await page.evaluate(() =>
      [...document.querySelectorAll('[data-ward-type-floor="badge"]')].map((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
      ),
    );

    expect(badges.length, "no badge rendered at 375px — this test proves nothing as written").toBeGreaterThan(0);
    for (const px of badges) {
      expect(px, `the badge computes to ${px}px below 40rem, where a phone override once undid the floor`).toBe(
        TYPE_FLOOR_PX,
      );
    }
  });
});

test("@mockup print-only referral tables have measurable thresholds", async ({ page }) => {
  await page.goto("/mockups/ward-flow/referrals");
  await page.waitForLoadState("networkidle");
  await page.emulateMedia({ media: "print" });
  for (const id of ["ward-referral-board-queued-table", "ward-referral-board-decided-table"]) {
    const table = page.getByTestId(id).locator("table");
    await expect(table).toBeVisible();
    const measured = await table.evaluate((node) => {
      const element = node as HTMLTableElement;
      const before = element.style.cssText;
      const pin = Number.parseFloat(getComputedStyle(element).minWidth);
      element.style.setProperty("transition-property", "none", "important");
      element.style.setProperty("min-width", "0px", "important");
      element.style.setProperty("width", "min-content", "important");
      const min = element.getBoundingClientRect().width;
      element.style.setProperty("width", "max-content", "important");
      const max = element.getBoundingClientRect().width;
      element.style.cssText = before;
      return { pin, min, max };
    });
    expect(measured.min).toBeGreaterThan(0);
    expect(measured.max).toBeGreaterThanOrEqual(measured.min);
    console.log(`[print table threshold] ${id}`, measured);
  }
});
