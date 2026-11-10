import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { startWardPolling } from "../src/components/ward-management/ward-shared-polling";

// Compound drill 2 (master audit list, 10 Nov 2026), browser half: shift-change load (D-111 item 6:
// 100 concurrent synthetic users) plus one service outage plus a mass reconnect. 100 real
// SharedWorkspaceClient instances, each with the app's own polling, share one fake server on fake
// time. The server half, with a real backend, PostgreSQL and a fault proxy, is
// backend/ward-flow/ward-audit-drill-2-shift-outage-reconnect.test.mjs.
//
// What must hold: each save held through the outage is sent once (one identity, applied once) when
// the service returns; clients back off while it is down rather than hammering it; and the
// reconnect does not arrive as one spike from every client in the same second.

const USERS = 100;
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const units = state.units.map((unit) => unit.id);

function fleet() {
  const server = {
    up: true,
    // The first saves of the outage commit before the gateway fails, so their replies are lost.
    commitThenFail: 0,
    revision: 1,
    applied: new Map<string, number>(),
    requests: [] as number[],
  };
  const snapshot = (): SharedSnapshot => ({
    dataMode: "prototype",
    revision: server.revision,
    now: 642,
    payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  });
  const fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    server.requests.push(Date.now());
    const isCommand = new URL(String(url)).pathname === "/v1/workspace/commands";
    // The outage: the service answers nothing a browser can use.
    if (!server.up && !(isCommand && server.commitThenFail > 0))
      return Response.json({ error: "Service unavailable" }, { status: 503 });
    if (isCommand) {
      const { commandId } = JSON.parse(String(init?.body));
      if (!server.applied.has(commandId)) {
        server.revision += 1;
        server.applied.set(commandId, 0);
      }
      server.applied.set(commandId, server.applied.get(commandId)! + 1);
      if (!server.up) {
        server.commitThenFail -= 1;
        return Response.json({ error: "Gateway failed after the save committed" }, { status: 503 });
      }
      return Response.json({ outcome: "accepted", commandRevision: server.revision, snapshot: snapshot() });
    }
    // As the real server does: a poll naming the current revision gets the clock only.
    const since = Number(new URL(String(url)).searchParams.get("since"));
    if (since === server.revision) return Response.json({ notModified: true, revision: server.revision, now: 642 });
    return Response.json({ actorId: "synthetic-actor-drill-2", snapshot: snapshot() });
  };
  const clients = Array.from({ length: USERS }, () => {
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic-token",
      changed: (next) => {
        view = next;
      },
      fetch,
    });
    return { client, view: () => view, polling: undefined as ReturnType<typeof startWardPolling> | undefined };
  });
  return { server, clients };
}

describe("compound drill 2: shift-change load, an outage and a mass reconnect (100 browser clients)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    // 07:00 Perth handover.
    vi.setSystemTime(new Date("2026-11-10T23:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it(
    "backs off during the outage, spreads the reconnect, and lands each held save exactly once",
    { timeout: 180_000 },
    async () => {
      const { server, clients } = fleet();
      // Shift change: everyone opens the board within the same ten seconds.
      for (const [index, entry] of clients.entries()) {
        await vi.advanceTimersByTimeAsync(100);
        await entry.client.refresh();
        expect(entry.view()?.status).toBe("ready");
        entry.polling = startWardPolling({
          visible: () => true,
          refresh: async () => {
            const read = await entry.client.refresh();
            return read === "skipped" ? "skipped" : entry.view()?.status === "ready";
          },
        });
        void index;
      }
      await vi.advanceTimersByTimeAsync(10_000);

      // The outage starts. Each person tries one save; it is not confirmed.
      server.up = false;
      server.commitThenFail = 20;
      const outcomes = await Promise.all(
        clients.map((entry, index) =>
          entry.client.dispatch({
            type: "REQUEST_CAPACITY_REFRESH",
            role: "coordinator",
            now: 642,
            unitId: units[index % units.length]!,
          } as WardFlowEvent),
        ),
      );
      expect(outcomes.every((outcome) => outcome.status === "failed")).toBe(true);
      const outageStart = Date.now();
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      const duringOutage = server.requests.filter((at) => at > outageStart + 60_000).length;
      // Backed off to one read a minute each: about 100 a minute, not 100 every 3 seconds (2,000).
      expect(duringOutage).toBeLessThanOrEqual(USERS * 4 + USERS);

      // The service returns. People press Retry as they notice, within the next minute.
      server.up = true;
      const back = Date.now();
      for (const entry of clients) {
        await vi.advanceTimersByTimeAsync(600);
        await entry.client.retry();
      }
      await vi.advanceTimersByTimeAsync(120_000);

      // Exactly once: each person's save applied once, whatever the number of sends.
      expect(server.applied.size).toBe(USERS);
      // The 20 saves whose replies were lost were sent again under the same identity and replayed.
      expect([...server.applied.values()].filter((sends) => sends >= 2).length).toBeGreaterThanOrEqual(20);
      expect(server.revision).toBe(1 + USERS);
      for (const entry of clients) expect(entry.view()?.status).toBe("ready");

      // The reconnect is spread: no single second after the return carries every client.
      const buckets = new Map<number, number>();
      for (const at of server.requests.filter((at) => at >= back))
        buckets.set(Math.floor((at - back) / 1000), (buckets.get(Math.floor((at - back) / 1000)) ?? 0) + 1);
      const peak = Math.max(...buckets.values());
      expect(peak).toBeLessThan(USERS);
      console.info(
        `drill 2 browser half: ${duringOutage} reads in the outage's last 4 minutes; reconnect peak ${peak} requests in one second`,
      );
      for (const entry of clients) {
        entry.polling?.stop();
        entry.client.dispose();
      }
    },
  );
});
