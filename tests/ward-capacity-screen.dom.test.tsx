import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation.
import "@testing-library/jest-dom/vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { BEDS_FORECAST_LIMITS, bedsForecast } from "@/components/ward-management/capacity/beds-forecast";
import {
  bedKindGaps,
  bedKindTotals,
  countCellText,
  networkTotals,
  freeingCellText,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { capacityConfirmer } from "@/components/ward-management/capacity/capacity-confirmer";
import { shortNeed } from "@/components/ward-management/capacity/capacity-mismatch-band";
import { gapWords } from "@/components/ward-management/capacity/capacity-range-line";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * MERGE 02 — the ward-confirmed capacity view and the morning bed-state board become one screen
 * answering one question: where is a bed KIND short across the network?
 *
 * Capacity redesign (Josh, 31 Oct 2026): the same question, on a new layout. The mismatch by bed
 * type is the "Mismatch" card (one tile per type), the network total is the bed forecast's "Now"
 * figure, the ready split is the hero's chips, and each ward is a bed map card that opens its ward
 * drawer. The gap table, the network ward table, the "Ready now" panel, the Beds freeing / Attention
 * tabs and the table's scroll notices were removed by the redesign; cases that pinned only those are
 * retired below, on the record, and every fact they carried is read where it now lives.
 *
 * ⚠️ Every expected value below comes from calling the same derivation functions the screen itself
 * calls (`bedKindGaps`, `bedKindTotals`, `networkWardRows`, `networkTotals`), against the real
 * fixture — never a hand-written number. A hand-written expectation is the thing that goes stale
 * the day the fixture changes, and it goes stale by passing.
 */
const NOW = NOW_ANCHOR;
// CapacityScreen reads the full seeded state that WardFlowProvider populates
// (`seedWardFlowState()`), not the raw fixture arrays: the seed additively overlays demonstration
// movements (ward-rulings-demo.ts), and using the raw arrays undercounted every gap figure once.
const seed = seedWardFlowState();
const units = seed.units;
// ⚠️ THE SAME ARGUMENTS THE SCREEN USES (`useCapacityModel` in `capacity-model.ts`). A test that
// calls the production function with DIFFERENT arguments from the caller is testing a configuration
// nothing ships: this file once read `networkWardRows(units, NOW)` while the screen passed
// `bedReleases`, and two tests failed while both sides were individually correct.
const gapRows = bedKindGaps(seed.movements, units, NOW, seed.admissions);
const gapTotals = bedKindTotals(gapRows);
const networkRows = networkWardRows(units, NOW, seed.bedReleases, seed.admissions, seed.leaveBeds);
const netTotals = networkTotals(networkRows);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** A ward card's visible name: its text without the spelled-out code a screen reader hears. */
function visibleName(element: Element | null): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("abbr + span").forEach((node) => node.remove());
  return (clone.textContent ?? "").trim();
}

function bedMap(): HTMLElement {
  const map = document.getElementById("capacity-bed-map");
  if (!map) throw new Error("no bed map on the Capacity screen");
  return map;
}

/** Every ward card on the bed map, folded service groups included (they stay mounted, hidden). */
function wardCards(): HTMLElement[] {
  return Array.from(bedMap().querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]'));
}

function cardsOf(unit: { name: string }): HTMLElement[] {
  return wardCards().filter((card) => visibleName(card.firstElementChild) === unit.name);
}

function isDimmed(card: HTMLElement): boolean {
  return /dimmed/u.test(card.className);
}

/** Opens a ward's drawer from its bed map card, as a coordinator would. */
function openWardDrawer(unit: { id: string; name: string }): HTMLElement {
  const [card] = cardsOf(unit);
  if (!card) throw new Error(`no bed map card for ${unit.id}`);
  fireEvent.click(card);
  const drawer = screen.getByTestId("ward-capacity-ward-drawer");
  expect(drawer).toHaveAccessibleName(unit.name);
  return drawer;
}

/** The drawer's "Beds now" section: the ready figure, the bed squares and the notes line. */
function bedsNow(drawer: HTMLElement) {
  const section = within(drawer).getByRole("region", { name: "Beds now" });
  return {
    section,
    figure: section.querySelector("p span")?.textContent ?? "",
    notes: Array.from(section.querySelectorAll("p")).at(-1)?.textContent ?? "",
  };
}

function drawerFact(drawer: HTMLElement, label: string): HTMLElement {
  const value = within(drawer).getByText(label, { selector: "dt" }).nextElementSibling;
  if (!value) throw new Error(`no value beside "${label}"`);
  return value as HTMLElement;
}

/** The Mismatch card's tile for one bed type, found by its title. */
function mismatchTile(need: string): HTMLElement {
  const card = screen.getByRole("region", { name: "Mismatch" });
  const title = within(card).getByRole("heading", { level: 3, name: shortNeed(need) });
  return title.closest("li") as HTMLElement;
}

/** The tile's "now" figure, beside its title (the Tomorrow line under it is a different figure). */
function tileNow(tile: HTMLElement): string {
  return tile.querySelector("h3")?.nextElementSibling?.textContent?.trim() ?? "";
}

/** One of the bed forecast's three figures ("Now", "Tomorrow", "In 48 hours"): value and sub-line. */
function forecastFigure(label: string): { value: string; sub: string } {
  const forecast = screen.getByRole("region", { name: "Bed forecast" });
  const term = within(forecast)
    .getAllByRole("term")
    .find((dt) => dt.firstChild?.textContent === label || dt.textContent?.trim().startsWith(label));
  if (!term) throw new Error(`the bed forecast has no "${label}" figure`);
  const [value, sub] = Array.from(term.nextElementSibling?.children ?? []);
  return { value: value?.textContent ?? "", sub: sub?.textContent ?? "" };
}

function heroChips() {
  return within(screen.getByRole("group", { name: "Network beds" }));
}

function highlightChips(): HTMLElement[] {
  return within(screen.getByRole("group", { name: "Highlight wards" })).getAllByRole("button");
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
    // The hero title reads "Capacity, N beds ready of M" (the first word is screen-reader only).
    expect(screen.getByRole("heading", { level: 1, name: /^Capacity,/u })).toBeInTheDocument();
  });

  it("shows the ready-bed split in the hero, whose numbers are the real locked/open sums, never invented", () => {
    const totalLocked = networkRows.reduce((sum, row) => sum + row.lockedReady, 0);
    const totalReady = netTotals.ready;
    expect(totalReady, "no ready bed in the fixture — this guard proved nothing").toBeGreaterThan(0);
    renderScreen();
    expect(screen.getByRole("heading", { level: 1 }).textContent?.replace(/\s+/gu, " ").trim()).toBe(
      `Capacity, ${totalReady} beds ready of ${netTotals.beds}`,
    );
    expect(heroChips().getByRole("button", { name: /Locked ready/u })).toHaveTextContent(
      new RegExp(`^${totalLocked}\\s*Locked ready$`, "u"),
    );
    expect(heroChips().getByRole("button", { name: /Open ready/u })).toHaveTextContent(
      new RegExp(`^${totalReady - totalLocked}\\s*Open ready$`, "u"),
    );
  });

  it("renders exactly the four bed-type tiles the derivations return, each with its own real waiting and beds-that-fit", () => {
    renderScreen();
    const card = screen.getByRole("region", { name: "Mismatch" });
    expect(within(card).getAllByRole("heading", { level: 3 })).toHaveLength(gapRows.length);
    for (const row of gapRows) {
      expect(mismatchTile(row.need), `tile ${row.id}`).toHaveTextContent(
        `${row.waiting} waiting · ${row.bedsThatFit} ready that fit`,
      );
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
    for (const row of shortfallRows) {
      // A glyph, the size of the gap and the word: "6 short". The magnitude is real too.
      expect(tileNow(mismatchTile(row.need)), `tile ${row.id}`).toBe(`${Math.abs(row.gap)} short`);
    }
  });

  it("shows a non-negative gap as 'exactly enough' or 'N spare' in words, never the word 'short'", () => {
    const nonNegativeRows = gapRows.filter((row) => row.gap >= 0);
    expect(nonNegativeRows.length, "the fixture has no non-negative row — this guard proved nothing").toBeGreaterThan(
      0,
    );
    renderScreen();
    for (const row of nonNegativeRows) {
      const now = tileNow(mismatchTile(row.need));
      expect(now, `tile ${row.id}`).not.toMatch(/short/iu);
      expect(now, `tile ${row.id}`).toBe(row.gap === 0 ? "exactly enough" : `${row.gap} spare`);
    }
  });

  // The "all four together" total row went with the gap table. The redesign states it once, as the
  // bed forecast's "Now" figure (the Mismatch card says so in its own comment).
  it("shows the 'all four together' total as the forecast's Now figure, matching bedKindTotals exactly", () => {
    renderScreen();
    const now = forecastFigure("Now");
    expect(now.value).toBe(gapWords(gapTotals.gap));
    expect(now.sub).toBe(`${gapTotals.waiting} waiting · ${gapTotals.bedsThatFit} fit`);
  });

  it("draws every network ward exactly once on the bed map, with an honest ward count in the hero", () => {
    renderScreen();
    expect(
      screen.getByText(new RegExp(`· ${networkRows.length} wards? ·`, "u")),
      "the hero does not say how many wards it counts",
    ).toBeInTheDocument();
    expect(wardCards()).toHaveLength(networkRows.length);
    for (const row of networkRows) {
      expect(cardsOf(row.unit), `${row.unit.id} is not on the bed map exactly once`).toHaveLength(1);
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
   * **What is asserted now is the CLAIM: each ward states its own real ready count**, on its bed
   * map card and in its drawer (the table row it was written against went with the redesign). The
   * word-for-zero transform is applied here as the test's own inverse of the component's, exactly
   * as the retired capacity board's test did, so a rewording of the absence does not break this but
   * a WRONG NUMBER still does.
   */
  it("names every ward's real ready count on its card and in its drawer", () => {
    renderScreen();

    /*
     * Floored: if no ward had a zero ready count, the word branch below would never be exercised
     * and this case would silently stop covering it. Three wards do today.
     */
    expect(
      networkRows.filter((row) => row.ready === 0).length,
      "no ward has a zero ready count, so the stated-absence branch is not being checked at all",
    ).toBeGreaterThan(0);

    for (const row of networkRows) {
      const [card] = cardsOf(row.unit);
      // The card spells a known zero as a word too (its own capital, as it leads the line).
      const cardFigure = card?.querySelector("b")?.textContent?.trim() ?? "";
      expect(cardFigure.toLowerCase(), `${row.unit.id}'s card does not show its ready count`).toBe(
        countCellText(row.ready).toLowerCase(),
      );
      if (row.ready === 0) expect(cardFigure).not.toMatch(/0/u);

      const { figure } = bedsNow(openWardDrawer(row.unit));
      expect(figure, `${row.unit.id} has ${row.ready} ready bed(s) and its drawer does not say so`).toBe(
        row.ready === 0 ? "none" : String(row.ready),
      );
      // Both directions on the absence: the digit must not survive beside the word, or a figure
      // reading "0 none" would pass while still making the claim the rule forbids.
      if (row.ready === 0) expect(figure).not.toMatch(/0/u);
    }
    /*
     * RETIRED 31 Oct 2026 with the network ward table: the per-ward locked-ready column. No single
     * ward's locked figure is drawn on the redesigned screen; the hero's network sum is asserted
     * above and the bed map's "Locked ready" highlight marks the wards holding one.
     */
  });

  /**
   * ⚠️ THE TRAP THIS TEST IS FOR: `NetworkWardRow.freeing` is `number | undefined`, and it is
   * `undefined` on every row today (see the field's own doc comment in `capacity-derivations.ts`).
   * A screen that rendered a bare `{row.freeing}` (now the drawer's "Freeing today") would print the literal word "undefined" —
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
    for (const row of networkRows) {
      const cell = drawerFact(openWardDrawer(row.unit), "Freeing today");
      expect(cell, `${row.unit.id} rendered the literal word "undefined"`).not.toHaveTextContent(/undefined/iu);
      expect(cell.textContent?.trim(), `${row.unit.id} does not render the module's own decision`).toBe(
        freeingCellText(row.freeing),
      );
      if (row.freeing === undefined) {
        // The property, restated at the screen so a future inline rewrite of the cell cannot pass:
        // an absent figure reads as a sentence, never as something a coordinator could take for a
        // count. Unreachable today (see the note above); reachable the day a ward stops reporting.
        const text = cell.textContent?.trim() ?? "";
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
        const text = cell.textContent?.trim() ?? "";
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
   * The total half of the same property, now the hero's "Due out today" chip (the "Beds freeing"
   * tab that used to carry it went with the redesign). Asserts the FIGURE, and the two fabrications
   * `NetworkWardRow.freeing`'s own doc comment names — the literal word "undefined", and a bare `0`
   * presented as the total when nothing is tracked.
   */
  it("reports the freeing total in the hero, or says the figure is not tracked", () => {
    const tracked = networkRows.map((row) => row.freeing).filter((value): value is number => value !== undefined);
    const total = tracked.reduce((sum, value) => sum + value, 0);
    renderScreen();
    const chip = heroChips().getByText("Due out today").parentElement as HTMLElement;
    const value = chip.firstElementChild?.textContent ?? "";
    if (tracked.length === 0) {
      expect(value, "nothing is tracked, so the hero must not print a bare 0 as the total").not.toMatch(/^\s*0\s*$/u);
      expect(value, "nothing is tracked, so the hero must say so in words").toMatch(/\p{L}/u);
    } else {
      expect(value, `the hero should report the real total ${total}`).toBe(String(total));
    }
    expect(chip).not.toHaveTextContent(/undefined/iu);
  });

  it("puts every ward behind a real hospital and service, never a bare unresolved site code", () => {
    renderScreen();
    // Every unit in this fixture resolves to a real site (`siteByCode`), so the fallback text
    // must never appear — proving the drawer reads the real site rather than showing nothing.
    for (const row of networkRows) {
      const site = siteByCode(row.unit.siteCode);
      expect(site, `${row.unit.id}'s site code resolves to no site`).toBeDefined();
      const drawer = openWardDrawer(row.unit);
      expect(drawer).toHaveAccessibleDescription(new RegExp(` · ${escapeRegExp(site!.service)}$`, "u"));
      expect(drawer).not.toHaveAccessibleDescription(/No site matches|Service not recorded/u);
    }
  });

  // "Needs you" was the Attention tab, removed by the redesign. The Mismatch card's "Short" filter is
  // the same list: exactly the bed types that are short, or the absence in words.
  it("shows exactly the bed types that are short under 'Short', and states the absence in words when none are", () => {
    const shortfalls = gapRows.filter((row) => row.gap < 0);
    renderScreen();
    const card = screen.getByRole("region", { name: "Mismatch" });
    fireEvent.click(within(card).getByRole("radio", { name: /^Short/u }));
    if (shortfalls.length === 0) {
      expect(card).toHaveTextContent(/no bed type is short/iu);
    } else {
      expect(
        within(card)
          .getAllByRole("heading", { level: 3 })
          .map((heading) => heading.textContent),
      ).toEqual(shortfalls.map((row) => shortNeed(row.need)));
    }
  });

  it("keeps the whole-network mismatch facts unchanged while a ward is selected", () => {
    expect(networkRows.length, "no ward can be selected, so this comparison would be vacuous").toBeGreaterThan(0);
    renderScreen();
    const mismatch = () => screen.getByRole("region", { name: "Mismatch" }).textContent;
    const forecast = () => screen.getByRole("region", { name: "Bed forecast" }).textContent;
    const beforeSelection = [mismatch(), forecast()];
    expect(beforeSelection[0], "the mismatch card is empty, so selection cannot be compared").toBeTruthy();

    openWardDrawer(networkRows[0]!.unit);

    expect([mismatch(), forecast()]).toEqual(beforeSelection);
  });

  /**
   * 🔴 OWNER RULING 2026-09-05: a bed still being cleaned is FREE but not PULLABLE, and the screen
   * must say so beside the Ready figure without changing it. Ward Lead measured the harm: the
   * reducer rejects PULL_PATIENT with "every free bed at X is still being made ready", so a
   * coordinator could commit two patients and have the second refused at the moment of action,
   * after the ward had been told.
   *
   * Asserts the PROPERTY, not the sentence: wherever a pending figure exists the ward's drawer states it and
   * the Ready number is unchanged; where none exists it says nothing rather than "0".
   */
  it("states beds still being made ready beside the Ready figure, without altering it", () => {
    const withPending = networkRows.filter((row) => (row.pendingPreparation ?? 0) > 0);
    expect(withPending.length, "no ward has a bed being made ready — this would be vacuous").toBeGreaterThan(0);
    renderScreen();
    for (const row of withPending) {
      const { figure, notes } = bedsNow(openWardDrawer(row.unit));
      expect(figure, `${row.unit.id}: the Ready figure itself must not change`).toBe(countCellText(row.ready));
      expect(notes, `${row.unit.id} has ${row.pendingPreparation} being made ready and must say so`).toContain(
        `${row.pendingPreparation} being made ready`,
      );
    }
    for (const row of networkRows.filter((r) => (r.pendingPreparation ?? 0) === 0)) {
      const { notes } = bedsNow(openWardDrawer(row.unit));
      expect(notes, `${row.unit.id} has none pending and must not render a bare zero`).not.toMatch(/being made ready/u);
    }
  });

  /**
   * 🔴 WHO CONFIRMED THE FIGURE — a clinical property my fold dropped, guarded here on the LIVE
   * screen because the test that used to guard it now renders a mode no route reaches.
   *
   * `source === "ward"` means the ward itself stood behind the number; anything else means it was
   * derived from a feed. A coordinator ringing a ward about its own figure needs to know which.
   * Asserts the PROPERTY against the fixture, not the sentence: a ward-sourced figure names who
   * confirmed it, a derived one does not claim anyone. Read in each ward's drawer since the redesign.
   */
  it("says who confirmed each capacity figure, and never attributes a derived one to a ward", () => {
    const wardSourced = networkRows.filter((row) => row.unit.allocatable.source === "ward");
    expect(wardSourced.length, "no ward-sourced figure — this assertion would be vacuous").toBeGreaterThan(0);
    renderScreen();
    // Matched against the freshness stamp's own text inside "Confirmed beds", never the drawer,
    // whose title names the ward regardless (see `ward-capacity-freshness-source.dom.test.tsx`).
    for (const row of wardSourced) {
      const confirmed = within(openWardDrawer(row.unit)).getByRole("region", { name: "Confirmed beds" });
      expect(
        within(confirmed).getByText(new RegExp(`^Confirmed .* · ${escapeRegExp(capacityConfirmer(row.unit)!)}$`, "u")),
        `${row.unit.id} is ward-confirmed and must name who confirmed it`,
      ).toBeInTheDocument();
    }
    for (const row of networkRows.filter((r) => r.unit.allocatable.source !== "ward")) {
      const confirmed = within(openWardDrawer(row.unit)).getByRole("region", { name: "Confirmed beds" });
      expect(
        within(confirmed).queryByText(/^Confirmed .* · /u),
        `${row.unit.id} is derived and must not be attributed to a ward`,
      ).toBeNull();
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
 *
 * Capacity redesign (Josh, 31 Oct 2026): the bar and its key are gone. The hero's chips count
 * BEDS ("Locked ready", "Open ready") and the bed map's highlight chips count WARDS, and the redesign
 * gave every ward chip its noun ("Locked ready · 7 wards"). So what is asserted now is that every
 * ward-counting chip names its noun and none reads exactly like a bed-counting hero figure.
 */
describe("the Capacity screen never labels a bed count and a ward count with the same words", () => {
  /** The hero chips count beds: each chip's label, without its figure. */
  function heroLabels(): string[] {
    return heroChips()
      .getAllByRole("button")
      .concat(
        Array.from(screen.getByRole("group", { name: "Network beds" }).querySelectorAll<HTMLElement>(":scope > span")),
      )
      .map((chip) => (chip.lastElementChild?.textContent ?? "").replace(/\s+/gu, " ").trim())
      .filter((text) => text !== "");
  }

  it("has hero bed chips and bed map ward chips to compare, or the comparison below is vacuous", () => {
    renderScreen();
    expect(heroLabels().length, "the hero renders no bed chips").toBeGreaterThan(0);
    expect(highlightChips().length, "the bed map renders no highlight chips").toBeGreaterThan(0);
  });

  it("names the noun on every ward-counting chip, so none reads as a bed-counting hero figure", () => {
    renderScreen();
    const beds = heroLabels();
    const chips = highlightChips().map((chip) => (chip.textContent ?? "").replace(/\s+/gu, " ").trim());
    for (const chip of chips) {
      expect(chip, "a ward-counting chip does not say it counts wards").toMatch(/ · \d+ wards?$/u);
      expect(beds, "a ward-counting chip reads exactly like a bed-counting hero figure").not.toContain(chip);
    }
    for (const label of beds) {
      expect(label, "a bed-counting hero figure is labelled as wards").not.toMatch(/\bwards?$/u);
    }
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
    // Capacity redesign (31 Oct 2026): `.attentionWho` and `capacity.module.css` are gone; ward names
    // now sit in the bed map card's `.wardName` slot in `capacity-page.module.css`.
    const css = readFileSync("src/components/ward-management/capacity/capacity-page.module.css", "utf8");
    const rule = /^\.wardName\s*\{([^}]*)\}/mu.exec(css);
    expect(rule, "no .wardName rule found — the assertion below would be vacuous").not.toBeNull();

    expect(
      (rule as RegExpExecArray)[1],
      "a font-family is back on the slot that renders ward names. Every one of them is prose, so a " +
        "code face here is a hospital's name typeset as though it were a reference number.",
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
   *
   * Capacity redesign (31 Oct 2026): the table row is gone, so this reads each ward's bed map card
   * across: its ready figure and its occupied figure. The drawer's counts are read the same way in
   * `ward-capacity-zero-spelling.dom.test.tsx`.
   */
  it("never spells a known zero two ways on the same ward's card", () => {
    renderScreen();
    const cards = wardCards();
    expect(cards.length, "no ward cards rendered — this guard would prove nothing").toBeGreaterThan(10);

    const mixed: string[] = [];
    let sawAZero = 0;
    for (const card of cards) {
      const occupied = Array.from(card.querySelectorAll("span"))
        .map((span) => /^(\S+) of \d+ occupied$/u.exec(span.textContent ?? "")?.[1])
        .find((value) => value !== undefined);
      const figures = [card.querySelector("b")?.textContent ?? "", occupied ?? ""].map((text) => text.trim());
      const words = figures.filter((t) => /^none$/iu.test(t)).length;
      const digits = figures.filter((t) => t === "0").length;
      if (words + digits > 0) sawAZero += 1;
      if (words > 0 && digits > 0) mixed.push(`${visibleName(card.firstElementChild)} -> ${figures.join(" | ")}`);
    }

    // Floor on the POPULATION, never on the findings: a board with no zero at all would pass the
    // assertion below while proving nothing about how a zero is spelled.
    expect(sawAZero, "no ward card reports a zero — nothing was checked").toBeGreaterThan(0);

    expect(
      mixed,
      "these cards spell zero as a word in one figure and a digit in another, on the same card. " +
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
 *
 * Capacity redesign (31 Oct 2026): the network table is gone, and the bed map's highlight chips
 * carry the same ruling: a chip dims the wards that do not match and never removes one.
 */
describe("the Capacity bed map's highlight chips mark the matching wards and never remove one", () => {
  it("clicking 'Any ready' marks exactly its own population and leaves every ward, including the excluded one, on the map", () => {
    const readyRows = networkRows.filter((row) => row.ready > 0);
    // Anti-vacuity floor: the chip must both have something to mark AND leave something
    // unmarked, or this test cannot tell a wired handler from a dead one that marks everything or
    // nothing regardless of which chip is pressed.
    expect(readyRows.length, "no ward has a ready bed in this fixture — this floor is vacuous").toBeGreaterThan(0);
    expect(
      readyRows.length,
      "every ward has a ready bed in this fixture — highlighting cannot be proven to mark a subset",
    ).toBeLessThan(networkRows.length);

    renderScreen();
    const chip = highlightChips().find((candidate) => /^Any ready · /u.test(candidate.textContent ?? ""))!;
    // The chip states how many wards it matches, never a bed count standing in for it.
    expect(chip).toHaveTextContent(`Any ready · ${readyRows.length} ${readyRows.length === 1 ? "ward" : "wards"}`);
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");

    expect(wardCards().length, "a chip changed how many wards are on the map — this board must never hide a bed").toBe(
      networkRows.length,
    );

    // Every ward is present, and lit or dimmed exactly according to the predicate — both directions.
    for (const row of networkRows) {
      const [card] = cardsOf(row.unit);
      expect(card, `${row.unit.id} is missing from the map`).toBeDefined();
      expect(isDimmed(card!), `${row.unit.id}: expected lit=${row.ready > 0}`).toBe(row.ready === 0);
    }

    // The ward the OLD (Task 1) hiding behaviour would have removed from the board entirely.
    const excluded = networkRows.find((row) => row.ready === 0);
    expect(excluded, "no ward lacks a ready bed — nothing here proves a hidden ward would be caught").toBeDefined();
    expect(
      cardsOf(excluded!.unit),
      "a non-matching ward was removed from the map — this is the exact defect the owner ruled against",
    ).toHaveLength(1);
  });

  /**
   * 🔴 **THE RULING WRITTEN DOWN AS A TEST, PER THE BRIEF.** Walks every chip the screen renders —
   * not just "Any ready" — and asserts the card COUNT never moves and every ward's card stays
   * reachable, floored so an empty chip group or an empty ward list cannot pass this vacuously.
   */
  it("never removes a ward from the bed map, on any chip", () => {
    renderScreen();
    const chips = highlightChips();
    expect(chips.length, "fewer than two chips exist — switching between them proves nothing").toBeGreaterThan(1);
    expect(networkRows.length, "no ward rows at all — the card count below would be vacuous").toBeGreaterThan(0);

    for (const chip of chips) {
      fireEvent.click(chip);
      expect(wardCards().length, `chip "${chip.textContent}" changed the card count`).toBe(networkRows.length);
      for (const row of networkRows) {
        expect(cardsOf(row.unit), `chip "${chip.textContent}" removed ${row.unit.id} from the map`).toHaveLength(1);
      }
    }
  });

  /**
   * 🔴 **THE BED MAP DRAWS EVERY UNIT UNCONDITIONALLY, SO THE PAGE'S BED COUNT MUST NEVER FOLLOW A
   * SELECTION.** The bed map's own "N beds" count went with the redesign (the hero has it), so this
   * pins the hero's headline instead: a header reading "40 beds" over a map drawing 303 is exactly
   * the units-collision incident this file already records once.
   */
  it("keeps the hero's bed count constant across every chip", () => {
    renderScreen();
    const headline = () => screen.getByRole("heading", { level: 1 }).textContent;
    const initial = headline();
    expect(initial, "the hero headline should count beds").toContain(`of ${netTotals.beds}`);

    const chips = highlightChips();
    expect(
      chips.length,
      "fewer than two chips exist — this proves nothing about following a selection",
    ).toBeGreaterThan(1);
    for (const chip of chips) {
      fireEvent.click(chip);
      expect(headline(), `chip "${chip.textContent}" changed the hero's bed count`).toBe(initial);
    }
  });
});

/*
 * RETIRED 31 Oct 2026 with the network ward table (Capacity redesign): "Capacity's tables declare
 * the scroll affordance they have earned" — "declares horizontal scrolling only when additional
 * columns are requested" and "shows one scroll notice in the expanded view and removes it when
 * returning to compact". Both pinned the table's More columns / Key columns switch and its
 * "This table scrolls sideways on narrow screens." notice; the redesign removed the table and its
 * column switch, and the bed map that replaced it does not scroll sideways.
 */

describe("tomorrow's beds forecast", () => {
  it("shows the 24 and 48 hour estimates from bedsForecast in the bed forecast's figures", () => {
    // Stream D: the screen counts the seeded planned admissions as beds needed.
    const forecast = bedsForecast(
      seed.units,
      seed.bedReleases,
      seed.admissions,
      seed.movements,
      NOW_ANCHOR,
      seed.plannedAdmissions,
    );
    const [tomorrow, twoDays] = forecast.horizons;
    expect(tomorrow, "the forecast has no 24 hour estimate").toBeDefined();
    expect(twoDays, "the forecast has no 48 hour estimate").toBeDefined();
    renderScreen();
    expect(forecastFigure("Tomorrow")).toEqual({
      value: gapWords(tomorrow!.likely),
      sub: `${gapWords(tomorrow!.low)} to ${gapWords(tomorrow!.high)}`,
    });
    // 48 hours rests on softer dates, so it leads with the range and gives the likely figure under it.
    expect(forecastFigure("In 48 hours")).toEqual({
      value: `${gapWords(twoDays!.low)} to ${gapWords(twoDays!.high)}`,
      sub: `Likely ${gapWords(twoDays!.likely)}`,
    });
    // PR #423 prototype disclosure: the forecast states its limits. Since the redesign they sit in
    // its "How this is worked out" fold, under the visible "Estimate only".
    const panel = screen.getByRole("region", { name: "Bed forecast" });
    expect(within(panel).getByText("Estimate only")).toBeVisible();
    const how = within(panel).getByText("How this is worked out").closest("details") as HTMLElement;
    expect(how, "the forecast has no 'How this is worked out' fold").not.toBeNull();
    for (const limit of BEDS_FORECAST_LIMITS) expect(within(how).getByText(limit)).toBeInTheDocument();
  });
});
