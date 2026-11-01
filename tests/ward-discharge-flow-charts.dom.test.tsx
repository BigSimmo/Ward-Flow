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

  it("highlights a day's people in the admission records and hides nobody", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /^History/u }));
    const day = within(dayChart())
      .getAllByRole("button", { pressed: false })
      .find((button) => /: [1-9]\d* due/u.test(button.getAttribute("aria-label") ?? ""));
    expect(day).toBeDefined();
    const expected = Number(/: (\d+) due/u.exec(day!.getAttribute("aria-label") ?? "")?.[1]);
    fireEvent.click(day!);
    // On History a click stays on History and highlights the people (admission records).
    expect(screen.getByRole("button", { name: /^History/u })).toHaveAttribute("aria-pressed", "true");
    const rows = worklistRows();
    const lit = rows.filter((row) => row.getAttribute("data-highlighted") === "true");
    expect(lit).toHaveLength(expected);
    // Highlighted people come first, and every other record is still listed.
    expect(rows.slice(0, expected)).toEqual(lit);
    expect(rows.length).toBeGreaterThan(expected);
    expect(screen.getByTestId("ward-discharge-highlight-note")).toHaveTextContent(
      new RegExp(`${expected} of \\d+ highlighted, all rows stay`),
    );
    fireEvent.click(within(screen.getByTestId("ward-discharge-highlight-note")).getByRole("button", { name: "Clear" }));
    expect(screen.queryByTestId("ward-discharge-highlight-note")).not.toBeInTheDocument();
  });

  it("highlights a day's bed releases within Now, never jumping to History (Josh, 30 Oct)", () => {
    renderBoard();
    const day = within(dayChart())
      .getAllByRole("button", { pressed: false })
      .find((button) => /: [1-9]\d* due/u.test(button.getAttribute("aria-label") ?? ""));
    expect(day).toBeDefined();
    const due = Number(/: (\d+) due/u.exec(day!.getAttribute("aria-label") ?? "")?.[1]);
    fireEvent.click(day!);
    expect(screen.getByRole("button", { name: /^Now,/u })).toHaveAttribute("aria-pressed", "true");
    const note = screen.getByTestId("ward-discharge-highlight-note").textContent ?? "";
    const listed = Number(/^(\d+) of \d+ highlighted, all rows stay/u.exec(note)?.[1]);
    const notListed = Number(/· (\d+) more that day not listed/u.exec(note)?.[1] ?? 0);
    // The chart leaves closed wards out (as Capacity's forecast does); the list keeps every row, so it
    // can only hold as many or more.
    expect(listed + notListed).toBeGreaterThanOrEqual(due);
    expect(listed + notListed).toBeGreaterThan(0);
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

  it("clears a hiding status filter on a chart click, and drops the highlight on a population switch", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /^History/u }));
    const confirmedChip = () =>
      within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: /^Confirmed/u });
    fireEvent.click(confirmedChip());
    expect(confirmedChip()).toHaveAttribute("aria-pressed", "true");
    const first = within(barrierBars()).getAllByRole("button")[0]!;
    const count = Number(/: (\d+) held up/u.exec(first.getAttribute("aria-label") ?? "")?.[1]);
    expect(count).toBeGreaterThan(0);
    fireEvent.click(first);
    expect(confirmedChip()).toHaveAttribute("aria-pressed", "false");
    expect(worklistRows().filter((row) => row.getAttribute("data-highlighted") === "true")).toHaveLength(count);
    fireEvent.click(screen.getByRole("button", { name: /^Now,/u }));
    expect(screen.queryByTestId("ward-discharge-highlight-note")).not.toBeInTheDocument();
  });

  it("offers one control per filter: no blocker chip row and no status tab row (decision 5)", () => {
    renderBoard();
    expect(screen.queryByRole("toolbar", { name: "Quick blocker filters" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filter by discharge status")).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: "Blocker" })).toHaveLength(1);
    // The Status chips' counts are the hero chips' counts, so the two never disagree.
    const statusChips = within(screen.getByRole("group", { name: "Status" })).getAllByRole("button");
    const chipLabels: Record<string, RegExp> = {
      blocked: /^Held up/u,
      confirmed: /^Confirmed/u,
      expected: /^Expected/u,
      departed: /^Discharged/u,
    };
    for (const key of ["blocked", "confirmed", "expected", "departed"]) {
      const chip = screen.getByTestId(`ward-discharge-kpi-${key}`);
      // P082: the chip's name starts with the count it shows.
      const count = /^(\d+) /u.exec(chip.getAttribute("aria-label") ?? "")?.[1];
      const statusChip = statusChips.find((candidate) => chipLabels[key]!.test(candidate.textContent ?? ""))!;
      expect(statusChip.textContent).toMatch(new RegExp(`${count}$`, "u"));
    }
  });

  it("keeps the table full width until a row is opened", () => {
    renderBoard();
    const workspace = screen.getByRole("region", { name: "Discharge worklist" }).closest("[data-detail-open]");
    expect(workspace).toBeNull();
    fireEvent.click(within(worklistRows()[0]!).getAllByRole("button")[0]!);
    expect(screen.getByRole("region", { name: "Discharge worklist" }).closest("[data-detail-open]")).not.toBeNull();
  });
});
