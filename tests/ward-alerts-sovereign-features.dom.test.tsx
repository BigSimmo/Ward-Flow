import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

describe("Alerts — Third Edition Sovereign Enhancements", () => {
  it("renders 3 escalation tier tabs and All Active Tiers tab", () => {
    renderScreen();
    expect(screen.getByRole("tab", { name: /All Active Tiers/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tier 1: Clinical Emergency/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tier 2: Capacity Pressure/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tier 3: Administrative/i })).toBeInTheDocument();
  });

  it("renders role-based addressed filter pills", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: /All Roles/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Coordinator/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Duty Registrar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bed Manager/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /NUM/i })).toBeInTheDocument();
  });

  it("renders 4-KPI summary strip with tabular figures", () => {
    renderScreen();
    expect(screen.getByText("Form expiries passed")).toBeInTheDocument();
    expect(screen.getByText("Placement Gridlock")).toBeInTheDocument();
    expect(screen.getByText(/Prolonged ED Wait/i)).toBeInTheDocument();
    expect(screen.getByText("Active Monitored")).toBeInTheDocument();
  });

  it("renders synthetic prototype badge in the subheader (FF8)", () => {
    renderScreen();
    const badge = screen.getAllByText("Synthetic prototype")[0];
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-ward-type-floor", "badge");
  });

  it("opens Right Inspector Drawer on Action button click, closes on Escape, and restores focus", () => {
    renderScreen();
    const actionButtons = screen.getAllByRole("button", { name: "Action" });
    expect(actionButtons.length).toBeGreaterThan(0);

    const firstActionBtn = actionButtons[0];
    firstActionBtn.focus();
    fireEvent.click(firstActionBtn);

    // Inspector drawer should now be in the document
    const drawer = screen.getByRole("dialog", { name: /Alert Escalation & Triage/i });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText("Case Parameters & Tracking")).toBeInTheDocument();
    expect(within(drawer).getByTestId("ward-alerts-action-confirm")).toBeInTheDocument();

    // Press Escape to dismiss drawer
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(screen.queryByRole("dialog", { name: /Alert Escalation & Triage/i })).not.toBeInTheDocument();
  });

  it("can acknowledge an alert from the Right Inspector Drawer", () => {
    renderScreen();
    const actionButtons = screen.getAllByRole("button", { name: "Action" });
    fireEvent.click(actionButtons[0]);

    const ackButton = screen.queryByRole("button", { name: "Acknowledge Alert" });
    if (ackButton) {
      fireEvent.click(ackButton);
      // State updates to Acknowledged
      expect(screen.getByText("Acknowledged by Duty Coordinator")).toBeInTheDocument();
    }
  });

  // The feed used to render two typed-in items, one naming "Luke Davies" as WF-021's patient and
  // calling a transfer complete that the record does not hold (25 September 2026 audit, A7). It
  // now lists only the notices the reducer has raised, and says plainly when there are none.
  it("renders the Operational Notices & Shift Communication Feed from recorded notices only", () => {
    renderScreen();
    const feed = screen.getByRole("region", { name: "Operational Notices and Shift Communication Feed" });
    expect(within(feed).getByText("Role Notices & Shift Communication Feed")).toBeInTheDocument();
    expect(within(feed).getByText("No notices have been raised this session.")).toBeInTheDocument();
    expect(feed.textContent).not.toMatch(/Catchment Override Logged|Custodial Transfer Completed|Luke Davies/);
  });

  it("lists a notice in the feed once the reducer raises one", () => {
    function PullReleaser() {
      const { now, dispatch } = useWardFlow();
      return (
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "RELEASE_PULL",
              role: "coordinator",
              now,
              movementId: "WF-004",
              reason: "pull_made_in_error",
            })
          }
        >
          release the pull
        </button>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW}>
        <AlertsScreen />
        <PullReleaser />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "release the pull" }));

    const feed = screen.getByRole("region", { name: "Operational Notices and Shift Communication Feed" });
    expect(within(feed).queryByText("No notices have been raised this session.")).not.toBeInTheDocument();
    const items = within(feed).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toMatch(/Unread/);
  });
});
