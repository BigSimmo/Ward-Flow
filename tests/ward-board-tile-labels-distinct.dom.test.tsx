import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * ⚠️ **TWO TILES ON THIS BOARD SHARE A WORD AND MEAN OPPOSITE THINGS, AND A RENAME IS ABOUT TO
 * TOUCH ONE OF THEM.**
 *
 * `tile.kind === "empty"` is a bed a coordinator can fill right now. `tile.kind === "waiting"` is a
 * bed the ward has **already given away** — the patient is on their way and the bed is gone from
 * the ward's count (`ward-board.tsx`'s own comment says so at the `waiting` tile's site). Today they
 * render as `"Empty"` and `"Empty, waiting"`.
 *
 * **A rename done by string replacement rather than by `tile.kind` would rewrite BOTH** — turning an
 * already-claimed bed into one that reads as available, on a board coordinators act from directly.
 * That is the worst outcome the 2026-09-04 "one word for one number" ruling could produce, and it
 * would be produced by somebody being helpful.
 *
 * ⚠️ **THIS GUARD IS DELIBERATELY NOT A PIN ON TODAY'S WORDS.** Asserting `"Empty"` and
 * `"Empty, waiting"` would go red on the very rename it exists to permit, and somebody would then
 * "update" it to whatever the new strings are — which is exactly how a guard comes to certify the
 * defect it was written to prevent. It pins the PROPERTY instead: **whatever the fillable tile is
 * called, the given-away tile must not be readable as that word.**
 *
 * So it survives `"Empty"` → `"Ready"` and goes red on `"Empty, waiting"` → `"Ready, waiting"`.
 *
 * The given-away tile now reads `"Pulled"` (the ruled bed-state word, `ward-bed-states.ts`), so the
 * tiles are told apart by their `data-bed-kind` — `waiting` and `empty` — rather than by finding
 * the word "waiting" in their text, which would have left the comparisons below with no subjects.
 */

/** A unit whose grid carries both tile kinds; asserted rather than assumed, below. */
const UNIT_ID = "rph-adult-secure";

function renderBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

/** The visible text of every bed tile of one kind, in grid order. Read from the DOM rather than
 *  from the source, so this asks what a coordinator can actually read. */
function tileTexts(kind: "waiting" | "empty"): string[] {
  const grid = screen.getByTestId("ward-board-beds");
  return within(grid)
    .getAllByRole("listitem")
    .filter((item) => item.getAttribute("data-bed-kind") === kind)
    .map((item) => item.textContent ?? "");
}

describe("the board's given-away tile is never readable as its fillable tile", () => {
  it("has a unit carrying both a fillable and a given-away tile, so the comparison has subjects", () => {
    // ⚠️ ANTI-VACUITY, AND IT IS THE WHOLE FLOOR: every assertion below is satisfied by a board
    // with no tiles of either kind. Floored on the POPULATION — that both kinds are present — never
    // on a count, which would break the day the seed changes and teach somebody to edit the number.
    renderBoard(UNIT_ID);

    expect(tileTexts("waiting").length).toBeGreaterThan(0);
    expect(tileTexts("empty").length).toBeGreaterThan(0);
  });

  it("never labels a given-away bed with the fillable bed's own word", () => {
    renderBoard(UNIT_ID);

    const givenAway = tileTexts("waiting");
    const fillable = tileTexts("empty");
    expect(givenAway.length).toBeGreaterThan(0);

    /*
     * The fillable tile's word, taken from the SCREEN rather than written down here — so the rule
     * follows the rename instead of having to be updated by it. `Empty` today, `Ready` after the
     * 2026-09-04 rename, and this line needs no edit for either.
     */
    const fillableWord = fillable[0]?.trim().split(/\s+/)[0] ?? "";
    expect(fillableWord).not.toBe("");

    for (const label of givenAway) {
      // A given-away bed may say anything EXCEPT the word that means "you can put someone here".
      expect(label.toLowerCase()).not.toContain(fillableWord.toLowerCase());
    }
  });

  it("keeps the two labels distinguishable from each other, not merely different in punctuation", () => {
    renderBoard(UNIT_ID);

    const givenAway = new Set(tileTexts("waiting").map((text) => text.trim().toLowerCase()));
    const fillable = new Set(tileTexts("empty").map((text) => text.trim().toLowerCase()));
    expect(givenAway.size).toBeGreaterThan(0);

    // Disjoint sets: no string may serve as both, which a rename collapsing the two would produce.
    for (const label of givenAway) expect(fillable.has(label)).toBe(false);
  });

  it("is checking a real unit rather than a name that no longer resolves", () => {
    // The one thing that would make every assertion above vacuous without failing: a unit id that
    // stopped existing, rendering an empty board. Derived from the unit list, not from a constant
    // written twice.
    expect(allUnits().map((unit) => unit.id)).toContain(UNIT_ID);
  });
});
