import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DischargeBoard, groupDischarges } from "@/components/ward-management/discharges/discharge-board";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { BedRelease } from "@/components/ward-management/ward-model";

/**
 * THE BLOCKER COLUMN BELONGS TO THE BLOCKED GROUP AND NOWHERE ELSE.
 *
 * CHANGED 3 Nov 2026 (Discharges redesign, approved by Josh): the desktop `Stage` column is gone.
 * A held-up row states its own stage ("Confirmed" or "Expected") as the line under its hold-up tag,
 * and a row without a hold-up carries screen-reader-only "Not held up". The E16 notes below on why
 * `Stage` was kept are history; the structural fact they rest on (only Blocked can mix stages) is
 * still pinned by the last test, and is why the stage line lives in the Blocked rows alone.
 *
 * Ward Lead ruling E16, 2026-09-05. `groupDischarges` routes every release with a non-null blocker
 * into `blocked`, so in the other three groups `release.blocker` is `null` BY CONSTRUCTION and the
 * cell read "Not applicable" on every row — seven times on the seeded board, a sixth of the table
 * spent on a fact about the column rather than about the patient. The card list for this same
 * board has always rendered `{release.blocker && …}` and omitted it; the table restated it. **Two
 * renderings of one board disagreeing about whether an absence is worth stating is a defect, and
 * the deliberate one wins over the repeated one.**
 *
 * ⚠️ **`Stage` IS CONSTANT IN THREE GROUPS TOO AND IS DELIBERATELY KEPT.** It is a genuine per-row
 * fact, and keeping it everywhere makes the Blocked group's Stage the only VARYING one on the
 * page, which puts the emphasis where this board exists to put it. The last test below pins the
 * structural reason that is true — the blocked bucket is the only one whose membership test does
 * not fix `state` — rather than pinning what today's fixture happens to show.
 *
 * ⚠️ **AND THE FIRST READING OF THIS SAID SIX REDUNDANT COLUMNS, NOT TWO.** Measured off the
 * rendered table, `discharged-today` showed all six as constant, because it has ONE seeded row.
 * A rendered table cannot tell a column that is constant by construction from one that is constant
 * because the group is small; acting on that reading would have deleted four columns carrying real
 * per-row facts from a clinical board.
 */

/*
 * ⚠️ WHAT THIS SUITE DOES NOT COVER, ESTABLISHED BY DELIBERATELY MUTATING WHERE I EXPECTED NO
 * COVERAGE — Ward Lead's point that a mutation run with no surprises has told you nothing.
 *
 * **It pins the header list and forbids one string. It says NOTHING about which cell sits under
 * which header.** Two mutations swapped adjacent `<td>`s while leaving the `<thead>` untouched —
 * Stage against Blocker, and Health service against Expected — and this file stayed green through
 * both. A value under the wrong heading is a nastier defect than a wrong header list, and it is
 * outside this suite's reach by construction.
 *
 * ⚠️ **AND BOTH MUTATIONS WERE STILL CAUGHT — BY OLDER TESTS THAT READ CELLS POSITIONALLY FOR
 * UNRELATED REASONS.** `ward-discharge-board.dom.test.tsx` caught the first with *"states each
 * blocked row's own stage"* (it read `Awaiting accommodation` where a stage belonged), and a
 * release-band test caught the second (`East Metro` where `By midday` belonged). I predicted
 * SURVIVED for both and was wrong twice.
 *
 * **That coverage is real, incidental and undocumented.** It exists because three separate tests
 * happen to read three different columns by index for their own purposes. Nothing names it, and
 * a refactor of those tests to look cells up by header — an obvious tidy-up — would remove it
 * silently while every one of them stayed green. If cell-to-header correspondence is wanted as a
 * property rather than as a by-product, it needs its own assertion here; this note is so that
 * whoever needs it does not read this file's name and assume it is already covered.
 */
// Discharges redesign (approved 31 Oct 2026): the person leads each row, and a fourth column holds the
// row's one action (its header is read by screen readers only, and its cell carries no phone label).
// Redesign (3 Nov 2026): no Stage column; the stage reads under the hold-up tag instead.
const WORKLIST_COLUMNS = ["Person", "Expected out", "Held up by", "Next"];
// Desktop cells carry no phone labels; the column classes are the per-cell contract.
const CELL_CLASSES = ["colPerson", "colOut", "colBlocker", "actionCell"];
const GROUPS = ["blocked", "confirmed", "expected", "discharged-today"] as const;

function headersFor(groupKey: string): string[] {
  const table = screen.getByTestId(`ward-discharge-group-${groupKey}`).closest("table");
  return [...(table?.querySelectorAll("thead th") ?? [])].map((th) => (th.textContent ?? "").trim());
}

function renderBoard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
    </WardFlowProvider>,
  );
}

describe("the discharges board's column contract", () => {
  /**
   * ⚠️ ANTI-VACUITY, ON THE POPULATION WALKED. Every assertion below reads headers out of a
   * rendered table; a group that renders its empty note instead has no table, and `headersFor`
   * would throw rather than pass — but a board that rendered no groups at all, or four empty ones,
   * would leave the loop below asserting over nothing. All four must be present with tables in
   * them before anything is concluded.
   */
  it("renders all four release groups within the shared worklist table", () => {
    renderBoard();
    for (const key of GROUPS) {
      expect(
        screen.getByTestId(`ward-discharge-group-${key}`).closest("table"),
        `${key} rendered no table — the seed has stopped populating it and this suite is asserting ` +
          "over fewer groups than it names",
      ).toBeTruthy();
    }
  });

  it.each(GROUPS)("keeps person, timing and hold-up columns aligned in %s", (key) => {
    renderBoard();
    expect(headersFor(key)).toEqual(WORKLIST_COLUMNS);
    // Each group shows its first rows, then Show more (redesign): open the rest before walking them.
    const more = screen.queryByTestId(`ward-discharge-more-${key}`)?.querySelector("button");
    if (more) fireEvent.click(more);
    const rows = [...screen.getByTestId(`ward-discharge-group-${key}`).querySelectorAll("tr")].filter((row) =>
      row.hasAttribute("data-release-id"),
    );
    expect(rows.length, `${key} must exercise actual release rows`).toBeGreaterThan(0);
    for (const row of rows) {
      const cells = [...row.querySelectorAll("td")];
      expect(cells.map((cell, i) => cell.className.includes(CELL_CLASSES[i]))).toEqual(CELL_CLASSES.map(() => true));
      const blockerCell = cells[2];
      if (!blockerCell) throw new Error(`${key} row has no Held up by cell`);
      if (key === "blocked") {
        expect(blockerCell.querySelector('[class*="blockerTag"]')?.textContent).toBeTruthy();
        // The row's own stage is the line under its hold-up tag.
        expect(within(blockerCell).queryByText(/(^|· )(Confirmed|Expected)$/u)).not.toBeNull();
      } else {
        expect(blockerCell.querySelector('[class*="blockerTag"]')).toBeNull();
        if (key === "discharged-today") expect(blockerCell.textContent).toBe("");
        // The criteria led tag (D-64, flag on in tests) and the discharge checklist tally (feature
        // 37) may follow in the same cell.
        else expect(blockerCell.textContent).toMatch(/^Not held up(, CLD|, discharge checklist|$)/);
      }
      fireEvent.click(within(row).getAllByRole("button")[0]);
      // Drawer review (6 Nov 2026): the chosen release opens in the kit drawer (PanelDrawer).
      const details = screen.getByTestId("ward-discharge-detail");
      const reported = within(details).getByText("Last reported", { selector: "dt" }).nextElementSibling;
      expect(reported?.textContent, "freshness remains available in the selected release detail").toMatch(
        /Confirmed \d{2}:\d{2}|Never confirmed/u,
      );
    }
  });

  it("has no `Stage` column in any group, since the group heading or the hold-up line states it", () => {
    renderBoard();
    for (const key of GROUPS) {
      expect(headersFor(key), `${key} has a Stage column again`).not.toContain("Stage");
    }
  });

  it("never prints `Not applicable` anywhere on the board", () => {
    renderBoard();
    expect(
      screen.queryAllByText(/Not applicable/u),
      "a cell still says `Not applicable` — the column was dropped from the header but a value is " +
        "still being rendered somewhere",
    ).toHaveLength(0);
  });

  /**
   * WHY A HELD-UP ROW STATES ITS STAGE, ASSERTED STRUCTURALLY RATHER THAN AGAINST THE FIXTURE. The
   * blocked bucket is the only one whose membership test does not fix `state` — the flag is read
   * before the stage — so it is the only group where the stage can vary, and the only one whose
   * rows carry the stage line under the hold-up tag. Pinning "blocked shows two
   * different stages today" would instead go red the day the seed happens to hold one blocked row,
   * which says nothing about the design.
   */
  it("is the only group whose membership does not fix the stage", () => {
    const seeded = seedWardFlowState().bedReleases;
    const blocked = seeded.find((release) => release.blocker !== null);
    expect(blocked, "no seeded release carries a blocker, so this cannot be exercised").toBeTruthy();

    const asConfirmed: BedRelease = { ...(blocked as BedRelease), id: "BR-stage-probe-a", state: "confirmed" };
    const asExpected: BedRelease = { ...(blocked as BedRelease), id: "BR-stage-probe-b", state: "expected" };
    const groups = groupDischarges([asConfirmed, asExpected], NOW_ANCHOR);

    expect(
      groups.blocked.map((release) => release.state).sort(),
      "a blocked release stopped landing in `blocked` on the strength of its stage — the flag must " +
        "be read before the stage, or a stuck confirmation is buried under Confirmed",
    ).toEqual(["confirmed", "expected"]);
    expect(groups.confirmed, "a blocked confirmation leaked into the Confirmed group").toHaveLength(0);
    expect(groups.expected, "a blocked prediction leaked into the Expected group").toHaveLength(0);
  });
});
