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

describe("Alerts — Command queue (9 October 2026, round 2 option A)", () => {
  function selectedPanel() {
    return screen.getByRole("complementary", { name: "Selected alert" });
  }

  it("arranges the queue by urgency, lanes or owner", () => {
    renderScreen();
    const arrange = screen.getByRole("radiogroup", { name: "Arrange by" });
    expect(within(arrange).getByRole("radio", { name: /Urgency/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("region", { name: "Act now" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Waiting" })).toBeInTheDocument();

    fireEvent.click(within(arrange).getByRole("radio", { name: /Lanes/ }));
    expect(screen.getByRole("region", { name: "Snoozed" })).toHaveTextContent(
      "A snoozed act-now alert also stays listed in Act now.",
    );

    fireEvent.click(within(arrange).getByRole("radio", { name: /Owner/ }));
    expect(screen.getByRole("region", { name: "Bed coordinator" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ED mental health team" })).toBeInTheDocument();
  });

  it("highlights rows from a check without hiding any, with no owner menu on desktop", () => {
    const { container } = renderScreen();
    const total = container.querySelectorAll("li[data-alert-id]").length;
    expect(total).toBeGreaterThan(0);

    // Q183 (1 Nov 2026): the hero figures are gone; a flagged check in the Checking list highlights.
    fireEvent.click(screen.getByRole("button", { name: /^Checking \d+ flagged · \d+ clear$/u }));
    const checks = within(screen.getByRole("list", { name: "Conditions checked" })).getAllByRole("button");
    // The first check whose kind has a row in the list.
    const flagged = checks.find((button) => {
      if (!button.hasAttribute("aria-pressed")) return false;
      fireEvent.click(button);
      if (container.querySelector("li[data-highlighted]")) return true;
      fireEvent.click(button);
      return false;
    });
    expect(flagged, "the seed flags at least one listed condition").toBeDefined();
    expect(flagged).toHaveAttribute("aria-pressed", "true");
    const highlighted = container.querySelectorAll("li[data-highlighted]");
    expect(highlighted.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("li[data-alert-id]")).toHaveLength(total);
    const clear = screen.getByRole("button", { name: `Clear highlights, ${highlighted.length} highlighted` });

    fireEvent.click(clear);
    expect(container.querySelectorAll("li[data-highlighted]")).toHaveLength(0);

    // Josh, 31 Oct 2026 (answer 17): the desktop's Owner view under Arrange by replaces the owner menu,
    // which only phones keep (tests/ward-alerts-screen.dom.test.tsx).
    expect(screen.queryByRole("combobox", { name: "Highlight by owner" })).not.toBeInTheDocument();
  });

  it("opens the most urgent alert in the side panel and moves with Next alert", () => {
    renderScreen();
    const firstName = within(selectedPanel()).getByRole("heading", { level: 2 }).textContent;
    expect(firstName).toBeTruthy();
    expect(within(selectedPanel()).getByText(/UM\d{6}/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next alert/ }));
    expect(within(selectedPanel()).getByRole("heading", { level: 2 }).textContent).not.toBe(firstName);

    const open = screen.getAllByTestId("ward-alerts-open").at(-1)!;
    fireEvent.click(open);
    expect(open).toHaveAttribute("aria-current", "true");
    expect(open.getAttribute("aria-label")).toContain(
      within(selectedPanel()).getByRole("heading", { level: 2 }).textContent!,
    );
  });

  it("acknowledges the selected alert from the panel", () => {
    renderScreen();
    const panel = selectedPanel();
    fireEvent.click(within(panel).getByRole("button", { name: /^Acknowledge / }));
    expect(within(panel).getByRole("button", { name: /^Seen: / })).toHaveTextContent("Seen");
    expect(within(panel).getByText(/Seen by Bed coordinator/)).toBeInTheDocument();
  });

  it.each([
    [27 * 60, "1d 3h overdue"],
    [48 * 60, "2d overdue"],
    [3 * 60 + 5, "3h 05m overdue"],
    [5, "5m overdue"],
  ] as const)("shows a legal form %s minutes past its typed time as typed, never as %s (D-93)", (elapsed, expected) => {
    function SetExpiry() {
      const { movements, dispatch } = useWardFlow();
      const movement = movements.find((m) => !m.closure && m.legalForm)!;
      return (
        <button
          onClick={() =>
            dispatch({
              type: "RECORD_LEGAL_FORM_EXPIRY",
              role: "coordinator",
              now: NOW,
              movementId: movement.id,
              dueAt: NOW - elapsed,
            })
          }
        >
          Set recorded expiry
        </button>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW}>
        <SetExpiry />
        <AlertsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set recorded expiry" }));
    // D-93 (31 Oct 2026): legal form times only as typed. The row shows "Ended 09:42 as typed",
    // and the overdue duration this test used to pin is gone.
    expect(screen.getAllByText(/^Ended .+ as typed$/u)[0]).toBeVisible();
    expect(screen.queryByText(expected, { exact: true })).toBeNull();
  });

  it("renders synthetic prototype badge in the subheader (FF8)", () => {
    renderScreen();
    const badge = screen.getAllByText("Synthetic prototype")[0];
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-ward-type-floor", "badge");
  });

  // The feed used to render two typed-in items, one naming "Luke Davies" as WF-021's patient and
  // calling a transfer complete that the record does not hold (25 September 2026 audit, A7). It
  // now lists only the notices the reducer has raised, and says plainly when there are none.
  it("renders the Operational Notices & Shift Communication Feed from recorded notices only", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("tab", { name: /Notices/ }));
    const feed = screen.getByRole("region", { name: "Operational notices and shift communication feed" });
    expect(within(feed).getByText("Role notices")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("tab", { name: /Notices/ }));

    const feed = screen.getByRole("region", { name: "Operational notices and shift communication feed" });
    expect(within(feed).queryByText("No notices have been raised this session.")).not.toBeInTheDocument();
    const items = within(feed).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toMatch(/Unread/);
  });
});
