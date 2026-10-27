import { act, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { ForecastHistoryEntry } from "@/components/ward-management/forecast/forecast-history";
import { sharedForecastReply } from "@/components/ward-management/forecast/forecast-shared-history";
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
  const forecastHistory: NonNullable<SharedAccessApi["forecastHistory"]> = async (body) => {
    if (failing) throw new Error("Forecast history could not be read");
    if (!shared) return { shared: false };
    if (body) {
      sent.push(body);
      generation = body.generation as number;
      const snapshot = body.snapshot as ForecastHistoryEntry | undefined;
      if (snapshot && !snapshots.some((entry) => entry.day === snapshot.day)) snapshots.push(snapshot);
      if (body.reason) reasons.push(body.reason as Record<string, unknown>);
    }
    return { shared: true, generation, snapshots: [...snapshots], reasons: [...reasons] };
  };
  const api = { forecastHistory } as unknown as SharedAccessApi;
  return { api, sent };
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

afterEach(() => window.localStorage.clear());

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
});
