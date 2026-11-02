import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FORECAST_MISS_REASONS_STORAGE_KEY,
  latestMissReasons,
} from "@/components/ward-management/forecast/forecast-miss-reasons";

import { useForecastMissReasons } from "@/components/ward-management/forecast/use-forecast-model";
import { ForecastMissReasonControl } from "@/components/ward-management/forecast/forecast-miss-reason-control";
import { FORECAST_PENDING_PREFIX } from "@/components/ward-management/forecast/forecast-pending-reasons";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

const choice = { day: 0, reason: "capacity_changed" as const, by: "coordinator" as const, at: 642 };
const peer = { ...choice, reason: "discharge_postponed" as const, at: 643 };
const scopeKey = "a".repeat(64);
type Seen = ReturnType<typeof useForecastMissReasons>;

function server() {
  let current: typeof choice | typeof peer | undefined;
  let version = 0;
  let revision = 0;
  const receipts = new Map<string, Record<string, unknown>>();
  const sent: Record<string, unknown>[] = [];
  const control = { failWrites: false, loseAcknowledgement: false, holdAcknowledgement: false };
  let release = () => {};
  const history = () => ({
    shared: true,
    generation: 0,
    scopeKey,
    writable: true,
    historyRevision: revision,
    snapshots: [],
    reasons: current ? [current] : [],
    reasonVersions: current ? { "0": version } : {},
  });
  const forecastHistory: NonNullable<SharedAccessApi["forecastHistory"]> = async (body) => {
    if (!body) return history();
    sent.push(body);
    if (control.failWrites) throw new Error("Synthetic disconnected save");
    const operationId = String(body.operationId);
    if (receipts.has(operationId)) return { ...history(), ...receipts.get(operationId), replayed: true };
    if (body.expectedDayVersion !== version)
      return { ...history(), operationId, outcome: "conflict", code: "forecast-conflict" };
    current = body.reason as typeof choice;
    version += 1;
    revision += 1;
    const receipt = { operationId, outcome: "accepted", commandRevision: revision };
    receipts.set(operationId, receipt);
    if (control.holdAcknowledgement)
      return new Promise((resolve) => {
        release = () => resolve({ ...history(), ...receipt });
      });
    if (control.loseAcknowledgement) throw new Error("Synthetic lost acknowledgement");
    return { ...history(), ...receipt };
  };
  return {
    api: { forecastHistory } as SharedAccessApi,
    control,
    sent,
    history,
    release: () => release(),
    changePeer() {
      current = peer;
      version += 1;
      revision += 1;
    },
  };
}

function Probe({ seenRef, control = false }: { seenRef: { current?: Seen }; control?: boolean }) {
  const value = useForecastMissReasons();
  useEffect(() => {
    seenRef.current = value;
  }, [value, seenRef]);
  return control ? (
    <ForecastMissReasonControl
      day={0}
      now={642}
      entry={latestMissReasons(value.entries).get(0)}
      candidates={[]}
      pending={value.pending}
      legacy={value.legacy}
      writable={value.writable}
      version={value.reasonVersions[0] ?? 0}
      error={value.error}
      onRetry={value.retry}
      onDiscard={value.discard}
      onRecord={(reason, basis) => value.record({ ...choice, reason }, basis)}
    />
  ) : null;
}

function mount(api: SharedAccessApi, seen: { current?: Seen }, control = false) {
  return render(
    <WardFlowProvider initialNow={642}>
      <SharedAccessContext.Provider value={{ api, actorId: "synthetic-actor" }}>
        <Probe seenRef={seen} control={control} />
      </SharedAccessContext.Provider>
    </WardFlowProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("durable forecast reason recovery", () => {
  it("does not count a failed shared save as a confirmed recorded reason", async () => {
    const remote = server();
    remote.control.failWrites = true;
    const seen: { current?: Seen } = {};
    mount(remote.api, seen);
    await act(async () => {});
    await act(async () => {
      seen.current?.record(choice);
    });
    await waitFor(() => expect(remote.sent).toHaveLength(1));
    expect(seen.current?.entries).toEqual([]);
    await waitFor(() => expect(seen.current?.pending[0].status).toBe("failed"));
  });

  it("retries the original operation after reload and never replaces a newer peer reason", async () => {
    const remote = server();
    remote.control.failWrites = true;
    const seen: { current?: Seen } = {};
    const view = mount(remote.api, seen);
    await act(async () => {});
    await act(async () => {
      seen.current?.record(choice);
    });
    await waitFor(() => expect(remote.sent).toHaveLength(1));
    const original = remote.sent[0];
    view.unmount();
    remote.control.failWrites = false;
    remote.changePeer();
    mount(remote.api, seen);
    await waitFor(() => expect(remote.sent).toHaveLength(2));
    expect(remote.sent[1]).toMatchObject({ operationId: original.operationId, expectedDayVersion: 0 });
    expect(seen.current?.entries).toEqual([peer]);
    expect(remote.history().reasons).toEqual([peer]);
    await waitFor(() => expect(seen.current?.pending[0].status).toBe("conflict"));
  });

  it("recovers a lost acknowledgement without replaying it over a newer peer reason", async () => {
    const remote = server();
    remote.control.loseAcknowledgement = true;
    const seen: { current?: Seen } = {};
    const view = mount(remote.api, seen);
    await act(async () => {});
    await act(async () => {
      seen.current?.record(choice);
    });
    await waitFor(() => expect(remote.sent).toHaveLength(1));
    const original = remote.sent[0];
    view.unmount();
    remote.control.loseAcknowledgement = false;
    remote.changePeer();
    mount(remote.api, seen);
    await waitFor(() => expect(remote.sent).toHaveLength(2));
    expect(remote.sent[1].operationId).toBe(original.operationId);
    expect(seen.current?.entries).toEqual([peer]);
    expect(remote.history().reasons).toEqual([peer]);
    await waitFor(() => expect(seen.current?.pending).toEqual([]));
  });

  it("keeps an unconfirmed reason visibly distinct from a recorded one", () => {
    render(<ForecastMissReasonControl day={0} now={642} entry={undefined} candidates={[]} onRecord={() => {}} />);
    expect(screen.queryByText(/Recorded by/)).toBeNull();
  });

  it("recovers an in-flight save after unmount with the same operation and preserves newer history", async () => {
    const remote = server();
    remote.control.holdAcknowledgement = true;
    const seen: { current?: Seen } = {};
    const view = mount(remote.api, seen);
    await act(async () => {});
    await act(async () => {
      seen.current?.record(choice);
    });
    await waitFor(() => expect(remote.sent).toHaveLength(1));
    const original = remote.sent[0];
    view.unmount();
    remote.changePeer();
    mount(remote.api, seen);
    await waitFor(() => expect(remote.sent).toHaveLength(2));
    expect(remote.sent[1].operationId).toBe(original.operationId);
    await waitFor(() => expect(seen.current?.pending).toEqual([]));
    expect(seen.current?.entries).toEqual([peer]);
    await act(async () => remote.release());
    expect(seen.current?.entries).toEqual([peer]);
  });

  it("keeps the form's original day version after another reason is read", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const remote = server();
    remote.changePeer();
    const seen: { current?: Seen } = {};
    mount(remote.api, seen, true);
    await screen.findByRole("button", { name: "Change" });
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    remote.changePeer();
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    fireEvent.change(screen.getByLabelText("Reason for the difference"), { target: { value: "other" } });
    fireEvent.click(screen.getByRole("button", { name: "Record reason" }));
    await waitFor(() => expect(seen.current?.pending[0].status).toBe("conflict"));
    expect(remote.sent[0].expectedDayVersion).toBe(1);
    expect(screen.getByText(/Another reason was recorded/)).toBeInTheDocument();
    expect(screen.getByText(/Reason: Discharge postponed. Recorded by/)).toBeInTheDocument();
    expect(remote.history().reasons).toEqual([peer]);
  });

  it("shows an older unscoped local choice for review without sending it automatically", async () => {
    const localKey = `${FORECAST_MISS_REASONS_STORAGE_KEY}:synthetic-actor:standard:0`;
    window.localStorage.setItem(localKey, JSON.stringify([choice]));
    const remote = server();
    const seen: { current?: Seen } = {};
    mount(remote.api, seen, true);
    await screen.findByRole("button", { name: "Review local choice" });
    expect(remote.sent).toHaveLength(0);
    expect(seen.current?.entries).toEqual([]);
    expect(window.localStorage.getItem(localKey)).toBe(JSON.stringify([choice]));
    fireEvent.click(screen.getByRole("button", { name: "Review local choice" }));
    fireEvent.click(screen.getByRole("button", { name: "Record reason" }));
    await waitFor(() => expect(remote.sent).toHaveLength(1));
    expect(remote.sent[0]).toMatchObject({ scopeKey, expectedDayVersion: 0 });
  });

  it("keeps an initial choice and its empty-day basis when a peer records the first reason", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const remote = server();
    const seen: { current?: Seen } = {};
    mount(remote.api, seen, true);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("Reason for the difference"), { target: { value: "capacity_changed" } });
    remote.changePeer();
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByLabelText("Reason for the difference")).toHaveValue("capacity_changed");
    fireEvent.click(screen.getByRole("button", { name: "Record reason" }));
    await waitFor(() => expect(seen.current?.pending[0].status).toBe("conflict"));
    expect(remote.sent[0].expectedDayVersion).toBe(0);
    expect(remote.history().reasons).toEqual([peer]);
  });

  it("does not send a choice when this device cannot keep its pending operation", async () => {
    const remote = server();
    const seen: { current?: Seen } = {};
    mount(remote.api, seen);
    await act(async () => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Synthetic full storage");
    });
    await act(async () => expect(seen.current?.record(choice)).toBe(false));
    expect(remote.sent).toHaveLength(0);
    expect(seen.current?.error).toMatch(/has not been sent/);
  });

  it("does not resurrect a draft another tab removed while its failed reply was pending", async () => {
    const remote = server();
    let reject!: (error: Error) => void;
    let writes = 0;
    const pendingReply = new Promise<unknown>((_, no) => {
      reject = no;
    });
    const api = {
      forecastHistory: (body?: Record<string, unknown>) => {
        if (!body) return Promise.resolve(remote.history());
        writes += 1;
        return pendingReply;
      },
    } as SharedAccessApi;
    const seen: { current?: Seen } = {};
    mount(api, seen);
    await act(async () => {});
    await act(async () => {
      seen.current?.record(choice);
    });
    await waitFor(() => expect(writes).toBe(1));
    const key = Object.keys(window.localStorage).find((value) => value.startsWith(FORECAST_PENDING_PREFIX))!;
    expect(key).toBeDefined();
    await act(async () => {
      window.localStorage.removeItem(key);
      window.dispatchEvent(new Event("storage"));
    });
    await act(async () => reject(new Error("Synthetic lost connection")));
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(seen.current?.pending).toEqual([]);
  });
});
