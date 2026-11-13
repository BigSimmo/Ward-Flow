import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import { acceptedPullTaskRows, alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardTasksDrawer } from "@/components/ward-management/ward-tasks-drawer";

/**
 * Q260 review (#1296): on a desktop away from Alerts the bell opens this drawer. The badge counts a
 * ward's acceptance with no bed pulled, so the drawer lists it too, and its header says the same
 * number as the badge (`alertsNowFigures`, `ward-bar-state.ts`).
 */
describe("the bell's drawer lists what the badge counts", () => {
  const state = seedWardFlowState();
  const now = NOW_ANCHOR;
  const toPull = acceptedReferralsAwaitingPull(state.referrals, state.units, state.movements);
  const rows = acceptedPullTaskRows(toPull, now);
  const items = [
    ...activeTaskItems({ ...state, stuckHandoverMinutes: state.configuration.transportBookedTargetMinutes }, now),
    ...rows,
  ];

  it("an accepted referral awaiting a pull is an Act now row that opens Alerts, and the header matches the badge", () => {
    expect(rows.length, "the seed has an accepted referral with no bed pulled").toBeGreaterThan(0);
    const badge = alertsNowFigures(items, 0).outstanding;
    render(
      <WardTasksDrawer
        items={items}
        acknowledgements={{}}
        completions={{}}
        role="coordinator"
        now={now}
        dispatch={vi.fn()}
        onClose={vi.fn()}
        onSelectMovement={vi.fn()}
        records={state}
      />,
    );
    const drawer = screen.getByRole("complementary", { name: "Alerts" });
    expect(within(drawer).getByTestId("ward-tasks-drawer-count")).toHaveTextContent(`${badge} open`);
    // A9-13: the seed now has more than one such row, which the drawer groups under the one title.
    expect(drawer).toHaveTextContent("Accepted, bed not pulled");
    expect(within(drawer).getByTestId(`ward-task-${rows[0]!.id}`)).toBeInTheDocument();
    const action = within(drawer).getByTestId(`ward-task-action-${rows[0]!.id}`);
    expect(action).toHaveTextContent("Pull the bed");
    expect(action).toHaveAttribute("href", "/ward-flow/alerts");
  });
});
