// Time audit C1 (13 Nov 2026): the demonstration's board clock never runs backwards when the
// device clock is set back while the page is open, so the day it saves can still be restored.
import { useEffect } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  WARD_FLOW_DEMO_STORAGE_KEY,
  useWardFlow,
  useWardFlowClock,
} from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardRecoveryNotice } from "@/components/ward-management/shell/ward-recovery-notice";

let current: ReturnType<typeof useWardFlow>;
let boardNow: number;
function Probe() {
  const value = useWardFlow();
  const clock = useWardFlowClock();
  useEffect(() => {
    current = value;
    boardNow = clock;
  }, [value, clock]);
  return null;
}
function mount() {
  return render(
    <WardFlowProvider>
      <WardRecoveryNotice />
      <Probe />
    </WardFlowProvider>,
  );
}
function saved() {
  return JSON.parse(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 23, 10, 0));
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  vi.useRealTimers();
});

it("holds the board clock when the device clock is set back, then moves on, and the day still restores", () => {
  const view = mount();
  act(() => vi.advanceTimersByTime(30 * 60_000));
  expect(current.now).toBe(NOW_ANCHOR + 30);
  act(() => current.dispatch({ type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: current.now }));

  // The device clock goes back 20 minutes while the page is open.
  act(() => vi.setSystemTime(new Date(2026, 8, 23, 10, 10)));
  act(() => vi.advanceTimersByTime(60_000));
  expect(current.now).toBe(NOW_ANCHOR + 30);
  expect(boardNow).toBe(current.now);

  // A change made now saves a board minute no earlier than anything already recorded.
  act(() => current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 5 }));
  expect(saved().now).toBe(NOW_ANCHOR + 35);
  const stamps: number[] = saved().state.handoverSignOffs.map((entry: { at: number }) => entry.at);
  expect(Math.max(...stamps)).toBeLessThanOrEqual(saved().now);

  // Once the device passes the high-water mark, the board moves forward again.
  act(() => vi.setSystemTime(new Date(2026, 8, 23, 10, 45)));
  act(() => vi.advanceTimersByTime(60_000));
  expect(current.now).toBe(NOW_ANCHOR + 46 + 5);

  // A reload on the set-back device clock resumes the day rather than refusing it.
  view.unmount();
  vi.setSystemTime(new Date(2026, 8, 23, 10, 12));
  act(() => {
    mount();
  });
  expect(screen.queryByText(/could not be restored safely/)).toBeNull();
  expect(current.now).toBeGreaterThanOrEqual(NOW_ANCHOR + 35);
  expect(saved().state.handoverSignOffs).toHaveLength(stamps.length);
});
