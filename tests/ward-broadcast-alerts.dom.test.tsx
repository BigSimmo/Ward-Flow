// Pre-commit hook's isolated per-file typecheck builds a program from only the staged file plus
// every .d.ts in the project -- tests/setup/jsdom.setup.ts (where the real vitest run registers
// these matchers via the same import) is a .ts file reached only through vitest's `setupFiles`,
// never through this file's own import graph, so the hook cannot see it register jest-dom's
// matcher types otherwise. This import makes this file typecheck on its own.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { alertsBroadcastItem, openAlertsBroadcast } from "./helpers/alerts-broadcast";

const NOW = NOW_ANCHOR;

function renderAlertsScreen(wardDeskId?: string) {
  return render(
    <WardFlowProvider initialNow={NOW}>
      {wardDeskId ? (
        <div data-testid="ward-desk">
          <WardBroadcastBanner currentUnitId={wardDeskId} />
        </div>
      ) : null}
      {/* Mounted exactly as the real app mounts it — src/app/ward-flow/layout.tsx
          passes no `currentUnitId`, so acknowledging here sends
          COORDINATOR_DESK_ACKNOWLEDGER_ID, the one non-unit sender
          ACKNOWLEDGE_BROADCAST_ALERT exempts from the "must name a real unit" refusal
          (owner ruling 2026-09-25). */}
      <WardBroadcastBanner />
      <AlertsScreen />
    </WardFlowProvider>,
  );
}

describe("Ward Flow Statewide Broadcast Alerts", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });
  it("renders the broadcast trigger button and opens the modal", () => {
    renderAlertsScreen();
    const trigger = alertsBroadcastItem();
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: /New broadcast/i })).toBeInTheDocument();
    // Alerts redesign (1 Nov 2026): it opens on Ask wards for beds, Adult beds today.
    expect(screen.getByRole("radio", { name: /Ask wards for beds/ })).toHaveAttribute("aria-checked", "true");
    const starts = screen.getByRole("group", { name: "Start from" });
    expect(within(starts).getByRole("button", { name: "Adult beds today" })).toHaveAttribute("aria-pressed", "true");
  });

  it("counts every ward and ED desk for Everyone and names severity in one word set (ops-12)", () => {
    renderAlertsScreen();
    openAlertsBroadcast();
    fireEvent.click(screen.getByRole("radio", { name: /Tell areas something/ }));
    const everyone = allUnits().length + allEmergencyDepartments().length;
    expect(
      within(screen.getByRole("radiogroup", { name: "Audience" })).getByRole("radio", { name: "Everyone" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("heading", { name: `Shows on ${everyone} screens` })).toBeInTheDocument();
    expect(screen.getByLabelText(`I'm authorised to send this to ${everyone} units.`)).toBeInTheDocument();
    expect(
      within(screen.getByRole("radiogroup", { name: "Severity" }))
        .getAllByRole("radio")
        .map((option) => option.textContent),
    ).toEqual(["Advisory", "Warning", "Critical"]);
  });

  it("populates form fields when choosing a quick start", () => {
    renderAlertsScreen();
    openAlertsBroadcast();
    fireEvent.click(screen.getByRole("radio", { name: /Tell areas something/ }));
    fireEvent.click(screen.getByRole("button", { name: "Unit closed" }));

    const titleInput = screen.getByLabelText(/^Title$/i) as HTMLInputElement;
    expect(titleInput.value).toContain("Demo: admissions paused");

    const messageInput = screen.getByLabelText(/^Message$/i) as HTMLTextAreaElement;
    expect(messageInput.value).toContain("closed to new admissions");
  });

  it("requires the authorisation tick before enabling Send", () => {
    renderAlertsScreen();
    openAlertsBroadcast();

    const confirmBtn = () => screen.getByTestId("ward-alerts-broadcast-confirm");
    expect(confirmBtn()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Tick the box to send")).toBeInTheDocument();

    const safeguard = screen.getByLabelText(/I'm authorised to send this to/i);
    fireEvent.click(safeguard);
    expect(confirmBtn()).not.toHaveAttribute("aria-disabled", "true");

    fireEvent.click(safeguard);
    expect(confirmBtn()).toHaveAttribute("aria-disabled", "true");
  });

  it("dispatches statewide alert, mounts global banner, and renders active directive card", () => {
    renderAlertsScreen();
    openAlertsBroadcast();
    fireEvent.click(screen.getByRole("radio", { name: /Tell areas something/ }));

    const safeguard = screen.getByLabelText(/I'm authorised to send this to/i);
    fireEvent.click(safeguard);

    const confirmBtn = screen.getByTestId("ward-alerts-broadcast-confirm");
    fireEvent.click(confirmBtn);

    // Modal closes
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Success toast shown
    expect(screen.getByText(/shown in this prototype only; no external notifications are sent\./i)).toBeInTheDocument();

    // Active directive card rendered in Alerts view
    expect(screen.getByLabelText("Current broadcast")).toBeInTheDocument();
    // Ops-11 (13 Oct 2026): nobody has acknowledged yet, counted against the desks the directive
    // asked: every ward and every ED desk for the all-units target, never the coordinator desk.
    expect(
      within(screen.getByLabelText("Current broadcast")).getByText(
        `0 of ${allUnits().length + allEmergencyDepartments().length} acknowledged`,
      ),
    ).toBeInTheDocument();

    // Global broadcast banner rendered
    const banner = screen.getByTestId("ward-broadcast-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Critical Directive/i);
  });

  it("does not ask the coordinator to acknowledge their own directive; a ward acknowledges, then it is stood down", () => {
    const ward = allUnits()[0];
    renderAlertsScreen(ward.id);

    // Dispatch alert first
    openAlertsBroadcast();
    fireEvent.click(screen.getByRole("radio", { name: /Tell areas something/ }));
    fireEvent.click(screen.getByLabelText(/I'm authorised to send this to/i));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));

    // Before ack: nobody has acknowledged yet.
    expect(
      within(screen.getByLabelText("Current broadcast")).getByText(/^0 of \d+ acknowledged$/i),
    ).toBeInTheDocument();

    // Ops-13 (13 Oct 2026): the coordinator sent it, so their banner shows the count and no
    // Acknowledge button.
    const desks = screen.getAllByTestId("ward-broadcast-banner");
    const wardBanner = within(screen.getByTestId("ward-desk")).getByTestId("ward-broadcast-banner");
    const coordinatorBanner = desks.find((banner) => banner !== wardBanner)!;
    expect(within(coordinatorBanner).queryByRole("button", { name: /^Acknowledge$/i })).toBeNull();
    expect(coordinatorBanner).toHaveTextContent(/0 of \d+ acknowledged/);

    // The ward is asked, and its acknowledgement is recorded: the count rises by one.
    fireEvent.click(within(wardBanner).getByRole("button", { name: /^Acknowledge$/i }));
    expect(within(wardBanner).getByText("Acknowledged")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Current broadcast")).getByText(/^1 of \d+ acknowledged$/i),
    ).toBeInTheDocument();

    // Stand down directive from alerts screen
    const standDownBtn = screen.getByRole("button", { name: /Stand down this alert/i });
    fireEvent.click(standDownBtn);

    // Active directive card disappears and confirmation toast appears
    expect(screen.queryByLabelText("Current broadcast")).not.toBeInTheDocument();
    expect(screen.getByText("Statewide broadcast directive stood down.")).toBeInTheDocument();

    // Global banner is no longer rendered
    expect(screen.queryByTestId("ward-broadcast-banner")).not.toBeInTheDocument();
  });
});
