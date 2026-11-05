import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { installMatchMediaStub } from "./setup/jsdom.setup";

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
  it("never dims an act-now row for any reachable condition highlight", () => {
    renderScreen();
    for (const expand of screen.queryAllByRole("button", { name: /^Show each/u })) fireEvent.click(expand);
    fireEvent.click(screen.getByRole("button", { name: /^Checking.*flagged.*clear$/u }));
    const checks = screen.getByRole("list", { name: "Conditions checked" });
    const buttons = within(checks).getAllByRole("button");
    const actCount = document.querySelectorAll('[data-alert-id][data-act="true"]').length;
    expect(actCount).toBeGreaterThan(0);
    expect(buttons.length).toBeGreaterThan(1);
    let dimmedRowsObserved = 0;
    for (const button of buttons) {
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(document.querySelectorAll('[data-alert-id][data-act="true"]')).toHaveLength(actCount);
      expect(document.querySelectorAll('[data-alert-id][data-act="true"][data-dim="true"]')).toHaveLength(0);
      dimmedRowsObserved += document.querySelectorAll('[data-alert-id][data-dim="true"]').length;
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(document.querySelectorAll('[data-alert-id][data-dim="true"]')).toHaveLength(0);
    }
    expect(dimmedRowsObserved).toBeGreaterThan(0);
  });

  it("never dims an act-now row when a condition check is highlighted", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /^Checking.*flagged.*clear$/u }));
    const checks = screen.getByRole("list", { name: "Conditions checked" });
    const check = within(checks).getByRole("button", { name: /Legal due time passed/u });
    fireEvent.click(check);
    expect(check).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelectorAll('[data-alert-id][data-act="true"]').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-alert-id][data-act="true"][data-dim="true"]')).toHaveLength(0);
  });

  it("never dims an act-now row for any reachable phone owner highlight", () => {
    installMatchMediaStub(true);
    renderScreen();
    for (const expand of screen.queryAllByRole("button", { name: /^Show each/u })) fireEvent.click(expand);
    const actCount = document.querySelectorAll('[data-alert-id][data-act="true"]').length;
    expect(actCount).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Highlight by owner" }));
    const ownerCount = screen.getAllByRole("menuitemradio").length - 1;
    expect(ownerCount).toBeGreaterThan(0);
    let highlightedRowsObserved = 0;
    let dimmedRowsObserved = 0;
    for (let index = 1; index <= ownerCount; index += 1) {
      if (index > 1) fireEvent.click(screen.getByRole("button", { name: "Highlight by owner" }));
      fireEvent.click(screen.getAllByRole("menuitemradio")[index]!);
      const owner = screen.getByRole("button", { name: /^Highlighting /u });
      highlightedRowsObserved += document.querySelectorAll('[data-alert-id][data-highlighted="true"]').length;
      expect(document.querySelectorAll('[data-alert-id][data-act="true"]')).toHaveLength(actCount);
      expect(document.querySelectorAll('[data-alert-id][data-act="true"][data-dim="true"]')).toHaveLength(0);
      dimmedRowsObserved += document.querySelectorAll('[data-alert-id][data-dim="true"]').length;
      fireEvent.click(owner);
      expect(screen.getAllByRole("menuitemradio")[index]).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("menuitemradio", { name: "Any owner" }));
      expect(screen.getByRole("button", { name: "Highlight by owner" })).toBeInTheDocument();
      expect(document.querySelectorAll('[data-alert-id][data-highlighted="true"]')).toHaveLength(0);
      expect(document.querySelectorAll('[data-alert-id][data-dim="true"]')).toHaveLength(0);
    }
    expect(highlightedRowsObserved).toBeGreaterThan(0);
    expect(dimmedRowsObserved).toBeGreaterThan(0);
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
