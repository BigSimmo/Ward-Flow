import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P085 (UI audit, 27 Oct 2026): an alert whose one action is "Open patient" showed a second
 * "Patient" link to the same page beside it. The selected alert now offers one way to the patient.
 */
describe("selected alert: one link to the patient", () => {
  it("drops the separate Patient link when the action already opens the patient", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    let checked = 0;
    for (const row of Array.from(container.querySelectorAll<HTMLElement>("li[data-alert-id]"))) {
      fireEvent.click(within(row).getByTestId("ward-alerts-open"));
      const panel = screen.getByRole("complementary", { name: "Selected alert" });
      const action = within(panel).queryByRole("link", { name: "Open patient" });
      if (!action) continue;
      checked += 1;
      const href = action.getAttribute("href");
      const same = within(panel)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href") === href);
      expect(same).toHaveLength(1);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
