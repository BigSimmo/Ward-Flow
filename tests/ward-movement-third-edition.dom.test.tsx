import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { panelTitlesInOrder } from "./helpers/ward-panels";

import { MovementsScreen } from "@/components/ward-management/movements/movements-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { totalsReconciliation } from "@/components/ward-management/movements/movements-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { dayOf } from "@/components/ward-management/ward-clock";

/**
 * **TASK M1 — the Movements screen's panel ORDER, which nothing has ever asserted.**
 *
 * 🔴 **THIS FILE WAS M1's ONE NET-NEW DELIVERABLE AND IT WAS NEVER CREATED.** M1 also called for
 * renaming and restyling the four panels; measured 2026-09-12, **every one of those was already
 * satisfied before the task was written** — three panel names and the token-based stylesheet came
 * in with the original merge, and the fourth name was replaced by a LATER ruling (see below). **The
 * order assertion is the only part of M1 with nothing standing in for it**, and M2, M4, M5, M6 and
 * M7 were each supposed to extend this file as they landed. None could: it did not exist.
 *
 * 🔴 **CORRECTED 2026-09-12 AFTER AN ADVERSARIAL REVIEW, AND THE CORRECTION IS THE USEFUL PART.**
 * This comment previously said *"the drawing calls it 'Where each move has got to'"*. **It does
 * not.** That string appears in the LANE PLAN, under a heading reading *"The app's four panels
 * today, measured"* — it was the APP's own pre-M1 name, and I read a measurement of the app as a
 * quotation from the drawing. ⚠️ **A comment whose whole job was "do not think the drawing was
 * ignored" misdescribed the drawing.**
 *
 * **What `docs/ward-flow/mockups/movement-third-edition.html` actually names, measured from its own
 * `aria-label`s:** *The day, and what is severe in it* · *Today's traffic* (containing *Corridors,
 * ranked*) · *Open movements* · *The shape of the same day* · *What reconciles*.
 *
 * 🔴 **SO THE DIVERGENCE IS NOT ONE PANEL, IT IS FIVE OF SIX, AND THIS TEST DOES NOT IMPLEMENT
 * M1's STEP 1.** M1 asked for an order test *"over the drawing's order"*, run RED first. **This is
 * a characterisation of the order the app has** — green the moment it was written — and it is worth
 * having for what it does catch (an accidental reordering) and must not be read as agreement with
 * the drawing. **Whether the app or the drawing is right is Ward Lead's call, not this file's, and
 * it is routed to them rather than settled here.**
 *
 * The refined screen uses a stable **Movement worklist** title. Its Resolved today switcher carries
 * the derived same-day closure count, leaving operational state out of the region name.
 *
 * ⚠️ **AND ORDER IS EXACTLY THE PROPERTY NO OTHER TEST HERE HOLDS.** `ward-movements-screen.dom`
 * fetches each panel by name, one at a time — every one of those assertions passes with the panels
 * rendered in any sequence at all, including one that puts the summary above the board it summarises.
 */

const NOW = NOW_ANCHOR;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <MovementsScreen />
    </WardFlowProvider>,
  );
}

/*
 * The panel-order helper is imported from `./helpers/ward-panels` — ONE definition for the estate,
 * Ward Lead's ruling. 🔴 A long comment stood here explaining that it was a COPY and that no shared
 * module existed; the module was created in the same change that deleted the copy, and the comment
 * was left behind attached to nothing. **An orphaned comment asserts a state the file no longer has
 * and reads as current.**
 */

/**
 * ⚠️ **EXACT STRINGS EXCEPT WHERE THE TITLE CARRIES A DERIVED COUNT.** The first panel's heading
 * embeds a live figure and pluralises around it; matching it verbatim here would hard-code a number
 * that changes with the fixture, which is the defect the ruling that created this heading exists to
 * prevent. It is matched on its stable opening instead — **the part that names the region**.
 *
 * 🔴 **THIS COMMENT USED TO SAY "the derived count is already pinned by `ward-movements-screen.dom`".
 * IT WAS NOT PINNED ANYWHERE.** Measured: that suite fetches the region eight times by a name regex
 * and never asserts the number, and `ui-ward-roles.spec.ts` says in its own comment that it avoids
 * an exact match. ⚠️ **A comment claiming coverage that does not exist is worse than no comment —
 * it is the reason nobody goes looking.** **It is pinned now, by the test below, against the
 * fixture's own count.**
 */
/**
 * The 2026-09-13 full-estate visual rebuild adds the drawing's day summary, followed by
 * Today's traffic, before the board. This supersedes the six-panel characterization described
 * above. Traffic still precedes the patient rows, preserving the earlier ordering intent.
 * Engine-backed transport facts sit inside the bounded Transport summary view.
 */
const EXPECTED_PANELS: readonly RegExp[] = [
  /^The day$/u,
  /^Today’s traffic$/u,
  /^Movement worklist$/u,
  /^Transport right now$/u,
  /^Shape of the day$/u,
] as const;

describe("the Movements screen's panels, in the order a coordinator meets them", () => {
  it("renders every panel exactly once, in order, and no others", () => {
    renderScreen();
    const titles = panelTitlesInOrder();

    expect(
      titles.length,
      `the screen renders ${titles.length} panels, not ${EXPECTED_PANELS.length}: ${JSON.stringify(titles)}. ` +
        "A panel added or removed without this list moving means somebody changed what this screen " +
        "is and nothing recorded the decision.",
    ).toBe(EXPECTED_PANELS.length);

    EXPECTED_PANELS.forEach((expected, index) => {
      expect(
        titles[index] ?? "",
        `panel ${index + 1} is "${titles[index]}" and should match ${expected}. Full order: ${JSON.stringify(titles)}`,
      ).toMatch(expected);
    });
  });

  /**
   * ⚠️ **THE ONE ORDERING RULE WITH A REASON BEHIND IT, ASSERTED SEPARATELY FROM THE FULL LIST.**
   * The summary panel must come AFTER the board it summarises. The full-order test above would also
   * catch a swap, but it would report it as "panel 2 is wrong" — this one says what actually broke,
   * and it survives panels being added between them.
   */
  it("keeps the open-day summary beside and after the board it summarises", () => {
    renderScreen();
    const titles = panelTitlesInOrder();
    const board = titles.indexOf("Movement worklist");
    const glance = titles.indexOf("Shape of the day");

    expect(board, "the movement board is not on the screen at all").toBeGreaterThanOrEqual(0);
    expect(glance, "the at-a-glance summary is not on the screen at all").toBeGreaterThanOrEqual(0);
    expect(
      glance,
      "the summary of the stages now sits ABOVE the board it summarises, so a coordinator meets the " +
        "totals before the rows they are totals of",
    ).toBeGreaterThan(board);
  });

  /**
   * 🔴 **THE COUNT IS DERIVED, AND NOTHING ASSERTED IT.** `A-ADD-1 · M2` exists precisely because
   * the heading states how many movements have closed; a typed number, or one read off the wrong
   * population, is the defect the ruling was made to prevent. **Change `closedMovements.length` to
   * `movements.length` in the screen and, before this test, every ward suite stayed green.**
   */
  it("states the real number resolved today on the worklist switcher", () => {
    // The screen renders the seeded state, which since 22 Sept includes the rulings demo overlay
    // (1b1c5bb2ba, 17 more movements); count what it renders, not the raw fixture array.
    const wardMovements = seedWardFlowState().movements;
    const closed = wardMovements.filter(
      (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(NOW),
    );
    expect(closed.length, "no closed movement in the fixture — this assertion is vacuous").toBeGreaterThan(0);
    expect(
      closed.length,
      "every movement in the fixture is closed, so this cannot tell the closed count from the total",
    ).toBeLessThan(wardMovements.length);

    renderScreen();
    const board = screen.getByRole("region", { name: "Movement worklist" });
    expect(
      within(board).getByRole("tab", { name: new RegExp(`Resolved today ${closed.length}`, "u") }),
    ).toBeInTheDocument();
    const shape = screen.getByRole("region", { name: "Shape of the day" });
    expect(shape).toHaveTextContent(
      `${wardMovements.filter((movement) => movement.closure === undefined).length} open`,
    );
    fireEvent.click(within(shape).getByRole("button", { name: /Resolved/u }));
    expect(shape).toHaveTextContent(`${closed.length} resolved today`);
  });

  it("gives the screen its page shell, so the order above is not over a fragment", () => {
    renderScreen();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Movements" })).toBeInTheDocument();
  });
});
