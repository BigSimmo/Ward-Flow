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

  it("restores focus to trigger button when dialog is dismissed via Escape or close button", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);

    const handoverBtn = screen.getByRole("button", { name: /📋 Handover Summary/i });
    handoverBtn.focus();
    expect(document.activeElement).toBe(handoverBtn);

    fireEvent.click(handoverBtn);
    expect(screen.getByRole("dialog", { name: /Shift Handover Summary/i })).toBeInTheDocument();

    // Dismiss with Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /Shift Handover Summary/i })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(handoverBtn);

    // Open decline modal
    const declineBtn = screen.getByRole("button", { name: /✕ Decline/i });
    declineBtn.focus();
    expect(document.activeElement).toBe(declineBtn);

    fireEvent.click(declineBtn);
    expect(screen.getByRole("dialog", { name: /Decline Inbound Referral/i })).toBeInTheDocument();

    // Dismiss with Close button
    const closeBtn = screen.getByRole("button", { name: /^Close$/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog", { name: /Decline Inbound Referral/i })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(declineBtn);
  });

  it("clears hidden decline draft when alternative decision (accept or ED MO review) wins", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);

    const declineBtn = screen.getByRole("button", { name: /✕ Decline/i });
    fireEvent.click(declineBtn);

    const notesTextarea = screen.getByLabelText(/Clinical Explanatory Note/i);
    fireEvent.change(notesTextarea, { target: { value: "Acuity too high for our nursing ratio" } });

    // Close without submitting
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Accept to Bed 04 wins
    const acceptBtn = screen.getByRole("button", { name: /✓ Accept to Bed 04/i });
    fireEvent.click(acceptBtn);

    // Draft is purged from sessionStorage
    expect(window.sessionStorage.getItem(`cockpit-decline-${mockUnit.id}`)).toBeNull();
  });

  it("clears hidden barrier draft when postponing discharge", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);

    const barrierBtn = screen.getByRole("button", { name: /📞 Escalate to Social Work & Flow/i });
    fireEvent.click(barrierBtn);

    const actionTextarea = screen.getByLabelText(/Action Note/i);
    fireEvent.change(actionTextarea, { target: { value: "Housing voucher delay" } });

    // Close without submitting
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Postpone discharge wins
    const postponeBtn = screen.getByRole("button", { name: /⏳ Postpone to Tomorrow/i });
    fireEvent.click(postponeBtn);

    // Draft is purged from sessionStorage
    expect(window.sessionStorage.getItem(`cockpit-barrier-${mockUnit.id}`)).toBeNull();
  });
});
