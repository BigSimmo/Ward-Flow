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
    const trigger = screen.getByRole("button", { name: "Broadcast alert" });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: /Broadcast network alert/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Start from$/i)).toBeInTheDocument();
  });

  it("labels each target with counts from the unit list and names severity in one word set (ops-12)", () => {
    renderAlertsScreen();
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    const scope = screen.getByLabelText(/^Target scope$/i);
    expect(within(scope).getByRole("option", { name: /^All inpatient wards and ED desks/ })).toHaveTextContent(
      `${allUnits().length} wards and ${allEmergencyDepartments().length} ED desks`,
    );
    const severity = screen.getByLabelText(/^Severity$/i);
    expect(
      within(severity)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Advisory", "Warning", "Critical"]);
  });

  it("populates form fields when changing the WA Mental Health template", () => {
    renderAlertsScreen();
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));

    const templateSelect = screen.getByLabelText(/^Start from$/i);
    // Switch to Graylands Forensic Surge template
    fireEvent.change(templateSelect, { target: { value: "wa-forensic-full-advisory" } });

    const titleInput = screen.getByLabelText(/^Title$/i) as HTMLInputElement;
    expect(titleInput.value).toContain("Demo: forensic beds full");

    const messageInput = screen.getByLabelText(/^Directive$/i) as HTMLTextAreaElement;
    expect(messageInput.value).toContain("Graylands Frankland Centre secure beds fully committed");
  });

  it("requires clinical confirmation safeguard before enabling dispatch", () => {
    renderAlertsScreen();
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));

    const confirmBtn = screen.getByTestId("ward-alerts-broadcast-confirm");
    expect(confirmBtn).toBeDisabled();

    const safeguard = screen.getByLabelText(/I confirm this directive is clinically authorised/i);
    fireEvent.click(safeguard);
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(safeguard);
    expect(confirmBtn).toBeDisabled();
  });

  it("dispatches statewide alert, mounts global banner, and renders active directive card", () => {
    renderAlertsScreen();
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));

    const safeguard = screen.getByLabelText(/I confirm this directive is clinically authorised/i);
    fireEvent.click(safeguard);

    const confirmBtn = screen.getByTestId("ward-alerts-broadcast-confirm");
    fireEvent.click(confirmBtn);

    // Modal closes
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Success toast shown
    expect(screen.getByText(/shown in this prototype only; no external notifications are sent\./i)).toBeInTheDocument();

    // Active directive card rendered in Alerts view
    expect(screen.getByLabelText("Active Statewide Directive")).toBeInTheDocument();
    // Ops-11 (13 Oct 2026): nobody has acknowledged yet, counted against the desks the directive
    // asked: every ward and every ED desk for the all-units target, never the coordinator desk.
    expect(
      screen.getByText(`0 of ${allUnits().length + allEmergencyDepartments().length} units acknowledged`),
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
    fireEvent.click(screen.getByRole("button", { name: "Broadcast alert" }));
    fireEvent.click(screen.getByLabelText(/I confirm this directive is clinically authorised/i));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));

    // Before ack: nobody has acknowledged yet.
    expect(screen.getByText(/^0 of \d+ units acknowledged$/i)).toBeInTheDocument();

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
    expect(screen.getByText(/^1 of \d+ units acknowledged$/i)).toBeInTheDocument();

    // Stand down directive from alerts screen
    const standDownBtn = screen.getByRole("button", { name: /Stand down this alert/i });
    fireEvent.click(standDownBtn);

    // Active directive card disappears and confirmation toast appears
    expect(screen.queryByLabelText("Active Statewide Directive")).not.toBeInTheDocument();
    expect(screen.getByText("Statewide broadcast directive stood down.")).toBeInTheDocument();

    // Global banner is no longer rendered
    expect(screen.queryByTestId("ward-broadcast-banner")).not.toBeInTheDocument();
  });
});
