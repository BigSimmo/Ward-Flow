import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWardMinuteTick } from "@/components/ward-management/use-ward-minute-tick";

/* The board clock's minute tick: no timer while the tab is hidden, including a tab mounted hidden. */

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:30Z"));
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useWardMinuteTick", () => {
  it("ticks at the top of each minute in a visible tab", () => {
    const setTick = vi.fn();
    renderHook(() => useWardMinuteTick(true, setTick));
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(30_000));
    expect(setTick).toHaveBeenCalledTimes(1);
  });

  it("starts no timer when mounted in a hidden tab, and starts one when the tab is shown", () => {
    visibility = "hidden";
    const setTick = vi.fn();
    renderHook(() => useWardMinuteTick(true, setTick));
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(180_000));
    expect(setTick).not.toHaveBeenCalled();

    act(() => setVisibility("visible"));
    expect(setTick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("stops its timer while hidden", () => {
    const setTick = vi.fn();
    renderHook(() => useWardMinuteTick(true, setTick));
    act(() => setVisibility("hidden"));
    expect(vi.getTimerCount()).toBe(0);
  });
});
