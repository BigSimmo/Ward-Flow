// Alerts redesign (1 Nov 2026), BUILD-SPEC "Broadcast tab": the live card, its answers, its action
// bar, Earlier today and the empty state, checked against the approved mock-up's bcPanel().
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { audienceGroups } from "@/components/ward-management/alerts/broadcast-audience";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { openAlertsBroadcast } from "./helpers/alerts-broadcast";

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
// Q181 (Josh, 1 Nov 2026): a live broadcast sits at the top of Now; ended ones are in Earlier today.
describe("Broadcasts in Now and Earlier today", () => {
  it("shows no live card when nothing is live, and offers Broadcast alert under More", () => {
    mount();
    expect(screen.queryByTestId("ward-alerts-live")).not.toBeInTheDocument();
    openAlertsBroadcast();
    expect(screen.getByRole("dialog", { name: /New broadcast/ })).toBeInTheDocument();
  });

  it("shows a sent bed call as a live card with its answers, then lists it as earlier once stood down", () => {
    mount();
    const metro = audienceGroups(allUnits())[0].desks.length;
    openAlertsBroadcast();
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

    expect(screen.getByTestId("ward-alerts-hero-broadcast")).toHaveTextContent("Broadcast live");

    fireEvent.click(within(card).getByRole("button", { name: "Stand down this alert" }));
    expect(screen.queryByTestId("ward-alerts-live")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /^Earlier today/ }));
    const earlier = screen.getByRole("region", { name: "Earlier broadcasts" });
    expect(within(earlier).getByText(/Warning · Metro adult wards · stood down/)).toBeInTheDocument();
  });
});
