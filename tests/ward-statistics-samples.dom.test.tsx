import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { StatisticsSampleFigures } from "@/components/ward-management/statistics/statistics-sample-figures";
import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { setStatisticsSamples } from "@/components/ward-management/statistics/statistics-samples";

const route = vi.hoisted(() => ({ pathname: "/mockups/ward-flow/statistics/ward/rph-adult-secure" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: vi.fn() }) }));

function Workspace() {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {/* v6 (7 Oct 2026): the page's own hero band carries the section track and the Samples switch. */}
      <StatisticsSampleFigures />
      <StatisticsWardScreen unitId="rph-adult-secure" />
    </WardFlowProvider>
  );
}

beforeEach(() => {
  setStatisticsSamples(false);
  route.pathname = "/mockups/ward-flow/statistics/ward/rph-adult-secure";
});
afterEach(() => {
  cleanup();
  setStatisticsSamples(false);
});

describe("optional sample statistics", () => {
  it("defaults to off, hides unavailable history, and preserves recorded figures when switched on and off", () => {
    render(<Workspace />);
    const toggle = screen.getByRole("switch", { name: "Samples" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("statistics-sample-figures")).toBeNull();
    expect(screen.queryByTestId("ward-statistics-ward-occupancy-trajectory")).toBeNull();
    const ready = screen.getByTestId("ward-stat-capacity-ready").textContent;
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    const samples = screen.getByTestId("statistics-sample-figures");
    expect(samples).toHaveTextContent("Invented data · 30 days");
    expect(within(samples).getAllByRole("img")).toHaveLength(3);
    expect(samples.querySelectorAll('[data-figure-kind="sample"]')).toHaveLength(3);
    for (const svg of samples.querySelectorAll("svg")) {
      expect(svg.querySelector("desc")).toHaveTextContent("Sample data, invented for preview");
      expect(svg.querySelector("polyline")?.getAttribute("points")).not.toMatch(/NaN|Infinity/);
    }
    const geometry = samples.querySelector("polyline")!.getAttribute("points");
    expect(screen.getByTestId("ward-stat-capacity-ready")).toHaveTextContent(ready!);
    fireEvent.click(toggle);
    expect(screen.queryByTestId("statistics-sample-figures")).toBeNull();
    expect(screen.getByTestId("ward-stat-capacity-ready")).toHaveTextContent(ready!);
    fireEvent.click(toggle);
    expect(screen.getByTestId("statistics-sample-figures").querySelector("polyline")!.getAttribute("points")).toBe(
      geometry,
    );
  });

  it("persists across page mounts and switches to the appropriate metrics for the selected mode", () => {
    const view = render(<Workspace />);
    fireEvent.click(screen.getByRole("switch", { name: "Samples" }));
    view.unmount();
    route.pathname = "/mockups/ward-flow/statistics/ed/rph-ed";
    render(<Workspace />);
    expect(screen.getByRole("switch", { name: "Samples" })).toHaveAttribute("aria-checked", "true");
    const samples = screen.getByTestId("statistics-sample-figures");
    expect(within(samples).getByRole("heading", { name: /Median wait/ })).toBeTruthy();
    expect(samples).toHaveTextContent("Royal Perth");
    expect(within(samples).queryByRole("heading", { name: /Occupancy/ })).toBeNull();
  });

  it("does not fabricate a sample profile for an unknown ward", () => {
    route.pathname = "/mockups/ward-flow/statistics/ward/not-a-ward";
    setStatisticsSamples(true);
    render(<Workspace />);
    expect(screen.queryByTestId("statistics-sample-figures")).toBeNull();
  });

  it("removes the empty Dabakarn identity card while retaining its bed figures", () => {
    const ward = allUnits().find((unit) => unit.name === "Dabakarn")!;
    expect(ward).toBeDefined();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsWardScreen unitId={ward.id} />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("heading", { name: "Dabakarn", level: 1 })).toBeTruthy();
    // v6 (7 Oct 2026): the hero band is a region named by the ward; no other card may repeat the name.
    const title = screen.getByRole("heading", { name: "Dabakarn", level: 1 });
    expect(screen.queryAllByRole("region", { name: "Dabakarn" }).filter((region) => !region.contains(title))).toEqual(
      [],
    );
    expect(screen.getByTestId("ward-statistics-ward-beds-now")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-section-governance")).toBeNull();
    expect(screen.getByRole("heading", { name: "Dabakarn", level: 1 }).parentElement).not.toHaveTextContent(
      "Synthetic prototype",
    );
  });
});
