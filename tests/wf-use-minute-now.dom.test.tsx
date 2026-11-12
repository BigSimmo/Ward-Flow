import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMinuteNow } from "@/components/wf/use-minute-now";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

// Review finding 21 (12 Nov 2026): the fast (every second) clock kept re-rendering a hidden tab.
describe("useMinuteNow", () => {
  afterEach(() => {
    setVisibility("visible");
    vi.useRealTimers();
  });

  it("stops ticking while the tab is hidden and refreshes at once when it is shown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T08:00:00.000Z"));
    const { result } = renderHook(() => useMinuteNow({ fast: true }));
    const start = result.current;
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(start + 1000);

    act(() => setVisibility("hidden"));
    const hiddenAt = result.current;
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(hiddenAt);
    expect(vi.getTimerCount()).toBe(0);

    act(() => setVisibility("visible"));
    expect(result.current).toBe(start + 6000);
    expect(vi.getTimerCount()).toBe(1);
  });
});
