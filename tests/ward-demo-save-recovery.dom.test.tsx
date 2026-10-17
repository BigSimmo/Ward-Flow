import { fireEvent, render, screen } from "@testing-library/react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { absoluteWallClockMinutes, demoDayZero } from "@/components/ward-management/ward-clock";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  tryReadDemoState,
  tryWriteDemoState,
  WARD_FLOW_DEMO_STORAGE_KEY,
  STORAGE_UNAVAILABLE,
} from "@/components/ward-management/ward-flow-demo-storage";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});
describe("successful save identity after storage failure", () => {
  it("restores and labels the retained older successful save after a later quota failure", () => {
    const state = seedWardFlowState();
    const dayZero = new Date("2026-10-16T00:00:00Z");
    const savedAt = Date.parse("2026-10-16T10:00:00Z") / 60_000;
    expect(tryWriteDemoState(state, dayZero, NOW_ANCHOR, savedAt)).toBe(true);
    const retained = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(tryWriteDemoState({ ...state, clockOffsetMinutes: 15 }, dayZero, NOW_ANCHOR + 15, savedAt + 15)).toBe(false);
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBe(retained);
    const restored = tryReadDemoState(dayZero, savedAt + 30);
    expect(restored.saved?.now).toBe(NOW_ANCHOR);
    expect(restored.recoveryNotice).toMatch(/last successful save from 16 Oct 2026.*10:00.*device time/);
    expect(STORAGE_UNAVAILABLE).toContain("Changes stay in memory and may be lost");
  });
});

it("shows the retained successful save label alongside the storage warning after actual provider restoration", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T10:00:00Z"));
  expect(
    tryWriteDemoState(seedWardFlowState(), demoDayZero(new Date()), NOW_ANCHOR, absoluteWallClockMinutes() - 30),
  ).toBe(true);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Quota exceeded", "QuotaExceededError");
  });
  function Reset() {
    const { dispatch, now } = useWardFlow();
    return <button onClick={() => dispatch({ type: "RESET_SCENARIO", role: "demo", now })}>Reset</button>;
  }
  render(
    <WardFlowProvider>
      <Reset />
    </WardFlowProvider>,
  );
  // The save was stamped 30 minutes before "now" in device wall-clock minutes, so the notice shows
  // that device time. Derive it from the device offset instead of assuming UTC.
  const savedWall = (((10 * 60 - 30 - new Date().getTimezoneOffset()) % 1440) + 1440) % 1440;
  const savedClock = `${Math.floor(savedWall / 60) % 12 || 12}:${String(savedWall % 60).padStart(2, "0")} ${
    savedWall < 720 ? "am" : "pm"
  }`;
  expect(screen.getByRole("status").textContent).toMatch(
    new RegExp(`Demo storage is unavailable.*last successful save from.*, ${savedClock}`),
  );
  fireEvent.click(screen.getByText("Reset"));
  expect(screen.getByRole("status").textContent).not.toContain("Restored the last successful save");
});
