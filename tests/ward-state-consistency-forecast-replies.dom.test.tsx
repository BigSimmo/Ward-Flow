import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useSharedForecastHistory,
  type SharedForecastHistory,
} from "@/components/ward-management/forecast/forecast-shared-history";
import type { ForecastMissReasonEntry } from "@/components/ward-management/forecast/forecast-miss-reasons";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

type ForecastCall = NonNullable<SharedAccessApi["forecastHistory"]>;
const first: ForecastMissReasonEntry = { day: 0, reason: "capacity_changed", by: "coordinator", at: 642 };
const later: ForecastMissReasonEntry = { day: 1, reason: "discharge_postponed", by: "coordinator", at: 2082 };

function reply(reasons: ForecastMissReasonEntry[] = [], generation = 0) {
  return { shared: true, generation, snapshots: [], reasons };
}

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function desk(call: ForecastCall) {
  const api = { forecastHistory: call } as SharedAccessApi;
  return function Desk({ children }: { children: ReactNode }) {
    return (
      <SharedAccessContext.Provider value={{ api, actorId: "synthetic-actor" }}>
        {children}
      </SharedAccessContext.Provider>
    );
  };
}

function reasons(state: SharedForecastHistory) {
  expect(state.status).toBe("shared");
  return state.status === "shared" ? state.reasons : [];
}

async function flush(run: () => void = () => {}) {
  await act(async () => run());
}

afterEach(() => vi.restoreAllMocks());

describe("forecast reply boundaries after concurrent local activity", () => {
  it("shares an in-flight read between views in the same world", async () => {
    const pending = deferred();
    const call = vi.fn<ForecastCall>().mockReturnValue(pending.promise);
    const { result } = renderHook(() => [useSharedForecastHistory(0), useSharedForecastHistory(0)], {
      wrapper: desk(call),
    });
    expect(call).toHaveBeenCalledTimes(1);
    await flush(() => pending.resolve(reply([first])));
    expect(result.current.map((value) => reasons(value.state))).toEqual([[first], [first]]);
  });

  it.each(["resolve", "reject"] as const)(
    "keeps an acknowledged save when an earlier background read later %ss",
    async (outcome) => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      const pending = deferred();
      let reads = 0;
      const call = vi.fn<ForecastCall>((body) =>
        body ? Promise.resolve(reply([first])) : ++reads === 1 ? Promise.resolve(reply()) : pending.promise,
      );
      const { result } = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call) });
      await flush();
      await flush(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(reads).toBe(2);
      await act(async () => expect(await result.current.send({ reason: first })).toBe(true));
      expect(reasons(result.current.state)).toEqual([first]);
      await flush(() =>
        outcome === "resolve" ? pending.resolve(reply()) : pending.reject(new Error("Synthetic disconnected read")),
      );
      expect(reasons(result.current.state)).toEqual([first]);
    },
  );

  it("protects a sibling view's first read when another view saves before it finishes", async () => {
    const pending = deferred();
    let reads = 0;
    const call = vi.fn<ForecastCall>((body) =>
      body ? Promise.resolve(reply([first])) : ++reads === 1 ? Promise.resolve(reply()) : pending.promise,
    );
    const wrapper = desk(call);
    const writer = renderHook(() => useSharedForecastHistory(0), { wrapper });
    await flush();
    const observer = renderHook(() => useSharedForecastHistory(0), { wrapper });
    await act(async () => expect(await writer.result.current.send({ reason: first })).toBe(true));
    expect(reasons(observer.result.current.state)).toEqual([first]);
    await flush(() => pending.reject(new Error("Synthetic disconnected first read")));
    expect(reasons(observer.result.current.state)).toEqual([first]);
  });

  it("does not reuse the previous world's pending read or let it remove the new read", async () => {
    const previous = deferred();
    const current = deferred();
    const call = vi.fn<ForecastCall>().mockReturnValueOnce(previous.promise).mockReturnValue(current.promise);
    const wrapper = desk(call);
    const view = renderHook(({ generation }) => useSharedForecastHistory(generation), {
      initialProps: { generation: 0 },
      wrapper,
    });
    view.rerender({ generation: 1 });
    expect(call).toHaveBeenCalledTimes(2);
    await flush(() => previous.resolve(reply([first])));
    const observer = renderHook(() => useSharedForecastHistory(1), { wrapper });
    expect(call).toHaveBeenCalledTimes(2);
    await flush(() => current.resolve(reply([later], 1)));
    expect(reasons(view.result.current.state)).toEqual([later]);
    expect(reasons(observer.result.current.state)).toEqual([later]);
  });

  it("ignores a save completion and retained callback from the previous world", async () => {
    const pending = deferred();
    let reads = 0;
    const call = vi.fn<ForecastCall>((body) =>
      body ? pending.promise : Promise.resolve(++reads === 1 ? reply() : reply([later], 1)),
    );
    const view = renderHook(({ generation }) => useSharedForecastHistory(generation), {
      initialProps: { generation: 0 },
      wrapper: desk(call),
    });
    await flush();
    const previousSend = view.result.current.send;
    let saving!: Promise<boolean>;
    await flush(() => {
      saving = previousSend({ reason: first });
    });
    view.rerender({ generation: 1 });
    await flush();
    expect(reasons(view.result.current.state)).toEqual([later]);
    await flush(() => pending.resolve(reply([first])));
    expect(await saving).toBe(false);
    expect(reasons(view.result.current.state)).toEqual([later]);
    expect(await previousSend({ reason: first })).toBe(false);
    expect(call.mock.calls.filter(([body]) => body)).toHaveLength(1);
  });

  it("does not broadcast an unmounted view's late save into a later view", async () => {
    const pending = deferred();
    let reads = 0;
    const call = vi.fn<ForecastCall>((body) =>
      body ? pending.promise : Promise.resolve(++reads === 1 ? reply() : reply([later])),
    );
    const wrapper = desk(call);
    const writer = renderHook(() => useSharedForecastHistory(0), { wrapper });
    await flush();
    let saving!: Promise<boolean>;
    await flush(() => {
      saving = writer.result.current.send({ reason: first });
    });
    writer.unmount();
    const observer = renderHook(() => useSharedForecastHistory(0), { wrapper });
    await flush();
    expect(reasons(observer.result.current.state)).toEqual([later]);
    await flush(() => pending.resolve(reply([first])));
    expect(await saving).toBe(false);
    expect(reasons(observer.result.current.state)).toEqual([later]);
  });

  it.each([undefined, { shared: false }, reply([first], 1)])(
    "keeps confirmed history when a save returns an unconfirmed reply: %j",
    async (unconfirmed) => {
      const call = vi.fn<ForecastCall>((body) => Promise.resolve(body ? unconfirmed : reply([later])));
      const { result } = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call) });
      await flush();
      expect(reasons(result.current.state)).toEqual([later]);
      await act(async () => expect(await result.current.send({ reason: first })).toBe(false));
      expect(reasons(result.current.state)).toEqual([later]);
    },
  );
});
