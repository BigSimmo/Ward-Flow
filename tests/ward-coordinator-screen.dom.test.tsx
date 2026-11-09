import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("names open ED movements and separates physical presence from transport accountability", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    // Sticky header redesign (Josh, 9 Nov 2026): the hero title is "Bed flow right now"; open ED
    // movements are its first figure, and the ED strip says who is in ED and who is in transit.
    expect(screen.getByRole("heading", { name: "Bed flow right now" })).toBeInTheDocument();
    expect(screen.getByTestId("home-figure-ed")).toHaveTextContent(/^\d+open ED movements$/);
    expect(screen.getByTestId("ward-home-ed-population")).toHaveTextContent(/^\d+ in ED · \d+ in transit$/);
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
    expect(footer).toHaveTextContent("CAHS wards not modelled");
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
    // Home v7 (Josh, 22 Oct 2026): Act now replaced the hero's Alerts count. Home flow (Q340/Q345,
    // 3 Nov 2026): the registers open from Registers in the "More for this list" menu above the list.
    // Plan 2i (Josh, 4 Nov 2026, question 2): when the next step is Act now, its "Show act now"
    // button stands in for the Act now chip, so either way the hero offers Act now.
    expect(screen.getAllByRole("button", { name: /act now/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^\d+\s*Alerts$/ })).not.toBeInTheDocument();
    const homeLists = screen.getByRole("navigation", { name: "Home lists" });
    expect(within(homeLists).queryByRole("button", { name: "Registers" })).not.toBeInTheDocument();
    fireEvent.click(within(homeLists).getByRole("button", { name: "More for this list" }));
    // Home notes 4, issue 4 (Josh, 9 Nov 2026): Today's review replaced Registers.
    expect(screen.getByRole("menuitem", { name: "Today's review" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Registers" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Alerts history" })).toBeInTheDocument();
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
    // Plan 2i (Josh, 4 Nov 2026, question 2): when the next step is Act now, its "Show act now"
    // button stands in for the Act now chip, so either way the hero offers Act now.
    expect(screen.getAllByRole("button", { name: /act now/i }).length).toBeGreaterThan(0);
  });
});
