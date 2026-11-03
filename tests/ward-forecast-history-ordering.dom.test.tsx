import { createElement, type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSharedForecastHistory } from "@/components/ward-management/forecast/forecast-shared-history";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const snapshot = {
  day: 1,
  at: 1440,
  nowGap: 3,
  tomorrow: { low: 1, likely: 2, high: 4 },
};
const reply = (snapshots: unknown[] = []) => ({
  shared: true,
  generation: 0,
  snapshots,
  reasons: [],
});
function wrapper(api: SharedAccessApi) {
  return function ForecastHistoryWrapper({ children }: { children: ReactNode }) {
    return createElement(SharedAccessContext.Provider, { value: { api, actorId: "synthetic-actor" } }, children);
  };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("forecast shared read/mutation ordering", () => {
  it("keeps a saved snapshot when an older GET resolves afterward", async () => {
    const initial = deferred<unknown>();
    const call = vi.fn((body?: unknown) => (body ? Promise.resolve(reply([snapshot])) : initial.promise));
    const { result } = renderHook(() => useSharedForecastHistory(0), {
      wrapper: wrapper({ forecastHistory: call } as unknown as SharedAccessApi),
    });
    await waitFor(() => expect(call).toHaveBeenCalledTimes(1));
    await act(async () => {
      expect(await result.current.send({ snapshot })).toBe(true);
    });
    expect(result.current.state).toMatchObject({
      status: "shared",
      snapshots: [snapshot],
    });
    await act(async () => {
      initial.resolve(reply());
    });
    expect(result.current.state).toMatchObject({
      status: "shared",
      snapshots: [snapshot],
    });
  });

  it("keeps the saved result when an older first GET fails afterward", async () => {
    const initial = deferred<unknown>();
    const call = vi.fn((body?: unknown) => (body ? Promise.resolve(reply([snapshot])) : initial.promise));
    const { result } = renderHook(() => useSharedForecastHistory(0), {
      wrapper: wrapper({ forecastHistory: call } as unknown as SharedAccessApi),
    });
    await act(async () => {
      await result.current.send({ snapshot });
    });
    await act(async () => {
      initial.reject(new Error("synthetic read failed"));
    });
    expect(result.current.state).toMatchObject({
      status: "shared",
      snapshots: [snapshot],
    });
  });

  it("deduplicates simultaneous readers of the same desk", async () => {
    const initial = deferred<unknown>();
    const call = vi.fn(() => initial.promise);
    const wrapped = wrapper({
      forecastHistory: call,
    } as unknown as SharedAccessApi);
    const one = renderHook(() => useSharedForecastHistory(0), {
      wrapper: wrapped,
    });
    const two = renderHook(() => useSharedForecastHistory(0), {
      wrapper: wrapped,
    });
    expect(call).toHaveBeenCalledTimes(1);
    await act(async () => {
      initial.resolve(reply([snapshot]));
    });
    expect(one.result.current.state).toMatchObject({ snapshots: [snapshot] });
    expect(two.result.current.state).toMatchObject({ snapshots: [snapshot] });
  });

  it("does not adopt an old desk reply after the provider changes", async () => {
    const old = deferred<unknown>();
    const oldApi = {
      forecastHistory: vi.fn(() => old.promise),
    } as unknown as SharedAccessApi;
    const newApi = {
      forecastHistory: vi.fn(() => Promise.resolve(reply([snapshot]))),
    } as unknown as SharedAccessApi;
    let selected = oldApi;
    const { result, rerender } = renderHook(() => useSharedForecastHistory(0), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(SharedAccessContext.Provider, { value: { api: selected, actorId: "synthetic-actor" } }, children),
    });
    selected = newApi;
    rerender();
    await waitFor(() => expect(result.current.state).toMatchObject({ snapshots: [snapshot] }));
    await act(async () => {
      old.resolve(reply());
    });
    expect(result.current.state).toMatchObject({ snapshots: [snapshot] });
  });
});
