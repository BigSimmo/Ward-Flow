import { fireEvent, render, screen, within } from "@testing-library/react";
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
 *  1. "Record Intervention" (now Escalate) and "Dispatch Broadcast" changed nothing but showed a success toast —
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
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    const confirm = screen.getByTestId("ward-alerts-broadcast-confirm");
    expect(confirm).toHaveAttribute("aria-disabled", "true");

    // Check safeguard checkbox
    fireEvent.click(screen.getByLabelText(/I confirm this directive is clinically authorised/i));
    // Re-read: Dispatch's tooltip wrapper goes once nothing is left to do.
    const ready = screen.getByTestId("ward-alerts-broadcast-confirm");
    expect(ready).not.toHaveAttribute("aria-disabled", "true");

    fireEvent.click(ready);
    expect(screen.getByText(/shown in this prototype only; no external notifications are sent\./i)).toBeInTheDocument();
  });

  // D-16 (site review, 12 Oct 2026): a working control that says it is not wired, never greyed for
  // the coordinator.
  it("Escalate is a working control that records escalation and updates button state", () => {
    renderScreen();
    // A placement alert: no ward in the network is eligible, so the bed search really is exhausted.
    fireEvent.click(screen.getAllByRole("button", { name: /^Open No eligible bed/ })[0]!);
    const panel = screen.getByRole("complementary", { name: "Selected alert" });
    const escalate = within(panel).getByRole("button", { name: /Escalate/ });
    expect(escalate).not.toHaveAttribute("aria-disabled");
    expect(escalate).not.toBeDisabled();
    fireEvent.click(escalate);
    expect(within(panel).getByRole("button", { name: /^Escalated/ })).toBeInTheDocument();
  });

  // PR #349 review: Escalate stamps "bed search exhausted" on the movement, so an alert about
  // something else (here an expired bed pull) must not offer it, and a click must change nothing.
  it("Escalate is unavailable for an alert that is not about the bed search and records nothing", () => {
    renderScreen();
    fireEvent.click(screen.getAllByRole("button", { name: /^Open Bed pull expired/ })[0]!);
    const panel = screen.getByRole("complementary", { name: "Selected alert" });
    const escalate = within(panel).getByRole("button", { name: /^Escalate / });
    expect(escalate).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(escalate);
    expect(within(panel).queryByRole("button", { name: /^Escalated/ })).not.toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /^Escalate / })).toBeInTheDocument();
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
    // Alerts redesign (31 Oct 2026): the Checking strip is one chip that opens the full list in place.
    fireEvent.click(screen.getByRole("button", { name: /^Checking \d+ flagged · \d+ clear$/u }));

    const openMovements = wardMovements.filter(isOpen);
    const inbox = buildActionInbox(openMovements, NOW, allUnits());
    const legal = inbox.filter((item) => item.id.startsWith(INBOX_CATEGORIES.legal_timing_breached.idPrefix));
    const declined = inbox.filter((item) => item.id.startsWith(INBOX_CATEGORIES.destinations_declined.idPrefix));

    const withDeadline = openMovements.filter((m) => m.legalForm?.dueAt !== undefined);
    const declineCandidates = openMovements.filter((m) => m.declines.length > 0).length;

    if (legal.length === 0) {
      expect(
        screen.getByText(new RegExp(`0 of ${withDeadline.length} with a written deadline passed`)),
      ).toBeInTheDocument();
    }
    if (declined.length === 0) {
      expect(
        screen.getByText(new RegExp(`0 of ${declineCandidates} declined by every ward asked`)),
      ).toBeInTheDocument();
    }
  });
});
