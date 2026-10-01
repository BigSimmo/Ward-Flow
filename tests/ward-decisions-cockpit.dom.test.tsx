import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

  it("renders chronological shift milestone ribbon with 4 gates", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);
    expect(screen.getByRole("button", { name: /GATE 1 · 07:00–09:30/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GATE 2 · 09:30–13:00/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GATE 3 · 11:00–14:00/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GATE 4 · 14:00–18:00/i })).toBeInTheDocument();
  });

  it("renders action queue filter strip and toggles filter views", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);
    const allButton = screen.getByRole("button", { name: /All Gates/i });
    const urgentButton = screen.getByRole("button", { name: /Immediate Actions/i });
    const barriersButton = screen.getByRole("button", { name: /Barriers & Escalation/i });

    expect(allButton).toBeInTheDocument();
    expect(urgentButton).toBeInTheDocument();
    expect(barriersButton).toBeInTheDocument();

    // Filter to Barriers
    fireEvent.click(barriersButton);
    expect(screen.getByText(/Rowan Ross/i)).toBeInTheDocument();

    // Switch back to all
    fireEvent.click(allButton);
    expect(screen.getByText(/Physical vs Staffed Capacity Declaration/i)).toBeInTheDocument();
  });

  it("allows re-affirming staffing handshake and records audit log entry", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);
    const confirmBtn = screen.getByRole("button", { name: /Re-affirm Handshake/i });
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);

    // Toast and Audit log entries are present
    const entries = screen.getAllByText(/Capacity Handshake Re-affirmed/i);
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it("allows accepting referral Aaron K to Bed 04", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);
    const acceptBtn = screen.getByRole("button", { name: /✓ Accept to Bed 04/i });
    expect(acceptBtn).toBeInTheDocument();

    fireEvent.click(acceptBtn);

    // Resolution banner appears with Undo button
    expect(screen.getByText(/Inbound Referral Accepted · Allocated to Bed 04/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Undo Decision/i })).toBeInTheDocument();
  });
});
