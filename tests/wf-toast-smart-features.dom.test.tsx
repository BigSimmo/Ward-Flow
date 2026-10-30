/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, type ToastInput, useToast } from "@/components/wf/toast-provider";
import { timedToastMs } from "@/components/wf/toast-timing";
import { toastStackLayout } from "@/components/wf/toast-stack";

function Pusher({ toasts }: { toasts: ToastInput[] }) {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toasts.forEach((input) => toast.push(input))}>
        Push notices
      </button>
      <input aria-label="Notes" />
    </>
  );
}

function renderWith(toasts: ToastInput[]) {
  render(
    <ToastProvider>
      <Pusher toasts={toasts} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Push notices" }));
}

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.style.removeProperty("--wf-t-exit");
  setVisibility("visible");
});

describe("toast exit motion", () => {
  it("keeps a closed card for the v9 exit time, hidden from assistive technology, then removes it", () => {
    document.documentElement.style.setProperty("--wf-t-exit", "160ms");
    renderWith([{ title: "Bed released", tone: "success", duration: 0 }]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Bed released" }));
    expect(screen.queryByTestId("toast")).toBeNull();
    const leaving = screen.getByTestId("toast-leaving");
    expect(leaving).toHaveAttribute("data-leaving", "true");
    expect(leaving).toHaveAttribute("aria-hidden", "true");
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(screen.queryByTestId("toast-leaving")).toBeNull();
  });

  it("removes a closed card at once where no exit time is set", () => {
    renderWith([{ title: "Bed released", tone: "success", duration: 0 }]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Bed released" }));
    expect(screen.queryByTestId("toast-leaving")).toBeNull();
  });
});

describe("smart timers", () => {
  it("gives a short outcome six seconds and a long one more, up to twelve", () => {
    expect(timedToastMs("Bed released")).toBe(6000);
    const long = Array.from({ length: 20 }, (_, index) => `word${index}`).join(" ");
    expect(timedToastMs(long)).toBe(8000);
    expect(timedToastMs(`${long} ${long} ${long}`)).toBe(12_000);
  });

  it("pauses a timed toast while it is hovered and resumes with the time left", () => {
    renderWith([{ title: "Bed released", tone: "success" }]);
    const card = screen.getByTestId("toast");
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    fireEvent.pointerEnter(card);
    expect(card).toHaveAttribute("data-paused", "true");
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByTestId("toast")).toBeInTheDocument();
    fireEvent.pointerLeave(card);
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(screen.getByTestId("toast")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("pauses a timed toast while the tab is hidden", () => {
    renderWith([{ title: "Bed released", tone: "success" }]);
    setVisibility("hidden");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("toast")).toBeInTheDocument();
    setVisibility("visible");
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("lets an Undo window run out on time in a hidden tab, so a save on expiry is not held up", () => {
    const onExpire = vi.fn();
    renderWith([{ title: "Task acknowledged", tone: "info", undo: { durationMs: 8000, onUndo: () => {}, onExpire } }]);
    setVisibility("hidden");
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("toast")).toBeNull();
  });

  it("restarts the time when the same outcome is pushed again", () => {
    render(
      <ToastProvider>
        <Pusher toasts={[{ title: "Bed released", tone: "success" }]} />
      </ToastProvider>,
    );
    const push = screen.getByRole("button", { name: "Push notices" });
    fireEvent.click(push);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireEvent.click(push);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("toast")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId("toast")).toBeNull();
  });
});

describe("stacking", () => {
  const three: ToastInput[] = [
    { title: "First saved", tone: "success", duration: 0 },
    { title: "Second saved", tone: "success", duration: 0 },
    { title: "Third saved", tone: "success", duration: 0 },
  ];

  it("folds three or more self-closing notices behind the newest, with a +N more control", () => {
    renderWith(three);
    const toggle = screen.getByTestId("toast-stack-toggle");
    expect(toggle).toHaveTextContent("+2 more");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("toast-region")).toHaveAttribute("data-stack", "folded");
    // Folded cards are only drawn behind; every one is still read.
    for (const title of ["First saved", "Second saved", "Third saved"]) expect(screen.getByText(title)).toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("Show fewer");
    expect(screen.getByTestId("toast-region")).not.toHaveAttribute("data-stack");
  });

  it("does not fold two notices", () => {
    renderWith(three.slice(0, 2));
    expect(screen.queryByTestId("toast-stack-toggle")).toBeNull();
  });

  it("never folds a warning: it keeps its own row", () => {
    const layout = toastStackLayout(
      [
        { id: "a", tone: "success" },
        { id: "w", tone: "warning" },
        { id: "b", tone: "success" },
        { id: "c", tone: "info" },
      ],
      false,
    );
    expect(layout.folded).toBe(true);
    expect(layout.hiddenCount).toBe(2);
    expect(layout.slots.get("w")).toEqual({ row: 1, depth: 0, faded: false });
    expect(layout.slots.get("c")).toEqual({ row: 2, depth: 0, faded: false });
    expect(layout.slots.get("b")?.depth).toBe(1);
    expect(layout.slots.get("a")?.depth).toBe(2);
  });

  it("opens out while focus is inside the stack", () => {
    renderWith(three);
    act(() => {
      screen.getByRole("button", { name: "Dismiss: First saved" }).focus();
    });
    expect(screen.getByTestId("toast-region")).not.toHaveAttribute("data-stack");
  });
});

describe("recent notices", () => {
  it("offers Recent once a notice has left, newest first, without offering Undo again", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderWith([
      { title: "Bed released", tone: "success", duration: 0 },
      { title: "Task acknowledged", tone: "info", undo: { durationMs: 8000, onUndo: () => {} } },
    ]);
    expect(screen.queryByTestId("toast-recent")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByTestId("toast-recent")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Bed released" }));
    fireEvent.click(screen.getByRole("button", { name: "Recent notices, 2" }));
    const list = screen.getByTestId("toast-recent-list");
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Bed released");
    expect(items[1]).toHaveTextContent("Task acknowledged");
    expect(items[1]).toHaveTextContent("Undone");
    expect(within(list).queryByRole("button", { name: "Undo" })).toBeNull();
    const stored = setItem.mock.calls.map((call) => String(call[1]));
    expect(stored.some((value) => value.includes("Bed released") || value.includes("Task acknowledged"))).toBe(false);
    setItem.mockRestore();
  });

  it("withdraws the control after half a minute and keeps at most ten", () => {
    renderWith(
      Array.from({ length: 12 }, (_, index) => ({
        title: `Saved ${index + 1}`,
        tone: "success" as const,
        duration: 1,
      })),
    );
    act(() => {
      vi.advanceTimersByTime(10);
    });
    fireEvent.click(screen.getByRole("button", { name: /^Recent notices, 10$/ }));
    expect(within(screen.getByTestId("toast-recent-list")).getAllByRole("listitem")).toHaveLength(10);
    fireEvent.keyDown(screen.getByRole("button", { name: "Clear list" }), { key: "Escape" });
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.queryByTestId("toast-recent")).toBeNull();
  });
});

describe("Alt+N", () => {
  it("jumps to the newest notice's Undo and back again", () => {
    renderWith([{ title: "Task acknowledged", tone: "info", undo: { durationMs: 8000, onUndo: () => {} } }]);
    const push = screen.getByRole("button", { name: "Push notices" });
    act(() => push.focus());
    fireEvent.keyDown(window, { key: "Dead", code: "KeyN", altKey: true });
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
    expect(screen.getByTestId("toast")).toHaveAttribute("data-paused", "true");
    fireEvent.keyDown(window, { key: "n", code: "KeyN", altKey: true });
    expect(push).toHaveFocus();
  });

  it("goes back on Escape", () => {
    renderWith([{ title: "Bed released", tone: "success", duration: 0 }]);
    const push = screen.getByRole("button", { name: "Push notices" });
    act(() => push.focus());
    fireEvent.keyDown(window, { key: "n", code: "KeyN", altKey: true });
    expect(screen.getByRole("button", { name: "Dismiss: Bed released" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape", code: "Escape" });
    expect(push).toHaveFocus();
  });

  it("leaves typing alone", () => {
    renderWith([{ title: "Bed released", tone: "success", duration: 0 }]);
    const notes = screen.getByRole("textbox", { name: "Notes" });
    act(() => notes.focus());
    fireEvent.keyDown(notes, { key: "n", code: "KeyN", altKey: true });
    expect(notes).toHaveFocus();
  });

  it("opens Recent when no notice is showing", () => {
    renderWith([{ title: "Bed released", tone: "success", duration: 0 }]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Bed released" }));
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(screen.queryByTestId("toast-recent")).toBeNull();
    fireEvent.keyDown(window, { key: "n", code: "KeyN", altKey: true });
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(screen.getByRole("dialog", { name: "Recent notices" })).toBeInTheDocument();
  });
});
