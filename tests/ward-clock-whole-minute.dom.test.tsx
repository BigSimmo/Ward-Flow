import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { absoluteWallClockMinutes, wallClockNow } from "@/components/ward-management/ward-clock";
import { WardFlowProvider, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/ward-management/ward-clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-clock")>();
  return {
    ...actual,
    wallClockNow: vi.fn(actual.wallClockNow),
    absoluteWallClockMinutes: vi.fn(actual.absoluteWallClockMinutes),
  };
});

const mountAbsolute = 29_000_000;

function ClockConsumer() {
  return <div data-testid="clock">{useWardFlowClock()}</div>;
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("P166: the board clock ticks once a minute and rests while hidden", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T02:00:00.000Z"));
    vi.mocked(wallClockNow).mockImplementation(() => 600);
    vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute);
  });

  afterEach(() => {
    setVisibility("visible");
    vi.useRealTimers();
    vi.mocked(wallClockNow).mockReset();
    vi.mocked(absoluteWallClockMinutes).mockReset();
  });

  it("does not tick at the half minute, only at the whole minute", () => {
    render(
      <WardFlowProvider>
        <ClockConsumer />
      </WardFlowProvider>,
    );
    const start = screen.getByTestId("clock").textContent;
    vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute + 1);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByTestId("clock").textContent).toBe(start);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(Number(screen.getByTestId("clock").textContent)).toBe(Number(start) + 1);
  });

  it("stops ticking while the tab is hidden and catches up when shown", () => {
    render(
      <WardFlowProvider>
        <ClockConsumer />
      </WardFlowProvider>,
    );
    const start = Number(screen.getByTestId("clock").textContent);
    setVisibility("hidden");
    vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute + 3);
    act(() => {
      vi.advanceTimersByTime(180_000);
    });
    expect(Number(screen.getByTestId("clock").textContent)).toBe(start);
    setVisibility("visible");
    expect(Number(screen.getByTestId("clock").textContent)).toBe(start + 3);
  });
});
