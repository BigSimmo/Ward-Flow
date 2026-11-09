import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  lastDowntimePack,
  rememberDowntimePack,
  type DowntimePack,
} from "../src/components/ward-management/reports/downtime-pack";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { startWardPolling } from "../src/components/ward-management/ward-shared-polling";

// Audit 8 (#1571): permission drift mid-shift. Staff move wards and leave without signing out, so an
// access admin removes a role or changes a ward scope while the person is still signed in. Each
// client channel must lose the old access within a stated bound, measured on fake time:
//
// - open screen: the next foreground poll, 3 s (`startWardPolling`'s first delay);
// - cached lists (board, event log, downtime pack): cleared by that same poll;
// - queued offline saves: never sent under the ended role; on reconnect the board is read first;
// - a device that stays offline: the server's `accessUntil` deadline, with no network needed.
//
// Phone push is decided on the server at send time, so it is not in this client file. The
// PostgreSQL tests in backend/ward-flow/push-registration-lifetime.test.mjs ("outside" and "no
// longer allowed") revoke a membership mid-sweep and assert nothing is sent.

const POLL_MS = 3_000;
const actorId = "synthetic-actor-audit-8";
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const [wardA, wardB] = state.units.map((unit) => unit.id);
const contextA = "a".repeat(64);
const contextB = "b".repeat(64);
const NO_ROLE = { code: "no-role", error: "No Ward Flow role is assigned to this account" };
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "ward", now: 642, unitId: wardA } as WardFlowEvent;

type Server = {
  online: boolean;
  revoked: boolean;
  unitIds: string[];
  context: string;
  accessUntil: number;
  revision: number;
};

function setup(overrides: Partial<Server> = {}) {
  const server: Server = {
    online: true,
    revoked: false,
    unitIds: [wardA],
    context: contextA,
    accessUntil: Date.now() + 8 * 3_600_000,
    revision: 1,
    ...overrides,
  };
  const views: SharedView[] = [];
  const commandsSent: string[] = [];
  const access = () => ({ role: "ward", scope: { kind: "ward", unitIds: [...server.unitIds] } });
  const snapshot = (): SharedSnapshot => ({
    dataMode: "prototype",
    revision: server.revision,
    now: 642,
    accessContext: server.context,
    payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  });
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    authenticatedActorId: () => actorId,
    token: async () => "synthetic-token",
    changed: (view) => {
      views.push(view);
    },
    fetch: async (url, init) => {
      if (!server.online) throw new TypeError("offline");
      const path = new URL(String(url)).pathname;
      if (server.revoked) return Response.json(NO_ROLE, { status: 403 });
      if (path === "/v1/workspace/commands") {
        commandsSent.push(JSON.parse(String(init?.body)).commandId);
        server.revision += 1;
        return Response.json({
          outcome: "accepted",
          commandRevision: server.revision,
          actorId,
          access: access(),
          snapshot: snapshot(),
        });
      }
      return Response.json({
        actorId,
        access: access(),
        workingAs: "bootstrap",
        accessUntil: server.accessUntil,
        snapshot: snapshot(),
      });
    },
  });
  const polling = startWardPolling({
    visible: () => true,
    refresh: async () => {
      const read = await client.refresh();
      return read === "skipped" ? "skipped" : views.at(-1)?.status === "ready";
    },
  });
  const view = () => views.at(-1);
  const stop = () => {
    polling.stop();
    client.dispose();
  };
  return { client, server, views, view, commandsSent, stop };
}

async function opened(harness: ReturnType<typeof setup>) {
  await harness.client.refresh();
  expect(harness.view()?.status).toBe("ready");
  expect(harness.view()?.snapshot?.accessContext).toBe(harness.server.context);
}

describe("permission drift mid-shift (audit 8, #1571)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-09T02:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("open screen: a removed role closes the board within one poll (3 s)", async () => {
    const harness = setup();
    await opened(harness);
    harness.server.revoked = true;
    await vi.advanceTimersByTimeAsync(POLL_MS);
    // The shared shell shows "ask for access" and never mounts the board without a snapshot.
    expect(harness.view()?.status).toBe("no-role");
    expect(harness.view()?.snapshot).toBeNull();
    harness.stop();
  });

  it("open screen: a changed ward scope replaces the old ward's board within one poll, never mixing them", async () => {
    const harness = setup();
    await opened(harness);
    const seen = harness.views.length;
    harness.server.unitIds = [wardB];
    harness.server.context = contextB;
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(harness.view()?.access).toEqual({ role: "ward", scope: { kind: "ward", unitIds: [wardB] } });
    expect(harness.view()?.snapshot?.accessContext).toBe(contextB);
    // No published view ever paired the new scope with the old ward's board.
    for (const view of harness.views.slice(seen)) if (view.snapshot) expect(view.snapshot.accessContext).toBe(contextB);
    harness.stop();
  });

  it("cached lists: the board, event log and downtime pack are dropped by the same poll", async () => {
    const harness = setup();
    await opened(harness);
    rememberDowntimePack({ generatedAt: 642, wards: [] } as unknown as DowntimePack);
    expect(lastDowntimePack()).not.toBeNull();
    harness.server.revoked = true;
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(harness.view()?.snapshot).toBeNull();
    expect(harness.view()?.eventLog).toEqual([]);
    expect(lastDowntimePack()).toBeNull();
    harness.stop();
  });

  it("queued offline saves: a role removed while offline sends nothing on reconnect", async () => {
    const harness = setup();
    await opened(harness);
    harness.server.online = false;
    expect((await harness.client.dispatch(event)).status).toBe("failed");
    expect(harness.view()?.waiting).toBe(1);
    harness.server.revoked = true;
    harness.server.online = true;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(harness.commandsSent).toEqual([]);
    expect(harness.view()?.status).toBe("no-role");
    expect(harness.view()?.waiting).toBe(0);
    expect(harness.view()?.pendingCount).toBe(0);
    // Later polls cannot replay it either.
    await vi.advanceTimersByTimeAsync(10 * POLL_MS);
    expect(harness.commandsSent).toEqual([]);
    harness.stop();
  });

  it("queued offline saves: a ward scope changed while offline drops saves made on the old ward", async () => {
    const harness = setup();
    await opened(harness);
    harness.server.online = false;
    expect((await harness.client.dispatch(event)).status).toBe("failed");
    expect(harness.view()?.waiting).toBe(1);
    harness.server.unitIds = [wardB];
    harness.server.context = contextB;
    harness.server.online = true;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(10 * POLL_MS);
    expect(harness.commandsSent).toEqual([]);
    expect(harness.view()?.snapshot?.accessContext).toBe(contextB);
    expect(harness.view()?.pendingCount).toBe(0);
    harness.stop();
  });

  it("a device that stays offline loses the board and its queue at the server's access deadline", async () => {
    const harness = setup({ accessUntil: Date.now() + 60_000 });
    await opened(harness);
    harness.server.online = false;
    expect((await harness.client.dispatch(event)).status).toBe("failed");
    expect(harness.view()?.waiting).toBe(1);
    // Revoked on the server; this device cannot hear it, so only the deadline it already holds ends access.
    harness.server.revoked = true;
    await vi.advanceTimersByTimeAsync(59_000);
    expect(harness.view()?.snapshot).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(harness.view()?.snapshot).toBeNull();
    expect(harness.view()?.pendingCount).toBe(0);
    harness.server.online = true;
    await vi.advanceTimersByTimeAsync(10 * POLL_MS);
    expect(harness.commandsSent).toEqual([]);
    harness.stop();
  });
});
