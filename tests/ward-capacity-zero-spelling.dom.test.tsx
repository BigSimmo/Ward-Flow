import { readFileSync } from "node:fs";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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
 * So every assertion here reads all of ONE ward's counts together. An assertion that reads a
 * single figure, however carefully, reproduces the blindness that let this ship.
 *
 * Capacity redesign (Josh, 31 Oct 2026): the network table is gone. A ward's counts are now read in
 * two places, and each is checked as one line: its bed map card (ready, and occupied of its beds)
 * and its ward drawer (ready of its beds, occupied, and freeing today). The locked-ready column went
 * with the table; no single ward's locked figure is drawn any more.
 */
const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
// Same arguments `useCapacityModel` passes to `networkWardRows`.
const rows = networkWardRows(seed.units, NOW, seed.bedReleases, seed.admissions, seed.leaveBeds);

/**
 * The word this screen uses for a reported zero. Kept as one constant so a rewording moves in one
 * place — but note that nothing below asserts the word itself is "none": what is asserted is that
 * the counts AGREE, which survives any rewording. Cf. the standing rule that a guard pinning
 * today's copy goes red on an honest rephrasing and teaches people to delete it.
 */
const ZERO_WORD = /^\s*none\s*$/iu;

/** A figure that is exactly the digit zero, with nothing else in it. */
const BARE_ZERO = /^\s*0\s*$/u;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

/** A ward card's visible name: its text without the spelled-out code a screen reader hears. */
function visibleName(element: Element | null): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("abbr + span").forEach((node) => node.remove());
  return (clone.textContent ?? "").trim();
}

function cardOf(unit: { id: string; name: string }): HTMLElement {
  const map = document.getElementById("capacity-bed-map");
  if (!map) throw new Error("no bed map on the Capacity screen");
  const card = Array.from(map.querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]')).find(
    (button) => visibleName(button.firstElementChild) === unit.name,
  );
  if (!card) throw new Error(`no bed map card for ${unit.id}`);
  return card;
}

/** A card's two counts: its ready figure and its occupied figure ("3 of 12 occupied"). */
function cardFigures(card: HTMLElement): string[] {
  const ready = card.querySelector("b")?.textContent ?? "";
  const occupied = /^(\S+) of \d+ occupied$/u.exec(
    Array.from(card.querySelectorAll("span")).find((span) => / of \d+ occupied$/u.test(span.textContent ?? ""))
      ?.textContent ?? "",
  )?.[1];
  return [ready, occupied ?? ""];
}

/** The drawer's three counts for its ward: ready, occupied, and freeing today. */
function drawerFigures(unit: { id: string; name: string }): string[] {
  fireEvent.click(cardOf(unit));
  const drawer = screen.getByTestId("ward-capacity-ward-drawer");
  expect(drawer).toHaveAccessibleName(unit.name);
  const beds = within(drawer).getByRole("region", { name: "Beds now" });
  const ready = beds.querySelector("p span")?.textContent ?? "";
  const notes = Array.from(beds.querySelectorAll("p")).at(-1)?.textContent ?? "";
  const occupied = /^(\S+) occupied/u.exec(notes)?.[1] ?? "";
  const freeing = within(drawer).getByText("Freeing today").nextElementSibling?.textContent ?? "";
  return [ready, occupied, freeing];
}

describe("Capacity spells zero one way per ward", () => {
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
    expect(rows.length, "the network has hardly any wards").toBeGreaterThan(10);
    const withAZero = rows.filter((row) => row.ready === 0 || row.occupied === 0 || row.freeing === 0);
    expect(
      withAZero.length,
      "no row in the fixture has a zero in any count column, so nothing here can detect a spelling " +
        "disagreement — the guard would pass over an estate it never examined",
    ).toBeGreaterThan(0);
  });

  it("never renders a word-zero and a digit-zero for the same ward, on its card or in its drawer", () => {
    // 🔴 THE ASSERTION THE OLD TESTS COULD NOT MAKE. One ward at a time, all its counts together.
    renderScreen();
    const mixed: string[] = [];
    let sawAZero = 0;
    for (const row of rows) {
      for (const [where, texts] of [
        ["card", cardFigures(cardOf(row.unit))],
        ["drawer", drawerFigures(row.unit)],
      ] as const) {
        expect(
          texts.every((text) => text.trim() !== ""),
          `${row.unit.name}'s ${where} is missing a count: ${texts.join(" · ")}`,
        ).toBe(true);
        const spelledAsWord = texts.filter((text) => ZERO_WORD.test(text));
        const spelledAsDigit = texts.filter((text) => BARE_ZERO.test(text));
        if (spelledAsWord.length + spelledAsDigit.length > 0) sawAZero += 1;
        if (spelledAsWord.length > 0 && spelledAsDigit.length > 0) {
          mixed.push(`  ${row.unit.name} (${where}): ${texts.map((text) => `"${text.trim()}"`).join(" · ")}`);
        }
      }
    }
    expect(sawAZero, "no card or drawer showed a zero at all — nothing was checked").toBeGreaterThan(0);
    expect(
      mixed,
      "these rows spell zero two ways on one line, so a reader meets a word and a digit side by " +
        "side with nothing telling them they mean the same thing:\n" +
        mixed.join("\n") +
        "\n\n  Spell every count for one ward the same way: on the card Ready and Occupied, in the " +
        "drawer Ready, Occupied and Freeing today; 'Not tracked here' is NOT a zero and is correctly " +
        "different from both.",
    ).toEqual([]);
  });

  it("keeps a reported zero distinguishable from a ward that reports nothing", () => {
    // ⚠️ THE OTHER DIRECTION, AND THE MORE DANGEROUS ONE. Making the three columns agree must not
    // be achieved by collapsing "reports zero" into "does not report" — that is the false claim
    // `NetworkWardRow.freeing` exists to prevent, and it would be made with total confidence.
    renderScreen();
    for (const row of rows) {
      if (row.freeing !== undefined) continue;
      const text = drawerFigures(row.unit)[2]!;
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
  it("keeps the drawer's three counts routed through the shared count spelling", () => {
    // Capacity redesign (31 Oct 2026): the counts that read "none" for a zero are now in the ward
    // drawer (`capacity-ward-drawer.tsx`); `freeingCellText` defers to `countCellText` in
    // `capacity-derivations.ts`. The network table file (`capacity-network-rows.tsx`) is deleted.
    const source =
      readFileSync("src/components/ward-management/capacity/capacity-ward-drawer.tsx", "utf8") +
      readFileSync("src/components/ward-management/capacity/capacity-derivations.ts", "utf8");
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, " "))
      .replace(/\/\/[^\n]*/gu, "");

    expect(stripped.length, "the comment strip removed nearly the whole file").toBeGreaterThan(source.length / 3);
    expect(stripped, "the screen source no longer mentions the shared decision at all").toContain("countCellText");

    for (const call of [
      "countCellText(row.ready)",
      "countCellText(row.occupied)",
      "freeingCellText(row.freeing)",
      "countCellText(freeing)",
    ]) {
      expect(
        stripped.includes(call),
        `${call} is not in the drawer or the derivations outside comments — that count has stopped deferring ` +
          "to the shared count spelling, so the counts can drift apart again. It produces " +
          "identical output today, which is why nothing else can catch it.",
      ).toBe(true);
    }

    expect(
      stripped.includes("ZERO IS THE WORD IN ALL THREE COUNT COLUMNS"),
      "a comment-only phrase survived the strip, so the assertions above could be satisfied by prose",
    ).toBe(false);
  });

  it("detects a mixed row when one is constructed, so the assertion above is not decoration", () => {
    // 🔴 WITHOUT THIS THE PER-WARD ASSERTION PASSES OVER AN EMPTY LIST, which is exactly what a detector
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
