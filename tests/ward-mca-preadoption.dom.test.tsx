// M10 (mechanics and clock audit, 14 Nov 2026): a step taken in the first moments after a demo
// reload, before the saved day is adopted, is replayed onto the restored day at the restored board
// minute, not the seed clock's 10:42. An early Reset builds its new day around the time on screen.
import { useEffect, useLayoutEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  WardFlowProvider,
  WARD_FLOW_DEMO_STORAGE_KEY,
  useWardFlow,
  useWardFlowClock,
} from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

let current: ReturnType<typeof useWardFlow>;
function Probe() {
  const value = useWardFlow();
  useEffect(() => {
    current = value;
  }, [value]);
  return null;
}
let earlyStamp: number | undefined;
let earlyOutcome: unknown;
function EarlyAction({ type }: { type: "signoff" | "reset" | "count" }) {
  const flow = useWardFlow();
  const clock = useWardFlowClock();
  useLayoutEffect(() => {
    // Once only: the restored day remounts the screens, and this must not act again then.
    if (earlyStamp !== undefined) return;
    earlyStamp = clock;
    if (type === "signoff")
      earlyOutcome = flow.dispatch({ type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: clock });
    else if (type === "reset") earlyOutcome = flow.dispatch({ type: "RESET_SCENARIO", role: "demo", now: clock });
    else {
      const unit = flow.units.find((candidate) => candidate.empty.value < candidate.beds)!;
      earlyOutcome = flow.dispatch({
        type: "CONFIRM_CAPACITY",
        role: "ward",
        now: clock,
        unitId: unit.id,
        actingUnitId: unit.id,
        expectedRevision: unit.allocatable.revision ?? 0,
        value: unit.empty.value + 1,
      });
    }
  });
  return null;
}
const saved = () => JSON.parse(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)!);
const T0 = Date.UTC(2026, 10, 13, 2, 0); // 10:00 Perth
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  window.sessionStorage.clear();
  earlyStamp = undefined;
  earlyOutcome = undefined;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  vi.useRealTimers();
});

/** A day run for three hours, then moved on an hour (14:42 on the board), and reloaded a minute later. */
function buildSavedDayAndReload(type: "signoff" | "reset" | "count") {
  const view = render(
    <WardFlowProvider>
      <Probe />
    </WardFlowProvider>,
  );
  act(() => vi.advanceTimersByTime(180 * 60_000));
  act(() => current.dispatch({ type: "RECORD_HANDOVER_SIGN_OFF", role: "coordinator", now: current.now }));
  act(() => current.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: current.now, minutes: 60 }));
  expect(saved().now).toBe(NOW_ANCHOR + 240);
  view.unmount();
  vi.setSystemTime(T0 + 181 * 60_000);
  act(() => {
    render(
      <WardFlowProvider>
        <EarlyAction type={type} />
        <Probe />
      </WardFlowProvider>,
    );
  });
  // The early step was dispatched on the seed clock, before the saved day arrived.
  expect(earlyStamp).toBe(NOW_ANCHOR);
  // A Reset drops the +1 hour press, as a Reset on a running board always does.
  expect(current.now).toBe(NOW_ANCHOR + (type === "reset" ? 181 : 241));
}

it("replays an early sign-off at the restored board minute", async () => {
  buildSavedDayAndReload("signoff");
  const stamps = saved().state.handoverSignOffs.map((entry: { at: number }) => entry.at);
  expect(stamps).toEqual([NOW_ANCHOR + 180, NOW_ANCHOR + 241]);
  // The caller waiting on the early step still gets its answer.
  await expect(Promise.resolve(earlyOutcome as Promise<WardCommandOutcome>)).resolves.toMatchObject({
    status: "accepted",
  });
});

it("replays an early bed count confirmation as just confirmed, not hours old", () => {
  buildSavedDayAndReload("count");
  const counts = current.units.map((unit) => unit.allocatable.confirmedAt);
  expect(Math.max(...counts)).toBe(NOW_ANCHOR + 241);
});

it("builds an early Reset's new day around the time on screen", () => {
  buildSavedDayAndReload("reset");
  const world = saved().state;
  const shift = world.movements[0].openedAt - seedWardFlowStateAt(0).movements[0].openedAt;
  expect(NOW_ANCHOR + shift).toBe(current.now);
});
