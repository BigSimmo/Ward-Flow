import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { setForceDynamicLoading } from "./setup/jsdom.setup";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  setForceDynamicLoading(false);
  vi.unstubAllGlobals();
});

function page() {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsScreen />
    </WardFlowProvider>
  );
}

describe("Statistics lazy view loading", () => {
  it.each(["journey", "map"] as const)(
    "keeps the %s anchor and one loading status until its panel is ready",
    (view) => {
      window.history.replaceState(null, "", `#${view}`);
      setForceDynamicLoading(true);
      const rendered = render(page());
      const holder = screen.getByTestId(`ward-statistics-${view}-loading`);
      expect(holder).toHaveAttribute("id", view);
      expect(document.querySelectorAll(`#${view}`)).toHaveLength(1);
      expect(screen.getByTestId(`ward-statistics-view-${view}`)).toHaveAttribute("aria-current", "page");
      expect(within(holder).getAllByRole("status")).toHaveLength(1);
      expect(within(holder).getByRole("status")).toHaveTextContent(`Loading ${view} view…`);
      expect(holder.querySelector('[aria-label="Spinner"]')).toBeNull();
      expect(screen.queryByTestId(`ward-statistics-${view}-view`)).toBeNull();

      setForceDynamicLoading(false);
      rendered.rerender(page());
      expect(screen.queryByTestId(`ward-statistics-${view}-loading`)).toBeNull();
      expect(screen.getByTestId(`ward-statistics-${view}-view`)).toHaveAttribute("id", view);
      expect(document.querySelectorAll(`#${view}`)).toHaveLength(1);
    },
  );

  it("can switch Journey to Map to Bed board while both optional panels are pending", () => {
    setForceDynamicLoading(true);
    render(page());
    fireEvent.click(screen.getByTestId("ward-statistics-view-journey"));
    expect(screen.getByTestId("ward-statistics-journey-loading")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-statistics-view-map"));
    expect(screen.queryByTestId("ward-statistics-journey-loading")).toBeNull();
    expect(screen.getByTestId("ward-statistics-map-loading")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ward-statistics-view-board"));
    expect(screen.queryByTestId("ward-statistics-map-loading")).toBeNull();
    expect(screen.getByTestId("ward-statistics-view-board")).toHaveAttribute("aria-current", "page");
    expect(document.getElementById("board")).not.toHaveAttribute("hidden");
  });
});
