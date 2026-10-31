import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

const event = (minutes: number) => ({ type: "ADVANCE_CLOCK", role: "demo", now: 0, minutes }) as WardFlowEvent;

describe("dispatch before the reducer slices load", () => {
  it("holds local commands in order until the slices arrive, then runs them at once", async () => {
    // A fresh registry with no slices, as a phone has straight after the page starts.
    vi.resetModules();
    const registry = await import("@/components/ward-management/ward-flow-reducer-slice-registry");
    const { useSliceGatedDispatch } = await import("@/components/ward-management/ward-flow-slice-dispatch");
    expect(registry.reducerSlicesLoaded()).toBe(false);
    const ran: number[] = [];
    const local = (sent: WardFlowEvent): WardCommandOutcome => {
      expect(registry.reducerSlicesLoaded()).toBe(true);
      ran.push(sent.type === "ADVANCE_CLOCK" ? sent.minutes : -1);
      return { commandId: `local-${ran.length}`, status: "accepted" };
    };
    const commands = { current: { sequence: 0 } };
    const { result } = renderHook(() => useSliceGatedDispatch(local, null, commands));
    const first = result.current(event(1));
    const second = result.current(event(2));
    expect(first).toBeInstanceOf(Promise);
    expect(second).toBeInstanceOf(Promise);
    expect(ran).toEqual([]);
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(ran).toEqual([1, 2]);
    // Once loaded and the queue is empty, a command runs straight away, as before the split.
    expect(result.current(event(3))).toEqual({ commandId: "local-3", status: "accepted" });
  });

  it("cancels a queued local command when its world is replaced before slices arrive", async () => {
    vi.resetModules();
    const { useSliceGatedDispatch } = await import("@/components/ward-management/ward-flow-slice-dispatch");
    const local = vi.fn((): WardCommandOutcome => ({ commandId: "x", status: "accepted" }));
    let generation = 0;
    const capture = () => {
      const original = generation;
      return () => generation === original;
    };
    const { result } = renderHook(() => useSliceGatedDispatch(local, null, { current: { sequence: 0 } }, capture));
    const pending = result.current(event(1));
    generation++;
    await act(async () => {
      expect(await pending).toMatchObject({ status: "cancelled" });
    });
    expect(local).not.toHaveBeenCalled();
  });

  it("sends a shared workspace's commands straight to the server", async () => {
    vi.resetModules();
    const { useSliceGatedDispatch } = await import("@/components/ward-management/ward-flow-slice-dispatch");
    const shared = vi.fn(() => undefined);
    const local = vi.fn((): WardCommandOutcome => ({ commandId: "x", status: "accepted" }));
    const { result } = renderHook(() => useSliceGatedDispatch(local, shared, { current: { sequence: 0 } }));
    expect(result.current(event(1))).toBeUndefined();
    expect(shared).toHaveBeenCalledTimes(1);
    expect(local).not.toHaveBeenCalled();
  });
});
