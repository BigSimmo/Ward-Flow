import { assertStatisticsPresentation } from "./helpers/statistics-presentation";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsEdsIndexScreen } from "@/components/ward-management/statistics/statistics-eds-index";
import * as statisticsHero from "@/components/ward-management/statistics/statistics-hero";
import { edJourneyWaitFigures as edWaitFigures } from "@/components/ward-management/statistics/statistics-ed-waits";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";

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
    sourceAdmissionId: undefined,
    transport: undefined,
    stageChanges: [],
    edOutcome: undefined,
    leftDepartmentAt: undefined,
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
  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      window.sessionStorage.clear();
      resetWardAccessStoreForTests();
    });
  });

  it("prevents the executive population split revealing a suppressed complement in the screen and CSV", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    renderEd(
      Array.from({ length: 10 }, (_, index) =>
        specimen({
          id: `WF-population-${index}`,
          originEdId: DEPARTMENTS[0]!.id,
          leftDepartmentAt: undefined,
          ...(index === 9 ? { stage: "moving", leftDepartmentAt: 100 } : {}),
        }),
      ),
    );
    expect(screen.getByTestId("ward-stat-ed-on-the-list")).toHaveTextContent("10");
    expect(screen.getByTestId("ward-statistics-ed-population")).toHaveTextContent(
      "not shown still in ED · fewer than 5 in transit",
    );
    let exported: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        exported = blob;
        return "blob:synthetic-counts";
      },
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      fireEvent.click(screen.getByTestId("ward-statistics-export"));
      const csv = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(exported!);
      });
      expect(csv).toContain('"Open ED journeys","10"');
      expect(csv).toContain('"Still in ED","not shown"');
      expect(csv).toContain('"In transit or recorded departure","fewer than 5"');
    } finally {
      click.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("also suppresses the complementary split on the executive all-ED page", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "executive", scope: { kind: "statewide" } });
    });
    const originalLive = statisticsHero.useStatisticsLive;
    vi.spyOn(statisticsHero, "useStatisticsLive").mockImplementation(() => {
      const live = originalLive();
      return {
        ...live,
        state: {
          ...live.state,
          movements: Array.from({ length: 10 }, (_, index) =>
            specimen({
              id: `WF-network-population-${index}`,
              originEdId: DEPARTMENTS[0]!.id,
              leftDepartmentAt: undefined,
              ...(index === 9 ? { stage: "moving", leftDepartmentAt: 100 } : {}),
            }),
          ),
        },
      };
    });
    render(
      <WardFlowProvider>
        <StatisticsEdsIndexScreen />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("ward-statistics-eds-population")).toHaveTextContent(
      "not shown still in ED · fewer than 5 in transit",
    );
    const bands = screen.getByTestId("ward-statistics-eds-bands");
    expect(within(bands).getByRole("heading", { name: "Time since opening" })).toBeInTheDocument();
    expect(bands).toHaveTextContent("Open ED journeys");
    expect(bands).toHaveTextContent("The bands do not overlap: they add up to all open ED journeys.");
    expect(
      within(screen.getByTestId("ward-statistics-eds-swarm-card")).getByRole("heading", {
        name: "Open ED journeys, by ED",
      }),
    ).toBeInTheDocument();
  });

  it("keeps travelling people in open journeys and names physical ED presence separately", () => {
    renderEd([
      specimen({ id: "WF-wait", originEdId: DEPARTMENTS[0]!.id, leftDepartmentAt: undefined }),
      specimen({
        id: "WF-transit",
        originEdId: DEPARTMENTS[0]!.id,
        stage: "moving",
        leftDepartmentAt: 100,
      }),
    ]);
    expect(screen.getByTestId("ward-stat-ed-on-the-list").textContent).toBe("2");
    expect(screen.getByTestId("ward-statistics-ed-population")).toHaveTextContent("1 still in ED · 1 in transit");
    expect(screen.getByRole("heading", { name: "Open ED journeys" })).toBeInTheDocument();
    const bands = screen.getByTestId("ward-statistics-ed-bands");
    expect(within(bands).getByRole("heading", { name: "Time since opening" })).toBeInTheDocument();
    expect(within(bands).getByText("Open ED journeys")).toBeInTheDocument();
    expect(within(bands).getByText("Open ED journeys by time since opening")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("ward-statistics-ed-everyone")).getByRole("heading", {
        name: "Open ED journeys, by ED",
      }),
    ).toBeInTheDocument();
  });
  it("names open-journey counts separately from time since opening for a travelling journey", () => {
    act(() => setWardFeatureFlagOnDevice("role-access", false));
    const department = DEPARTMENTS[0]!;
    const movements = [
      specimen({ id: "WF-column-here", originEdId: department.id, openedAt: NOW_ANCHOR - 30 }),
      specimen({
        id: "WF-column-transit",
        originEdId: department.id,
        stage: "moving",
        openedAt: NOW_ANCHOR - 120,
        leftDepartmentAt: NOW_ANCHOR - 15,
      }),
    ];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsEdScreen edId={department.id} movements={movements} />
      </WardFlowProvider>,
    );
    const comparison = screen.getByTestId("ward-stat-ed-comparison");
    expect(within(comparison).getByRole("columnheader", { name: /^Open journeys$/u })).toBeInTheDocument();
    expect(within(comparison).getByTestId(`ward-stat-ed-comparison-waiting-${department.id}`)).toHaveTextContent(
      /^2$/u,
    );
    const detail = screen.getByTestId("ward-stat-ed-wait-table");
    expect(within(detail).getByRole("columnheader", { name: /^Time since opening$/u })).toBeInTheDocument();
    const travelling = within(detail).getByTestId("ward-stat-ed-wait-row-WF-column-transit");
    expect(within(travelling).getAllByRole("cell").at(-1)).toHaveTextContent(/^2h 00m$/u);
  });

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
  it("omits unsupported columns and the retired explanation", () => {
    const panel = renderEd([]);
    const headers = within(panel)
      .getAllByRole("columnheader")
      .map((header) => (header.textContent ?? "").toLowerCase());

    expect(headers.some((header) => header.includes("median"))).toBe(false);
    expect(headers.some((header) => header.includes("accepted"))).toBe(false);
    expect(headers.some((header) => header.includes("out of area"))).toBe(false);

    expect(within(panel).queryByTestId("ward-stat-ed-comparison-not-built")).toBeNull();
  });

  it("says a quiet department is a measured none, not a missing figure", () => {
    renderEd([]);
    expect(screen.queryByTestId("ward-stat-ed-comparison-scope")).toBeNull();
    const table = within(screen.getByTestId("ward-stat-ed-comparison")).getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1);
    for (const cell of within(table).getAllByTestId(/^ward-stat-ed-comparison-waiting-/))
      expect(cell.textContent).toBe("0");
  });
});
