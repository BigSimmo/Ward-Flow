import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Alerts redesign clinical safety rules 2 and 3 (spec design/alerts-redesign-2026-11, 1 Nov 2026). */
function renderScreen() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

describe("Alerts safety rules", () => {
  it("never dims an act-now row when another highlight is on", () => {
    renderScreen();
    const act = () => Array.from(document.querySelectorAll('[data-alert-id][data-act="true"]'));
    expect(act().length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Waiting/ }));
    expect(screen.getByText(/^\d+ of \d+ highlighted, all rows stay$/u)).toBeInTheDocument();
    for (const row of act()) expect(row.getAttribute("data-dim")).not.toBe("true");
  });

  it("lists act now first inside each owner in the Owner view", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("radio", { name: /Owner/ }));
    const groups = Array.from(document.querySelectorAll("section[aria-label]")).filter(
      (group) => group.querySelector("[data-alert-id]") !== null,
    );
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      const flags = Array.from(group.querySelectorAll("[data-alert-id]")).map(
        (row) => row.getAttribute("data-act") === "true",
      );
      expect(flags, group.getAttribute("aria-label") ?? "").toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    }
  });
});
