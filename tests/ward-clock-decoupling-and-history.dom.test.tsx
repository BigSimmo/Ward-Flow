import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { absoluteWallClockMinutes, wallClockNow } from "@/components/ward-management/ward-clock";
import { WardFlowProvider, useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
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

describe("Issue 2: coherent clock across board and event consumers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(wallClockNow).mockReset();
    vi.mocked(absoluteWallClockMinutes).mockReset();
  });

  it("advances both contexts on the tick and records the time the board displays", () => {
    function FlowConsumer() {
      const { movements, now, dispatch } = useWardFlow();
      const movement = movements.find((item) => item.id === "WF-001")!;
      return (
        <>
          <div data-testid="flow-consumer">{now}</div>
          <div data-testid="recorded-at">{movement.transportNeed?.at ?? "Not recorded"}</div>
          <button
            onClick={() =>
              dispatch({ type: "RECORD_TRANSPORT_NEED", role: "ed", now, movementId: movement.id, needed: false })
            }
          >
            Record current need
          </button>
        </>
      );
    }

    function ClockConsumer() {
      const clock = useWardFlowClock();
      return <div data-testid="clock-consumer">{clock}</div>;
    }

    const startMinute = 600;
    const mountAbsolute = 29_000_000;
    vi.mocked(wallClockNow).mockImplementation(() => startMinute);
    vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute);

    render(
      <WardFlowProvider>
        <FlowConsumer />
        <ClockConsumer />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("clock-consumer")).toHaveTextContent("642");
    expect(screen.getByTestId("flow-consumer")).toHaveTextContent("642");

    // Advance by 30 seconds
    vi.mocked(absoluteWallClockMinutes).mockImplementation(() => mountAbsolute + 1);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByTestId("flow-consumer")).toHaveTextContent("643");
    expect(screen.getByTestId("clock-consumer")).toHaveTextContent("643");
    fireEvent.click(screen.getByRole("button", { name: "Record current need" }));
    expect(screen.getByTestId("recorded-at")).toHaveTextContent("643");
  });
});

describe("Issue 3: Shell drawer history sync", () => {
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  it("pushes history state on drawer open and pops history on browser popstate", async () => {
    const user = userEvent.setup();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar />
      </WardFlowProvider>,
    );

    // Open activity drawer
    await user.click(screen.getByTestId("ward-bar-activity-trigger"));
    expect(window.history.state).toEqual(expect.objectContaining({ wardDrawer: "activity" }));
    expect(screen.getByTestId("ward-bar-activity-sheet")).toBeInTheDocument();

    // Trigger popstate event (e.g. browser back button pressed)
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });

    // Drawer should be closed
    expect(screen.queryByTestId("ward-bar-activity-sheet")).toBeNull();
  });

  it("calls window.history.back() when closePopover is invoked via close button or toggle", async () => {
    const user = userEvent.setup();
    const backSpy = vi.spyOn(window.history, "back");

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardBar />
      </WardFlowProvider>,
    );

    // Open tasks drawer
    await user.click(screen.getByTestId("ward-bar-tasks-trigger"));
    expect(window.history.state).toEqual(expect.objectContaining({ wardDrawer: "tasks" }));

    // Click trigger again to close
    await user.click(screen.getByTestId("ward-bar-tasks-trigger"));
    expect(backSpy).toHaveBeenCalled();

    backSpy.mockRestore();
  });
});
