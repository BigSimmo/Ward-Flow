import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WardDecisionsCockpit, openDecisionCount } from "@/components/ward-management/ward/ward-decisions-cockpit";

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

  it("switches between decision windows without emoji labels", () => {
    render(
      <WardDecisionsCockpit
        unit={mockUnit}
        demonstration
        rollupOverdue
        onConfirmRollup={vi.fn()}
        leaves={[{ id: "l1", title: "Bed on leave · back 15:42" }]}
      />,
    );
    const staffingStep = screen.getByRole("button", { name: "Staffing, 07:00–09:30" });
    const leaveStep = screen.getByRole("button", { name: "Leave, 14:00–18:00" });

    expect(staffingStep).toHaveAttribute("aria-pressed", "true");
    expect(leaveStep).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(leaveStep);
    expect(screen.getByRole("region", { name: "Leave" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Staffing" })).not.toBeInTheDocument();
    expect(leaveStep).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Open Staffing window" }));
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
    expect(screen.getByRole("heading", { name: "Ready to sign off" })).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Held up" })).toBeInTheDocument();
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

  it("says the overdue rollup is not wired when no confirm action is supplied", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration rollupOverdue />);
    expect(screen.getByTestId("ward-morning-rollup-overdue-banner")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-confirm-morning-rollup-btn")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not wired in this prototype.").length).toBeGreaterThan(0);
  });

  it("shows the decision windows on a quiet ward when the screen supplies its rollup action", () => {
    render(<WardDecisionsCockpit unit={mockUnit} onConfirmRollup={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Staffing, 07:00–09:30" })).toBeInTheDocument();
    expect(screen.queryByText(/This illustrative cockpit does not record/)).not.toBeInTheDocument();
  });

  it("does not count people on leave as decisions still to make", () => {
    render(
      <WardDecisionsCockpit
        unit={mockUnit}
        demonstration
        leaves={[{ id: "l1", title: "Bed on leave · back 15:42" }]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Decisions, Done" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave, 14:00–18:00" }));
    expect(screen.getByRole("region", { name: "Leave" })).toHaveTextContent("Bed on leave");
    expect(screen.getAllByText("Nothing due").length).toBeGreaterThan(0);
  });

  it("counts open decisions once for the tab badge and the heading", () => {
    const base = { intakes: [], departures: [], rollupOverdue: false, rollupConfirmed: false };
    expect(openDecisionCount({ ...base, rollupActionable: false })).toBe(0);
    expect(openDecisionCount({ ...base, rollupActionable: true })).toBe(1);
    expect(openDecisionCount({ ...base, rollupConfirmed: true, rollupActionable: true })).toBe(0);
    expect(
      openDecisionCount({
        ...base,
        rollupActionable: false,
        intakes: [{ id: "i1", title: "A" }],
        departures: [
          { id: "d1", title: "B", badge: "Ready" },
          { id: "d2", title: "C", badge: "Blocked" },
          { id: "d3", title: "D", badge: "Done" },
        ],
      }),
    ).toBe(3);
  });

  it("counts a held-up discharge in the heading as well as its window", () => {
    render(
      <WardDecisionsCockpit
        unit={mockUnit}
        demonstration
        departures={[{ id: "h1", title: "Keira P.", badge: "Blocked", onClear: vi.fn() }]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Decisions, 1 due" })).toBeInTheDocument();
  });

  it("activates the four window steps via click", () => {
    render(<WardDecisionsCockpit unit={mockUnit} demonstration />);

    for (const [name, region] of [
      ["Staffing, 07:00–09:30", "Staffing"],
      ["Intake, 09:30–13:00", "Intake"],
      ["Departures, 11:00–14:00", "Departures"],
      ["Leave, 14:00–18:00", "Leave"],
    ] as const) {
      const step = screen.getByRole("button", { name });
      fireEvent.click(step);
      expect(step).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByRole("region", { name: region })).toBeInTheDocument();
    }
  });

  it("signs off every ready departure from the bulk bar", () => {
    const first = vi.fn();
    const second = vi.fn();
    render(
      <WardDecisionsCockpit
        unit={mockUnit}
        departures={[
          { id: "a", title: "Synthetic one", badge: "Ready", onConfirm: first },
          { id: "b", title: "Synthetic two", badge: "Ready", onConfirm: second },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign off 2" }));
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("confirms a sign-off only once the row reads back as signed off", () => {
    const onConfirm = vi.fn();
    const row = { id: "a", title: "Synthetic one", badge: "Ready" as const, onConfirm };
    const other = { id: "b", title: "Synthetic two", badge: "Ready" as const, onConfirm: vi.fn() };
    const view = render(<WardDecisionsCockpit unit={mockUnit} departures={[row, other]} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Sign off" })[0]!);
    expect(screen.getByRole("status")).toHaveTextContent("Sign off not recorded. Nothing was changed.");

    view.rerender(<WardDecisionsCockpit unit={mockUnit} departures={[other]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Synthetic one signed off");
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Departures decided" })).toHaveAttribute("aria-valuenow", "1");
  });

  it("collapses more than two done decisions behind Show", () => {
    render(
      <WardDecisionsCockpit
        unit={mockUnit}
        departures={[
          { id: "d1", title: "Synthetic one", badge: "Done" },
          { id: "d2", title: "Synthetic two", badge: "Done" },
          { id: "d3", title: "Synthetic three", badge: "Done" },
          { id: "r1", title: "Synthetic four", badge: "Ready", onConfirm: vi.fn() },
        ]}
      />,
    );
    expect(screen.queryByText("Synthetic one")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Show" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText("Synthetic one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows bed projections only when the screen supplies them", () => {
    const departures = [{ id: "r1", title: "Synthetic one", badge: "Ready" as const, onConfirm: vi.fn() }];
    const view = render(<WardDecisionsCockpit unit={mockUnit} departures={departures} />);
    expect(screen.queryByText("Free beds now")).not.toBeInTheDocument();
    view.rerender(
      <WardDecisionsCockpit
        unit={mockUnit}
        departures={departures}
        projection={{ freeNow: 1, freeBy: 4, byLabel: "15:00" }}
      />,
    );
    expect(screen.getByText("Free beds now")).toBeInTheDocument();
    expect(screen.getByText("Free by 15:00")).toBeInTheDocument();
  });
});
