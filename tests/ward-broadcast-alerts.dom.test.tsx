// Pre-commit hook's isolated per-file typecheck builds a program from only the staged file plus
// every .d.ts in the project -- tests/setup/jsdom.setup.ts (where the real vitest run registers
// these matchers via the same import) is a .ts file reached only through vitest's `setupFiles`,
// never through this file's own import graph, so the hook cannot see it register jest-dom's
// matcher types otherwise. This import makes this file typecheck on its own.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WA_BROADCAST_TEMPLATES } from "@/components/ward-management/alerts/ward-broadcast-model";

const NOW = NOW_ANCHOR;

function renderAlertsScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      {/* Mounted exactly as the real app mounts it — src/app/mockups/ward-flow/layout.tsx
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
  it("renders the broadcast trigger button and opens the modal", () => {
    renderAlertsScreen();
    const trigger = screen.getByText("+ Broadcast Network Alert");
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: /Broadcast Statewide Network Alert/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/WA Clinical Protocol & Flow Template/i)).toBeInTheDocument();
  });

  it("populates form fields when changing the WA Mental Health template", () => {
    renderAlertsScreen();
    fireEvent.click(screen.getByText("+ Broadcast Network Alert"));

    const templateSelect = screen.getByLabelText(/WA Clinical Protocol & Flow Template/i);
    // Switch to Graylands Forensic Surge template
    fireEvent.change(templateSelect, { target: { value: "wa-forensic-full-advisory" } });

    const titleInput = screen.getByLabelText(/Directive Headline \/ Title/i) as HTMLInputElement;
    expect(titleInput.value).toContain("State Forensic Service High-Security Beds");

    const messageInput = screen.getByLabelText(/Message Body & Clinical Instructions/i) as HTMLTextAreaElement;
    expect(messageInput.value).toContain("Graylands Frankland Centre secure beds fully committed");
  });

  it("requires clinical confirmation safeguard before enabling dispatch", () => {
    renderAlertsScreen();
    fireEvent.click(screen.getByText("+ Broadcast Network Alert"));

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
    fireEvent.click(screen.getByText("+ Broadcast Network Alert"));

    const safeguard = screen.getByLabelText(/I confirm this directive is clinically authorised/i);
    fireEvent.click(safeguard);

    const confirmBtn = screen.getByTestId("ward-alerts-broadcast-confirm");
    fireEvent.click(confirmBtn);

    // Modal closes
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Success toast shown
    expect(screen.getByText(/dispatched statewide\./i)).toBeInTheDocument();

    // Active directive card rendered in Alerts view
    expect(screen.getByLabelText("Active Statewide Directive")).toBeInTheDocument();
    // 23 -> 22 on 26 Sept 2026: Kununurra has no ward (owner-approved ward facts).
    expect(screen.getByText(/22 Clinical Units Acknowledged/i)).toBeInTheDocument();

    // Global broadcast banner rendered
    const banner = screen.getByTestId("ward-broadcast-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Critical Directive/i);
  });

  it("allows unit acknowledgement via global banner (as coordinator-desk) and standing down the directive", () => {
    renderAlertsScreen();

    // Dispatch alert first
    fireEvent.click(screen.getByText("+ Broadcast Network Alert"));
    fireEvent.click(screen.getByLabelText(/I confirm this directive is clinically authorised/i));
    fireEvent.click(screen.getByTestId("ward-alerts-broadcast-confirm"));

    // Before ack: nobody has acknowledged yet.
    expect(screen.getByText(/^0 of \d+ Clinical Units Acknowledged$/i)).toBeInTheDocument();

    // Global banner acknowledge button
    const banner = screen.getByTestId("ward-broadcast-banner");
    const ackBtn = within(banner).getByRole("button", { name: /^Acknowledge$/i });
    expect(ackBtn).toBeInTheDocument();
    fireEvent.click(ackBtn);

    // After ack, span changes to confirmed
    expect(within(banner).getByText("Acknowledged")).toBeInTheDocument();

    // The acknowledgement was genuinely recorded (not silently refused): the count rose by one.
    // The banner is mounted with no currentUnitId (as the real app mounts it), so the only
    // unitId it can have sent is COORDINATOR_DESK_ACKNOWLEDGER_ID -- proving the reducer
    // accepted that sender rather than refusing it as an unrecognised unit.
    expect(screen.getByText(/^1 of \d+ Clinical Units Acknowledged$/i)).toBeInTheDocument();

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
