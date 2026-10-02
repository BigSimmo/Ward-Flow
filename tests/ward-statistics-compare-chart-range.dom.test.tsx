import { fireEvent, render, screen, within } from "@testing-library/react";
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

it("keeps recorded ward stays and their printed values inside the chart without a target", () => {
  render(
    <WardFlowProvider>
      <StatisticsCompareScreen />
    </WardFlowProvider>,
  );
  const chart = screen.getByLabelText("Ward average length of stay bar chart");
  const box = chart.getAttribute("viewBox")!.split(" ").map(Number);
  const bars = within(chart).getAllByRole("graphics-symbol");
  expect(bars).toHaveLength(allUnits().length);
  expect(chart.textContent).not.toMatch(/target/i);
  const printedValues = [...chart.querySelectorAll("text")].filter((text) => /^\d+\.\d+$/.test(text.textContent ?? ""));
  expect(printedValues.length).toBeGreaterThan(0);
  for (const bar of bars) {
    const x = Number(bar.getAttribute("x"));
    const y = Number(bar.getAttribute("y"));
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + Number(bar.getAttribute("width"))).toBeLessThanOrEqual(box[2]!);
    expect(y + Number(bar.getAttribute("height"))).toBeLessThanOrEqual(box[3]!);
    expect(bar.getAttribute("fill")).not.toMatch(/warn|good|gilt/);
  }
  for (const text of printedValues) {
    expect(Number(text.getAttribute("y"))).toBeGreaterThanOrEqual(0);
    expect(Number(text.getAttribute("y"))).toBeLessThan(box[3]!);
  }
  for (const unit of allUnits()) {
    expect(bars.some((bar) => bar.getAttribute("aria-label")?.startsWith(`${unit.name}: `))).toBe(true);
  }
  const ticks = [...chart.querySelectorAll("text")]
    .map((text) => text.textContent ?? "")
    .filter((text) => /^\d+d$/.test(text));
  const recorded = bars.map((bar) => Number(bar.getAttribute("aria-label")?.match(/: ([\d.]+) days/)?.[1] ?? 0));
  expect(Math.max(...ticks.map((tick) => Number(tick.slice(0, -1))))).toBeGreaterThanOrEqual(Math.max(...recorded));
});

it("keeps an unavailable average distinct from zero when a bar receives keyboard focus", () => {
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
    const chart = screen.getByLabelText("Ward average length of stay bar chart");
    const bar = within(chart).getAllByRole("graphics-symbol")[0]!;
    expect(bar.getAttribute("aria-label")).toBe(`${allUnits()[0]!.name}: Not recorded`);
    expect(bar.getAttribute("fill")).toBe("transparent");
    fireEvent.focus(bar);
    expect(screen.getByText("Not recorded", { selector: "b", exact: true })).toBeTruthy();
    fireEvent.blur(bar);
    expect(screen.queryByText("Not recorded", { selector: "b", exact: true })).toBeNull();
  } finally {
    spy.mockRestore();
  }
});
