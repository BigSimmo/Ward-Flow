import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { dueWindowLabel } from "@/components/ward-management/coordinator/home-ed-pressure";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Saves a first warning of 90 minutes, the way Settings does. */
function SaveUrgentWindow() {
  const { now, dispatch, configuration } = useWardFlow();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "SET_CONFIGURATION",
          role: "coordinator",
          now,
          payload: { ...configuration, dueSoonUrgentMinutes: 90, dueSoonMinutes: 240 },
        })
      }
    >
      save warning times
    </button>
  );
}

describe("CoordinatorScreen", () => {
  it("names open ED journeys and separates physical presence from transport accountability", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("heading", { name: /open ED journeys/ })).toBeInTheDocument();
    expect(screen.getByTestId("ward-home-ed-population")).toHaveTextContent(/\d+ still in ED · \d+ in transit/);
  });
  it("renders the prototype footer with coordinator governance disclosure", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    const footer = screen.getByTestId("ward-coordinator-governance");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent("Demo coordinator view · Not approved for clinical use");
    expect(footer).toHaveTextContent("Synthetic prototype");
    expect(footer).toHaveTextContent("CAHS inpatient wards are not modelled; private live feeds are unavailable");
  });

  // Simplification A1 (Josh, 19 Oct 2026): the hero keeps three figures, the same three the phone
  // shows. The forms-due count is not repeated there because the queue's "Form due" filter already
  // carries it.
  it("keeps the hero to its own counts and leaves forms due to the queue", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SaveUrgentWindow />
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    expect(screen.queryByText(`Forms due within ${dueWindowLabel(DUE_SOON_URGENT_MINUTES)}`)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Declines/ })).not.toBeInTheDocument();
    // Home v7 (Josh, 22 Oct 2026): Act now replaced the hero's Alerts count; the registers open
    // from Registers above the list.
    expect(screen.getByRole("button", { name: /Act now/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^\d+\s*Alerts$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registers" })).toBeInTheDocument();
    expect(dueWindowLabel(60)).toBe("1h");
    expect(dueWindowLabel(240)).toBe("4h");
  });

  // Simplification A5 (Josh, 19 Oct 2026): Handover is reached from the rail's countdown card, so
  // Home no longer carries its own "Start handover" button.
  it("leaves the way into Handover to the rail", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    expect(screen.queryByRole("link", { name: "Start handover" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Act now/ })).toBeInTheDocument();
  });
});
