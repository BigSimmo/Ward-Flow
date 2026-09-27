import { readFileSync } from "node:fs";

import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * 🔴 ZERO SPELLED TWO WAYS ON ONE LINE — owner ruling 2026-09-06, census §8.
 *
 * `Ready` was given the word "none" and the other two count columns were not, so a ward with
 * nothing ready, nothing locked and nothing freeing rendered **`none · 0 · 0`** — three zero counts
 * side by side, one a word and two digits. Nothing on the screen says the word and the digit mean
 * the same thing, and the most natural reading of a deliberate difference is that there IS one.
 * Measured in Chromium against the seeded fixture: 3 of 23 rows spelled zero both ways.
 *
 * ⚠️ **THE TEST SHAPE IS THE FINDING, NOT THE FIX, AND THAT IS WHY THIS FILE EXISTS SEPARATELY.**
 * Every DOM test over this screen was green before the defect, during it, and after it. They read
 * `Ready` in one assertion and `Locked` in another — **so no test ever put the two spellings on one
 * line, which is the only place the problem existed.** A suite asserts what its author remembered
 * to compare, and a ROW was not a thing any of them looked at. It was found by rendering the page
 * and reading a row the way a reader meets it: across.
 *
 * So every assertion here reads all three cells of ONE row together. An assertion that reads a
 * single column, however carefully, reproduces the blindness that let this ship.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
const rows = networkWardRows(units, NOW, bedReleases);

/** The three count columns whose spelling must agree. `Mental Health Act` and `Confirmed` are not counts. */
const COUNT_CELLS = [
  "ward-capacity-network-ready",
  "ward-capacity-network-locked",
  "ward-capacity-network-freeing",
] as const;

/**
 * The word this screen uses for a reported zero. Kept as one constant so a rewording moves in one
 * place — but note that nothing below asserts the word itself is "none": what is asserted is that
 * the three cells AGREE, which survives any rewording. Cf. the standing rule that a guard pinning
 * today's copy goes red on an honest rephrasing and teaches people to delete it.
 */
const ZERO_WORD = /^\s*none\s*$/iu;

/** A cell that is exactly the digit zero, with nothing else in it. */
const BARE_ZERO = /^\s*0\s*$/u;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

/**
 * The text of a count cell with any second fact stripped off. `Ready` can carry a cleaning count
 * ("2 still being made ready") and a mid-update caution in the same `<td>`; neither is the figure,
 * and including them would make the digit test match the "2" in the cleaning line rather than the
 * figure itself. Reads the direct figure content only.
 */
function figureText(cell: HTMLElement): string {
  const clone = cell.cloneNode(true) as HTMLElement;
  for (const extra of clone.querySelectorAll("small")) extra.remove();
  return clone.textContent ?? "";
}

describe("the capacity network table spells zero one way per row", () => {
  it("has rows, and rows where a zero actually occurs, or every assertion below is vacuous", () => {
    // 🔴 FLOOR THE POPULATION WALKED AND THE POPULATION THAT CAN DISCRIMINATE — never the findings.
    // A table with no zero in it passes the row assertion trivially, and would go on passing if the
    // word were removed entirely. This is the assertion that tells "no disagreement" from "nothing
    // to disagree about", and it is the one that goes red if the fixture ever stops containing a
    // zero row.
    // Measured 2026-09-06 against the seeded fixture: 23 rows, `freeing` undefined on 0 of them,
    // zero on 15, positive on 8; `ready === 0` on 3 rows and `lockedReady === 0` on 16. Floors are
    // set well below those so ordinary fixture movement does not go red, but a fixture that lost
    // its zeros entirely — which would make every assertion below vacuous — does.
    expect(rows.length, "the network table rendered no rows at all").toBeGreaterThan(10);
    const withAZero = rows.filter((row) => row.ready === 0 || row.lockedReady === 0 || row.freeing === 0);
    expect(
      withAZero.length,
      "no row in the fixture has a zero in any count column, so nothing here can detect a spelling " +
        "disagreement — the guard would pass over an estate it never examined",
    ).toBeGreaterThan(0);
  });

  it("never renders a word-zero and a digit-zero in the same row", () => {
    // 🔴 THE ASSERTION THE OLD TESTS COULD NOT MAKE. One row at a time, all three cells together.
    renderScreen();
    const mixed: string[] = [];
    for (const row of rows) {
      const tableRow = document.querySelector(`[data-testid="ward-capacity-network-row-${row.unit.id}"]`);
      expect(tableRow, `no rendered row for ${row.unit.name}`).not.toBeNull();
      const texts = COUNT_CELLS.map((id) => figureText(within(tableRow as HTMLElement).getByTestId(id)));
      const spelledAsWord = texts.filter((text) => ZERO_WORD.test(text));
      const spelledAsDigit = texts.filter((text) => BARE_ZERO.test(text));
      if (spelledAsWord.length > 0 && spelledAsDigit.length > 0) {
        mixed.push(`  ${row.unit.name}: ${texts.map((text) => `"${text.trim()}"`).join(" · ")}`);
      }
    }
    expect(
      mixed,
      "these rows spell zero two ways on one line, so a reader meets a word and a digit side by " +
        "side with nothing telling them they mean the same thing:\n" +
        mixed.join("\n") +
        "\n\n  Spell every count column the same way. The three columns are Ready, Locked and " +
        "Freeing; 'Not tracked here' is NOT a zero and is correctly different from both.",
    ).toEqual([]);
  });

  it("keeps a reported zero distinguishable from a ward that reports nothing", () => {
    // ⚠️ THE OTHER DIRECTION, AND THE MORE DANGEROUS ONE. Making the three columns agree must not
    // be achieved by collapsing "reports zero" into "does not report" — that is the false claim
    // `NetworkWardRow.freeing` exists to prevent, and it would be made with total confidence.
    renderScreen();
    for (const row of rows) {
      if (row.freeing !== undefined) continue;
      const tableRow = document.querySelector(`[data-testid="ward-capacity-network-row-${row.unit.id}"]`);
      const text = figureText(within(tableRow as HTMLElement).getByTestId("ward-capacity-network-freeing"));
      expect(
        ZERO_WORD.test(text),
        `${row.unit.name} does not report a freeing figure, but its cell reads "${text.trim()}" — ` +
          "the same as a ward that reports zero",
      ).toBe(false);
    }
  });

  /**
   * 🔴 **READY AND LOCKED CANNOT BE CHECKED BY BEHAVIOUR, AND THAT IS WHY THIS READS THE SOURCE.**
   *
   * 🔴 **NO BEHAVIOURAL TEST CAN CATCH THIS, INCLUDING THE ONE WRITTEN FOR IT.** Un-wiring a column
   * from `countCellText` and hardcoding a CORRECT copy of the rule produces **byte-identical
   * output**, so every rendered assertion still passes — and so does a deferral assertion of the
   * form `expect(freeingCellText(v)).toBe(countCellText(v))`, because the two sides genuinely do
   * agree. **Measured twice with `scripts/ward-flow/mutation-run.mjs`: the un-wiring mutant
   * SURVIVED 55 tests across four files, and survived again after the behavioural deferral
   * assertion was added.**
   *
   * The deferral assertion is kept in `ward-capacity-derivations.test.ts` because it catches the
   * OTHER direction — a shared decision that changes and a consumer that does not follow it —
   * but it cannot see a faithful copy. **Only the source can.** The guarantee this file protects
   * is not "the columns agree today"; it is "there is one place where they are decided".
   *
   * ⚠️ **Comments are stripped before the search**, because a text-scanning guard is otherwise
   * satisfied by the sentence explaining the thing it is looking for — including this one.
   *
   * ⚠️ Brittle to a rename of `row.ready` or `row.lockedReady`, deliberately: a rename is a real
   * edit and exactly the moment to re-read which cells still defer. Update the strings; do not
   * delete the case.
   */
  it("keeps all three count columns routed through the shared count spelling", () => {
    const source =
      readFileSync("src/components/ward-management/capacity/capacity-screen.tsx", "utf8") +
      readFileSync("src/components/ward-management/capacity/capacity-derivations.ts", "utf8");
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, " "))
      .replace(/\/\/[^\n]*/gu, "");

    expect(stripped.length, "the comment strip removed nearly the whole file").toBeGreaterThan(source.length / 3);
    expect(stripped, "the screen source no longer mentions the shared decision at all").toContain("countCellText");

    for (const call of ["countCellText(row.ready)", "countCellText(row.lockedReady)", "countCellText(freeing)"]) {
      expect(
        stripped.includes(call),
        `${call} is not in capacity-screen.tsx outside comments — that cell has stopped deferring ` +
          "to the shared count spelling, so the three columns can drift apart again. It produces " +
          "identical output today, which is why nothing else can catch it.",
      ).toBe(true);
    }

    expect(
      stripped.includes("ZERO IS THE WORD IN ALL THREE COUNT COLUMNS"),
      "a comment-only phrase survived the strip, so the assertions above could be satisfied by prose",
    ).toBe(false);
  });

  it("detects a mixed row when one is constructed, so the assertion above is not decoration", () => {
    // 🔴 WITHOUT THIS THE ROW ASSERTION PASSES OVER AN EMPTY LIST, which is exactly what a detector
    // that matches nothing produces. Builds the defect by hand — the `none · 0 · 0` the census
    // measured — and requires the same predicate to find it.
    const detect = (texts: string[]): boolean =>
      texts.some((text) => ZERO_WORD.test(text)) && texts.some((text) => BARE_ZERO.test(text));

    expect(detect(["none", "0", "0"]), "the shipped defect must be detected").toBe(true);
    expect(detect(["none", "none", "none"]), "the fixed row must not fire").toBe(false);
    expect(detect(["0", "0", "0"]), "the pre-fix consistent row must not fire").toBe(false);
    expect(detect(["none", "none", "Not tracked here"]), "an untracked cell is not a zero").toBe(false);
    expect(detect(["3", "none", "1"]), "a real count beside a stated zero is not a disagreement").toBe(false);
  });
});
