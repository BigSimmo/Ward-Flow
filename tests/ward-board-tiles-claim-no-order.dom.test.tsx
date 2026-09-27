import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE BED GRID MUST NOT CLAIM ITS TILES ARE IN AN ORDER, BECAUSE THEY ARE NOT.**
 *
 * `ward-board.tsx:673` states the component's own rule: *"an `Admission` records the ward and NEVER
 * a bed, so a tile carries no bed identity and nothing here may number a tile, call it 'Bed 7', or
 * let the grid read as a floor plan — the order is seed order … nothing in this component ever has
 * an ordinal to print."* **The markup then wrapped those tiles in an `<ol>`, whose entire job is to
 * assert that sequence carries meaning.**
 *
 * ⚠️ **WHICH HALF WAS WRONG WAS DIAGNOSED BEFORE ANYTHING WAS CHANGED, and the answer was not
 * obvious from the shape.** `buildTiles` pushes occupants in seed order, then `blocked-n`, `held-n`,
 * `empty-n` — **the last three groups are COUNTS rendered as tiles, with keys that are literally
 * `empty-3`.** They have no identity to order and no bed to be. Reordering two of them changes
 * nothing a reader could read. **So the comment is true and the element was making a claim the data
 * cannot support.**
 *
 * 🔴 **AND THIS CORRECTS A REASSURANCE I GAVE THAT WAS WRONG AND TRAVELLED.** I reported that
 * `aria-posinset`/`aria-setsize` appear nowhere in this module and concluded that *"the version of
 * this defect that reaches a person — a screen reader announcing 'item 3 of 20' over a seed-ordered
 * list — does not exist in this codebase"*. ⚠️ **An `<ol>` supplies that position implicitly.** A
 * list item in an ordered list carries an ordinal whether or not anybody typed the attribute, so the
 * thing I declared absent was exactly what this grid was. **I had measured a MECHANISM — two
 * attribute spellings — and reported a PROPERTY.**
 *
 * ✅ **`<ol>` IS NOT WRONG EVERYWHERE ON THIS SCREEN, AND THIS FILE DOES NOT SAY IT IS.** Two of the
 * board's other lists are ordered and say so in visible prose — *"Expected within N days, soonest
 * first"* and *"Every occupant of this ward, soonest expected out first; anyone with no date set is
 * last"*. **Those are exemplary and are deliberately left alone.** The property below is about the
 * bed grid only.
 *
 * ⚠️ **POPULATION.** Several seeded wards in jsdom at one viewport. jsdom does not speak, so nothing
 * here proves what a screen reader announces — it proves only that the markup has stopped asserting
 * an order the data cannot support.
 */

const WALKED = allUnits().slice(0, 3);

function renderBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the bed grid does not assert an order it cannot support", () => {
  it("has several units to walk, so nothing below is vacuous", () => {
    expect(WALKED.length, "too few units to walk").toBeGreaterThan(1);
  });

  it("renders the tiles in an UNORDERED list, on every ward walked", () => {
    for (const unit of WALKED) {
      const { unmount } = renderBoard(unit.id);
      const grid = screen.getByTestId("ward-board-beds");

      expect(
        grid.tagName,
        `the bed grid on ${unit.name} is an <${grid.tagName.toLowerCase()}>. An ordered list asserts that ` +
          "sequence carries meaning, and most of these tiles are counts with keys like `empty-3` — " +
          "they are not beds and they have no order. See ward-board.tsx's own rule at :673.",
      ).toBe("UL");

      // 🔴 The tiles are still a LIST — a grid of divs would lose the count a screen reader gets for
      // free, which is real information the data does support. Unordered, not unlisted.
      expect(grid.querySelectorAll("li").length, `no tiles rendered on ${unit.name}`).toBeGreaterThan(0);

      unmount();
    }
  });

  it("gives no tile an explicit position attribute either", () => {
    const { container } = renderBoard(WALKED[0].id);
    expect(
      container.querySelectorAll("[aria-posinset], [aria-setsize]").length,
      "a tile carries an explicit position — the same claim the <ol> used to make implicitly",
    ).toBe(0);
  });
});
