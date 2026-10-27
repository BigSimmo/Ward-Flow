import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function SnoozeEveryRow() {
  const { movements, units, dispatch } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() => {
        for (const row of buildActionInbox(movements.filter(isOpen), NOW_ANCHOR, units)) {
          dispatch({
            type: "SNOOZE_INBOX_ITEM",
            role: "coordinator",
            now: NOW_ANCHOR,
            inboxItemId: row.id,
            until: NOW_ANCHOR + 30,
            reason: "awaiting_call_back",
          });
        }
      }}
    >
      Snooze every row
    </button>
  );
}

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
    let retained = 0;
    for (const row of Array.from(container.querySelectorAll<HTMLElement>("li[data-alert-id]"))) {
      fireEvent.click(within(row).getByTestId("ward-alerts-open"));
      const panel = screen.getByRole("complementary", { name: "Selected alert" });
      const action = within(panel).queryByRole("link", { name: "Open patient" });
      if (!action) {
        // An alert whose action goes elsewhere still has its Patient link.
        if (within(panel).queryByRole("link", { name: /^Patient/ })) retained += 1;
        continue;
      }
      checked += 1;
      const href = action.getAttribute("href");
      const same = within(panel)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href") === href);
      expect(same).toHaveLength(1);
    }
    expect(checked).toBeGreaterThan(0);
    expect(retained).toBeGreaterThan(0);
  });

  it("keeps the Patient link on a snoozed alert, which shows no action", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SnoozeEveryRow />
        <AlertsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Snooze every row" }));
    const rows = within(screen.getByTestId("ward-alerts-snoozed")).getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      fireEvent.click(within(row).getByTestId("ward-alerts-open"));
      const panel = screen.getByRole("complementary", { name: "Selected alert" });
      expect(within(panel).queryByRole("link", { name: "Open patient" })).toBeNull();
      expect(within(panel).getAllByRole("link", { name: /^Patient/ })).toHaveLength(1);
    }
  });
});
