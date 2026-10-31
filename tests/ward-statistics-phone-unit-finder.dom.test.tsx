import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";

// Codex review on #1145 (31 Oct 2026): "Open a unit" on another Statistics page links to the
// Summary's finder anchor. The phone Summary must show the finder there too, not a page with no way
// to choose a unit.

function phoneViewport() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === WF_PHONE_QUERY,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function renderSummary() {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("Statistics phone Summary unit finder", () => {
  it("shows the one finder at its anchor when a link arrives at #choose-a-unit, and Close shuts it", () => {
    phoneViewport();
    window.history.replaceState(null, "", "/ward-flow/statistics#choose-a-unit");
    const result = renderSummary();

    const finder = screen.getByTestId("ward-statistics-phone-unit-finder");
    expect(finder).toHaveAttribute("id", "choose-a-unit");
    expect(result.container.querySelector("#choose-a-unit")).toBe(finder);
    // The same finder the desktop shows, with its lists filled.
    expect(within(finder).getByPlaceholderText("Find a ward")).toBeInTheDocument();
    expect(within(finder).getAllByRole("link").length).toBeGreaterThan(0);

    act(() => {
      fireEvent.click(within(finder).getByRole("button", { name: "Close" }));
    });
    expect(screen.queryByTestId("ward-statistics-phone-unit-finder")).not.toBeInTheDocument();
  });

  it("draws no finder on the phone Summary without the anchor", () => {
    phoneViewport();
    window.history.replaceState(null, "", "/ward-flow/statistics");
    const result = renderSummary();

    expect(screen.getByTestId("ward-statistics-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-statistics-phone-unit-finder")).not.toBeInTheDocument();
    expect(result.container.querySelector("#choose-a-unit")).toBeNull();
  });
});
