import { act, fireEvent, render, screen } from "@testing-library/react";
import { Profiler, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let wallMinutes = 40_000_000;
vi.mock("@/components/ward-management/ward-clock", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-clock")>();
  return { ...actual, absoluteWallClockMinutes: () => wallMinutes };
});

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import {
  WardFlowContext,
  WardFlowOverride,
  WardFlowProvider,
  type WardFlowContextValue,
  useOptionalWardFlowSelect,
  useWardClock,
  useWardFlow,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Field readers (fix list 1.2 and 7.1): a screen reading named fields through `useWardFlowSelect`
 * re-renders when one of those fields changes, not on every change and every clock minute.
 */

const renders = { units: 0, rejections: 0, clock: 0, whole: 0 };

function UnitsReader() {
  const { units } = useWardFlowSelect("units");
  return <span data-testid="units">{units.length}</span>;
}
function RejectionsReader() {
  const { rejections, dispatch: send } = useWardFlowSelect("rejections", "dispatch");
  return (
    <button type="button" data-testid="rejections" onClick={() => send(refusedEvent)}>
      {rejections.length}
    </button>
  );
}
function ClockReader() {
  return <span data-testid="clock">{useWardClock()}</span>;
}
function WholeReader() {
  useWardFlow();
  return null;
}

const refusedEvent: WardFlowEvent = {
  type: "ACKNOWLEDGE_INBOX_ITEM",
  role: "coordinator",
  now: NOW_ANCHOR,
  inboxItemId: "not-a-real-category-WF-001",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  window.sessionStorage.clear();
  for (const key of Object.keys(renders) as (keyof typeof renders)[]) renders[key] = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

/** Counts the commits in which `children` rendered. */
function Counted({ name, children }: { name: keyof typeof renders; children: ReactNode }) {
  return (
    <Profiler id={name} onRender={() => renders[name]++}>
      {children}
    </Profiler>
  );
}

function renderLive() {
  render(
    <WardFlowProvider>
      <Counted name="units">
        <UnitsReader />
      </Counted>
      <Counted name="rejections">
        <RejectionsReader />
      </Counted>
      <Counted name="clock">
        <ClockReader />
      </Counted>
      <Counted name="whole">
        <WholeReader />
      </Counted>
    </WardFlowProvider>,
  );
  // The saved-session adoption after mount.
  act(() => {
    vi.advanceTimersByTime(0);
  });
  for (const key of Object.keys(renders) as (keyof typeof renders)[]) renders[key] = 0;
}

describe("useWardFlowSelect", () => {
  it("wakes only the clock readers when the clock moves on a minute", () => {
    renderLive();
    const before = Number(screen.getByTestId("clock").textContent);
    wallMinutes += 1;
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(Number(screen.getByTestId("clock").textContent)).toBe(before + 1);
    expect(renders).toEqual({ units: 0, rejections: 0, clock: 1, whole: 1 });
  });

  it("wakes only the readers of a field that changed", () => {
    renderLive();
    fireEvent.click(screen.getByTestId("rejections"));
    expect(screen.getByTestId("rejections")).toHaveTextContent("1");
    expect(renders).toEqual({ units: 0, rejections: 1, clock: 0, whole: 1 });
  });

  it("reaches field readers through an override, as it does whole-value readers", () => {
    function Shrink({ children }: { children: ReactNode }) {
      const flow = useWardFlow();
      return <WardFlowOverride value={{ ...flow, units: flow.units.slice(0, 2) }}>{children}</WardFlowOverride>;
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Shrink>
          <UnitsReader />
        </Shrink>
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("units")).toHaveTextContent("2");
  });

  it("reads a hand-built value when there is no provider, and nothing when there is no value", () => {
    const seen: unknown[] = [];
    function Optional() {
      seen.push(useOptionalWardFlowSelect("units"));
      return null;
    }
    render(<Optional />);
    const units = [] as WardFlowContextValue["units"];
    render(
      <WardFlowContext.Provider value={{ units } as WardFlowContextValue}>
        <Optional />
      </WardFlowContext.Provider>,
    );
    expect(seen).toEqual([null, { units }]);
    expect(() => render(<UnitsReader />)).toThrow("useWardFlow must be used within WardFlowProvider.");
  });
});
