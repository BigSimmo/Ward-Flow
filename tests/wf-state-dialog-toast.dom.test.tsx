/** @vitest-environment jsdom */

import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, StateLine, ToastView, type StateKind } from "@/components/wf";

describe("StateLine", () => {
  it.each<[StateKind, string, "status" | "alert"]>([
    ["empty", "No one waiting", "status"],
    ["stale", "Updated 12m ago", "status"],
    ["error", "Transport did not load", "alert"],
    ["clear", "All clear", "status"],
  ])("renders %s as one line with role %s", (kind, title, role) => {
    const onAction = vi.fn();
    render(
      kind === "clear" ? (
        <StateLine kind="clear" reason="No delays over target" action={{ label: "Show all", onAction }} />
      ) : (
        <StateLine kind={kind} title={title} reason="Checked at 10:42" action={{ label: "Retry", onAction }} />
      ),
    );
    const line = screen.getByRole(role);
    expect(line).toHaveAttribute("data-kind", kind);
    expect(line).toHaveTextContent(title);
    // The glyph carries the tone and is decoration only.
    expect(line.querySelector("svg")).toHaveAttribute("aria-hidden", "true");

    const button = screen.getByRole("button", { name: kind === "clear" ? "Show all" : "Retry" });
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("defaults the clear title to All clear and renders no button without an action", () => {
    render(<StateLine kind="clear" reason="No delays over target" />);
    const line = screen.getByRole("status");
    expect(line).toHaveTextContent("All clear");
    expect(line).toHaveTextContent("No delays over target");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Dialog", () => {
  beforeEach(() => {
    // jsdom has no layout; the trap only cycles through controls that have client rects.
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({
      length: 1,
      item: () => null,
      [Symbol.iterator]: function* () {
        yield {} as DOMRect;
      },
    } as DOMRectList);
  });

  function Harness({ onConfirm = () => {} }: { onConfirm?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Release bed
        </button>
        <button type="button">Elsewhere</button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Release bed 4?"
          description="The bed returns to the pool."
          primary={{ label: "Release", onAction: onConfirm }}
          secondary={[{ label: "Cancel", onAction: () => setOpen(false) }]}
        >
          <label>
            Note
            <input type="text" />
          </label>
        </Dialog>
      </>
    );
  }

  function tab(shiftKey = false) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true }));
    });
  }

  it("is modal, labelled by its title and described by its description", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Release bed" }));
    const dialog = await screen.findByRole("dialog", { name: "Release bed 4?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("The bed returns to the pool.");
    // One primary at most; secondaries are ghost buttons.
    expect(screen.getByRole("button", { name: "Release" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("traps Tab inside in both directions and returns focus to the opener on close", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Release bed" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Release bed 4?" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    const last = screen.getByRole("button", { name: "Release" });
    last.focus();
    tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
    tab(true);
    expect(document.activeElement).toBe(last);
    // The page behind is inert while the dialog is open.
    expect(screen.getByRole("button", { name: "Elsewhere", hidden: true }).closest("[inert]")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("closes on Escape and returns focus", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Release bed" });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole("dialog", { name: "Release bed 4?" });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("Escape closes only the top layer when two dialogs are stacked", async () => {
    const onCloseLower = vi.fn();
    const onCloseUpper = vi.fn();
    render(
      <>
        <Dialog open onClose={onCloseLower} title="Lower">
          <p>Lower body</p>
        </Dialog>
        <Dialog open onClose={onCloseUpper} title="Upper">
          <p>Upper body</p>
        </Dialog>
      </>,
    );
    await screen.findByRole("dialog", { name: "Upper" });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(onCloseUpper).toHaveBeenCalledTimes(1);
    expect(onCloseLower).not.toHaveBeenCalled();
  });

  it("runs the primary action", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Release bed" }));
    await screen.findByRole("dialog", { name: "Release bed 4?" });
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("ToastView undo window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onUndo when Undo is pressed, and not onExpire afterwards", () => {
    const onUndo = vi.fn();
    const onExpire = vi.fn();
    render(<ToastView title="Bed 4 released" undo={{ durationMs: 8000, onUndo, onExpire }} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
    // A second press does nothing once the step is undone.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("calls onExpire once when the window runs out, with the bar timed from the style var", () => {
    const onUndo = vi.fn();
    const onExpire = vi.fn();
    render(
      <ToastView
        data-testid="toast"
        title="Bed 4 released"
        undo={{ label: "Undo release", durationMs: 5000, onUndo, onExpire }}
      />,
    );
    const toast = screen.getByTestId("toast");
    expect(toast.style.getPropertyValue("--wf-undo-ms")).toBe("5000ms");
    expect(toast.querySelector("[data-undo-bar]")).toHaveAttribute("aria-hidden", "true");
    expect(toast.querySelector("[data-undo-left]")).toHaveTextContent("5s left");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(toast.querySelector("[data-undo-left]")).toHaveTextContent("3s left");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(toast).toHaveAttribute("data-undo", "expired");
    fireEvent.click(screen.getByRole("button", { name: "Undo release" }));
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("pauses while hovered or focused and resumes with the time left", () => {
    const onExpire = vi.fn();
    render(
      <ToastView data-testid="toast" title="Bed 4 released" undo={{ durationMs: 4000, onUndo: () => {}, onExpire }} />,
    );
    const toast = screen.getByTestId("toast");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.pointerEnter(toast);
    expect(toast).toHaveAttribute("data-paused", "true");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
    fireEvent.pointerLeave(toast);
    expect(toast).not.toHaveAttribute("data-paused");

    // Focus pauses too.
    act(() => {
      screen.getByRole("button", { name: "Undo" }).focus();
    });
    expect(toast).toHaveAttribute("data-paused", "true");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onExpire).not.toHaveBeenCalled();
    act(() => {
      screen.getByRole("button", { name: "Undo" }).blur();
    });

    act(() => {
      vi.advanceTimersByTime(2900);
    });
    expect(onExpire).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing action prop working without an undo window", () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <ToastView
        data-testid="toast"
        title="Bed 4 held"
        action={{ label: "Release", onAction }}
        onClose={onClose}
        style={{ pointerEvents: "auto" }}
      />,
    );
    const toast = screen.getByTestId("toast");
    expect(toast).not.toHaveAttribute("data-undo");
    expect(toast.querySelector("[data-undo-bar]")).toBeNull();
    expect(toast.style.pointerEvents).toBe("auto");
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
