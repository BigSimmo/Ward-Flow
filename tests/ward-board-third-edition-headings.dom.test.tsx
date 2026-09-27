import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **NOTHING PINNED ANY HEADING ON THIS BOARD UNTIL THIS FILE EXISTED.**
 *
 * Measured before writing it: every `ward-board-*` suite finds elements by `data-testid` and asserts
 * `textContent`; **not one uses `getByRole("heading")`.** The only heading-shaped assertion anywhere
 * is `ward-landmarks.test.ts:401`, which counts one `<h1>` per route and pins no text. **So every
 * heading on this screen could have been renamed, or demoted out of being a heading at all, and
 * nothing would have gone red.**
 *
 * ⚠️ **WHICH IS WHY THIS IS WRITTEN WITH THE RENAME AND NOT AFTER IT.** A guard written afterwards is
 * written by somebody who already believes the new text.
 *
 * 🔴 **ASSERTED BY ROLE, NEVER BY TEST ID.** That is the point: a `data-testid` assertion survives a
 * heading becoming a `<div>`, and the demotion is the half nobody notices — a screen-reader user
 * navigating by heading loses the landmark while every existing test stays green.
 *
 * ## What this file does NOT decide
 *
 * ⚠️ **The drawing folds `Coming in`, `Going out today` and `Since yesterday` into THREE TABS of one
 * panel named *Either side of this ward*. The owner authorized the drawing-led visual rebuild
 * on 2026-09-12. All three stay mounted; the active panel and keyboard navigation are now
 * asserted below, so a tab cannot hide its content permanently or erase another population.
 *
 * ⚠️ **`Who is in these beds` IS NOT A VISIBLE PANEL.** `.people { display: none }`, restored under
 * `@media print` — its own comment calls it *"the ONE piece of hidden content on this board, and
 * hidden in the direction that ADDS to the sheet rather than removing from it."* **It is asserted
 * here as present in the markup, never as visible**, because jsdom loads no stylesheet and a
 * `toBeVisible` here would be asserting something this environment cannot see.
 *
 * ⚠️ **POPULATION.** Several seeded wards in jsdom at one viewport. Silent about layout, about what a
 * browser paints, and about the tab question above.
 */

/** Copied from `bed-board-third-edition.html`. ✅ That drawing contains ZERO HTML entities —
 *  measured, not assumed — so every string here is safe to compare as plain text. */
const SCREEN_NAME = "Bed board";
const GRID_HEADING = "Every bed, and who is in it";

/** The headings that stand today, in render order. ⚠️ `Where these beds free up to` is deliberately
 *  absent: the drawing's own footnote folds it into `Going out`, because both panels listed the
 *  same beds — the ones with a discharge date. */
const PANEL_HEADINGS = [
  "Today on this ward",
  "Needs you this shift",
  "Coming in",
  "Going out today",
  "Since yesterday",
] as const;

/**
 * 🔴 **`Where these beds free up to` IS FOLDED, NOT DELETED, AND THOSE NEED OPPOSITE ASSERTIONS.**
 * The first draft of this file listed it as retired and required it to be absent as a heading. **That
 * was wrong and the code was right:** the drawing's footnote promises *"no count, note or action was
 * dropped"*, so the content must survive — it simply stops being a PANEL. ⚠️ **Asserting its absence
 * would have pushed a later reader to delete a list of where beds free up to, in order to go green.**
 */
const FOLDED_INTO_GOING_OUT = "Where these beds free up to";

const WALKED = allUnits().slice(0, 3);

function renderBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the bed board's third-edition headings", () => {
  it("has several distinctly-named units to walk, so nothing below is vacuous", () => {
    expect(WALKED.length).toBeGreaterThan(1);
    expect(
      new Set(WALKED.map((unit) => unit.name)).size,
      "the walked units share a name, so an h1 hard-coded to one ward could not be caught",
    ).toBe(WALKED.length);
  });

  it("names the SCREEN in the h1, identically on every ward", () => {
    for (const unit of WALKED) {
      const { unmount } = renderBoard(unit.id);
      expect(
        screen.getByRole("heading", { level: 1 }),
        `the h1 on ${unit.name} is not the screen's name — every ward renders a different one and the ` +
          "screen has no stable name anywhere on it",
      ).toHaveTextContent(new RegExp(`^${SCREEN_NAME}$`, "u"));
      unmount();
    }
  });

  /**
   * 🔴 **BOTH HALVES TOGETHER, AND THAT IS NOT BELT-AND-BRACES.** A test pinning only `h1 === "Bed
   * board"` would pass on a board that had lost the ward's name entirely — **the worse of the two
   * defects, because a coordinator cannot tell which ward they are placing into.** Renaming a heading
   * is exactly the change that drops what the heading used to carry.
   */
  it("still names the WARD, on every ward walked", () => {
    for (const unit of WALKED) {
      const { unmount } = renderBoard(unit.id);
      expect(
        screen.getByRole("heading", { name: unit.name }),
        `${unit.name}'s own name is no longer a heading on its board`,
      ).toBeInTheDocument();
      unmount();
    }
  });

  it("gives the bed grid the heading it did not have", () => {
    renderBoard(WALKED[0].id);
    expect(
      screen.getByRole("heading", { name: GRID_HEADING }),
      "the grid of beds has no heading — it had none at all before the third edition, and this is the gain",
    ).toBeVisible();
  });

  it("keeps every panel heading, by ROLE rather than by test id", () => {
    renderBoard(WALKED[0].id);
    for (const heading of PANEL_HEADINGS) {
      expect(
        screen.getByRole("heading", { name: heading, hidden: true }),
        `"${heading}" is not a heading on this board — it may have been renamed, or demoted to a div, ` +
          "which every test-id assertion in this suite would survive",
      ).toBeInTheDocument();
    }
    for (const heading of ["Today on this ward", "Needs you this shift", "Going out today"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  it("shows one flow panel while keyboard navigation keeps all three reachable and mounted", () => {
    renderBoard(WALKED[0].id);
    const outgoing = screen.getByRole("tab", { name: /^Going out /u });
    const incoming = screen.getByRole("tab", { name: /^Coming in /u });
    const since = screen.getByRole("tab", { name: "Since yesterday" });
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(3);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByTestId("ward-board-outgoing")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Going out today" })).toBeVisible();
    fireEvent.keyDown(outgoing, { key: "ArrowRight" });
    expect(incoming).toHaveFocus();
    expect(incoming).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("ward-board-incoming")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Coming in" })).toBeVisible();
    expect(screen.getByTestId("ward-board-outgoing")).not.toBeVisible();
    fireEvent.keyDown(incoming, { key: "End" });
    expect(since).toHaveFocus();
    expect(screen.getByTestId("ward-board-since-yesterday")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Since yesterday" })).toBeVisible();
    fireEvent.keyDown(since, { key: "Home" });
    expect(outgoing).toHaveFocus();
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(3);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  });

  it("keeps the folded destinations content, and stops it being a panel of its own", () => {
    renderBoard(WALKED[0].id);

    // BOTH halves, because each alone permits the wrong outcome: "still present" alone allows it to
    // remain a second panel, and "no longer level 2" alone allows somebody to delete it outright.
    const folded = screen.queryByRole("heading", { name: FOLDED_INTO_GOING_OUT, hidden: true });
    if (folded === null) {
      // Not an error in itself — the block renders only when this ward has dated departures.
      expect(
        screen.queryByRole("heading", { level: 2, name: FOLDED_INTO_GOING_OUT, hidden: true }),
        `"${FOLDED_INTO_GOING_OUT}" is absent entirely, which is only correct if this ward has no ` +
          "dated departures — it must never be absent because somebody deleted it to clear a red",
      ).toBeNull();
      return;
    }

    expect(
      folded.tagName,
      `"${FOLDED_INTO_GOING_OUT}" is still an <${folded.tagName.toLowerCase()}> — it was folded INTO ` +
        "Going out because both listed the same beds, so it is a group inside that list, not a panel beside it",
    ).toBe("H3");
    expect(
      screen.queryByRole("heading", { level: 2, name: FOLDED_INTO_GOING_OUT, hidden: true }),
      "the folded content is still a level-2 panel heading, so the fold did not happen",
    ).toBeNull();
  });

  /**
   * ⚠️ **PRESENT, NOT VISIBLE.** See the file header: this panel is `display: none` on screen and
   * restored for print. jsdom loads no CSS, so it cannot tell visible from hidden here — asserting
   * presence is the honest assertion, and asserting visibility would be asserting something this
   * environment is structurally unable to evaluate.
   */
  it("keeps the print-only people panel in the markup", () => {
    renderBoard(WALKED[0].id);
    expect(
      screen.getByRole("heading", { name: "Who is in these beds" }),
      "the print-only occupant panel is gone from the markup — it is the printed sheet's deliverable",
    ).toBeInTheDocument();
  });
});
