/** WF-B014: History replies belong to the world that requested them. Synthetic transport only. */
import { createHash } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { isValidSharedWardFlowState } from "../src/components/ward-management/ward-shared-state-validation";

type State = SharedSnapshot["payload"]["state"];
type Alert = State["broadcastAlerts"][number];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const context = "a".repeat(64);
const alert = (sequence: number, title: string): Alert => ({
  id: `BCAST-${sequence}`,
  title,
  message: "Synthetic archive fixture",
  targetScopeLabel: "All units",
  dispatchedByRole: "coordinator",
  dispatchedByName: "Synthetic desk",
  severity: "advisory",
  category: "capacity_gridlock",
  targetScope: "all",
  status: "expired",
  dispatchedAt: 1,
  expiresAt: 2,
  durationMinutes: 1,
  acknowledgedUnits: [],
});
const oldAlert = alert(1, "Synthetic previous-world alert");
const currentAlert = alert(1, "Synthetic current-world alert");
function snapshot(generation: number, archived = 1, counter = 1, revision = generation + 1): SharedSnapshot {
  const state = copy(seedWardFlowStateAt(0));
  state.worldGeneration = generation;
  state.broadcastSequence = counter;
  state.broadcastAlerts = [];
  return {
    dataMode: "prototype",
    revision,
    now: 60_000,
    accessContext: context,
    archived,
    payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  };
}
function archive(alerts: Alert[], through = 1) {
  const records = alerts.map((body) => ({
    collection: "broadcastAlerts",
    body,
    closedAt: body.expiresAt,
    hash: createHash("sha256")
      .update(`broadcastAlerts\0${body.id}\0${JSON.stringify(body)}`)
      .digest("hex")
      .slice(0, 12),
  }));
  const sum = records
    .reduce((total, record) => (total + Number.parseInt(record.hash, 16)) % 2 ** 48, 0)
    .toString(16)
    .padStart(12, "0");
  return { archived: alerts.length, through, sum, records };
}
function harness(initial = snapshot(0)) {
  let board = initial;
  let view: SharedView | undefined;
  const reads: Array<{ path: string; resolve: (reply: Response) => void }> = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    changed: (next) => {
      view = next;
    },
    fetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/v1/workspace/archive")
        return new Promise<Response>((resolve) => reads.push({ path: url.pathname + url.search, resolve }));
      if (url.pathname === "/v1/workspace") return Response.json({ snapshot: board });
      throw new Error(`Unexpected synthetic request: ${url.pathname}`);
    },
  });
  return {
    client,
    reads,
    async refresh() {
      await client.refresh();
      await setImmediate();
    },
    titles: () => view?.snapshot?.payload.state.broadcastAlerts.map((row) => row.title),
    generation: () => view?.snapshot?.payload.state.worldGeneration,
    show: (next: SharedSnapshot) => {
      board = next;
    },
    async finish(index: number, value: unknown) {
      reads[index]!.resolve(Response.json(value));
      // Let the actual request's JSON parsing, cache merge and publication finish before inspecting it.
      await setImmediate();
    },
  };
}

describe("shared archive world-generation lifetime", () => {
  it("starts a replacement same-count read and rejects the old completion without releasing its guard", async () => {
    const h = harness();
    try {
      await h.refresh();
      expect(h.reads).toHaveLength(1);
      h.show(snapshot(1));
      await h.refresh();
      expect(h.generation()).toBe(1);
      expect(h.reads).toHaveLength(2);
      await h.finish(0, archive([oldAlert]));
      expect(h.titles()).toEqual([]);
      await h.refresh();
      expect(h.reads).toHaveLength(2);
      await h.finish(1, archive([currentAlert]));
      expect(h.titles()).toEqual([currentAlert.title]);
      await h.refresh();
      expect(h.reads).toHaveLength(2);
      expect(h.titles()).toEqual([currentAlert.title]);
    } finally {
      h.client.dispose();
    }
  });

  it("keeps an old reply out after a zero-archive reset followed by compatible new-world count growth", async () => {
    const h = harness();
    try {
      await h.refresh();
      h.show(snapshot(1, 0, 0));
      await h.refresh();
      expect(h.titles()).toEqual([]);
      expect(h.reads).toHaveLength(1);
      h.show(snapshot(1, 1, 1, 3));
      await h.refresh();
      expect(h.reads).toHaveLength(2);
      await h.finish(0, archive([oldAlert]));
      expect(h.titles()).toEqual([]);
      await h.finish(1, archive([currentAlert]));
      expect(h.titles()).toEqual([currentAlert.title]);
    } finally {
      h.client.dispose();
    }
  });

  it("starts a whole new-world read and ignores a stale delta without starting its checksum fallback", async () => {
    const h = harness();
    try {
      await h.refresh();
      await h.finish(0, archive([oldAlert]));
      expect(h.titles()).toEqual([oldAlert.title]);
      await h.refresh();
      expect(h.reads).toHaveLength(1);
      h.show(snapshot(0, 2, 2, 2));
      await h.refresh();
      expect(h.reads[1]?.path).toBe("/v1/workspace/archive?since=1");
      h.show(snapshot(1, 2, 2, 3));
      await h.refresh();
      expect(h.reads).toHaveLength(3);
      expect(h.reads[2]?.path).toBe("/v1/workspace/archive");
      await h.finish(1, { since: 1, through: 2, records: [], sum: "0".repeat(12) });
      expect(h.reads).toHaveLength(3);
      expect(h.titles()).toEqual([]);
      const second = alert(2, "Synthetic second current-world alert");
      await h.finish(2, archive([currentAlert, second], 3));
      expect(h.titles()).toEqual([currentAlert.title, second.title]);
    } finally {
      h.client.dispose();
    }
  });

  it("does not restore a pending old archive into the initial zero-counter reset board", async () => {
    const h = harness();
    try {
      await h.refresh();
      h.show(snapshot(1, 0, 0));
      await h.refresh();
      await h.finish(0, archive([oldAlert]));
      expect(h.generation()).toBe(1);
      expect(h.titles()).toEqual([]);
      await h.refresh();
      expect(h.reads).toHaveLength(1);
    } finally {
      h.client.dispose();
    }
  });

  it("continues checking merged runtime IDs even for a current-generation checksum-valid reply", async () => {
    const board = snapshot(1, 1, 0);
    expect(isValidSharedWardFlowState(copy(board.payload.state))).toBe(true);
    expect(isValidSharedWardFlowState({ ...copy(board.payload.state), broadcastAlerts: [currentAlert] })).toBe(false);
    const h = harness(board);
    try {
      await h.refresh();
      await h.finish(0, archive([currentAlert]));
      expect(h.titles()).toEqual([]);
      expect(h.generation()).toBe(1);
    } finally {
      h.client.dispose();
    }
  });

  it("retains the current lifetime when a lower-revision snapshot names a different generation", async () => {
    const h = harness(snapshot(0, 1, 1, 5));
    try {
      await h.refresh();
      h.show(snapshot(1, 1, 1, 4));
      await h.refresh();
      expect(h.generation()).toBe(0);
      expect(h.reads).toHaveLength(1);
      await h.finish(0, archive([oldAlert]));
      expect(h.titles()).toEqual([oldAlert.title]);
    } finally {
      h.client.dispose();
    }
  });

  it("keeps legacy whole replies supported in the current world and polling retains their rows", async () => {
    const h = harness(snapshot(1));
    try {
      await h.refresh();
      await h.finish(0, { archived: 1, records: [{ collection: "broadcastAlerts", body: currentAlert }] });
      expect(h.titles()).toEqual([currentAlert.title]);
      await h.refresh();
      expect(h.reads).toHaveLength(1);
      expect(h.titles()).toEqual([currentAlert.title]);
    } finally {
      h.client.dispose();
    }
  });
});
