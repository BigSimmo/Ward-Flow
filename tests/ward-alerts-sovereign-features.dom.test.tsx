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
    expect(screen.getByRole("region", { name: "Snoozed" })).toHaveTextContent("None now");

    fireEvent.click(within(arrange).getByRole("radio", { name: /Owner/ }));
    expect(screen.getByRole("region", { name: "Flow coordinator" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "ED mental health team" })).toBeInTheDocument();
  });

  it("highlights rows from a hero figure or an owner chip without hiding any", () => {
    const { container } = renderScreen();
    const total = container.querySelectorAll("li[data-alert-id]").length;
    expect(total).toBeGreaterThan(0);

    const summary = screen.getByRole("group", { name: "Alert summary" });
    const actNow = within(summary).getByRole("button", { name: /Act now/ });
    fireEvent.click(actNow);
    expect(actNow).toHaveAttribute("aria-pressed", "true");
    const highlighted = container.querySelectorAll("li[data-highlighted]");
    expect(highlighted.length).toBeGreaterThan(0);
    for (const row of highlighted) expect(row).toHaveAttribute("data-tone", "danger");
    expect(container.querySelectorAll("li[data-alert-id]")).toHaveLength(total);
    expect(screen.getByText(`${highlighted.length} highlighted`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(container.querySelectorAll("li[data-highlighted]")).toHaveLength(0);

    const owners = screen.getByRole("group", { name: "Highlight by owner" });
    fireEvent.click(within(owners).getByRole("button", { name: /ED team/ }));
    for (const row of container.querySelectorAll("li[data-highlighted]")) {
      expect(row).toHaveTextContent("ED mental health team");
    }
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
    expect(within(panel).getByRole("button", { name: /^Acknowledged / })).toHaveTextContent("Seen");
    expect(within(panel).getByText(/Seen by Flow coordinator/)).toBeInTheDocument();
  });

  it.each([
    [27 * 60, "1d 3h overdue"],
    [48 * 60, "2d overdue"],
    [3 * 60 + 5, "3h 05m overdue"],
    [5, "5m overdue"],
  ] as const)("preserves the full recorded overdue duration of %s minutes", (elapsed, expected) => {
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
    expect(screen.getByText(expected, { exact: true })).toBeVisible();
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
    const feed = screen.getByRole("region", { name: "Operational Notices and Shift Communication Feed" });
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

    const feed = screen.getByRole("region", { name: "Operational Notices and Shift Communication Feed" });
    expect(within(feed).queryByText("No notices have been raised this session.")).not.toBeInTheDocument();
    const items = within(feed).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toMatch(/Unread/);
  });
});
