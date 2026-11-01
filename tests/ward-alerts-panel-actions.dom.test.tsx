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
});
