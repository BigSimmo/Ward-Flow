import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
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

describe("Statistics phone Summary with the unit finder retired (26 Nov 2026)", () => {
  it("draws no finder or Browse card on the phone Summary, whatever anchor the address carries", () => {
    phoneViewport();
    window.history.replaceState(null, "", "/bedchart/statistics#choose-a-unit");
    const result = renderSummary();

    expect(screen.getByTestId("ward-statistics-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-statistics-phone-unit-finder")).not.toBeInTheDocument();
    expect(result.container.querySelector("#choose-a-unit")).toBeNull();
  });

  it("draws no finder on the phone Summary without an anchor", () => {
    phoneViewport();
    window.history.replaceState(null, "", "/bedchart/statistics");
    const result = renderSummary();

    expect(screen.getByTestId("ward-statistics-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-statistics-phone-unit-finder")).not.toBeInTheDocument();
    expect(result.container.querySelector("#choose-a-unit")).toBeNull();
  });

  it("still lists units with their ready beds on the phone Summary", () => {
    phoneViewport();
    window.history.replaceState(null, "", "/bedchart/statistics");
    renderSummary();

    const list =
      screen.queryByRole("list", { name: "Wards A to Z" }) ??
      screen.getByRole("list", { name: "Hospitals by beds ready" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => /\d+\s*ready/.test(row.textContent ?? ""))).toBe(true);
  });
});
