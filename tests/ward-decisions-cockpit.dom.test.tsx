import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardDecisionsCockpit } from "@/components/ward-management/ward/ward-decisions-cockpit";

import type { Unit } from "@/components/ward-management/ward-model";

describe("ward decisions cockpit", () => {
  const mockUnit = {
    id: "rph-adult-secure",
    name: "Ward 2K (Adult Acute)",
    beds: 24,
    gender: "mixed",
    security: "secure",
    service: "adult",
  } as unknown as Unit;

  it("renders four compact decision titles instead of gate numbers", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);
    expect(screen.getByRole("button", { name: "Staffing, 07:00–09:30" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intake, 09:30–13:00" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Departures, 11:00–14:00" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave, 14:00–18:00" })).toBeInTheDocument();
    expect(screen.queryByText(/GATE 1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Demonstration only/i)).not.toBeInTheDocument();
  });

  it("filters the queue without emoji labels", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);
    const allButton = screen.getByRole("button", { name: "All" });
    const dueButton = screen.getByRole("button", { name: "Due now" });
    const barriersButton = screen.getByRole("button", { name: "Barriers" });
    const leaveButton = screen.getByRole("button", { name: "Leave", pressed: false });

    expect(allButton).toBeInTheDocument();
    expect(dueButton).toBeInTheDocument();
    expect(barriersButton).toBeInTheDocument();

    fireEvent.click(leaveButton);
    expect(screen.getByRole("region", { name: "Leave" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Staffing" })).not.toBeInTheDocument();

    fireEvent.click(allButton);
    expect(screen.getByRole("region", { name: "Staffing" })).toBeInTheDocument();
    expect(screen.queryByText(/Immediate Actions/i)).not.toBeInTheDocument();
  });

  it("keeps status badges on one line", () => {
    render(
      <WardDecisionsCockpit
        unit={mockUnit}
        demonstration
        departures={[{ id: "r1", title: "Keira P.", badge: "Ready", onConfirm: vi.fn() }]}
      />,
    );
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Release Ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Action Due/i)).not.toBeInTheDocument();
  });

  it("shows the staffing controls when they are supplied", () => {
    render(
      <WardDecisionsCockpit unit={mockUnit} staffingFact="1 allocatable">
        <button type="button">Confirm unchanged</button>
      </WardDecisionsCockpit>,
    );
    expect(screen.getByRole("button", { name: "Confirm unchanged" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Staffing, 07:00–09:30" })).toHaveTextContent("1 allocatable");
  });

  it("accepts a live intake from its row", () => {
    const onAccept = vi.fn();
    render(<WardDecisionsCockpit unit={mockUnit} intakes={[{ id: "m1", title: "Synthetic referral", onAccept }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it("signs off a ready departure and clears a barrier", () => {
    const onConfirm = vi.fn();
    const onClear = vi.fn();
    render(
      <WardDecisionsCockpit
        unit={mockUnit}
        departures={[
          { id: "ready", title: "Bed coming free", badge: "Ready", onConfirm },
          { id: "blocked", title: "Bed held", badge: "Blocked", onClear },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign off" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
  });

  it("puts the morning rollup confirm on the staffing row", () => {
    const onConfirmRollup = vi.fn();
    render(
      <WardDecisionsCockpit unit={mockUnit} rollupOverdue rollupTimeLabel="09:30" onConfirmRollup={onConfirmRollup}>
        <span>Counts</span>
      </WardDecisionsCockpit>,
    );
    const banner = screen.getByTestId("ward-morning-rollup-overdue-banner");
    expect(banner).toHaveTextContent("09:30 Morning Bed Rollup Overdue");
    fireEvent.click(screen.getByTestId("ward-confirm-morning-rollup-btn"));
    expect(onConfirmRollup).toHaveBeenCalledOnce();
  });

  it("activates the four summary cards via keyboard", () => {
    const scrollMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;

    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);

    for (const name of [
      "Staffing, 07:00–09:30",
      "Intake, 09:30–13:00",
      "Departures, 11:00–14:00",
      "Leave, 14:00–18:00",
    ]) {
      scrollMock.mockClear();
      fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
      expect(scrollMock).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    }
  });
});
