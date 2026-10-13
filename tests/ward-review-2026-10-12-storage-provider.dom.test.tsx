/**
 * Review findings A2-6, A2-7, A2-11, A2-12, A2-14 and A2-15 (8 Oct 2026 core-engine review), fixed
 * 13 Oct 2026. Each test drives the real provider against jsdom's session storage.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WardFlowClockProvider,
  WardFlowProvider,
  useWardFlow,
  useWardFlowClock,
} from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const STORAGE_KEY = "ward-flow-demo-state-v1";
const FIXED_SYSTEM_TIME = new Date(2026, 8, 16, 10, 42, 0);

function Probe() {
  const { now, dispatch } = useWardFlow();
  return (
    <div>
      <span data-testid="now">{now}</span>
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 20 })}>
        advance
      </button>
    </div>
  );
}

function stored(): { state: { clockOffsetMinutes: number }; saveFailed?: boolean } | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe("demo storage review fixes", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_SYSTEM_TIME);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it("A2-6: a failed save does not leave an older snapshot for the next reload to restore", () => {
    const { unmount } = render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    expect(stored()?.state.clockOffsetMinutes).toBe(20);

    const realSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === STORAGE_KEY && !value.includes('"saveFailed":true')) throw new Error("quota");
      return realSetItem.call(this, key, value);
    });
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    // The older (20-minute) snapshot is gone; only the no-state marker remains.
    expect(stored()?.saveFailed).toBe(true);
    expect(stored()?.state).toBeUndefined();
    vi.restoreAllMocks();
    unmount();

    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("could not be saved");
    expect(stored()?.state.clockOffsetMinutes).toBe(0);
  });

  it("A2-7 / A2-11: an unchanged world is not rewritten, so a cleared session stays cleared", () => {
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    expect(stored()).not.toBeNull();

    // Settings' "Clear session" removes the ward-flow keys from this tab's session storage.
    window.sessionStorage.removeItem(STORAGE_KEY);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(setItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toHaveLength(0);
    expect(stored()).toBeNull();

    // A new change in this tab is saved again.
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    expect(stored()?.state.clockOffsetMinutes).toBe(40);
  });

  it("A2-12: one BroadcastChannel serves every dispatch instead of one per dispatch", () => {
    const opened: string[] = [];
    class FakeChannel {
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(name: string) {
        opened.push(name);
      }
      postMessage() {}
      close() {}
    }
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    try {
      render(
        <WardFlowProvider>
          <Probe />
        </WardFlowProvider>,
      );
      const before = opened.length;
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      fireEvent.click(screen.getByRole("button", { name: "advance" }));
      expect(opened.length).toBe(before);
      expect(before).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("A2-15: a reload after midnight says the day rolled over, not that the save was damaged", () => {
    const { unmount } = render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "advance" }));
    unmount();

    vi.setSystemTime(new Date(FIXED_SYSTEM_TIME.getTime() + 24 * 60 * 60_000));
    render(
      <WardFlowProvider>
        <Probe />
      </WardFlowProvider>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("earlier day");
    expect(status).not.toHaveTextContent("could not be restored safely");
  });
});

describe("A2-14: WardFlowClockProvider uses the main provider's clock formula", () => {
  function ClockProbe() {
    return <span data-testid="clock">{useWardFlowClock()}</span>;
  }

  it("adds restored minutes and never runs backwards when the wall clock does", () => {
    render(
      <WardFlowClockProvider
        anchorOffsetMinutes={0}
        mountedAtAbsolute={Number.MAX_SAFE_INTEGER}
        clockOffsetMinutes={5}
        restoredElapsed={30}
      >
        <ClockProbe />
      </WardFlowClockProvider>,
    );
    // mountedAtAbsolute in the future makes the raw elapsed negative; it is clamped to zero.
    expect(screen.getByTestId("clock")).toHaveTextContent(String(NOW_ANCHOR + 30 + 5));
  });
});
