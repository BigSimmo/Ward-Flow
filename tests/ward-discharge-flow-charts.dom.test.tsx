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
  it("highlights a day's people in the admission records and hides nobody", () => {
    renderBoard();
    const chart = screen.getByTestId("ward-discharge-day-chart");
    const day = within(chart)
      .getAllByRole("button", { pressed: false })
      .find((button) => /: [1-9]\d* due/u.test(button.getAttribute("aria-label") ?? ""));
    expect(day).toBeDefined();
    const expected = Number(/: (\d+) due/u.exec(day!.getAttribute("aria-label") ?? "")?.[1]);
    fireEvent.click(day!);
    // A click on a chart moves to the people view.
    expect(screen.getByRole("button", { name: /^Admission records/u })).toHaveAttribute("aria-pressed", "true");
    const rows = worklistRows();
    const lit = rows.filter((row) => row.getAttribute("data-highlighted") === "true");
    expect(lit).toHaveLength(expected);
    // Highlighted people come first, and every other record is still listed.
    expect(rows.slice(0, expected)).toEqual(lit);
    expect(rows.length).toBeGreaterThan(expected);
    expect(screen.getByTestId("ward-discharge-highlight-note")).toHaveTextContent(`${expected} highlighted`);
    fireEvent.click(within(screen.getByTestId("ward-discharge-highlight-note")).getByRole("button", { name: "Clear" }));
    expect(screen.queryByTestId("ward-discharge-highlight-note")).not.toBeInTheDocument();
  });

  it("groups blocked people by barrier and highlights the barrier picked on the bars", () => {
    renderBoard();
    const bars = screen.getByTestId("ward-discharge-barrier-bars");
    const first = within(bars).getAllByRole("button")[0]!;
    const count = Number(/: (\d+) blocked/u.exec(first.getAttribute("aria-label") ?? "")?.[1]);
    fireEvent.click(first);
    fireEvent.click(screen.getByTestId("ward-discharge-view-barriers"));
    const table = screen.getByTestId("ward-discharge-barrier-table");
    expect(table.querySelectorAll('tr[data-highlighted="true"]')).toHaveLength(count);
    expect(within(table).getByText("No barrier recorded")).toBeInTheDocument();
  });

  it("clears a hiding status filter on a chart click, and drops the highlight on a population switch", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: /^Admission records/u }));
    fireEvent.click(screen.getByTestId("ward-discharge-kpi-confirmed"));
    const first = within(screen.getByTestId("ward-discharge-barrier-bars")).getAllByRole("button")[0]!;
    const count = Number(/: (\d+) blocked/u.exec(first.getAttribute("aria-label") ?? "")?.[1]);
    expect(count).toBeGreaterThan(0);
    fireEvent.click(first);
    expect(screen.getByTestId("ward-discharge-kpi-confirmed")).toHaveAttribute("aria-pressed", "false");
    expect(worklistRows().filter((row) => row.getAttribute("data-highlighted") === "true")).toHaveLength(count);
    fireEvent.click(screen.getByRole("button", { name: /^Anonymous releases/u }));
    expect(screen.queryByTestId("ward-discharge-highlight-note")).not.toBeInTheDocument();
  });

  it("keeps the table full width until a row is opened", () => {
    renderBoard();
    const workspace = screen.getByRole("region", { name: "Discharge worklist" }).closest("[data-detail-open]");
    expect(workspace).toBeNull();
    fireEvent.click(within(worklistRows()[0]!).getAllByRole("button")[0]!);
    expect(screen.getByRole("region", { name: "Discharge worklist" }).closest("[data-detail-open]")).not.toBeNull();
  });
});
