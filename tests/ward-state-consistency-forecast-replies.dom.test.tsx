import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const operationId = "00000000-0000-4000-8000-000000000001";
const scopeKey = "a".repeat(64);

function reply(reasons: ForecastMissReasonEntry[] = [], generation = 0, historyRevision = 1) {
  return {
    shared: true,
    generation,
    scopeKey,
    historyRevision,
    writable: true,
    reasonVersions: {},
    snapshots: [],
    reasons,
    operationId,
    outcome: "accepted",
    commandRevision: historyRevision,
  };
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

function desk(call: ForecastCall, accessContext = "test-context") {
  const api = { forecastHistory: call } as SharedAccessApi;
  return function Desk({ children }: { children: ReactNode }) {
    return (
      <SharedAccessContext.Provider value={{ api, actorId: "synthetic-actor", accessContext }}>
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
beforeEach(() => vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(operationId));

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

  it("keeps the newer server revision when write acknowledgements arrive in reverse order", async () => {
    const firstSave = deferred();
    const secondSave = deferred();
    const secondId = "00000000-0000-4000-8000-000000000002";
    const call = vi.fn<ForecastCall>((body) =>
      !body ? Promise.resolve(reply()) : body.operationId === operationId ? firstSave.promise : secondSave.promise,
    );
    const { result } = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call) });
    await flush();
    let one!: ReturnType<typeof result.current.write>;
    let two!: ReturnType<typeof result.current.write>;
    await flush(() => {
      one = result.current.write({ scopeKey, operationId, reason: first, expectedDayVersion: 0 });
      two = result.current.write({ scopeKey, operationId: secondId, reason: later, expectedDayVersion: 0 });
    });
    await flush(() => secondSave.resolve({ ...reply([first, later], 0, 2), operationId: secondId }));
    expect(await two).toEqual({ status: "accepted" });
    await flush(() => firstSave.resolve(reply([first], 0, 1)));
    expect(await one).toEqual({ status: "accepted" });
    expect(reasons(result.current.state)).toEqual([first, later]);
  });

  it("does not replace versioned history with an older or unversioned later read", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const call = vi
      .fn<ForecastCall>()
      .mockResolvedValueOnce(reply([later], 0, 2))
      .mockResolvedValueOnce(reply([first], 0, 1))
      .mockResolvedValue({ shared: true, generation: 0, snapshots: [], reasons: [] });
    const { result } = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call) });
    await flush();
    await flush(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(reasons(result.current.state)).toEqual([later]);
    await flush(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(reasons(result.current.state)).toEqual([later]);
  });

  it.each([0, 3])(
    "does not confirm an operation without a commit covered by its history (%i)",
    async (commandRevision) => {
      const call = vi.fn<ForecastCall>((body) =>
        Promise.resolve(body ? { ...reply([first], 0, 2), commandRevision } : reply()),
      );
      const { result } = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call) });
      await flush();
      await act(async () => expect(await result.current.send({ reason: first })).toBe(false));
    },
  );

  it("does not replace a newer desk reply with an older global revision from another scope", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const call = vi
      .fn<ForecastCall>()
      .mockResolvedValueOnce({ ...reply([later], 0, 2), scopeKey: "b".repeat(64) })
      .mockResolvedValue({ ...reply([first], 0, 1), scopeKey });
    const { result } = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call) });
    await flush();
    await flush(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(reasons(result.current.state)).toEqual([later]);
  });

  it("does not switch desks when an earlier desk's write acknowledgement shares the current revision", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const pending = deferred();
    let reads = 0;
    const otherScope = "b".repeat(64);
    const call = vi.fn<ForecastCall>((body) =>
      body
        ? pending.promise
        : Promise.resolve(++reads === 1 ? reply() : { ...reply([later], 0, 2), scopeKey: otherScope }),
    );
    const { result } = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call) });
    await flush();
    let saving!: ReturnType<typeof result.current.write>;
    await flush(() => {
      saving = result.current.write({ scopeKey, operationId, expectedDayVersion: 0, reason: first });
    });
    await flush(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(reasons(result.current.state)).toEqual([later]);
    await flush(() => pending.resolve(reply([first], 0, 2)));
    expect(await saving).toEqual({ status: "accepted" });
    expect(reasons(result.current.state)).toEqual([later]);
    expect(result.current.state.status === "shared" && result.current.state.scopeKey).toBe(otherScope);
  });

  it("does not resurrect another access context's cached history after a failed first read", async () => {
    const call = vi
      .fn<ForecastCall>()
      .mockResolvedValueOnce(reply([first], 0, 4))
      .mockRejectedValue(new Error("Synthetic disconnected new desk"));
    const previous = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call, "a".repeat(64)) });
    await flush();
    expect(reasons(previous.result.current.state)).toEqual([first]);
    previous.unmount();
    const current = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call, "b".repeat(64)) });
    await flush();
    expect(current.result.current.state).toEqual({ status: "local" });
  });

  it("does not reuse another access context's pending read or adopt its late completion", async () => {
    const previousRead = deferred();
    const currentRead = deferred();
    const call = vi.fn<ForecastCall>().mockReturnValueOnce(previousRead.promise).mockReturnValue(currentRead.promise);
    const previous = renderHook(() => useSharedForecastHistory(0), { wrapper: desk(call, "a".repeat(64)) });
    previous.unmount();
    const wrapper = desk(call, "b".repeat(64));
    const current = renderHook(() => useSharedForecastHistory(0), { wrapper });
    expect(call).toHaveBeenCalledTimes(2);
    await flush(() => previousRead.resolve(reply([first], 0, 1)));
    const sibling = renderHook(() => useSharedForecastHistory(0), { wrapper });
    expect(call).toHaveBeenCalledTimes(2);
    await flush(() => currentRead.resolve({ ...reply([later], 0, 2), scopeKey: "b".repeat(64) }));
    expect(reasons(current.result.current.state)).toEqual([later]);
    expect(reasons(sibling.result.current.state)).toEqual([later]);
  });
});
