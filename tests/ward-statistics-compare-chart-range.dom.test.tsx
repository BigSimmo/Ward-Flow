import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsCompareScreen } from "@/components/ward-management/statistics/statistics-compare-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";
import * as statistics from "@/components/ward-management/ward-statistics";

/*
 * v6 (components.md BarList): the ward chart is the shared bar list, not a hand-drawn SVG. Its
 * screen-reader list carries one item per charted ward, its bars are widths inside their track,
 * and an unrecorded average is left out of the bars and named in words beneath them.
 */
function chartFigure(): HTMLElement {
  // The bar list names itself in a visually hidden figcaption.
  return screen.getByText("Ward average length of stay bar chart").closest("figure")!;
}

function chartItems(chart: HTMLElement): string[] {
  return within(chart)
    .getAllByRole("listitem", { hidden: true })
    .map((item) => item.textContent ?? "")
    .filter((text) => !text.startsWith("Mean"));
}

it("keeps recorded ward stays and their printed values inside the chart without a target", () => {
  render(
    <WardFlowProvider>
      <StatisticsCompareScreen />
    </WardFlowProvider>,
  );
  const chart = chartFigure();
  const items = chartItems(chart);
  expect(items).toHaveLength(allUnits().length);
  expect(chart.textContent).not.toMatch(/target/i);
  const bars = [...chart.querySelectorAll<HTMLElement>('[aria-hidden="true"] span[style*="width"]')];
  expect(bars.length).toBeGreaterThan(0);
  for (const bar of bars) {
    const width = Number.parseFloat(bar.style.width);
    expect(width).toBeGreaterThanOrEqual(0);
    expect(width).toBeLessThanOrEqual(100);
  }
  const printedValues = [...chart.querySelectorAll('[aria-hidden="true"] span')].filter((span) =>
    /^\d+\.\d$/.test(span.textContent ?? ""),
  );
  expect(printedValues.length).toBeGreaterThan(0);
  for (const unit of allUnits()) {
    expect(items.some((item) => item.startsWith(`${unit.name}: `))).toBe(true);
  }
  const recorded = items.map((item) => Number(item.match(/: ([\d.]+)$/)?.[1] ?? 0));
  const ticks = [...chart.querySelectorAll('[aria-hidden="true"] span')]
    .map((span) => span.textContent ?? "")
    .filter((text) => /^\d+$/.test(text))
    .map(Number);
  expect(Math.max(...ticks)).toBeGreaterThanOrEqual(Math.max(...recorded));
});

it("keeps an unavailable average distinct from zero in the ward chart", () => {
  const derive = statistics.allWardStatistics;
  const spy = vi
    .spyOn(statistics, "allWardStatistics")
    .mockImplementation((...args) =>
      derive(...args).map((entry, index) =>
        index === 0 ? { ...entry, statistics: { ...entry.statistics, averageLengthOfStayDays: null } } : entry,
      ),
    );
  try {
    render(
      <WardFlowProvider>
        <StatisticsCompareScreen />
      </WardFlowProvider>,
    );
    const name = allUnits()[0]!.name;
    const items = chartItems(chartFigure());
    expect(
      items.some((item) => item.startsWith(`${name}: `)),
      "an unrecorded average was drawn as a bar",
    ).toBe(false);
    expect(screen.getByTestId("ward-statistics-compare-ward-chart-unrecorded").textContent).toBe(
      `Average stay not recorded for ${name}`,
    );
    expect(screen.queryByText(`${name}: 0`)).toBeNull();
  } finally {
    spy.mockRestore();
  }
});
