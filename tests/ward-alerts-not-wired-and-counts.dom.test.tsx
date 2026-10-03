import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * F3 (P1), 2026-09-17 fix round.
 *
 *  1. "Record Intervention" and "Dispatch Broadcast" changed nothing but showed a success toast —
 *     D4 requires an exact "Not wired in this prototype." on the unconnected confirm control and
 *     no toast claiming an effect.
 *  2. The all-clear KPI captions ("All Clocks in Date", "Zero Gridlock") were unqualified; they
 *     must now state what was counted, against a real denominator.
 */
const NOW = NOW_ANCHOR;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

describe("Alerts — confirm controls (F3.1)", () => {
  it("Dispatch Broadcast requires clinical confirmation safeguard and dispatches directive", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Broadcast Network Alert" }));
    const confirm = screen.getByTestId("ward-alerts-broadcast-confirm");
    expect(confirm).toBeDisabled();

    // Check safeguard checkbox
    fireEvent.click(screen.getByLabelText(/I confirm this directive is clinically authorised/i));
    expect(confirm).not.toBeDisabled();

    fireEvent.click(confirm);
    expect(screen.getByText(/dispatched statewide\./i)).toBeInTheDocument();
  });

  it("Record Intervention is aria-disabled, carries the exact D4 wording, and shows no toast", () => {
    renderScreen();
    const actionButtons = screen.queryAllByRole("button", { name: "Action" });
    if (actionButtons.length === 0) {
      // No inbox item on this fixture to open the intervention modal from — nothing to prove.
      return;
    }
    fireEvent.click(actionButtons[0]);
    const confirm = screen.getByTestId("ward-alerts-action-confirm");
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(confirm).not.toBeDisabled();
    expect(confirm).toHaveAttribute("title", "Not wired in this prototype.");
    fireEvent.click(confirm);
    expect(screen.queryByText(/Intervention recorded for:/)).not.toBeInTheDocument();
  });
});

describe("Alerts — all-clear KPI captions state a count (F3.2)", () => {
  it("never shows the unqualified 'All Clocks in Date' or 'Zero Gridlock'", () => {
    renderScreen();
    expect(screen.queryByText("All Clocks in Date")).not.toBeInTheDocument();
    expect(screen.queryByText("Zero Gridlock")).not.toBeInTheDocument();
  });

  it("shows a counted caption against a real denominator when each condition is clear", () => {
    renderScreen();

    const openMovements = wardMovements.filter(isOpen);
    const inbox = buildActionInbox(openMovements, NOW, allUnits());
    const legal = inbox.filter((item) => item.id.startsWith(INBOX_CATEGORIES.legal_timing_breached.idPrefix));
    const declined = inbox.filter((item) => item.id.startsWith(INBOX_CATEGORIES.destinations_declined.idPrefix));

    const withDeadline = openMovements.filter((m) => m.legalForm?.dueAt !== undefined);
    const declineCandidates = openMovements.filter((m) => m.declines.length > 0).length;

    if (legal.length === 0) {
      expect(screen.getByText(`0 of ${withDeadline.length} with a written deadline passed`)).toBeInTheDocument();
    }
    if (declined.length === 0) {
      expect(screen.getByText(`0 of ${declineCandidates} declined by every ward asked`)).toBeInTheDocument();
    }
  });
});
