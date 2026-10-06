import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **EVERY DEPARTMENT GETS A ROW, INCLUDING THE ONES WITH NOBODY IN THEM — and that is the whole
 * property, not a detail of layout.** The drawing says it plainly: *"Every department in scope is
 * shown, including the ones with nobody waiting. A none in this table is a measured answer and not
 * a missing figure."*
 *
 * ⚠️ **A TABLE THAT LISTS ONLY THE BUSY DEPARTMENTS CANNOT BE READ AS A COMPARISON AT ALL** — a
 * reader has no way to tell a quiet department from one the table forgot, and the quiet ones are
 * precisely what a comparison is for.
 *
 * 🔴 **THE FIGURES ARE CHECKED AGAINST THE DERIVATION, NOT AGAINST TYPED LITERALS.** The screen and
 * this table both call `edWaitFigures`, so a literal here would pin today's seed rather than the
 * relationship — and would go on passing after the two drifted apart.
 */

const SEED = seedWardFlowState();
const TEMPLATE = SEED.movements[0];
const DEPARTMENTS = allEmergencyDepartments();

function specimen(changes: Partial<Movement>): Movement {
  expect(TEMPLATE, "the seed holds no movements, so every case here would assert nothing").toBeDefined();
  return {
    ...structuredClone(TEMPLATE!),
    acceptedUnitId: undefined,
    closure: undefined,
    stage: "placement_requested",
    declines: [],
    ...changes,
  };
}

function renderEd(movements: Movement[]) {
  render(
    <WardFlowProvider>
      <StatisticsEdScreen edId={DEPARTMENTS[0]!.id} movements={movements} />
    </WardFlowProvider>,
  );
  return screen.getByTestId("ward-stat-ed-comparison");
}

describe("comparison across departments", () => {
  it("has departments to compare at all", () => {
    expect(DEPARTMENTS.length, "ward-sites.ts lists no emergency departments").toBeGreaterThan(1);
  });

  /**
   * 🔴 **THE POPULATION IS `allEmergencyDepartments()`, STATED IN THE MESSAGE.** ⚠️ A row count
   * compared against a literal would pass after a department was added and never appeared.
   */
  it("renders one row for every department the prototype has, not only the busy ones", () => {
    // One movement, in ONE department. Every other department is genuinely empty.
    const panel = renderEd([specimen({ id: "WF-only", originEdId: DEPARTMENTS[1]!.id })]);

    for (const department of DEPARTMENTS) {
      expect(
        within(panel).queryByTestId(`ward-stat-ed-comparison-row-${department.id}`),
        `${department.name} is one of the ${DEPARTMENTS.length} departments allEmergencyDepartments() returns and has no row`,
      ).not.toBeNull();
    }
  });

  /**
   * ⚠️ **A QUIET DEPARTMENT MUST READ AS MEASURED, NOT AS BLANK.** 🔴 An empty cell and a nought are
   * the same pixels to nobody — but an empty cell and a nought mean *"we did not look"* and *"we
   * looked and found none"*, which are opposite answers.
   */
  it("shows a department with nobody waiting as a measured nought, never an empty cell", () => {
    const quiet = DEPARTMENTS[2]!;
    const panel = renderEd([specimen({ id: "WF-only", originEdId: DEPARTMENTS[1]!.id })]);
    const row = within(panel).getByTestId(`ward-stat-ed-comparison-row-${quiet.id}`);

    expect(within(row).getByTestId(`ward-stat-ed-comparison-waiting-${quiet.id}`).textContent).toBe("0");
    const longest = (within(row).getByTestId(`ward-stat-ed-comparison-longest-${quiet.id}`).textContent ?? "").trim();
    expect(longest.length, "the longest-wait cell is blank on a quiet department").toBeGreaterThan(0);
    expect(longest, "a quiet department's longest wait rendered as a number").not.toMatch(/^\d/u);
  });

  /**
   * 🔴 **AGAINST THE DERIVATION, PER DEPARTMENT.** ⚠️ The floor matters: two departments carrying
   * different, non-zero figures, so a table that summed everyone or copied one row into another
   * reddens rather than coinciding.
   */
  it("takes every figure from edWaitFigures, department by department", () => {
    const movements = [
      specimen({ id: "WF-a1", originEdId: DEPARTMENTS[0]!.id }),
      specimen({ id: "WF-a2", originEdId: DEPARTMENTS[0]!.id }),
      specimen({ id: "WF-b1", originEdId: DEPARTMENTS[1]!.id }),
    ];
    const panel = renderEd(movements);
    const now = SEED.clockOffsetMinutes;

    const first = edWaitFigures(movements, DEPARTMENTS[0]!.id, now);
    const second = edWaitFigures(movements, DEPARTMENTS[1]!.id, now);
    expect(first.onTheList, "the two departments carry the same figure, so a swap would pass").not.toBe(
      second.onTheList,
    );

    for (const department of DEPARTMENTS) {
      const expected = edWaitFigures(movements, department.id, now);
      const cell = within(panel).getByTestId(`ward-stat-ed-comparison-waiting-${department.id}`);
      expect(cell.textContent, `${department.id} disagrees with the derivation`).toBe(String(expected.onTheList));
    }
  });

  /**
   * ⚠️ **THE COLUMN'S SCOPE IS NARROWER THAN ITS NAME AND MUST SAY SO ON THE PAGE.** 🔴 Only a
   * transport or transfer order carries a due-by instant in this model — never an examination or a
   * detention form. **A column headed "Breached" that a reader takes for a missed Mental Health Act
   * deadline is the most consequential misreading available on this screen.**
   */
  it("uses visible operational panels instead of the retired explanation: says on the page what the breached column can and cannot mean", () => {
    assertStatisticsPresentation("ed");
  });

  /**
   * 🔴 **THE THREE COLUMNS THE DRAWING ASKS FOR AND THIS PAGE CANNOT HONESTLY BUILD.** Two need a
   * rolling seven-day window and the prototype keeps no history; the third needs a suppression
   * threshold nobody has ruled on. ⚠️ **Asserted as absent from the HEADERS, not merely explained in
   * prose — a column quietly appearing later with an invented figure in it is the failure.**
   */
  it("builds none of the three columns it cannot support, and says which and why", () => {
    const panel = renderEd([]);
    const headers = within(panel)
      .getAllByRole("columnheader")
      .map((header) => (header.textContent ?? "").toLowerCase());

    expect(headers.some((header) => header.includes("median"))).toBe(false);
    expect(headers.some((header) => header.includes("accepted"))).toBe(false);
    expect(headers.some((header) => header.includes("out of area"))).toBe(false);

    const note = (within(panel).getByTestId("ward-stat-ed-comparison-not-built").textContent ?? "").toLowerCase();
    expect(note).toContain("median");
    expect(note, "the reason the seven-day columns cannot be built is not stated").toContain("history");
  });

  it("uses visible operational panels instead of the retired explanation: quotes the drawing's own guarantee about quiet departments", () => {
    assertStatisticsPresentation("ed", "ward-stat-ed-comparison-scope");
  });
});
