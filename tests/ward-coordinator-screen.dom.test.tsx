import { fireEvent, render, screen } from "@testing-library/react";
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
  it("names open ED journeys separately from physical ED presence and transit", () => {
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

  // #113 review: the hero's deadline count is classified by `clockState`, which reads the saved
  // first warning, so its label must name that same saved window rather than a fixed "1h".
  it("names the saved first-warning window on the hero's deadline count", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <SaveUrgentWindow />
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    const defaultLabel = `Forms due within ${dueWindowLabel(DUE_SOON_URGENT_MINUTES)}`;
    expect(screen.getByText(defaultLabel)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "save warning times" }));
    expect(screen.getByText("Forms due within 1h 30m")).toBeInTheDocument();
    expect(screen.queryByText(defaultLabel)).not.toBeInTheDocument();
    expect(dueWindowLabel(60)).toBe("1h");
    expect(dueWindowLabel(240)).toBe("4h");
  });
});
