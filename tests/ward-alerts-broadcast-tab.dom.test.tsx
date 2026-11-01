// Alerts redesign (1 Nov 2026), BUILD-SPEC "Broadcast tab": the live card, its answers, its action
// bar, Earlier today and the empty state, checked against the approved mock-up's bcPanel().
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { audienceGroups } from "@/components/ward-management/alerts/broadcast-audience";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

const mount = () =>
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
const broadcastTab = () => fireEvent.click(screen.getByRole("tab", { name: /^Broadcast/ }));
// The selected alert's side panel has tab panels of its own, so name this one.
const broadcastPanel = () => screen.getByRole("tabpanel", { name: /^Broadcast/ });

describe("Broadcast tab", () => {
  it("offers Broadcast alert when nothing is live", () => {
    mount();
    broadcastTab();
    // The header band says it too (Alerts redesign), so read the tab panel.
    expect(within(broadcastPanel()).getByText("No broadcast live")).toBeInTheDocument();
    const panel = broadcastPanel();
    fireEvent.click(within(panel).getByRole("button", { name: "Broadcast alert" }));
    expect(screen.getByRole("dialog", { name: /New broadcast/ })).toBeInTheDocument();
  });

  it("shows a sent bed call as a live card with its answers, then lists it as earlier once stood down", () => {
    mount();
    const metro = audienceGroups(allUnits())[0].desks.length;
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    fireEvent.click(screen.getByLabelText(`I'm authorised to send this to ${metro} units.`));
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
    // Q149 (1 Nov 2026): Add units is built, and other wards are still free to ask.
    expect(within(card).getByRole("button", { name: /Add units/ })).not.toHaveAttribute("aria-disabled", "true");
    expect(within(card).getByRole("button", { name: /Copy answers/ })).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Stand down this alert" }));
    // The header band says it too (Alerts redesign), so read the tab panel.
    expect(within(broadcastPanel()).getByText("No broadcast live")).toBeInTheDocument();
    const earlier = screen.getByRole("region", { name: "Earlier broadcasts" });
    expect(within(earlier).getByText(/Warning · Metro adult wards · stood down/)).toBeInTheDocument();
  });
});
