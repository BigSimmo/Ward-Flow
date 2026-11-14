// Alerts redesign (1 Nov 2026), BUILD-SPEC "Broadcast tab": the live card, its answers, its action
// bar, Earlier today and the empty state, checked against the approved mock-up's bcPanel().
// AL2 (Josh, 3 Nov 2026): live and past broadcasts sit in the Broadcasts view.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { audienceGroups } from "@/components/ward-management/alerts/broadcast-audience";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

const mount = () =>
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
// AL2 (Josh, 3 Nov 2026): a live broadcast sits at the top of Broadcasts; ended ones follow it there.
describe("Broadcasts view: live, then earlier", () => {
  it("shows no live card when nothing is live, and offers Broadcast alert in the hero", () => {
    mount();
    expect(screen.queryByTestId("ward-alerts-live")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    expect(screen.getByRole("dialog", { name: /New broadcast/ })).toBeInTheDocument();
  });

  it("shows a sent bed call as a live card with its answers, then lists it as earlier once stood down", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    mount();
    const metro = audienceGroups(allUnits())[0].desks.length;
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    fireEvent.click(screen.getByLabelText(`I'm authorised to send this to ${metro} desks.`));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));

    const card = screen.getByLabelText("Current broadcast");
    expect(within(card).getByText("Live")).toBeInTheDocument();
    expect(within(card).getByText("Bed call")).toBeInTheDocument();
    expect(within(card).getByText(`Metro adult wards (${metro}) · sent`, { exact: false })).toHaveTextContent("by you");
    expect(
      within(card).getByRole("img", { name: `0 can take, 0 after a discharge, 0 can't, ${metro} no answer yet` }),
    ).toBeInTheDocument();
    expect(within(card).getByText(`0 of ${metro} answered`)).toBeInTheDocument();
    expect(within(card).getAllByRole("row")).toHaveLength(metro + 1);
    // Q149 (1 Nov 2026): Add desks (was Add units) is built, and other wards are still free to ask.
    expect(within(card).getByRole("button", { name: /Add desks/ })).not.toHaveAttribute("aria-disabled", "true");
    expect(within(card).getByRole("button", { name: /Copy answers/ })).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Stand down this alert" }));
    await waitFor(() => expect(screen.queryByTestId("ward-alerts-live")).not.toBeInTheDocument());
    expect(confirm).toHaveBeenCalledOnce();
    // Sending opened the Broadcasts view; the stood-down broadcast is listed there as earlier.
    expect(screen.getByRole("tab", { name: /^Broadcasts/ })).toHaveAttribute("aria-selected", "true");
    const earlier = screen.getByRole("region", { name: "Earlier broadcasts" });
    expect(within(earlier).getByText(/Warning · Metro adult wards · stood down/)).toBeInTheDocument();
  });
});

// Together-X2-6 (master stress test, 14 Nov 2026): a ward's Broadcasts tab offered Extend, Add desks
// and Stand down (coordinator and site bed manager steps) and no Acknowledge.
describe("the live card offers each desk only its own steps", () => {
  it("shows Acknowledge and no lifecycle steps when only acknowledging is given", async () => {
    const { BroadcastLiveCard } = await import("@/components/ward-management/alerts/broadcast-live-card");
    const acknowledge = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BroadcastLiveCard
          alert={{
            id: "BCAST-SYN-1",
            kind: "directive",
            title: "Synthetic directive",
            message: "Review discharges.",
            severity: "warning",
            category: "capacity_gridlock",
            targetScope: "all",
            targetScopeLabel: "All units",
            durationMinutes: 120,
            dispatchedAt: NOW_ANCHOR,
            expiresAt: NOW_ANCHOR + 120,
            dispatchedByRole: "coordinator",
            dispatchedByName: "Desk",
            status: "active",
            acknowledgedUnits: [],
          }}
          units={[]}
          now={NOW_ANCHOR}
          sentByYou={false}
          acknowledgements={{ acknowledged: 0, of: 1 }}
          onCopyAnswers={() => {}}
          onAcknowledge={acknowledge}
        />
      </WardFlowProvider>,
    );
    const card = screen.getByLabelText("Current broadcast");
    expect(within(card).queryByRole("button", { name: /Extend/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Add desks/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Stand down this alert" })).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /Acknowledge/ }));
    expect(acknowledge).toHaveBeenCalledOnce();
  });
});
