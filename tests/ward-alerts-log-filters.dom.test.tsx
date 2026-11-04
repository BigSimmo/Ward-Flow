// AL2 (Josh, 3 Nov 2026): Alerts is the full log for the desk. Open, Cleared and Broadcasts views,
// and filter chips over Open for the kinds the queue already groups by. Synthetic seed data only.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { alertsTabFromHash } from "@/components/ward-management/alerts/alerts-log-filters";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
});

const mount = () =>
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );

const chips = () => within(screen.getByRole("group", { name: "Show open alerts" }));

describe("Alerts as the desk's full log (AL2)", () => {
  it("names the coordinator's three views", () => {
    mount();
    const tabs = within(screen.getByRole("tablist", { name: "Alerts views" })).getAllByRole("tab");
    expect(tabs.map((tab) => (tab.textContent ?? "").replace(/\d+/gu, "").trim())).toEqual([
      "Open",
      "Cleared",
      "Broadcasts",
    ]);
  });

  it("filters Open by kind with named, counted chips, one pressed at a time", () => {
    mount();
    const all = chips().getByRole("button", { name: "All" });
    const waiting = chips().getByRole("button", { name: /^Waiting\s*\d+$/u });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(chips().getByRole("button", { name: /^Act now\s*\d+$/u })).toHaveAttribute("aria-pressed", "false");
    // Plain buttons, so Tab reaches each one.
    for (const chip of chips().getAllByRole("button")) expect(chip.tagName).toBe("BUTTON");
    expect(screen.getByRole("region", { name: "Act now" })).toBeInTheDocument();

    fireEvent.click(waiting);
    expect(waiting).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("region", { name: "Act now" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Waiting" })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-alert-id][data-act="true"]').length).toBeGreaterThan(0);

    // Pressing the chosen chip again shows everything, as All does.
    fireEvent.click(waiting);
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Act now" })).toBeInTheDocument();
  });

  it("opens Cleared from the address, and keeps #earlier working", () => {
    expect(alertsTabFromHash("#earlier")).toBe("earlier");
    expect(alertsTabFromHash("#broadcasts")).toBe("broadcasts");
    window.history.replaceState(null, "", "/ward-flow/alerts#cleared");
    mount();
    expect(screen.getByRole("tab", { name: /^Cleared/u })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Nothing cleared this session")).toBeInTheDocument();
  });
});
