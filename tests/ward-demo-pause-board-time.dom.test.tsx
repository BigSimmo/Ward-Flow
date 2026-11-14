// D-229 (stress test D1a-S-1, Josh 14 Nov 2026): the Demo panel's Pause holds Board time on this
// device's demo, and Resume carries on from the paused minute. +15 min and +1 hour still move it.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { absoluteWallClockMinutes, wallClockNow } from "@/components/ward-management/ward-clock";
import { WardFlowProvider, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("@/components/ward-management/ward-clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-clock")>();
  return {
    ...actual,
    wallClockNow: vi.fn(actual.wallClockNow),
    absoluteWallClockMinutes: vi.fn(actual.absoluteWallClockMinutes),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function ClockProbe() {
  return <output data-testid="board-now">{useWardFlowClock()}</output>;
}

const MOUNT = 29_000_000;
let wall = MOUNT;

beforeEach(() => {
  vi.useFakeTimers();
  wall = MOUNT;
  vi.mocked(wallClockNow).mockImplementation(() => 600);
  vi.mocked(absoluteWallClockMinutes).mockImplementation(() => wall);
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(wallClockNow).mockReset();
  vi.mocked(absoluteWallClockMinutes).mockReset();
});

function passMinutes(minutes: number) {
  wall += minutes;
  act(() => {
    vi.advanceTimersByTime(60_000);
  });
}

const boardNow = () => Number(screen.getByTestId("board-now").textContent);
const pauseButton = () => within(screen.getByTestId("ward-tools-demo-panel")).getByTestId("ward-tools-demo-pause");

it("holds Board time while paused and carries on from the paused minute after Resume", () => {
  render(
    <WardFlowProvider>
      <ClockProbe />
      <WardDemoPanel />
    </WardFlowProvider>,
  );
  passMinutes(5);
  expect(boardNow()).toBe(NOW_ANCHOR + 5);

  // No Live chip is on this page: the panel still offers Pause, for Board time.
  expect(pauseButton()).toHaveTextContent("Pause");
  fireEvent.click(pauseButton());
  expect(pauseButton()).toHaveTextContent("Resume");

  passMinutes(20);
  expect(boardNow()).toBe(NOW_ANCHOR + 5);

  // The clock steps still move a paused clock.
  fireEvent.click(within(screen.getByTestId("ward-tools-demo-panel")).getByRole("button", { name: "+15 min" }));
  expect(boardNow()).toBe(NOW_ANCHOR + 20);

  fireEvent.click(pauseButton());
  expect(pauseButton()).toHaveTextContent("Pause");
  expect(boardNow()).toBe(NOW_ANCHOR + 20);

  passMinutes(3);
  expect(boardNow()).toBe(NOW_ANCHOR + 23);
});
