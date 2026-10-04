import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { bedsForecast, forecastHeadline } from "@/components/ward-management/capacity/beds-forecast";
import {
  bedKindGaps,
  bedKindTotals,
  countCellText,
  networkTotals,
  freeingCellText,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * MERGE 02 — the ward-confirmed capacity view and the morning bed-state board become one screen
 * answering one question: where is a bed KIND short across the network?
 *
 * ⚠️ Every expected value below comes from calling the same derivation functions the screen itself
 * calls (`bedKindGaps`, `bedKindTotals`, `networkWardRows`, `networkTotals`), against the real
 * fixture — never a hand-written number. A hand-written expectation is the thing that goes stale
 * the day the fixture changes, and it goes stale by passing.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
// CapacityScreen reads `movements` from useWardFlow(), i.e. the full seeded state
// (seedWardFlowState().movements) that WardFlowProvider populates — not the raw
// ward-movements.ts fixture array. seedWardFlowState() additively overlays demonstration
// movements (ward-rulings-demo.ts), growing the seed from 60 to 77 movements (2026-09-25); the
// raw array stayed at 60. Using the raw array here undercounted every gap-row figure below.
const gapRows = bedKindGaps(seedWardFlowState().movements, units, NOW);
const gapTotals = bedKindTotals(gapRows);
// ⚠️ THE SAME ARGUMENTS THE SCREEN USES, INCLUDING `bedReleases`. This read `networkWardRows(units,
// NOW)` and the screen read `(units, now, bedReleases)` — so the expectation and the render
// disagreed about whether a freeing figure exists at all, and two tests failed while both sides were
// individually correct. A test that calls the production function with DIFFERENT arguments from the
// caller is testing a configuration nothing ships.
const networkRows = networkWardRows(units, NOW, bedReleases);
const netTotals = networkTotals(networkRows);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

describe("the Capacity screen", () => {
  it("has a non-empty population to render, or every assertion below is vacuous", () => {
    expect(gapRows.length).toBe(4);
    expect(networkRows.length).toBeGreaterThan(0);
    expect(netTotals.beds).toBeGreaterThan(0);
  });

  it("has the page shell — a rail, a main landmark and an <h1> — like every other Ward Flow screen", () => {
    // ⚠️ `DelaysScreen` shipped without this once (see its own doc comment) and no component test
    // caught it, because a component test cannot see a missing page shell — the shell is exactly
    // what it does not render. This screen's shell is asserted from the start rather than added
    // after the fact.
    renderScreen();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Capacity" })).toBeInTheDocument();
  });

  it("shows the ready-bed split as a bar whose numbers are the real locked/open sums, never invented", () => {
    const totalLocked = networkRows.reduce((sum, row) => sum + row.lockedReady, 0);
    const totalReady = netTotals.ready;
    expect(totalReady, "no ready bed in the fixture — this guard proved nothing").toBeGreaterThan(0);
    renderScreen();
    // WardBar's accessible name names every segment and its count — `\\b`, not `\b`: in a template
    // literal `\b` is a literal backspace byte, not a regex word boundary, and it can never match.
    expect(
      screen.getByRole("img", { name: new RegExp(`Locked ready ${totalLocked}\\b.*Open ready`, "su") }),
    ).toBeInTheDocument();
    const readySummary = screen.getByRole("region", { name: "Ready now" });
    expect(within(readySummary).getByText(String(totalReady), { selector: "strong" })).toBeInTheDocument();
    expect(within(readySummary).getByText(new RegExp(`^of\\s+${netTotals.beds} beds$`, "u"))).toBeInTheDocument();
  });

  it("renders exactly the four bed-kind rows the derivations return, each with its own real waiting and beds-that-fit", () => {
    renderScreen();
    const table = screen.getByTestId("ward-capacity-gap-table");
    for (const row of gapRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-gap-row-${row.id}`);
      expect(tableRow, `row ${row.id}`).toHaveTextContent(row.need);
      expect(within(tableRow).getByTestId("ward-capacity-waiting")).toHaveTextContent(String(row.waiting));
      expect(within(tableRow).getByTestId("ward-capacity-beds-that-fit")).toHaveTextContent(String(row.bedsThatFit));
    }
  });

  /**
   * ⚠️ THE ONE THING THE DESIGN LOCK NAMES BY SECTION NUMBER (§5.1): a negative gap must read as a
   * shortfall in words, never only as a minus sign or a tinted number.
   */
  it("labels every negative gap a shortfall in words, not only as a signed number", () => {
    const shortfallRows = gapRows.filter((row) => row.gap < 0);
    expect(shortfallRows.length, "the fixture has no shortfall row — this guard proved nothing").toBeGreaterThan(0);
    renderScreen();
    const table = screen.getByTestId("ward-capacity-gap-table");
    for (const row of shortfallRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-gap-row-${row.id}`);
      expect(within(tableRow).getByText(/shortfall/iu)).toBeInTheDocument();
      // The magnitude is real too — not just the word.
      expect(tableRow).toHaveTextContent(`${Math.abs(row.gap)} short`);
    }
  });

  it("shows a non-negative gap as 'exactly enough' or 'spare capacity' in words, never only the word 'shortfall'", () => {
    const nonNegativeRows = gapRows.filter((row) => row.gap >= 0);
    expect(nonNegativeRows.length, "the fixture has no non-negative row — this guard proved nothing").toBeGreaterThan(
      0,
    );
    renderScreen();
    const table = screen.getByTestId("ward-capacity-gap-table");
    for (const row of nonNegativeRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-gap-row-${row.id}`);
      expect(within(tableRow).queryByText(/shortfall/iu)).toBeNull();
      expect(within(tableRow).getByText(row.gap === 0 ? /exactly enough/iu : /spare capacity/iu)).toBeInTheDocument();
    }
  });

  it("shows the 'all four together' total row, matching bedKindTotals exactly", () => {
    renderScreen();
    const totalRow = screen.getByTestId("ward-capacity-gap-total");
    expect(within(totalRow).getByTestId("ward-capacity-waiting")).toHaveTextContent(String(gapTotals.waiting));
    expect(within(totalRow).getByTestId("ward-capacity-beds-that-fit")).toHaveTextContent(
      String(gapTotals.bedsThatFit),
    );
    expect(totalRow).toHaveTextContent(
      gapTotals.gap < 0 ? /shortfall/iu : gapTotals.gap === 0 ? /exactly enough/iu : /spare capacity/iu,
    );
  });

  it("lists every network ward exactly once, with an honest denominator on the panel count", () => {
    renderScreen();
    expect(
      within(screen.getByRole("region", { name: "Wards" })).getByText(
        new RegExp(`${networkRows.length} wards?\\b`, "u"),
      ),
      "the panel count does not say how many wards are shown",
    ).toBeInTheDocument();
    const table = screen.getByTestId("ward-capacity-network-table");
    const rendered = within(table)
      .getAllByRole("row")
      .filter((row) => row.getAttribute("data-testid")?.startsWith("ward-capacity-network-row-"));
    expect(rendered.length).toBe(networkRows.length);
    for (const row of networkRows) {
      expect(within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`)).toBeInTheDocument();
    }
  });

  /*
   * ⚠️ **UPDATED 2026-09-05 BECAUSE THE SCREEN NOW STATES A ZERO IN WORDS, AND THE OLD ASSERTION
   * PINNED THE RENDERING RATHER THAN THE CLAIM.** It read `toHaveTextContent(String(row.ready))`
   * for every row, so it went red the moment three wards began reading "none" instead of "0" — a
   * legitimate change obeying the design rule this repo already applies two columns over. That is
   * the shape the standing policy warns about: a guard that fights a redesign gets deleted, and the
   * honest guards go with it in the same tidy-up.
   *
   * **What is asserted now is the CLAIM: each row states its ward's own real ready count.** The
   * word-for-zero transform is applied here as the test's own inverse of the component's, exactly
   * as the retired capacity board's test did, so a rewording of the absence does not break this but
   * a WRONG NUMBER still does.
   */
  it("names every ward's real ready and locked-ready counts in its own network row", () => {
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");

    /*
     * Floored: if no ward had a zero ready count, the word branch below would never be exercised
     * and this case would silently stop covering it. Three wards do today.
     */
    expect(
      networkRows.filter((row) => row.ready === 0).length,
      "no ward has a zero ready count, so the stated-absence branch is not being checked at all",
    ).toBeGreaterThan(0);

    for (const row of networkRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      const readyCell = within(tableRow).getByTestId("ward-capacity-network-ready");
      const pending = within(readyCell).queryByTestId("ward-capacity-network-pending");
      const figure = (readyCell.textContent ?? "").replace(pending?.textContent ?? "\u0000", "").trim();

      expect(figure, `${row.unit.id} has ${row.ready} ready bed(s) and its row does not say so`).toBe(
        row.ready === 0 ? "none" : String(row.ready),
      );

      // Both directions on the absence: the digit must not survive beside the word, or a cell
      // reading "0 none" would pass while still making the claim the rule forbids.
      if (row.ready === 0) expect(figure).not.toMatch(/0/u);

      /*
       * 🔴 **EXTENDED 2026-09-06 TO THE SAME RULE AS `ready`, ON THE OWNER'S RULING (census §8).**
       * This asserted `String(row.lockedReady)` while the Ready cell beside it said "none" — which
       * is exactly the inconsistency the ruling closed: three of 23 rows read `none · 0 · 0`.
       * Both directions here too, so a cell reading "0 none" cannot pass.
       */
      const lockedCell = within(tableRow).getByTestId("ward-capacity-network-locked");
      expect(lockedCell.textContent?.trim(), `${row.unit.id} has ${row.lockedReady} locked-ready bed(s)`).toBe(
        row.lockedReady === 0 ? "none" : String(row.lockedReady),
      );
      if (row.lockedReady === 0) expect(lockedCell.textContent ?? "").not.toMatch(/0/u);
    }
  });

  /**
   * ⚠️ THE TRAP THIS TEST IS FOR: `NetworkWardRow.freeing` is `number | undefined`, and it is
   * `undefined` on every row today (see the field's own doc comment in `capacity-derivations.ts`).
   * A screen that rendered a bare `{row.freeing}` here would print the literal word "undefined" —
   * or, worse, a naive `row.freeing ?? 0` would print a false "0", claiming nothing is freeing
   * today. Both are wrong; only a stated absence is honest. This walks every row the fixture
   * actually produces, rather than asserting the shape of one hand-picked row.
   */
  /**
   * ⚠️ **BOTH DIRECTIONS, because the first version pinned a MOMENT rather than a property.** It
   * asserted every row reads "not tracked" and floored on there being at least one untracked row —
   * true while `freeing` was undefined everywhere, and false the hour the derivation was wired to
   * the real bed releases. A test that fails when the product gets BETTER is one somebody deletes.
   *
   * The property that survives either state: a tracked row shows its real figure, an untracked row
   * says so in words, and neither ever renders "undefined" or a fabricated zero.
   *
   * 🔴 **AND THE SECOND VERSION STILL PINNED A PHRASE.** It matched the untracked arm against
   * `/not tracked/i` — the literal copy — which is the kind of guard that goes red on a legitimate
   * rewording and gets deleted with the honest ones beside it. Worse, that arm CANNOT RUN:
   * `CapacityScreen` reads `bedReleases` from `useWardFlow()`, typed `BedRelease[]` and never
   * `undefined`, so `networkWardRows` always returns a number. Measured here 2026-09-05: 23 rows,
   * 0 untracked, 15 of them showing a real `0`. A dead branch guarding a phrase was two problems
   * wearing one coat.
   *
   * Both arms now compare against `freeingCellText` — the module's own single decision, whose
   * absence branch is directly constructible and whose PROPERTY (a sentence, never a figure, never
   * "undefined") is proved exhaustively in `ward-capacity-derivations.test.ts`. This test's job is
   * the other half: that the screen defers to that decision rather than making its own. The two
   * halves together are what the phrase match was standing in for, and neither is a tautology on
   * its own — mutate the cell to `row.freeing ?? 0` and the tracked arm goes red here on the
   * fifteen wards whose real figure is not zero... which is why the tracked arm also asserts the
   * FIGURE independently, below, rather than only the helper's answer.
   */
  it("shows a real freeing figure where one exists and states the absence in words where it does not", () => {
    expect(networkRows.length, "no ward rows — this guard would prove nothing").toBeGreaterThan(5);
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");
    for (const row of networkRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      const cell = within(tableRow).getByTestId("ward-capacity-network-freeing");
      expect(cell, `${row.unit.id} rendered the literal word "undefined"`).not.toHaveTextContent(/undefined/iu);
      expect(cell?.textContent?.trim(), `${row.unit.id} does not render the module's own decision`).toBe(
        freeingCellText(row.freeing),
      );
      if (row.freeing === undefined) {
        // The property, restated at the screen so a future inline rewrite of the cell cannot pass:
        // an absent figure reads as a sentence, never as something a coordinator could take for a
        // count. Unreachable today (see the note above); reachable the day a ward stops reporting.
        const text = cell?.textContent?.trim() ?? "";
        expect(text, `${row.unit.id} states its absence with no words at all`).toMatch(/\p{L}/u);
        expect(Number(text), `${row.unit.id} states its absence as a figure`).toBeNaN();
      } else if (row.freeing === 0) {
        /*
         * 🔴 **A KNOWN ZERO IS THE WORD, NOT THE DIGIT — owner ruling 2026-09-06 (census §8).**
         * Asserted independently of `freeingCellText` on purpose: the equality above compares the
         * cell against the very helper the screen calls, so it would agree with any wording the
         * helper chose, including a wrong one. This arm and the absence arm are what make that
         * comparison mean something.
         *
         * ⚠️ **`"none"` AND `"Not tracked here"` STAY DIFFERENT STATEMENTS.** `0` is the ward
         * saying none; `undefined` is nobody having said. The branch above holds that half.
         */
        const text = cell?.textContent?.trim() ?? "";
        expect(text, `${row.unit.id} reports zero freeing and must say so in a word`).toBe("none");
        expect(text, `${row.unit.id} kept the digit beside the word`).not.toMatch(/0/u);
      } else {
        expect(cell, `${row.unit.id} should show its real figure ${row.freeing}`).toHaveTextContent(
          String(row.freeing),
        );
      }
    }
  });

  /**
   * The panel half of the same property. Asserts the FIGURE the panel reports, not the ARIA shape of
   * whatever renders it — a bar today, something else after a redesign, and this test does not care.
   *
   * 🔴 **THE UNTRACKED ARM WAS ASSERTING A PHRASE THE PANEL HAS NEVER CONTAINED.** It required
   * `/not tracked/i`; the panel's absence paragraph says "Nothing this screen reads can say how
   * many beds will free up before the day ends…" and the words "not tracked" appear nowhere in it.
   * That arm would have failed the moment it ran, and the only reason it never has is that
   * `freeingTracked` is true for every render the app can produce. **A wrong expectation hidden
   * behind an unreachable branch is worse than no expectation: it reads, to the next person, as
   * settled.**
   *
   * What it asserts instead are the two fabrications the field's own doc comment names — the
   * literal word "undefined", and a bare `0` presented as the total. Deliberately NOT a ban on the
   * WORD "zero": the real paragraph says "A zero here would claim nothing is freeing today", which
   * mentions a zero in order to explain why it is not shown. Banning the word would go red on the
   * most honest sentence on the screen.
   */
  it("reports the freeing total in its panels, or says the figure is not tracked", () => {
    const tracked = networkRows.map((row) => row.freeing).filter((value): value is number => value !== undefined);
    const total = tracked.reduce((sum, value) => sum + value, 0);
    renderScreen();
    const tab = screen.getByRole("tab", { name: "Beds freeing" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: "Beds freeing" });
    if (tracked.length === 0) {
      expect(panel, "nothing is tracked, so the panel must not print a bare 0 as the total").not.toHaveTextContent(
        /(?:^|\s)0(?:\s|$)/u,
      );
      expect(panel.textContent ?? "", "nothing is tracked, so the panel must say so in words").toMatch(/\p{L}/u);
    } else {
      expect(
        within(panel).getByRole("heading", { level: 3 }),
        `the panel should report the real total ${countCellText(total)}`,
      ).toHaveTextContent(countCellText(total));
    }
    expect(panel).not.toHaveTextContent(/undefined/iu);
  });

  it("puts every named person-fact behind a real unit, never a bare unresolved site code", () => {
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");
    // Every unit in this fixture resolves to a real site (`siteByCode`), so the fallback text
    // must never appear — proving the row reads the real site name rather than showing nothing.
    expect(within(table).queryByText(/No site matches/u)).toBeNull();
  });

  it("shows 'Worth your attention' with exactly the bed kinds that are short, and states the absence in words when none are", () => {
    const shortfalls = gapRows.filter((row) => row.gap < 0);
    renderScreen();
    fireEvent.click(screen.getByRole("tab", { name: "Attention" }));
    const panel = screen.getByRole("tabpanel", { name: "Attention" });
    if (shortfalls.length === 0) {
      expect(panel).toHaveTextContent(/no bed kind is short/iu);
    } else {
      for (const row of shortfalls) {
        expect(within(panel).getByText(row.need)).toBeInTheDocument();
      }
    }
  });

  it("keeps the whole-network mismatch facts unchanged while a ward is selected", () => {
    expect(networkRows.length, "no ward can be selected, so this comparison would be vacuous").toBeGreaterThan(0);
    renderScreen();
    const gapTable = screen.getByTestId("ward-capacity-gap-table");
    const beforeSelection = gapTable.textContent;
    expect(beforeSelection, "the mismatch table is empty, so selection cannot be compared").toBeTruthy();

    const wardTable = screen.getByTestId("ward-capacity-network-table");
    fireEvent.click(within(wardTable).getByRole("button", { name: networkRows[0].unit.name }));

    expect(screen.getByTestId("ward-capacity-gap-table").textContent).toBe(beforeSelection);
  });

  /**
   * 🔴 OWNER RULING 2026-09-05: a bed still being cleaned is FREE but not PULLABLE, and the screen
   * must say so beside the Ready figure without changing it. Ward Lead measured the harm: the
   * reducer rejects PULL_PATIENT with "every free bed at X is still being made ready", so a
   * coordinator could commit two patients and have the second refused at the moment of action,
   * after the ward had been told.
   *
   * Asserts the PROPERTY, not the sentence: wherever a pending figure exists the row states it and
   * the Ready number is unchanged; where none exists the row says nothing rather than "0".
   */
  it("states beds still being made ready beside the Ready figure, without altering it", () => {
    const withPending = networkRows.filter((row) => (row.pendingPreparation ?? 0) > 0);
    expect(withPending.length, "no ward has a bed being made ready — this would be vacuous").toBeGreaterThan(0);
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");
    for (const row of withPending) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      expect(
        within(tableRow).getByTestId("ward-capacity-network-ready"),
        `${row.unit.id}: the Ready figure itself must not change`,
      ).toHaveTextContent(String(row.ready));
      expect(
        within(tableRow).getByTestId("ward-capacity-network-pending"),
        `${row.unit.id} has ${row.pendingPreparation} being made ready and must say so`,
      ).toHaveTextContent(String(row.pendingPreparation));
    }
    for (const row of networkRows.filter((r) => (r.pendingPreparation ?? 0) === 0)) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      expect(
        within(tableRow).queryByTestId("ward-capacity-network-pending"),
        `${row.unit.id} has none pending and must not render a bare zero`,
      ).toBeNull();
    }
  });

  /**
   * 🔴 WHO CONFIRMED THE FIGURE — a clinical property my fold dropped, guarded here on the LIVE
   * screen because the test that used to guard it now renders a mode no route reaches.
   *
   * `source === "ward"` means the ward itself stood behind the number; anything else means it was
   * derived from a feed. A coordinator ringing a ward about its own figure needs to know which.
   * Asserts the PROPERTY against the fixture, not the sentence: a ward-sourced row names the ward,
   * a derived row does not claim one.
   */
  it("says who confirmed each capacity figure, and never attributes a derived one to a ward", () => {
    const wardSourced = networkRows.filter((row) => row.unit.allocatable.source === "ward");
    expect(wardSourced.length, "no ward-sourced figure — this assertion would be vacuous").toBeGreaterThan(0);
    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");
    for (const row of wardSourced) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      expect(tableRow, `${row.unit.id} is ward-confirmed and must name the ward`).toHaveTextContent(row.unit.name);
    }
    for (const row of networkRows.filter((r) => r.unit.allocatable.source !== "ward")) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      const stamp = within(tableRow).queryByText(/Confirmed .* · /u);
      expect(stamp, `${row.unit.id} is derived and must not be attributed to a ward`).toBeNull();
    }
  });
});

/*
 * 🔴 **TWO FIGURES ON ONE SCREEN MUST NOT SHARE A LABEL WHEN THEY COUNT DIFFERENT THINGS.**
 *
 * Found by Ward Verifier on 2026-09-06, by sweeping for the label rather than by eye:
 *
 *     "Ready now" bar key   Locked ready  8   -> 8 locked BEDS
 *     the ward filter chip  Locked ready  7   -> 7 WARDS holding one
 *
 * Both visible at once, in identical words, with nothing to tell them apart. A coordinator reading
 * 7 under 8 has no way to know these are different quantities rather than one figure disagreeing
 * with itself — and noticing exactly that kind of disagreement is what the screen is for.
 *
 * ⚠️ **THIS IS A PROPERTY, NOT A PIN ON THE PHRASE THAT HAPPENED TO COLLIDE.** Asserting the new
 * wording would go green the day somebody reintroduces the collision under different words. What is
 * asserted is that the two groups share NO label at all: the bar's key counts beds, every filter
 * chip counts wards, so any label common to both is a units collision whatever it says.
 *
 * The floor matters as much as the assertion. Both sets must be non-empty and must genuinely
 * differ in size — if the bar ever rendered no key, or the filters no chips, an intersection of
 * nothing would pass while proving nothing.
 */
describe("the Capacity screen never labels a bed count and a ward count with the same words", () => {
  function labelsIn(container: HTMLElement, selector: string): string[] {
    return (
      Array.from(container.querySelectorAll(selector))
        .map((node) => (node.textContent ?? "").replace(/\s+/gu, " ").trim())
        // Both a key item and a filter chip render "<label> <count>"; the count is what differs
        // between them and is not part of the name being compared.
        .map((text) => text.replace(/\s*\d+\s*$/u, "").trim())
        .filter((text) => text !== "")
    );
  }

  it("has a bar key and a filter group to compare, or the intersection below is vacuous", () => {
    renderScreen();
    const bar = document.querySelector('[data-ward-primitive="bar"]') as HTMLElement;
    const filters = document.querySelector('[data-ward-primitive="filters"]') as HTMLElement;
    expect(bar, "no WardBar on the capacity screen — this guard has nothing to stand over").not.toBeNull();
    expect(filters, "no filter group on the capacity screen").not.toBeNull();
    expect(labelsIn(bar, "li").length, "the bar renders no key items").toBeGreaterThan(0);
    expect(labelsIn(filters, "button").length, "the filter group renders no chips").toBeGreaterThan(0);
  });

  it("shares no label between the bed-counting bar key and the ward-counting filter chips", () => {
    renderScreen();
    const barLabels = labelsIn(document.querySelector('[data-ward-primitive="bar"]') as HTMLElement, "li");
    const chipLabels = labelsIn(document.querySelector('[data-ward-primitive="filters"]') as HTMLElement, "button");
    const shared = barLabels.filter((label) => chipLabels.includes(label));

    expect(
      shared,
      "these words label a BED count in the bar and a WARD count in the filters, on screen at the " +
        "same time. Rename one — the numbers are both correct and neither should move.",
    ).toEqual([]);
  });
  /**
   * 🔴 **A WARD'S NAME IS NOT A FIGURE, AND IT SAT IN A CODE FACE.** `.attentionWho` renders
   * `row.unit.name` ("Ward 2K", "Graylands Older Adult") and `row.need` ("A locked adult
   * bed"). **Measured in a browser rather than inferred: 11 text nodes carrying this class on this
   * screen, all 11 prose, not one containing a digit.** Removed 2026-09-06 with Ward Lead's approval,
   * immediately after the same face came off `.panelCount` — because the two sit in the same view,
   * and a half-corrected screen reads as a mistake where a wholly uncorrected one reads as a style.
   *
   * ⚠️ **UNLIKE `.panelCount`, THERE IS NO DESIGNED HALF TO KEEP HERE, AND THAT ABSENCE IS THE
   * EVIDENCE.** That rule carried `font-variant-numeric: tabular-nums`, and preserving it was the
   * whole difference between a fix and a regression. This rule never had one — because nothing in
   * this slot was ever a number. The face was applied without anyone asking what the slot holds.
   *
   * ⚠️ **THE LINE WAS DRAWN DELIBERATELY AND THIS GUARD DOES NOT POLICE THE OTHERS.**
   * `var(--font-mono)` is set in 26 further declarations across ward stylesheets. Some are correct:
   * `ward-bar.module.css`'s `.count` holds only bare figures (measured: 6 nodes across two screens,
   * every one a digit string) and a figure column is what a code face is FOR. Blanket-removing it
   * would be the regression this project keeps nearly making.
   *
   * Reads the stylesheet because jsdom applies no CSS-module styles, so `getComputedStyle` on a
   * rendered node reports nothing about this declaration. Named as the weakness it is: it guards the
   * declaration returning to this rule, not the rendered face.
   */
  it("never sets a code face on the slot that holds ward names", () => {
    const css = readFileSync("src/components/ward-management/capacity/capacity.module.css", "utf8");
    const rule = /^\.attentionWho\s*\{([^}]*)\}/mu.exec(css);
    expect(rule, "no .attentionWho rule found — the assertion below would be vacuous").not.toBeNull();

    expect(
      (rule as RegExpExecArray)[1],
      "a font-family is back on the slot that renders ward names and bed-kind needs. Every one of " +
        "the 11 nodes carrying this class is prose with no digit in it, so a code face here is a " +
        "hospital's name typeset as though it were a reference number.",
    ).not.toMatch(/font-family/u);
  });
  /**
   * 🔴 **ONE ROW MUST NOT SPELL ZERO TWO WAYS — owner ruling 2026-09-06, closing census §8.**
   *
   * When `ready === 0` began rendering the word and the neighbouring columns did not, three of the
   * 23 rows read **`none · 0 · 0`**. Kununurra Adult Open was the clean case: three zero counts on
   * one line, one a word and two digits, with nothing on screen saying they mean the same thing.
   * **A difference that looks deliberate is read as meaning something.** I caused it with a fix that
   * was right about one cell and silent about its neighbours.
   *
   * ⚠️ **THE PROPERTY IS PER ROW, NOT PER COLUMN, AND THAT IS THE WHOLE POINT.** Every existing test
   * over this table reads one column at a time, so no assertion anywhere ever put the two spellings
   * on the same line — which is the only place the problem existed. Asserting "Ready says none" and
   * "Locked says none" separately would pass on a board that mixed them.
   *
   * ⚠️ **`"Not tracked here"` IS NOT IN SCOPE AND MUST NOT BE FOLDED IN.** `undefined` means nobody
   * told this screen; `0` means the ward told us and the answer is none. Those are different
   * statements and collapsing them would fabricate a fact.
   */
  it("never spells a known zero two ways on the same ward's row", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CapacityScreen />
      </WardFlowProvider>,
    );

    const table = screen.getByTestId("ward-capacity-network-table");
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    expect(rows.length, "no ward rows rendered — this guard would prove nothing").toBeGreaterThan(10);

    const mixed: string[] = [];
    let sawAZero = 0;
    for (const row of rows) {
      const cells = ["ward-capacity-network-ready", "ward-capacity-network-locked", "ward-capacity-network-freeing"]
        .map((id) => row.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? "")
        // The pending-preparation note lives inside the Ready cell; the figure is its first line.
        .map((text) => text.split(/\r?\n/u)[0].trim());
      const words = cells.filter((t) => t === "none").length;
      const digits = cells.filter((t) => /^0\b/u.test(t)).length;
      if (words + digits > 0) sawAZero += 1;
      if (words > 0 && digits > 0) mixed.push(`${row.textContent?.slice(0, 30)} -> ${cells.join(" | ")}`);
    }

    // Floor on the POPULATION, never on the findings: a board with no zero at all would pass the
    // assertion below while proving nothing about how a zero is spelled.
    expect(sawAZero, "no ward row reports a zero in any of the three columns — nothing was checked").toBeGreaterThan(0);

    expect(
      mixed,
      "these rows spell zero as a word in one column and a digit in another, on the same line. " +
        "Nothing on screen says the two mean the same thing, so a reader has to assume they do not.",
    ).toEqual([]);
  });
});

/**
 * 🔴 **TASK 1, 2026-09-07, BUILT A CHIP THAT HID WARDS — AND THE OWNER RULED THAT OUT.** Task 1's
 * own report flagged the conflict before shipping it: a chip that removes a ward from Capacity's
 * statewide board is the same shape as the metro/rural toggle the owner already declined, twice,
 * for exactly that reason (`ward-management-network.tsx` and `referral-match.tsx` both record it).
 * Task 1b's ruling: **a chip on this board highlights, it never hides.**
 *
 * This describe block replaces Task 1's "actually filter the table" tests with "actually highlight
 * the table, and never remove a row" — the same wiring proof (a click really does something), now
 * pointed at the correct behaviour.
 */
describe("the Capacity network filter chips highlight the matching wards and never remove a row", () => {
  it("clicking 'Has a bed ready' marks exactly its own population and leaves every ward, including the excluded one, on the table", () => {
    const readyRows = networkRows.filter((row) => row.ready > 0);
    // Anti-vacuity floor: the filter must both have something to mark AND leave something
    // unmarked, or this test cannot tell a wired handler from a dead one that marks everything or
    // nothing regardless of which chip is pressed.
    expect(readyRows.length, "no ward has a ready bed in this fixture — this floor is vacuous").toBeGreaterThan(0);
    expect(
      readyRows.length,
      "every ward has a ready bed in this fixture — highlighting cannot be proven to mark a subset",
    ).toBeLessThan(networkRows.length);

    renderScreen();
    const chip = screen.getByRole("button", { name: `Has a bed ready ${readyRows.length}` });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");

    // The header states the WHOLE board and, separately, how many the chip matches — never one
    // figure standing in for the other. See the screen's own comment on this panel's count.
    const region = screen.getByRole("region", { name: "Wards" });
    const countEl = region.querySelector("[data-ward-panel-count]");
    expect(countEl?.textContent, "the header no longer states the whole board's own count").toContain(
      `${networkRows.length} ${networkRows.length === 1 ? "ward" : "wards"}`,
    );
    expect(countEl?.textContent, "the header does not say separately how many wards match").toContain(
      `${readyRows.length} matching`,
    );

    const table = within(region).getByTestId("ward-capacity-network-table");
    const renderedRows = within(table)
      .getAllByRole("row")
      .filter((row) => row.getAttribute("data-testid")?.startsWith("ward-capacity-network-row-"));
    expect(
      renderedRows.length,
      "a chip changed how many wards are on the table — this board must never hide a bed",
    ).toBe(networkRows.length);

    // Every row is present, and marked (attribute AND word) exactly according to the predicate —
    // both directions, so a row cannot be marked "true" without the word or "false" while carrying it.
    for (const row of networkRows) {
      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      const shouldMatch = row.ready > 0;
      expect(tableRow, `${row.unit.id} should be marked matches=${shouldMatch}`).toHaveAttribute(
        "data-ward-network-row-matches",
        shouldMatch ? "true" : "false",
      );
      expect(
        within(tableRow).queryByText(/Matches this filter/iu) !== null,
        `${row.unit.id}: expected the "Matches this filter" word to be present=${shouldMatch}`,
      ).toBe(shouldMatch);
    }

    // The ward the OLD (Task 1) hiding behaviour would have removed from the table entirely.
    const excluded = networkRows.find((row) => row.ready === 0);
    expect(excluded, "no ward lacks a ready bed — nothing here proves a hidden ward would be caught").toBeDefined();
    if (excluded) {
      expect(
        within(table).getByTestId(`ward-capacity-network-row-${excluded.unit.id}`),
        "a non-matching ward was removed from the table — this is the exact defect the owner ruled against",
      ).toBeInTheDocument();
    }
  });

  /**
   * 🔴 **THE RULING WRITTEN DOWN AS A TEST, PER THE BRIEF.** Walks every chip the screen renders —
   * not just "Has a bed ready" — and asserts the row COUNT never moves and every ward's row stays
   * reachable, floored so an empty filter group or an empty ward list cannot pass this vacuously.
   */
  it("never removes a ward from the network table, on any chip", () => {
    renderScreen();
    const region = screen.getByRole("region", { name: "Wards" });
    const table = within(region).getByTestId("ward-capacity-network-table");
    const filterGroup = screen.getByRole("group", { name: "Highlight wards" });
    const chips = within(filterGroup).getAllByRole("button");

    expect(chips.length, "fewer than two chips exist — switching between them proves nothing").toBeGreaterThan(1);
    expect(networkRows.length, "no ward rows at all — the row count below would be vacuous").toBeGreaterThan(0);

    for (const chip of chips) {
      fireEvent.click(chip);
      const renderedRows = within(table)
        .getAllByRole("row")
        .filter((row) => row.getAttribute("data-testid")?.startsWith("ward-capacity-network-row-"));
      expect(renderedRows.length, `chip "${chip.textContent}" changed the rendered row count`).toBe(networkRows.length);
      for (const row of networkRows) {
        expect(
          within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`),
          `chip "${chip.textContent}" removed ${row.unit.id} from the table`,
        ).toBeInTheDocument();
      }
    }
  });

  /**
   * 🔴 **THE BED MAP DRAWS EVERY UNIT UNCONDITIONALLY (`bed-map.tsx`), SO ITS PANEL COUNT MUST
   * NEVER FOLLOW A SELECTION.** A header reading "40 beds" over a map drawing 303 is exactly the
   * units-collision incident this screen's own comments already record once (the bed-count vs
   * ward-count mix-up above); pinned here so a future change that makes this panel read from a
   * filtered figure is caught immediately rather than found by eye on the running page.
   */
  it("keeps the bed map's panel count constant across every chip", () => {
    renderScreen();
    const bedMapRegion = screen.getByRole("region", { name: "Bed map" });
    const initialCount = bedMapRegion.querySelector("[data-ward-panel-count]")?.textContent;
    expect(initialCount, "the bed map panel renders no count at all — this guard has nothing to pin").toBeTruthy();
    expect(initialCount, "the bed map count should name beds, not wards").toBe(`${netTotals.beds} beds`);

    const filterGroup = screen.getByRole("group", { name: "Highlight wards" });
    const chips = within(filterGroup).getAllByRole("button");
    expect(
      chips.length,
      "fewer than two chips exist — this proves nothing about following a selection",
    ).toBeGreaterThan(1);

    for (const chip of chips) {
      fireEvent.click(chip);
      const count = bedMapRegion.querySelector("[data-ward-panel-count]")?.textContent;
      expect(count, `chip "${chip.textContent}" changed the bed map's panel count`).toBe(initialCount);
    }
  });
});

/**
 * 🔴 **ITEM B — THE MISSING SCROLL AFFORDANCE.** `WardTable`'s `hasScrollThreshold` renders a
 * visible wrapper border plus the sentence "This table scrolls sideways on narrow screens." for a
 * caller that has declared a `--ward-table-min-width`. The Wards table retains its scroll floor;
 * the third-edition mismatch band wraps into columns and no longer needs horizontal scrolling.
 */
describe("Capacity's tables declare the scroll affordance they have earned", () => {
  it("declares horizontal scrolling only when additional columns are requested", () => {
    renderScreen();
    expect(screen.getByTestId("ward-capacity-network-table")).not.toHaveAttribute("data-ward-scroll-hint");
    fireEvent.click(screen.getByRole("button", { name: "More columns" }));
    expect(screen.getByTestId("ward-capacity-network-table")).toHaveAttribute("data-ward-scroll-hint", "true");
    expect(screen.getByTestId("ward-capacity-gap-table")).not.toHaveAttribute("data-ward-scroll-hint", "true");
  });

  it("shows one scroll notice in the expanded view and removes it when returning to compact", () => {
    renderScreen();
    expect(screen.queryByText("This table scrolls sideways on narrow screens.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More columns" }));
    // The responsive mismatch band must not falsely advertise horizontal scrolling.
    expect(screen.getAllByText("This table scrolls sideways on narrow screens.")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Key columns" }));
    expect(screen.queryByText("This table scrolls sideways on narrow screens.")).not.toBeInTheDocument();
  });
});

describe("tomorrow's beds forecast", () => {
  it("shows the 24 and 48 hour estimates from bedsForecast, with the working and its limits", () => {
    const seeded = seedWardFlowState();
    const forecast = bedsForecast(seeded.units, seeded.bedReleases, seeded.admissions, seeded.movements, NOW_ANCHOR);
    renderScreen();
    const panel = screen.getByTestId("ward-capacity-beds-forecast");
    for (const entry of forecast.horizons) {
      expect(within(panel).getByTestId(`ward-capacity-beds-forecast-${entry.hours}h-likely`)).toHaveTextContent(
        forecastHeadline(entry.likely),
      );
    }
    expect(within(panel).getAllByText("How this was worked out")).toHaveLength(2);
    expect(within(panel).getByText(/not predicted/)).toBeInTheDocument();
  });
});
