/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, type ToastInput, useToast } from "@/components/wf/toast-provider";
import { timedToastMs } from "@/components/wf/toast-timing";

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
  setVisibility("visible");
});

describe("smart timers", () => {
  it("gives a short outcome six seconds and a long one more, up to twelve", () => {
    expect(timedToastMs(6000, "Bed released")).toBe(6000);
    const long = Array.from({ length: 20 }, (_, index) => `word${index}`).join(" ");
    expect(timedToastMs(6000, long)).toBe(8000);
    expect(timedToastMs(6000, `${long} ${long} ${long}`)).toBe(12_000);
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

describe("a full stack", () => {
  it("pushes out the oldest notice that is not a warning, and never a warning", () => {
    renderWith([
      { title: "Not recorded: synthetic refusal.", tone: "warning" },
      { title: "First saved", tone: "success", duration: 0 },
      { title: "Second saved", tone: "success", duration: 0 },
      { title: "Third saved", tone: "success", duration: 0 },
      { title: "Fourth saved", tone: "success", duration: 0 },
      { title: "Fifth saved", tone: "success", duration: 0 },
    ]);
    expect(screen.getAllByTestId("toast")).toHaveLength(5);
    expect(screen.getByText("Not recorded: synthetic refusal.")).toBeInTheDocument();
    expect(screen.queryByText("First saved")).toBeNull();
    expect(screen.getByText("Fifth saved")).toBeInTheDocument();
  });

  it("keeps every warning past five rather than drop one", () => {
    renderWith(
      Array.from({ length: 6 }, (_, index) => ({
        title: `Not recorded: synthetic refusal ${index + 1}.`,
        tone: "warning" as const,
      })),
    );
    expect(screen.getAllByTestId("toast")).toHaveLength(6);
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

  it("does nothing with no notice showing", () => {
    renderWith([]);
    const push = screen.getByRole("button", { name: "Push notices" });
    act(() => push.focus());
    fireEvent.keyDown(window, { key: "n", code: "KeyN", altKey: true });
    expect(push).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
