import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Alerts redesign, side panel (approved 1 Nov 2026). Synthetic seed data only. */
describe("Alerts side panel", () => {
  it("names the person on every main button and keeps Activity on its own tab", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    let checked = 0;
    for (const row of Array.from(container.querySelectorAll<HTMLElement>("li[data-alert-id]")).slice(0, 6)) {
      fireEvent.click(within(row).getByTestId("ward-alerts-open"));
      const panel = screen.getByRole("complementary", { name: "Selected alert" });
      const name = within(panel).getByRole("heading", { level: 2 }).textContent ?? "";
      const main = panel.querySelector<HTMLElement>("a[class*='primary'], button[class*='pri']");
      if (main) {
        expect(main.textContent).toContain(name);
        checked += 1;
      }
      expect(within(panel).getByRole("tab", { name: "Act" })).toHaveAttribute("aria-selected", "true");
      expect(within(panel).getByRole("tab", { name: /^Activity/u })).toBeInTheDocument();
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("moves between Act and Activity with the arrow keys, one tab stop at a time", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(within(container.querySelector<HTMLElement>("li[data-alert-id]")!).getByTestId("ward-alerts-open"));
    const panel = screen.getByRole("complementary", { name: "Selected alert" });
    const act = within(panel).getByRole("tab", { name: "Act" });
    const activity = within(panel).getByRole("tab", { name: /^Activity/u });
    expect(act).toHaveAttribute("tabindex", "0");
    expect(activity).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(act, { key: "ArrowRight" });
    expect(activity).toHaveAttribute("aria-selected", "true");
    expect(activity).toHaveFocus();
    expect(within(panel).getByRole("tabpanel")).toHaveAttribute("aria-labelledby", activity.id);
    fireEvent.keyDown(activity, { key: "Home" });
    expect(act).toHaveAttribute("aria-selected", "true");
    expect(act).toHaveFocus();
  });
  it("states only what is still outstanding, never a fixed sentence", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    for (const row of Array.from(container.querySelectorAll<HTMLElement>("li[data-alert-id]"))) {
      fireEvent.click(within(row).getByTestId("ward-alerts-open"));
      const panel = screen.getByRole("complementary", { name: "Selected alert" });
      expect(panel.textContent).not.toContain(
        "Carer, personal support person and advocacy notifications are not recorded",
      );
    }
  });
});
