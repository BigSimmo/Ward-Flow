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

  it("highlights rows from a checked condition without hiding any, with no owner menu on desktop", () => {
    const { container } = renderScreen();
    const total = container.querySelectorAll("li[data-alert-id]").length;
    expect(total).toBeGreaterThan(0);

    // Alerts overhaul (4 Nov 2026): the hero no longer repeats the Act now and Waiting figures, which
    // the Open view's chips already filter by. Highlighting stays on the checked conditions.
    fireEvent.click(screen.getByRole("button", { name: /^Checking \d+ flagged · \d+ clear$/u }));
    const checks = screen.getByRole("list", { name: "Conditions checked" });
    const watch = within(checks).getByRole("button", { name: /No eligible bed/u });
    fireEvent.click(watch);
    expect(watch).toHaveAttribute("aria-pressed", "true");
    const highlighted = container.querySelectorAll("li[data-highlighted]");
    expect(highlighted.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("li[data-alert-id]")).toHaveLength(total);
    const clear = screen.getByRole("button", { name: `Clear highlights, ${highlighted.length} highlighted` });

    fireEvent.click(clear);
    expect(container.querySelectorAll("li[data-highlighted]")).toHaveLength(0);

    // Josh, 31 Oct 2026 (answer 17): the desktop's Owner view under Arrange by replaces the owner menu,
    // which only phones keep (tests/ward-alerts-screen.dom.test.tsx).
    expect(screen.queryByRole("button", { name: "Highlight by owner" })).not.toBeInTheDocument();
  });

  it("opens the most urgent alert in the drawer and moves with Next alert", () => {
    renderScreen();
    // Drawer review (6 Nov 2026): nothing opens by itself; Next alert opens the most urgent first.
    expect(screen.queryByRole("complementary", { name: "Selected alert" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next alert/ }));
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
    // Drawer review (6 Nov 2026): the alert opens in the kit drawer once a row is chosen.
    fireEvent.click(screen.getAllByTestId("ward-alerts-open")[0]!);
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
    // Audit M13b (D-210, 14 Nov 2026): a typed expiry must come after the time the form was
    // written, so the expiry is typed as the current minute and the clock then runs `elapsed`
    // minutes past it. Typing it `elapsed` minutes in the past would be refused for any form
    // written more recently than that, and the row would never appear.
    function SetExpiry() {
      const { movements, dispatch, now } = useWardFlow();
      const movement = movements.find((m) => !m.closure && m.legalForm)!;
      return (
        <>
          <button
            onClick={() =>
              dispatch({
                type: "RECORD_LEGAL_FORM_EXPIRY",
                role: "coordinator",
                now,
                movementId: movement.id,
                dueAt: NOW,
              })
            }
          >
            Set recorded expiry
          </button>
          <button onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: elapsed })}>
            Run the clock past it
          </button>
        </>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW}>
        <SetExpiry />
        <AlertsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set recorded expiry" }));
    fireEvent.click(screen.getByRole("button", { name: "Run the clock past it" }));
    // D-93 (31 Oct 2026): legal form times only as typed. The row shows "Ended 09:42 as typed",
    // and the overdue duration this test used to pin is gone. The clock runs for every row, so a
    // pull or a decision target may rightly read "2d overdue"; the check is on the legal rows.
    const legalRows = screen.getAllByText(/^Ended .+ as typed$/u).map((typed) => typed.closest("li")!);
    expect(legalRows[0]).toBeVisible();
    for (const row of legalRows) {
      expect(within(row).queryByText(expected, { exact: true })).toBeNull();
      expect(row.textContent).not.toMatch(/overdue/u);
    }
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
  it("shows notices from recorded notices only, and no Notices group while there are none", () => {
    // Q181 (1 Nov 2026): unread notices are a group in Now; with none recorded there is no group.
    const { container } = renderScreen();
    expect(screen.queryByRole("region", { name: "Notices" })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Catchment Override Logged|Custodial Transfer Completed|Luke Davies/);
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

    const feed = screen.getByRole("region", { name: "Notices" });
    const items = within(feed).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toMatch(/Unread/);
  });
});
