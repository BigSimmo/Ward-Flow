import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette, NeedsYou, UndoHairline, type CommandPaletteItem } from "@/components/wf";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { PhoneWalkRoundSheet, WardTop25Cockpit } from "@/components/ward-management/top25/ward-top25-cockpit";

describe("Perfected Top 25 Ward Flow Master List — DOM & Interactive Component Suite", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders NeedsYou (#6) when count > 0 and collapses when count === 0", () => {
    const { rerender } = render(<NeedsYou label="Needs You (COORDINATOR)" count={2} tone="warning" />);
    expect(screen.getByTestId("wf-needs-you")).toBeInTheDocument();
    expect(screen.getByText("Needs You (COORDINATOR)")).toBeInTheDocument();

    rerender(<NeedsYou label="Needs You (COORDINATOR)" count={0} tone="warning" />);
    expect(screen.queryByTestId("wf-needs-you")).not.toBeInTheDocument();
  });

  it("renders UndoHairline (#17) with 8-second countdown, triggers onUndo on click, and fires onExpire after durationMs", () => {
    vi.useFakeTimers();
    try {
      const onUndo = vi.fn();
      const onExpire = vi.fn();
      render(
        <UndoHairline
          message="Declined referral to Bentley Ward 7"
          durationMs={8000}
          onUndo={onUndo}
          onExpire={onExpire}
        />,
      );
      expect(screen.getByTestId("wf-undo-hairline")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^Undo$/i }));
      expect(onUndo).toHaveBeenCalledTimes(1);

      expect(onExpire).not.toHaveBeenCalled();
      vi.advanceTimersByTime(8000);
      expect(onExpire).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders CommandPalette (#22), filters by keyword, stops Escape propagation, and resets query on close", () => {
    const onSelectA = vi.fn();
    const onOpenChange = vi.fn();
    const parentEscapeSpy = vi.fn();
    const items: CommandPaletteItem[] = [
      {
        id: "cp-1",
        label: "Jump to Bentley Ward 7",
        category: "Ward",
        keywords: ["bty", "acute"],
        onSelect: onSelectA,
      },
      {
        id: "cp-2",
        label: "Confirm Morning Discharge",
        category: "Flow",
        keywords: ["tto"],
        onSelect: vi.fn(),
      },
    ];

    window.addEventListener("keydown", parentEscapeSpy);
    try {
      const { rerender } = render(<CommandPalette open={true} onOpenChange={onOpenChange} items={items} />);
      const input = screen.getByTestId("wf-command-palette-input") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "bty" } });
      expect(input.value).toBe("bty");

      // Pressing Escape closes the palette, stops propagation to parent window listeners, and resets query
      fireEvent.keyDown(input, { key: "Escape" });
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(parentEscapeSpy).not.toHaveBeenCalled();

      rerender(<CommandPalette open={true} onOpenChange={onOpenChange} items={items} />);
      const reopenedInput = screen.getByTestId("wf-command-palette-input") as HTMLInputElement;
      expect(reopenedInput.value).toBe("");

      fireEvent.change(reopenedInput, { target: { value: "bty" } });
      const option = screen.getByText("Jump to Bentley Ward 7");
      fireEvent.click(option);
      expect(onSelectA).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", parentEscapeSpy);
    }
  });

  it("renders PhoneWalkRoundSheet (#23) with 390x844 viewport and 52px row height", () => {
    const onPrimaryAction = vi.fn();
    render(<PhoneWalkRoundSheet onPrimaryAction={onPrimaryAction} />);
    const sheet = screen.getByTestId("phone-walk-round-sheet");
    expect(sheet).toHaveAttribute("data-viewport", "390x844");
    expect(sheet).toHaveAttribute("data-row-height", "52");

    fireEvent.click(screen.getByRole("button", { name: "Confirm Morning Discharge" }));
    expect(onPrimaryAction).toHaveBeenCalledWith("wr-bed-1");
  });

  it("renders controlled WardBroadcastBanner (#25) with [Extend +2h] and [Stand Down — Resolved]", () => {
    const onExtend = vi.fn();
    const onClear = vi.fn();
    render(
      <WardBroadcastBanner
        activeAlert={{
          id: "b-1",
          title: "Code Yellow Surge",
          message: "Check morning discharges",
          severity: "critical",
          author: "State Bed Desk",
          createdAt: "2026-10-15T08:00:00.000Z",
          expiresAt: "2026-10-15T12:00:00.000Z",
          status: "active",
        }}
        now="2026-10-15T08:30:00.000Z"
        onExtend={onExtend}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Extend \+2h/i }));
    expect(onExtend).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Stand Down — Resolved/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("renders full interactive WardTop25Cockpit across all 4 tiers and executes interactive actions (#1, #3, #7, #9)", () => {
    render(<WardTop25Cockpit />);
    expect(screen.getByTestId("ward-top25-cockpit")).toBeInTheDocument();
    expect(screen.getByTestId("top25-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("top25-item-3")).toBeInTheDocument();
    expect(screen.getByTestId("top25-item-7")).toBeInTheDocument();
    expect(screen.getByTestId("top25-item-9")).toBeInTheDocument();
    expect(screen.getByTestId("top25-item-16")).toBeInTheDocument();
    expect(screen.getByTestId("top25-item-24")).toBeInTheDocument();

    // Trigger #1 parallel support dispatch
    fireEvent.click(screen.getByRole("button", { name: /Confirm Morning Discharge & Dispatch Support/i }));
    expect(screen.getByText(/Dispatched: pharmacy, transport, cleaning/i)).toBeInTheDocument();

    // Trigger #3 refusal recovery action
    fireEvent.click(screen.getByRole("button", { name: /Show compatible wards or record coordinator ward check/i }));
    expect(
      screen.getByText(/Applied filter: Show compatible wards or record coordinator ward check/i),
    ).toBeInTheDocument();

    // Trigger #7 silent ward switch action
    fireEvent.click(screen.getByRole("button", { name: /Switch to Next Compatible Ward/i }));
    expect(screen.getByText(/Re-allocated unanswered referral to next compatible ward/i)).toBeInTheDocument();

    // Trigger #9 CLD criteria completion
    fireEvent.click(screen.getByRole("button", { name: /Mark All CLD Criteria Met/i }));
    expect(screen.getByText(/3\/3 Criteria Met/i)).toBeInTheDocument();
  });
});
