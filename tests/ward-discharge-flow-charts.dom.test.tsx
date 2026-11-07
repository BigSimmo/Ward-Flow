import "@testing-library/jest-dom/vitest";
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

import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
    </WardFlowProvider>,
  );
}

const worklistRows = () =>
  within(screen.getByRole("region", { name: "Discharge worklist" }))
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("button").length > 0);

describe("Discharges charts under the table (direction A)", () => {
  // Discharges redesign (approved 31 Oct 2026): the barrier panel and the day chart sit beside the list on
  // a wide screen and under it on a tablet, and CSS shows one pair. jsdom applies no media queries, so
  // both pairs are in the document here; the first of each is read.
  const dayChart = () => screen.getAllByTestId("ward-discharge-day-chart")[0]!;
  const barrierBars = () => screen.getAllByTestId("ward-discharge-barrier-bars")[0]!;

  it("labels the first bar Overdue, and a day click lights that day's people and adds the unlisted to Expected", () => {
    renderBoard();
    const bars = within(dayChart()).getAllByRole("button");
    // DC5 (Josh, 3 Nov 2026): the column of dates already passed reads "Overdue".
    expect(bars[0]).toHaveTextContent("Overdue");
    expect(bars[0]).toHaveAccessibleName(/^Overdue: \d+ due, expected date already passed, /u);
    expect(within(dayChart()).queryByText("Passed")).not.toBeInTheDocument();
    // The furthest day with anyone due is two or more days ahead, so the list's groups leave its
    // not-held-up releases out until the day is chosen.
    const day = [...bars].reverse().find((button) => /: [1-9]\d* due/u.test(button.getAttribute("aria-label") ?? ""));
    expect(day).toBeDefined();
    const due = Number(/: (\d+) due/u.exec(day!.getAttribute("aria-label") ?? "")?.[1]);
    const before = worklistRows().length;
    // The Now switch's name carries the rows to work: "Now, N to work now".
    const nowSwitch = screen.getByRole("button", { name: /^Now, \d+ to work now$/u });
    const toWork = Number(/(\d+) to work now/u.exec(nowSwitch.textContent ?? "")?.[1]);
    expect(toWork).toBeGreaterThan(0);
    fireEvent.click(day!);
    // On Now a click stays on Now.
    expect(screen.getByRole("button", { name: /^Now,/u })).toHaveAttribute("aria-pressed", "true");
    const extra = Number(/^\+(\d+) that day$/u.exec(screen.getByText(/^\+\d+ that day$/u).textContent ?? "")?.[1]);
    expect(extra).toBeGreaterThan(0);
    const rows = worklistRows();
    const lit = rows.filter((row) => row.getAttribute("data-highlighted") === "true");
    // The chart leaves closed wards out (as Capacity's forecast does); the list keeps every row, so it
    // can only hold as many or more. Nobody is hidden: the day's extra people join the rows to work
    // (lit rows first; a group's unlit rows past its cap stay behind Show more).
    expect(lit.length).toBeGreaterThanOrEqual(due);
    expect(rows.slice(0, 1)).toEqual(lit.slice(0, 1));
    expect(screen.getByTestId("ward-discharge-highlight-note")).toHaveTextContent(
      new RegExp(`^${lit.length} of ${toWork + extra} highlighted, all rows stay`, "u"),
    );
    fireEvent.click(within(screen.getByTestId("ward-discharge-highlight-note")).getByRole("button", { name: "Clear" }));
    expect(screen.queryByTestId("ward-discharge-highlight-note")).not.toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+ that day$/u)).not.toBeInTheDocument();
    expect(worklistRows()).toHaveLength(before);
  });

  it("opens a release the day bar added, not the resting panel (Codex review, #1374)", () => {
    renderBoard();
    const listed = new Set(worklistRows().map((row) => row.getAttribute("data-release-id")));
    const bars = within(dayChart()).getAllByRole("button");
    const day = [...bars].reverse().find((button) => /: [1-9]\d* due/u.test(button.getAttribute("aria-label") ?? ""));
    fireEvent.click(day!);
    const added = worklistRows().find(
      (row) => row.getAttribute("data-highlighted") === "true" && !listed.has(row.getAttribute("data-release-id")),
    );
    expect(added).toBeDefined();
    fireEvent.click(within(added!).getAllByRole("button")[0]!);
    expect(screen.getByRole("tablist", { name: /discharge/iu })).toBeInTheDocument();
  });

  it("highlights a day's bed releases within Now, never jumping to Recorded (Josh, 30 Oct)", () => {
    renderBoard();
    const day = within(dayChart())
      .getAllByRole("button", { pressed: false })
      .find((button) => /: [1-9]\d* due/u.test(button.getAttribute("aria-label") ?? ""));
    expect(day).toBeDefined();
    const due = Number(/: (\d+) due/u.exec(day!.getAttribute("aria-label") ?? "")?.[1]);
    fireEvent.click(day!);
    expect(screen.getByRole("button", { name: /^Now,/u })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Recorded/u })).toHaveAttribute("aria-pressed", "false");
    const note = screen.getByTestId("ward-discharge-highlight-note").textContent ?? "";
    const listed = Number(/^(\d+) of \d+ highlighted, all rows stay/u.exec(note)?.[1]);
    // The chart leaves closed wards out (as Capacity's forecast does); the list keeps every row, and
    // adds the day's unlisted people to Expected, so it can only hold as many or more.
    expect(listed).toBeGreaterThanOrEqual(due);
    expect(listed).toBeGreaterThan(0);
  });

  it("counts held-up releases by barrier and highlights the barrier picked, within Now", () => {
    renderBoard();
    const bars = barrierBars();
    expect(within(bars).getByText(/^\d+ releases?$/u)).toBeInTheDocument();
    const first = within(bars).getAllByRole("button")[0]!;
    const count = Number(/: (\d+) held up/u.exec(first.getAttribute("aria-label") ?? "")?.[1]);
    expect(count).toBeGreaterThan(0);
    fireEvent.click(first);
    expect(screen.getByRole("button", { name: /^Now,/u })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("ward-discharge-highlight-note")).toHaveTextContent(
      new RegExp(`^${count} of \\d+ highlighted, all rows stay`),
    );
    // The List / Barriers switch and its table are gone: one barrier panel.
    expect(screen.queryByTestId("ward-discharge-view-barriers")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-discharge-barrier-table")).not.toBeInTheDocument();
  });

  it("drops the highlight on a population switch, and Recorded hides the charts and KPI bar", () => {
    renderBoard();
    const first = within(barrierBars()).getAllByRole("button")[0]!;
    const count = Number(/: (\d+) held up/u.exec(first.getAttribute("aria-label") ?? "")?.[1]);
    expect(count).toBeGreaterThan(0);
    fireEvent.click(first);
    expect(worklistRows().filter((row) => row.getAttribute("data-highlighted") === "true")).toHaveLength(count);
    // DC4 (Josh, 3 Nov 2026): Recorded lists the last 7 days of discharges with no barrier side,
    // charts or KPI bar, and a Now highlight never carries over.
    fireEvent.click(screen.getByRole("button", { name: /^Recorded/u }));
    expect(screen.queryByTestId("ward-discharge-highlight-note")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-discharge-day-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-discharge-barrier-bars")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-discharge-kpi-strip")).not.toBeInTheDocument();
    expect(worklistRows().some((row) => row.getAttribute("data-highlighted") === "true")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /^Now,/u }));
    expect(screen.queryByTestId("ward-discharge-highlight-note")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("ward-discharge-day-chart").length).toBeGreaterThan(0);
  });

  it("offers one control per filter: no blocker chip row, no status chips and no browser selects (DC2)", () => {
    renderBoard();
    expect(screen.queryByRole("toolbar", { name: "Quick blocker filters" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by discharge status")).not.toBeInTheDocument();
    // DC2 (Josh, 3 Nov 2026): the in-list Status chips are gone; the KPI bar alone picks a status.
    expect(screen.queryByRole("group", { name: "Status" })).not.toBeInTheDocument();
    // Q12 (3 Nov 2026): kit Menu radio pickers replace the browser drop-downs.
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    const heldUpBy = screen.getAllByRole("button", { name: /^Held up by: /u });
    expect(heldUpBy).toHaveLength(1);
    expect(heldUpBy[0]).toHaveAccessibleName("Held up by: Any");
    expect(screen.getByTestId("ward-discharges-sort")).toHaveAccessibleName(/^Sort: /u);
    fireEvent.click(heldUpBy[0]!);
    const options = within(screen.getByRole("menu", { name: "Held up by" })).getAllByRole("menuitemradio");
    expect(options[0]).toHaveAccessibleName("Any");
    expect(options[0]).toHaveAttribute("aria-checked", "true");
    expect(options.slice(1).every((option) => option.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it("keeps the table full width and opens a row in the drawer", () => {
    // Drawer review (6 Nov 2026): no side column opens beside the list; the row opens the kit drawer.
    renderBoard();
    expect(screen.queryByTestId("ward-discharge-detail")).toBeNull();
    fireEvent.click(within(worklistRows()[0]!).getAllByRole("button")[0]!);
    expect(screen.getByRole("region", { name: "Discharge worklist" }).closest("[data-detail-open]")).toBeNull();
    expect(screen.getByTestId("ward-discharge-detail")).toHaveAttribute("role", "dialog");
  });
});
