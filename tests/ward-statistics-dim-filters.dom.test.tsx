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

import { HospitalCapacityMatrix } from "@/components/ward-management/statistics/hospital-capacity-matrix";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const units = allUnits();

describe("Statistics Summary v10 hero and pressure chip", () => {
  const renderSummary = () =>
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen />
      </WardFlowProvider>,
    );

  it("answers with the beds ready now and keeps five chips at most", () => {
    renderSummary();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^\d+ beds? ready now$/u);
    const chips = screen.getByRole("group", { name: "Network at a glance" });
    expect(chips.children.length).toBeLessThanOrEqual(5);
    expect(within(chips).getByText("Admissions ended today")).toBeInTheDocument();
  });

  it("labels the line 'At or over 85%' and highlights rather than hides", () => {
    renderSummary();
    const pressure = screen.getByTestId("ward-statistics-pressure");
    const rowsBefore = within(pressure).getAllByRole("row").length;
    const chip = within(pressure).getByRole("button", { name: /^At or over 85%/u });
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    const rows = within(pressure).getAllByRole("row");
    expect(rows).toHaveLength(rowsBefore);
    const body = rows.slice(1);
    expect(body.length).toBeGreaterThan(0);
    for (const row of body) {
      const percent = Number(/(\d+)%/u.exec(within(row).getAllByRole("cell")[2].textContent ?? "")?.[1]);
      if (percent >= 85) expect(row).not.toHaveAttribute("data-dim");
      else expect(row).toHaveAttribute("data-dim", "true");
    }
    expect(pressure.querySelector("#wardFilterCount")).toHaveTextContent(/highlighted, all rows stay$/u);
  });
});

/**
 * v10 filter rule on Statistics: a status or service choice highlights the matching wards and dims
 * the rest by colour (`data-dim`). No row is hidden and nothing uses opacity.
 */
describe("Statistics Beds by ward highlights and dims", () => {
  const bodyRows = () =>
    within(screen.getByTestId("ward-statistics-overview-capacity-matrix")).getAllByRole("row").slice(1);

  it("keeps every row when a status is chosen and dims the ones that do not match", () => {
    render(<HospitalCapacityMatrix units={units} bedReleases={[]} />);
    const before = bodyRows().length;
    expect(before).toBe(units.length);
    fireEvent.click(screen.getByRole("radio", { name: /^None ready/ }));
    const rows = bodyRows();
    expect(rows).toHaveLength(before);
    for (const row of rows) {
      const matches = within(row).queryByText("None ready") !== null;
      if (matches) expect(row).not.toHaveAttribute("data-dim");
      else expect(row).toHaveAttribute("data-dim", "true");
    }
    expect(screen.getByTestId("ward-statistics-capacity-matrix-count")).toHaveTextContent(
      /highlighted, all rows stay$/u,
    );
  });

  it("highlights one service's wards without narrowing the table", () => {
    const service = "South Metro";
    render(<HospitalCapacityMatrix units={units} bedReleases={[]} service={service} />);
    const rows = bodyRows();
    expect(rows).toHaveLength(units.length);
    const lit = rows.filter((row) => !row.hasAttribute("data-dim"));
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(rows.length);
    expect(screen.getByTestId("ward-statistics-capacity-matrix-count")).toHaveTextContent(
      `${lit.length} of ${rows.length} highlighted in ${service}, all rows stay`,
    );
  });
});
