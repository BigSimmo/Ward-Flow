import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ForecastHistoryEntry } from "@/components/ward-management/forecast/forecast-history";
import {
  sharedForecastReply,
  useSharedForecastHistory,
} from "@/components/ward-management/forecast/forecast-shared-history";
import {
  useForecastHistory,
  useForecastMissReasons,
  useForecastModel,
} from "@/components/ward-management/forecast/use-forecast-model";
import { dayOf } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

// Proposal 013 (migration 16): the desk's forecast history comes from the server when it has it,
// and the browser's own copy is used otherwise. Synthetic counts only.
const today = dayOf(NOW_ANCHOR);
const yesterday: ForecastHistoryEntry = {
  day: today - 1,
  at: NOW_ANCHOR - 1440,
  nowGap: 3,
  tomorrow: { low: 1, likely: 2, high: 4 },
};

type Seen = {
  history: ForecastHistoryEntry[];
  reasons: number;
  record?: ReturnType<typeof useForecastMissReasons>["record"];
};
function Probe({ onSeen }: { onSeen: (seen: Seen) => void }) {
  const model = useForecastModel(NOW_ANCHOR);
  const { history } = useForecastHistory(model, NOW_ANCHOR);
  const { entries, record } = useForecastMissReasons();
  useEffect(() => {
    onSeen({ history, reasons: entries.length, record });
  }, [onSeen, history, entries, record]);
  return null;
}

/** A desk's server history in memory: the first snapshot of a day stands, a later reason replaces. */
function fakeServer({ shared = true, failing = false } = {}) {
  const sent: Record<string, unknown>[] = [];
  let generation = 0;
  const snapshots: ForecastHistoryEntry[] = [yesterday];
  const reasons: Record<string, unknown>[] = [];
  const control = { failWrites: false };
  const forecastHistory: NonNullable<SharedAccessApi["forecastHistory"]> = async (body) => {
    if (failing || (body && control.failWrites)) throw new Error("Forecast history could not be read");
    if (!shared) return { shared: false };
    if (body) {
      sent.push(body);
      generation = body.generation as number;
      const snapshot = body.snapshot as ForecastHistoryEntry | undefined;
      if (snapshot && !snapshots.some((entry) => entry.day === snapshot.day)) snapshots.push(snapshot);
      if (body.reason) addReason(body.reason as Record<string, unknown>);
    }
    return { shared: true, generation, snapshots: [...snapshots], reasons: [...reasons] };
  };
  function addReason(reason: Record<string, unknown>) {
    const index = reasons.findIndex((held) => held.day === reason.day);
    if (index >= 0) reasons.splice(index, 1);
    reasons.push(reason);
  }
  const api = { forecastHistory } as unknown as SharedAccessApi;
  return { api, sent, control, addReason };
}

function renderWith(api: SharedAccessApi | null, seen: Seen) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {api ? (
        <SharedAccessContext.Provider value={{ api, actorId: "synthetic-actor" }}>
          <Probe onSeen={(next) => Object.assign(seen, next)} />
        </SharedAccessContext.Provider>
      ) : (
        <Probe onSeen={(next) => Object.assign(seen, next)} />
      )}
    </WardFlowProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

type ForecastCall = NonNullable<SharedAccessApi["forecastHistory"]>;
function deferredReply() {
  let resolve!: (reply: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<unknown>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function historyReply(generation: number, nowGap: number) {
  return { shared: true, generation, snapshots: [{ ...yesterday, nowGap }], reasons: [] };
}
function renderHistory(call: ForecastCall, generation = 0) {
  let current!: ReturnType<typeof useSharedForecastHistory>;
  function HistoryProbe({ world }: { world: number }) {
    const value = useSharedForecastHistory(world);
    useEffect(() => {
      current = value;
    }, [value]);
    return null;
  }
  const tree = (nextCall: ForecastCall, world: number) => (
    <SharedAccessContext.Provider
      value={{ api: { forecastHistory: nextCall } as SharedAccessApi, actorId: "synthetic" }}
    >
      <HistoryProbe world={world} />
    </SharedAccessContext.Provider>
  );
  const view = render(tree(call, generation));
  return {
    get current() {
      return current;
    },
    rerender(nextCall: ForecastCall, world: number) {
      view.rerender(tree(nextCall, world));
    },
    unmount: view.unmount,
  };
}

describe("shared forecast request lifetimes", () => {
  it("keeps an accepted write when an earlier GET finishes later", async () => {
    const read = deferredReply();
    const call: ForecastCall = (body) => (body ? Promise.resolve(historyReply(0, 9)) : read.promise);
    const view = renderHistory(call);
    await act(async () => {
      expect(await view.current.send({ snapshot: yesterday })).toBe(true);
    });
    expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 9 }] });
    await act(async () => read.resolve(historyReply(0, 1)));
    expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 9 }] });
  });

  it("keeps Shared when an earlier first GET fails after an accepted write", async () => {
    const read = deferredReply();
    const call: ForecastCall = (body) => (body ? Promise.resolve(historyReply(0, 9)) : read.promise);
    const view = renderHistory(call);
    await act(async () => {
      expect(await view.current.send({ snapshot: yesterday })).toBe(true);
    });
    await act(async () => read.reject(new Error("synthetic delayed read failure")));
    expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 9 }] });
  });

  it("does not publish an obsolete world's POST into the current world", async () => {
    const write = deferredReply();
    let reads = 0;
    const call: ForecastCall = (body) => (body ? write.promise : Promise.resolve(historyReply(++reads, reads)));
    const view = renderHistory(call, 1);
    await waitFor(() => expect(view.current.state.status).toBe("shared"));
    const sent = view.current.send({ snapshot: yesterday });
    view.rerender(call, 2);
    await waitFor(() => expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 2 }] }));
    await act(async () => {
      write.resolve(historyReply(1, 9));
      expect(await sent).toBe(false);
    });
    expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 2 }] });
  });

  it("invalidates the shared old GET and keeps a newer deduplicated read owned until it finishes", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const oldRead = deferredReply();
    const newRead = deferredReply();
    let reads = 0;
    const call: ForecastCall = (body) => {
      if (body) return Promise.resolve(historyReply(0, 9));
      return ++reads === 1 ? oldRead.promise : newRead.promise;
    };
    const first = renderHistory(call);
    await act(async () => {
      expect(await first.current.send({ snapshot: yesterday })).toBe(true);
    });
    const second = renderHistory(call);
    const third = renderHistory(call);
    await waitFor(() => expect(reads).toBe(2));
    for (const view of [first, second, third])
      expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 9 }] });
    await act(async () => oldRead.resolve(historyReply(0, 1)));
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(reads).toBe(2);
    for (const view of [first, second, third])
      expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 9 }] });
    await act(async () => newRead.resolve(historyReply(0, 10)));
    for (const view of [first, second, third])
      expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 10 }] });
  });

  it.each([null, { shared: false }, historyReply(1, 1)])(
    "keeps current shared history when a write has no matching shared reply: %j",
    async (reply) => {
      const call: ForecastCall = (body) => Promise.resolve(body ? reply : historyReply(0, 9));
      const view = renderHistory(call);
      await waitFor(() => expect(view.current.state.status).toBe("shared"));
      await act(async () => {
        expect(await view.current.send({ snapshot: yesterday })).toBe(false);
      });
      expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 9 }] });
    },
  );

  it("fences an old POST across call A to B to A, even when A's function is reused", async () => {
    const write = deferredReply();
    let reads = 0;
    const callA: ForecastCall = (body) => (body ? write.promise : Promise.resolve(historyReply(0, ++reads)));
    const callB: ForecastCall = () => Promise.resolve(historyReply(0, 20));
    const view = renderHistory(callA);
    await waitFor(() => expect(view.current.state.status).toBe("shared"));
    const oldSend = view.current.send;
    const sent = oldSend({ snapshot: yesterday });
    view.rerender(callB, 0);
    await waitFor(() => expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 20 }] }));
    view.rerender(callA, 0);
    await waitFor(() => expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 2 }] }));
    await act(async () => {
      write.resolve(historyReply(0, 9));
      expect(await sent).toBe(false);
      expect(await oldSend({ snapshot: yesterday })).toBe(false);
    });
    expect(view.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 2 }] });
  });

  it("publishes a valid accepted write to a surviving view when its originating view leaves", async () => {
    const read = deferredReply();
    const write = deferredReply();
    const call: ForecastCall = (body) => (body ? write.promise : read.promise);
    const first = renderHistory(call);
    const second = renderHistory(call);
    const sent = first.current.send({ snapshot: yesterday });
    first.unmount();
    await act(async () => {
      write.resolve(historyReply(0, 9));
      expect(await sent).toBe(false);
    });
    expect(second.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 9 }] });
    await act(async () => read.resolve(historyReply(0, 1)));
    expect(second.current.state).toMatchObject({ status: "shared", snapshots: [{ nowGap: 9 }] });
  });
});

describe("shared forecast history (proposal 013)", () => {
  it("keeps a reply only when it is shared and counted in the same world", () => {
    expect(sharedForecastReply({ shared: false }, 0)).toEqual({ status: "local" });
    expect(sharedForecastReply({ shared: true, generation: 1, snapshots: [], reasons: [] }, 0)).toEqual({
      status: "local",
    });
    expect(sharedForecastReply(null, 0)).toEqual({ status: "local" });
    const reply = sharedForecastReply(
      { shared: true, generation: 0, snapshots: [yesterday, { day: "x" }], reasons: [{ day: 1, reason: "free text" }] },
      0,
    );
    expect(reply).toEqual({ status: "shared", snapshots: [yesterday], reasons: [] });
  });

  it("shows the desk's shared history and records today's snapshot there once", async () => {
    const { api, sent } = fakeServer();
    const seen: Seen = { history: [], reasons: 0 };
    renderWith(api, seen);
    await waitFor(() => expect(seen.history.map((entry) => entry.day)).toEqual([today - 1, today]));
    expect(sent.filter((body) => body.snapshot)).toHaveLength(1);
    expect(sent[0]).toMatchObject({ generation: 0, snapshot: { day: today } });

    // A reason chosen on this device goes to the desk's shared record too.
    await act(async () => seen.record?.({ day: today, reason: "capacity_changed", by: "coordinator", at: NOW_ANCHOR }));
    await waitFor(() => expect(seen.reasons).toBe(1));
    expect(sent.at(-1)).toMatchObject({ reason: { day: today, reason: "capacity_changed" } });
  });

  it("keeps the browser's own history before migration 16, when the read fails, and in the local demo", async () => {
    for (const api of [fakeServer({ shared: false }).api, fakeServer({ failing: true }).api, null]) {
      const seen: Seen = { history: [], reasons: 0 };
      const view = renderWith(api, seen);
      await waitFor(() => expect(seen.history.map((entry) => entry.day)).toEqual([today]));
      view.unmount();
      window.localStorage.clear();
    }
  });

  it("keeps a reason shown when its save fails, and saves it on the next read", async () => {
    const { api, sent, control } = fakeServer();
    const seen: Seen = { history: [], reasons: 0 };
    renderWith(api, seen);
    await waitFor(() => expect(seen.history).toHaveLength(2));
    control.failWrites = true;
    await act(async () => seen.record?.({ day: today, reason: "other", by: "coordinator", at: NOW_ANCHOR }));
    expect(seen.reasons).toBe(1);
    control.failWrites = false;
    // The view reads the history again when it is shown again, and the unsaved reason goes with it.
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(sent.some((body) => body.reason)).toBe(true));
    expect(seen.reasons).toBe(1);
  });

  it("picks up a reason another device recorded when the view is shown again", async () => {
    const { api, addReason } = fakeServer();
    const seen: Seen = { history: [], reasons: 0 };
    renderWith(api, seen);
    await waitFor(() => expect(seen.history).toHaveLength(2));
    expect(seen.reasons).toBe(0);
    addReason({ day: today - 1, reason: "transfer_cancelled", by: "bed_manager", at: NOW_ANCHOR - 60 });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await waitFor(() => expect(seen.reasons).toBe(1));
  });
});
