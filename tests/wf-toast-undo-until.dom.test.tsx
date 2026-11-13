// Shared design parts item 4 (Josh, 13 Nov 2026): an Undo toast names one clock time, "Undo until
// 14:47", with no seconds left and no shrinking line; it stays at least ten seconds; and the row the
// step changed keeps a quiet "Undo pull · until 14:47" until the window ends.
import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RowUndo } from "@/components/wf/row-undo";
import { ToastView } from "@/components/wf/toast";
import { UNDO_TOAST_MIN_MS, undoUntilText } from "@/components/wf/toast-timing";

beforeEach(() => {
  vi.useFakeTimers();
  // 10:42 in Perth (UTC+8): the toast below names 10:47.
  vi.setSystemTime(new Date("2026-11-13T02:42:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Undo toast with a clock time", () => {
  it("says one clock time and draws no countdown words or line", () => {
    render(
      <ToastView
        data-testid="toast"
        title="Bed pulled for Pellingworth, Keira"
        undo={{ durationMs: 8000, until: new Date("2026-11-13T02:47:00.000Z"), onUndo: () => {} }}
      />,
    );
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent("Bed pulled for Pellingworth, Keira · Undo until 10:47");
    expect(toast).toHaveAttribute("data-undo-until");
    expect(toast.textContent).not.toMatch(/\ds left/u);
    expect(toast.querySelector("[data-undo-left]")).toBeNull();
    expect(toast.querySelector("[data-undo-bar]")).toBeNull();
  });

  it("shows an HH:MM string as given", () => {
    expect(undoUntilText("14:47")).toBe("Undo until 14:47");
    render(<ToastView title="Bed held" undo={{ durationMs: 8000, until: "14:47", onUndo: () => {} }} />);
    expect(screen.getByText(/Undo until 14:47/u)).toBeInTheDocument();
  });

  it("stays at least ten seconds, and hover pauses it", () => {
    const onExpire = vi.fn();
    render(
      <ToastView
        data-testid="toast"
        title="Bed pulled"
        undo={{ durationMs: 8000, until: "10:47", onUndo: () => {}, onExpire }}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(9000);
    });
    expect(onExpire).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Undo" })).not.toHaveAttribute("aria-disabled");
    fireEvent.pointerEnter(screen.getByTestId("toast"));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
    fireEvent.pointerLeave(screen.getByTestId("toast"));
    act(() => {
      vi.advanceTimersByTime(UNDO_TOAST_MIN_MS - 9000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("keeps the caller's window when it is longer than ten seconds", () => {
    const onExpire = vi.fn();
    render(<ToastView title="Bed pulled" undo={{ durationMs: 15_000, until: "10:47", onUndo: () => {}, onExpire }} />);
    act(() => {
      vi.advanceTimersByTime(14_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});

describe("RowUndo", () => {
  it("offers the named undo with its clock time and runs it", () => {
    const onUndo = vi.fn();
    render(<RowUndo verb="pull" until={new Date("2026-11-13T02:47:00.000Z")} onUndo={onUndo} />);
    const button = screen.getByRole("button", { name: "Undo pull · until 10:47" });
    fireEvent.click(button);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("goes once the window ends, on time rather than at the next minute", () => {
    // 10:46:30 in Perth: the window ends at 10:47:00, thirty seconds on.
    vi.setSystemTime(new Date("2026-11-13T02:46:30.000Z"));
    render(<RowUndo verb="pull" until={new Date("2026-11-13T02:47:00.000Z").getTime()} onUndo={() => {}} />);
    expect(screen.getByRole("button", { name: "Undo pull · until 10:47" })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(screen.getByRole("button", { name: /Undo pull/u })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole("button", { name: /Undo pull/u })).toBeNull();
  });

  it("follows a clock the caller gives, such as the board clock", () => {
    const until = new Date("2026-11-13T02:47:00.000Z").getTime();
    const view = render(<RowUndo verb="pull" until={until} now={until - 60_000} onUndo={() => {}} />);
    expect(screen.getByRole("button", { name: "Undo pull · until 10:47" })).toBeInTheDocument();
    view.rerender(<RowUndo verb="pull" until={until} now={until} onUndo={() => {}} />);
    expect(screen.queryByRole("button", { name: /Undo pull/u })).toBeNull();
  });
});
