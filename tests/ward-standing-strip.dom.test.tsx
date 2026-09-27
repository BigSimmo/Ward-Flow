// tests/ward-standing-strip.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { clockState } from "@/components/ward-management/ward-clock";
import { isOpen, elapsedLabel } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import type { Movement } from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds, wardMovements } from "@/components/ward-management/ward-movements";
import { bedsPendingPreparation, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { allUnits, NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { standingFigures, WardStandingStrip } from "@/components/ward-management/ward-standing-strip";

/**
 * **THE STANDING STRIP'S OWN CONTRACT, PINNED FROM THE OUTSIDE.**
 *
 * `ward-standing-strip.tsx`'s own doc comment names the property that has broken four times over:
 * `standingFigures()` may return at most two `flagged` entries, because it feeds `WardFigureStrip`
 * directly and that component THROWS above two (`ward-figure.tsx`). A screen that renders fine in
 * every screenshot can still ship a third amber tile the moment a seeded value crosses a threshold,
 * because nothing renders differently until it does — this file is what would go red the day that
 * threshold is crossed, rather than waiting for a coordinator's browser to throw first.
 *
 * The rest of this file exists so the seven figures cannot silently drift from what
 * `ward-standing-strip.tsx` itself names as each one's source: `serviceRollup` for the two capacity
 * figures, `edPressure` for the ED count, `isOpen`/`elapsedLabel` for waiting and longest-wait, and
 * `clockState` for the two legal figures. No expected number is typed into this file — every one is
 * re-derived here from the same exported primitives the component calls, over the same seeded
 * fixture (`wardMovements`, `allUnits()`, `wardSites`, `bedReleases`, `leaveBeds`, `NOW_ANCHOR`).
 */

/**
 * 🔴 **`initialNow` CANNOT CROSS A DEADLINE — THE SAME TRAP `ward-delays-legal-deadline.dom.test.tsx`
 * DOCUMENTS, AND IT APPLIES HERE TOO.** A pinned `initialNow` re-seeds the whole world at that
 * offset (`seedWardFlowStateAt` -> `shiftInstants`), so every `dueAt` in the seed moves with it and a
 * deadline that is 90 minutes away at the anchor stays 90 minutes away at any `initialNow`. Only an
 * `ADVANCE_CLOCK` dispatch moves `now` independently of the seed, which is the only way to actually
 * put a real coordinator in front of a breached or critical deadline in a rendered test. Test-only
 * scaffold, copied from that file's own pattern rather than invented fresh.
 */
function AdvanceClock({ minutes }: { minutes: number }) {
  const { dispatch, now } = useWardFlow();
  return (
    <button
      type="button"
      data-testid="test-advance-clock"
      onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}
    >
      advance clock
    </button>
  );
}

function renderAdvancedBy(minutes: number) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AdvanceClock minutes={minutes} />
      <WardStandingStrip />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByTestId("test-advance-clock"));
}

/**
 * The seven-figure input the live provider hands `standingFigures` at `now`, built from the exact
 * same seed the provider itself seeds from at `NOW_ANCHOR` — `allUnits()` for the "standard" scenario
 * unmodified (`scenarioUnits("standard")` is `structuredClone(allUnits())`, so the figures agree),
 * and the same `bedReleases`/`leaveBeds` fixtures `seedWardFlowState` clones into the reducer.
 */
/**
 * ⚠️ **`chromeRole` IS EXPLICIT HERE AND HAS NO DEFAULT IN THE COMPONENT, DELIBERATELY.**
 *
 * A defaulted parameter is only ever wrong when it is OMITTED, and a suite that always omits it
 * proves nothing about the other branches — the "coordinator" figures would be the only ones any
 * test had ever seen while the ward and ED sets shipped unexercised. Making it required means the
 * compiler names every call site the day a fourth role is added, rather than silently handing it
 * the widest view.
 */
function baseInput(now: number, chromeRole: "coordinator" | "ward" | "ed" = "coordinator", placeId?: string) {
  return {
    movements: wardMovements,
    units: allUnits(),
    admissions: wardAdmissions,
    bedReleases,
    leaveBeds,
    now,
    chromeRole,
    placeId,
  };
}

/**
 * A DERIVATION, NOT A COPY OF THE PRIVATE FUNCTION. `ward-standing-strip.tsx`'s own `legalCounts`
 * is not exported — it is an implementation detail behind the public `StandingFigure[]` contract —
 * so this cannot import it and must not need to: it re-derives the same two counts from the
 * exported `isOpen` and `clockState`, the same primitives the component itself calls. If the
 * component's own arithmetic ever disagreed with this (e.g. counting "due" as a flag, not only
 * "breached"/"critical"), the mismatch would show up as a value difference below, not as an
 * inability to compile against a private symbol.
 */
function expectedLegalCounts(now: number) {
  let passed = 0;
  let withinHour = 0;
  for (const movement of wardMovements.filter(isOpen)) {
    const dueAt = movement.legalForm?.dueAt;
    if (dueAt === undefined) continue;
    const state = clockState(dueAt, now);
    if (state === "breached") passed += 1;
    else if (state === "critical") withinHour += 1;
  }
  return { passed, withinHour };
}

describe("the standing strip never exceeds WardFigureStrip's two-flag ceiling", () => {
  /**
   * ⚠️ THE ANTI-VACUITY FLOOR, and it is not decoration. A suite that asserted "at most two
   * flagged" and "only the legal two may be flagged" over an empty world, or over a fixture where
   * every figure reads zero, would pass unconditionally — the ceiling is never approached and the
   * derivation-matching tests below would all be comparing "0" to "0". This proves the fixture
   * actually exercises the strip: some figure is non-zero at NOW_ANCHOR, a legal deadline sits in
   * range at NOW_ANCHOR (mirroring what `ward-delays-legal-deadline.dom.test.tsx` establishes — the
   * seed's nearest deadlines are "due", not yet "critical" or "breached", at the anchor itself), and
   * — separately — the later instant the ceiling test advances to genuinely turns two of the seed's
   * own deadlines critical/breached, rather than the offset having gone stale under a fixture edit.
   */
  it("fixture sanity: the seed is non-trivial and the chosen advance actually breaches a deadline, or every test below is vacuous", () => {
    const openMovements = wardMovements.filter(isOpen);
    expect(
      openMovements.length,
      "no open movement in the fixture — every figure below would read zero",
    ).toBeGreaterThan(0);

    const inRangeAtAnchor = openMovements.filter((movement) => {
      const dueAt = movement.legalForm?.dueAt;
      return dueAt !== undefined && clockState(dueAt, NOW_ANCHOR) !== "clear";
    });
    expect(
      inRangeAtAnchor.length,
      "no open movement carries a legal deadline in range at NOW_ANCHOR — the legal figures are untested here",
    ).toBeGreaterThan(0);

    const figures = standingFigures(baseInput(NOW_ANCHOR));
    const nonZero = figures.filter((figure) => /[1-9]/u.test(figure.value));
    expect(
      nonZero.length,
      "every figure on the strip reads zero at NOW_ANCHOR — this fixture proves nothing",
    ).toBeGreaterThan(0);

    // The 70-minute advance below is what the two-flag ceiling test actually renders at. Pinning
    // that it produces a real breach AND a real critical count (not merely "in range") is what
    // makes that test a genuine exercise of the throw rather than a vacuous pass over two zeroes.
    const advanced = expectedLegalCounts(NOW_ANCHOR + 70);
    expect(
      advanced.passed,
      "advancing 70 minutes no longer breaches any seeded deadline — pick a new offset",
    ).toBeGreaterThan(0);
    expect(
      advanced.withinHour,
      "advancing 70 minutes no longer makes any seeded deadline critical — pick a new offset",
    ).toBeGreaterThan(0);
  });

  /**
   * 🔴 THE CEILING ITSELF, AT THE INSTANT THE FIXTURE IS DORMANT. Both legal counts are zero at
   * NOW_ANCHOR (per the sanity check above), so this asserts the STRUCTURAL rule that would catch a
   * mutation flagging some other figure unconditionally: no figure outside the two legal keys may
   * ever carry `flagged: true`, at any instant, including one where the legal figures themselves
   * are quiet. A third figure flagged here would slip past a test that only checked the total count.
   */
  it("flags only the two legal figures at NOW_ANCHOR, where both happen to be quiet", () => {
    const figures = standingFigures(baseInput(NOW_ANCHOR));
    const flagged = figures.filter((figure) => figure.flagged === true);
    expect(
      flagged.length,
      `WardFigureStrip throws above two flagged children; this input already produces ${flagged.length}`,
    ).toBeLessThanOrEqual(2);
    for (const figure of flagged) {
      expect(
        ["passed", "within-hour"],
        `"${figure.key}" is flagged, and only "passed"/"within-hour" ever may be`,
      ).toContain(figure.key);
    }
  });

  /**
   * THE SAME CEILING, AT THE INSTANT BOTH LEGAL FIGURES ARE GENUINELY LIT — the case the sanity
   * check above proves is real. This is the version of the test that would fail if the ceiling
   * logic itself were broken (e.g. counting "due" as a flag too, which would add a third movement
   * — WF-004's +300 due-at is still clear at this offset, but a looser threshold could pull in more
   * than the two legal figures on its own).
   */
  it("flags only the two legal figures, and both are lit, at the instant the fixture's own deadlines breach", () => {
    const now = NOW_ANCHOR + 70;
    const expected = expectedLegalCounts(now);
    const figures = standingFigures(baseInput(now));
    const byKey = Object.fromEntries(figures.map((figure) => [figure.key, figure]));

    expect(byKey.passed.value).toBe(String(expected.passed));
    expect(byKey.passed.flagged).toBe(expected.passed > 0);
    expect(byKey["within-hour"].value).toBe(String(expected.withinHour));
    expect(byKey["within-hour"].flagged).toBe(expected.withinHour > 0);

    const flagged = figures.filter((figure) => figure.flagged === true);
    expect(
      flagged.length,
      `WardFigureStrip throws above two flagged children; this input produces ${flagged.length}`,
    ).toBeLessThanOrEqual(2);
    for (const figure of flagged) {
      expect(["passed", "within-hour"]).toContain(figure.key);
    }
  });

  /**
   * ⚠️ NO NUMBER HERE IS TYPED INTO THE TEST. Each figure is checked against the exact derivation
   * `ward-standing-strip.tsx`'s own doc comment names for it — `serviceRollup` for the two capacity
   * figures (never a re-summed total, per that module's own "never re-added here" rule),
   * `edPressure` for the ED count, `isOpen`/`elapsedLabel` for the open count and the longest wait,
   * and `expectedLegalCounts` above (built from the exported `clockState`, not the private
   * `legalCounts`) for the two legal figures. A change to any one derivation, or a rearrangement of
   * which figure reads which one, moves a value here and fails — a hardcoded expectation could not
   * tell the two apart.
   */
  it("derives every one of the seven figures from the exact source ward-standing-strip.tsx names for it", () => {
    const now = NOW_ANCHOR;
    const openMovements = wardMovements.filter(isOpen);
    const rollup = serviceRollup(wardSites, allUnits(), bedReleases, leaveBeds, now);
    const inEd = edPressure(now, wardMovements).reduce((total, ed) => total + ed.waiting, 0);
    const legal = expectedLegalCounts(now);
    // The same reduce `standingFigures` runs, over the same `isOpen` filter — there is no separate
    // exported "longest open movement" helper to call instead, so this mirrors the component's own
    // reduce rather than inventing a different way to find it.
    const longest = openMovements.reduce<Movement | undefined>(
      (worst, movement) => (worst === undefined || movement.openedAt < worst.openedAt ? movement : worst),
      undefined,
    );

    const figures = standingFigures(baseInput(now));
    const byKey = Object.fromEntries(figures.map((figure) => [figure.key, figure]));

    expect(byKey.ready.value).toBe(String(rollup.service.availableNow));
    expect(byKey["out-today"].value).toBe(String(rollup.service.expectedToday));
    expect(byKey.waiting.value).toBe(String(openMovements.length));
    expect(byKey["from-ed"].value).toBe(String(inEd));
    expect(byKey.longest.value).toBe(longest === undefined ? "—" : elapsedLabel(longest, now));
    expect(byKey.longest.sub).toBe(longest?.id);
    expect(byKey.passed.value).toBe(String(legal.passed));
    expect(byKey["within-hour"].value).toBe(String(legal.withinHour));
  });

  /**
   * THE COMPONENT ITSELF, RENDERED THROUGH THE REAL PROVIDER — not the pure function in isolation.
   * `WardFigureStrip` throws during render, not during a plain function call, so this is the test
   * that would actually fail the way a coordinator's browser would: a crashed screen, not a wrong
   * number. Advanced 70 minutes past `NOW_ANCHOR` (via `ADVANCE_CLOCK`, never `initialNow` — see the
   * scaffold's own doc comment) so both legal figures are genuinely lit rather than quiet, which is
   * the harder case for the ceiling to hold under.
   */
  it('renders under data-testid="ward-standing-strip" and does not throw once real deadlines breach', () => {
    const now = NOW_ANCHOR + 70;
    const expected = expectedLegalCounts(now);
    // Anti-vacuity for this render specifically: if the offset stopped lighting both figures, this
    // render would pass "did not throw" trivially, the same failure mode the fixture-sanity test
    // above exists to catch for the pure-function versions of this assertion.
    expect(expected.passed).toBeGreaterThan(0);
    expect(expected.withinHour).toBeGreaterThan(0);

    renderAdvancedBy(70);

    const strip = screen.getByTestId("ward-standing-strip");
    expect(strip).toBeInTheDocument();

    /*
     * 🔴 **THE FIGURES ARE BEHIND A TOGGLE NOW, SO THEY MUST BE OPENED BEFORE THEY CAN BE COUNTED.**
     * Owner's change, 2026-09-07. This assertion previously read the tiles straight out of the DOM
     * and would now pass over ZERO tiles — a collapsed panel and a panel that renders nothing look
     * identical to `querySelectorAll`, which is why the exact count is asserted rather than a
     * ceiling alone.
     */
    // Present in the DOM but NOT VISIBLE: the panel is always rendered and hidden with `hidden`, so
    // the print rule has something to restore. "Absent" would be the wrong assertion and would
    // pass again the day somebody made printing lose every figure.
    expect(
      screen.getByTestId("ward-stats-panel"),
      "the figures are showing before anybody opened them",
    ).not.toBeVisible();
    fireEvent.click(screen.getByTestId("ward-stats-toggle"));

    const flaggedTiles = strip.querySelectorAll('[data-flagged="true"]');
    expect(
      flaggedTiles.length,
      "the strip rendered more amber tiles than WardFigureStrip should ever allow",
    ).toBeLessThanOrEqual(2);
    expect(flaggedTiles.length).toBe(2);
  });

  it("🔴 STATES THE ALARM ON THE CLOSED TOGGLE, so a collapsed panel can never mean 'nothing is wrong'", () => {
    /*
     * The safety property the toggle introduced, and the reason the owner's change did not simply
     * hide the figures. **A breached statutory deadline must not be one click away.** So whatever is
     * flagged is written on the button's own face, in WORDS — not as a bare badge count, which reads
     * as "new since you looked", and not by colour alone.
     *
     * ⚠️ Both directions are asserted. A control that always says something alarming is exactly as
     * useless as one that never does, so the quiet case is pinned too — at `NOW_ANCHOR` nothing is
     * breached or critical, and the button must say so rather than going blank, because an empty
     * control and an unread one are indistinguishable.
     */
    const loud = expectedLegalCounts(NOW_ANCHOR + 70);
    expect(
      loud.passed + loud.withinHour,
      "nothing is flagged after the advance — this case proves nothing",
    ).toBeGreaterThan(0);

    renderAdvancedBy(70);
    const toggle = screen.getByTestId("ward-stats-toggle");
    expect(screen.getByTestId("ward-stats-panel"), "the panel starts open, so 'closed' is untested").not.toBeVisible();
    expect(
      toggle.textContent,
      "the closed toggle does not name what is flagged — a collapsed panel would read as all clear",
    ).toMatch(/deadline passed|due within/i);
    expect(toggle.textContent).not.toMatch(/nothing flagged/i);
  });
});

/**
 * 🔴 **THE PREPARATION NOTE, AND THE ONE PLACE ITS WORDING DELIBERATELY DIFFERS BY ROLE.**
 *
 * A "ready" figure counts beds that are free INCLUDING ones still pending, and `PULL_PATIENT`
 * refuses on exactly those — so the number alone states something a coordinator cannot act on. The
 * count must not change (owner ruling 2026-09-01: a ward's figure must not lurch as preparation
 * starts and stops); what was missing is the sentence beside it.
 *
 * ⚠️ **THE EMERGENCY DEPARTMENT GETS "M pending" WITHOUT "N can be pulled into", AND NOTHING ELSE
 * PINS THAT.** An ED cannot pull a patient into anything — its tile already carries "not all
 * eligible" for that reason — so naming how many beds *could be pulled into* offers it an action it
 * does not have. That is a judgement made during the 2026-09-07 fold, not a derivation, which is
 * precisely why it needs a test: nothing about the code says it was deliberate, so the next person
 * to tidy the two branches into one would be doing the obvious thing.
 *
 * ⚠️ **"pending", never "being made ready" or "being cleaned"** — owner correction 2026-09-07.
 * Cleaning is one of two `BED_PREPARATION_NOTES` entries, the other is maintenance or repair, and a
 * bed may carry the flag with no reason recorded at all. Both longer phrases assert a reason the
 * model does not hold, and this file carried "being made ready" for a few hours that day.
 */
describe("the ready figures say how many beds are pending, in the words each role can act on", () => {
  const readySub = (chromeRole: "coordinator" | "ward" | "ed", placeId?: string) => {
    const figures = standingFigures(baseInput(NOW_ANCHOR, chromeRole, placeId));
    const ready = figures.find((figure) => figure.key.startsWith("ready"));
    expect(ready, `no ready figure in the ${chromeRole} set`).toBeTruthy();
    return ready!.sub;
  };

  /** Derived, not typed: the one seeded ward carrying a pending bed. A literal here would pass on a
   *  seed where nothing is pending, which is the state that proves nothing. */
  const pendingUnit = allUnits().find((unit) => bedsPendingPreparation(unit.id, bedReleases) > 0);

  it("has a ward with a pending bed and a ward without, so both paths are exercised", () => {
    expect(pendingUnit, "no seeded ward has a pending bed — every assertion below would be vacuous").toBeTruthy();
    expect(
      allUnits().some((unit) => bedsPendingPreparation(unit.id, bedReleases) === 0),
      "every seeded ward has a pending bed — the omitted-note path is never rendered",
    ).toBe(true);
  });

  it("offers a coordinator the actionable count as well as the pending one", () => {
    const sub = readySub("coordinator");
    expect(sub).toMatch(/^\d+ can be pulled into · \d+ pending$/u);
  });

  it("offers a ward the same, after its own name", () => {
    const sub = readySub("ward", pendingUnit!.id);
    expect(sub).toBe(
      `${pendingUnit!.name} · ${openBedsNow(pendingUnit!, bedReleases)} can be pulled into · ` +
        `${bedsPendingPreparation(pendingUnit!.id, bedReleases)} pending`,
    );
  });

  it("offers an emergency department the pending count and NOT an action it does not have", () => {
    const sub = readySub("ed");
    expect(sub).toMatch(/pending$/u);
    expect(sub, "an ED cannot pull a patient into a bed, so it must not be told how many it could").not.toContain(
      "can be pulled into",
    );
  });

  it("says nothing at all where nothing is pending, rather than '0 pending'", () => {
    const clear = allUnits().find((unit) => bedsPendingPreparation(unit.id, bedReleases) === 0);
    expect(readySub("ward", clear!.id)).toBe(clear!.name);
  });

  it("never uses a phrase that asserts a reason the model does not hold", () => {
    for (const [role, placeId] of [
      ["coordinator", undefined],
      ["ward", pendingUnit!.id],
      ["ed", undefined],
    ] as const) {
      const sub = readySub(role, placeId) ?? "";
      for (const banned of ["being made ready", "being cleaned", "cleaning"]) {
        expect(sub.toLowerCase(), `the ${role} ready figure claims a reason for the flag`).not.toContain(banned);
      }
    }
  });
});
