import { act, render, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { useForecastModel, type ForecastModel } from "@/components/ward-management/forecast/use-forecast-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { useSharedForecastHistory } from "@/components/ward-management/forecast/forecast-shared-history";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";

// H-0359 (USC-08): every forecast panel on a screen calls the model hook. Panels reading the same
// records and clock now share one forecast instead of each working it out again. Synthetic world.
function Panel({ now, seen }: { now: number; seen: ForecastModel[] }) {
  seen.push(useForecastModel(now));
  return null;
}

describe("forecast model shared between panels", () => {
  it("retires a review GET when an overlapping earlier mutation is acknowledged", async () => {
    const empty = { shared: true, generation: 0, reasonWriteVersion: 1, snapshots: [], reasons: [] };
    const a = { day: 1, reason: "other" as const, by: "coordinator" as const, at: NOW_ANCHOR, version: "synthetic-a" };
    const b = { ...a, day: 2, version: "synthetic-b" };
    let finishA!: (value: unknown) => void;
    let finishB!: (value: unknown) => void;
    let finishOldRead!: (value: unknown) => void;
    const firstWrite = new Promise<unknown>((resolve) => {
      finishA = resolve;
    });
    const secondWrite = new Promise<unknown>((resolve) => {
      finishB = resolve;
    });
    const oldRead = new Promise<unknown>((resolve) => {
      finishOldRead = resolve;
    });
    let reads = 0;
    const api = {
      forecastHistory: (body?: { reason?: { day: number } }) =>
        body
          ? body.reason?.day === 1
            ? firstWrite
            : secondWrite
          : ++reads === 1
            ? Promise.resolve(empty)
            : reads === 2
              ? oldRead
              : Promise.resolve({ ...empty, reasons: [a, b] }),
    } as unknown as SharedAccessApi;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SharedAccessContext.Provider, { value: { api, actorId: "synthetic-actor" } }, children);
    const view = renderHook(() => useSharedForecastHistory(0), { wrapper });
    await waitFor(() => expect(view.result.current.state.status).toBe("shared"));
    const pendingA = view.result.current.sendReason({ day: a.day, reason: a.reason, by: a.by, at: a.at }, null);
    const pendingB = view.result.current.sendReason({ day: b.day, reason: b.reason, by: b.by, at: b.at }, null);
    await act(async () => {
      finishB({ ...empty, reasons: [b] });
      await pendingB;
    });
    const pendingReview = view.result.current.refresh();
    await act(async () => {
      finishA({ ...empty, reasons: [a] });
      await pendingA;
    });
    expect(reads).toBe(3);
    await act(async () => {
      finishOldRead({ ...empty, reasons: [b] });
      await pendingReview;
    });
    expect(view.result.current.state).toMatchObject({ reasons: [{ day: 1 }, { day: 2 }] });
  });

  it("keeps an accepted reason when an older explicit review GET finishes afterward", async () => {
    const empty = { shared: true, generation: 0, reasonWriteVersion: 1, snapshots: [], reasons: [] };
    const reason = { day: 2, reason: "other" as const, by: "coordinator" as const, at: NOW_ANCHOR };
    let reads = 0;
    let finishReview!: (reply: unknown) => void;
    const review = new Promise<unknown>((resolve) => {
      finishReview = resolve;
    });
    const api = {
      forecastHistory: (body?: unknown) =>
        body
          ? Promise.resolve({ ...empty, reasons: [{ ...reason, version: "synthetic-new-version" }] })
          : ++reads === 1
            ? Promise.resolve(empty)
            : review,
    } as unknown as SharedAccessApi;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SharedAccessContext.Provider, { value: { api, actorId: "synthetic-actor" } }, children);
    const view = renderHook(() => useSharedForecastHistory(0), { wrapper });
    await waitFor(() => expect(view.result.current.state.status).toBe("shared"));
    const refreshing = view.result.current.refresh();
    await act(async () => expect(await view.result.current.sendReason(reason, null)).toEqual({ status: "accepted" }));
    expect(view.result.current.state).toMatchObject({ reasons: [reason] });
    await act(async () => {
      finishReview(empty);
      await refreshing;
    });
    expect(view.result.current.state).toMatchObject({ reasons: [reason] });
  });

  it("never sends a reason to an older server without protected-write capability", async () => {
    const writes: unknown[] = [];
    const api = {
      forecastHistory: async (body?: unknown) => {
        if (body) writes.push(body);
        return { shared: true, generation: 0, snapshots: [], reasons: [] };
      },
    } as unknown as SharedAccessApi;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SharedAccessContext.Provider, { value: { api, actorId: "synthetic-actor" } }, children);
    const view = renderHook(() => useSharedForecastHistory(0), { wrapper });
    await waitFor(() => expect(view.result.current.state.status).toBe("shared"));
    expect(
      await view.result.current.sendReason({ day: 1, reason: "other", by: "coordinator", at: NOW_ANCHOR }, null),
    ).toMatchObject({ status: "unavailable" });
    expect(writes).toHaveLength(0);
  });

  it("does not adopt a reason confirmation after the account changes behind the same API", async () => {
    let actorId = "synthetic-actor-a";
    let finish!: (reply: unknown) => void;
    const saved = new Promise<unknown>((resolve) => {
      finish = resolve;
    });
    const empty = { shared: true, generation: 0, reasonWriteVersion: 1, snapshots: [], reasons: [] };
    const api = {
      forecastHistory: (body?: unknown) => (body ? saved : Promise.resolve(empty)),
    } as unknown as SharedAccessApi;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SharedAccessContext.Provider, { value: { api, actorId } }, children);
    const view = renderHook(() => useSharedForecastHistory(0), { wrapper });
    await waitFor(() => expect(view.result.current.state.status).toBe("shared"));
    const outcome = view.result.current.sendReason(
      { day: 1, reason: "other", by: "coordinator", at: NOW_ANCHOR },
      null,
    );
    actorId = "synthetic-actor-b";
    view.rerender();
    await act(async () =>
      finish({
        ...empty,
        reasons: [{ day: 1, reason: "other", by: "coordinator", at: NOW_ANCHOR, version: "synthetic-version" }],
      }),
    );
    expect(await outcome).toMatchObject({ status: "unavailable" });
    expect(view.result.current.state).toMatchObject({ status: "shared", reasons: [] });
  });

  it("gives panels on the same records and clock the same forecast, and a new one for a new clock", () => {
    const seen: ForecastModel[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Panel now={NOW_ANCHOR} seen={seen} />
        <Panel now={NOW_ANCHOR} seen={seen} />
        <Panel now={NOW_ANCHOR + 60} seen={seen} />
      </WardFlowProvider>,
    );
    const [first, second, later] = seen;
    expect(first!.tomorrow).toBe(second!.tomorrow);
    expect(first!.risk).toBe(second!.risk);
    expect(first!.levers).toBe(second!.levers);
    expect(later!.tomorrow).not.toBe(first!.tomorrow);
    expect(later!.horizons).toEqual(first!.horizons);
  });
});
