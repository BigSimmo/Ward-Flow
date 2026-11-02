import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Alerts redesign safety rules (approved 1 Nov 2026, spec in #1225). Synthetic seed data only. */
function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

describe("Alerts redesign safety rules", () => {
  it("never dims an act-now row, whichever highlight is on", () => {
    renderScreen();
    for (const name of [/Waiting/u, /Yours/u]) {
      fireEvent.click(screen.getAllByRole("button", { name })[0]!);
      expect(document.querySelectorAll('[data-alert-id][data-act="true"][data-dim="true"]')).toHaveLength(0);
      fireEvent.click(screen.getAllByRole("button", { name })[0]!);
    }
  });

  it("lists act now first inside each owner in the Owner view", () => {
    renderScreen();
    const arrange = screen.getByRole("radiogroup", { name: "Arrange by" });
    fireEvent.click(within(arrange).getByRole("radio", { name: /Owner/u }));
    const groups = [...document.querySelectorAll<HTMLElement>("section[aria-label]")].filter(
      (section) => section.querySelector("[data-alert-id]") !== null,
    );
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      const acts = [...group.querySelectorAll("li[data-alert-id]")].map(
        (row) => row.getAttribute("data-act") === "true",
      );
      const firstWait = acts.indexOf(false);
      if (firstWait >= 0) expect(acts.slice(firstWait)).not.toContain(true);
    }
  });

  it("only the first-in-line row's action is a filled button", () => {
    renderScreen();
    const actNow = screen.getAllByRole("region", { name: "Act now" })[0]!;
    const rows = [...actNow.querySelectorAll<HTMLElement>("li[data-alert-id]")];
    expect(rows.length).toBeGreaterThan(1);
    const filled = rows.filter((row) => {
      const action = row.querySelector("a, button:not([data-testid='ward-alerts-open'])");
      return action !== null && /(^|_)pri(_|\s|$)/u.test(action.className);
    });
    expect(filled).toHaveLength(1);
  });
});
