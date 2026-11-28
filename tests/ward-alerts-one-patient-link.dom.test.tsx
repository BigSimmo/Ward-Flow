import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { openAlertKindGroups } from "./helpers/alerts-kind-groups";

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
    for (const row of Array.from(container.querySelectorAll<HTMLElement>("li[data-alert-id]"))) {
      fireEvent.click(within(row).getByTestId("ward-alerts-open"));
      const panel = screen.getByRole("complementary", { name: "Selected alert" });
      // r10 names the patient action "Patient page" everywhere, so one link by that name is the rule.
      const patientLinks = within(panel).queryAllByRole("link", { name: /^Patient page/u });
      if (patientLinks.length === 0) continue;
      checked += 1;
      const href = patientLinks[0]!.getAttribute("href");
      const same = within(panel)
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href") === href);
      expect(same).toHaveLength(1);
      expect(patientLinks).toHaveLength(1);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("keeps the Patient link on a snoozed alert, which shows no action", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SnoozeEveryRow />
        <AlertsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Snooze every row" }));
    // Alerts redesign (point 17): runs of one kind are group rows; each alert keeps its own row inside.
    openAlertKindGroups(screen.getByTestId("ward-alerts-snoozed"));
    const rows = [...screen.getByTestId("ward-alerts-snoozed").querySelectorAll<HTMLElement>("li[data-alert-id]")];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      fireEvent.click(within(row).getByTestId("ward-alerts-open"));
      const panel = screen.getByRole("complementary", { name: "Selected alert" });
      expect(within(panel).queryByRole("link", { name: /^Open patient/u })).toBeNull();
      expect(within(panel).getAllByRole("link", { name: /^Patient/ })).toHaveLength(1);
    }
  });
});
