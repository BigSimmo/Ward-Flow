import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WARD_FLOW_DEMO_STORAGE_KEY,
  WardFlowProvider,
  useWardFlow,
} from "@/components/ward-management/ward-flow-provider";

// Review finding 23 (12 Nov 2026): the device save (the whole ~480 KB day) is written when the browser
// is idle, several changes making one write, and is flushed before the page is left or hidden so the
// leave warning and a reload stay truthful. Synthetic seed data only.
describe("deferred device save", () => {
  let current: ReturnType<typeof useWardFlow> | undefined;
  function Capture() {
    current = useWardFlow();
    return null;
  }
  const idle = new Map<number, () => void>();
  let handles = 0;
  const runIdle = () =>
    act(() => {
      const due = [...idle.values()];
      idle.clear();
      for (const callback of due) callback();
    });
  const storedOffset = () =>
    (
      JSON.parse(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY) ?? "null") as {
        state: { clockOffsetMinutes: number };
      } | null
    )?.state.clockOffsetMinutes;
  const advance = () =>
    act(() => {
      current!.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current!.now, minutes: 5 });
    });

  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 10, 0, 0));
    idle.clear();
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      idle.set(++handles, callback);
      return handles;
    });
    vi.stubGlobal("cancelIdleCallback", (handle: number) => idle.delete(handle));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  it("writes once when idle for several changes, and at once on leaving or hiding the page", () => {
    render(
      <WardFlowProvider>
        <Capture />
      </WardFlowProvider>,
    );
    runIdle();
    const start = storedOffset() ?? 0;

    advance();
    advance();
    expect(storedOffset() ?? 0).toBe(start);
    expect(idle.size).toBe(1);
    runIdle();
    expect(storedOffset()).toBe(start + 10);

    // The leave warning writes the waiting save first, so a saved day does not warn.
    advance();
    const leave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leave);
    expect(storedOffset()).toBe(start + 15);
    expect(leave.defaultPrevented).toBe(false);

    advance();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(storedOffset()).toBe(start + 20);
  });
});
