import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearWardFlowBrowserData } from "../src/components/ward-management/ward-browser-data";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { startWardPolling } from "../src/components/ward-management/ward-shared-polling";

// Compound drill 1 (master audit list, 10 Nov 2026): offline work, then the person's access is
// revoked, then a different person signs in on the same device. Offline plus revoke alone is in
// tests/ward-permission-drift.dom.test.tsx; this adds the account switch to the same run.
//
// The rule: a save made by the first person while offline is never sent under the second
// person's sign-in, the second person never sees a board, event log or recovery note that belonged
// to the first, and the second person's own board loads normally. Synthetic actors only.

const POLL_MS = 3_000;
const actorA = "synthetic-actor-drill-1-a";
const actorB = "synthetic-actor-drill-1-b";
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const [wardA, wardB] = state.units.map((unit) => unit.id);
const contextA = "a".repeat(64);
const contextB = "b".repeat(64);
const scopeA = "synthetic-receipt-scope-a";
const scopeB = "synthetic-receipt-scope-b";
const NO_ROLE = { code: "no-role", error: "No Ward Flow role is assigned to this account" };
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "ward", now: 642, unitId: wardA } as WardFlowEvent;

type Sent = { path: string; token: string; commandId?: string };

function setup() {
  const device = {
    online: true,
    // The account the device's sign-in currently holds (shared by every tab on the device).
    signedIn: actorA as string | null,
  };
  const server = { revokedA: false, revision: 1 };
  const sent: Sent[] = [];
  const views: SharedView[] = [];
  const accounts = {
    [actorA]: { unitIds: [wardA], context: contextA, receiptScope: scopeA },
    [actorB]: { unitIds: [wardB], context: contextB, receiptScope: scopeB },
  } as const;
  const snapshot = (context: string): SharedSnapshot => ({
    dataMode: "prototype",
    revision: server.revision,
    now: 642,
    accessContext: context,
    payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  });
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    authenticatedActorId: () => device.signedIn,
    token: async () => `synthetic-token-${device.signedIn}`,
    recoveryStorage: window.localStorage,
    changed: (view) => {
      views.push(view);
    },
    fetch: async (url, init) => {
      if (!device.online) throw new TypeError("offline");
      const path = new URL(String(url)).pathname;
      const token = String(new Headers(init?.headers).get("authorization")).replace("Bearer synthetic-token-", "");
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      sent.push({ path, token, commandId: body?.commandId });
      const actor = token === actorA ? actorA : actorB;
      if (actor === actorA && server.revokedA) return Response.json(NO_ROLE, { status: 403 });
      const account = accounts[actor];
      const access = { role: "ward", scope: { kind: "ward", unitIds: [...account.unitIds] } };
      if (path === "/v1/workspace/commands") {
        server.revision += 1;
        return Response.json({
          outcome: "accepted",
          commandRevision: server.revision,
          actorId: actor,
          access,
          snapshot: snapshot(account.context),
        });
      }
      if (path === "/v1/workspace/receipt") return Response.json({ receipt: null, actorId: actor, access });
      return Response.json({
        actorId: actor,
        access,
        workingAs: "bootstrap",
        accessUntil: Date.now() + 8 * 3_600_000,
        receiptScope: account.receiptScope,
        snapshot: snapshot(account.context),
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
  return { client, device, server, sent, views, view, stop };
}

/** The first person works offline: one save waits, with its recovery note on the device. */
async function workOfflineAsA(harness: ReturnType<typeof setup>) {
  await harness.client.refresh();
  expect(harness.view()?.status).toBe("ready");
  expect(harness.view()?.actorId).toBe(actorA);
  harness.device.online = false;
  const outcome = harness.client.dispatch(event);
  await vi.advanceTimersByTimeAsync(0);
  expect(harness.view()?.waiting ?? harness.view()?.pendingCount).toBe(1);
  return outcome;
}

describe("compound drill 1: offline, then access revoked, then an account switch on the same device", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-10T02:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("the first person's waiting save is never sent under the second person's sign-in", async () => {
    const harness = setup();
    const outcome = await workOfflineAsA(harness);
    const held = JSON.parse(window.localStorage.getItem(WARD_COMMAND_RECOVERY_KEY) ?? "[]") as unknown;
    const commandId = JSON.stringify(held).match(/[0-9a-f]{8}-[0-9a-f-]{27}/)?.[0] ?? null;
    expect(commandId).not.toBeNull();
    // Offline: A's access is revoked on the server, then B signs in on the same device.
    harness.server.revokedA = true;
    harness.device.signedIn = actorB;
    harness.device.online = true;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(12 * POLL_MS);

    // Nothing was ever posted, under either account.
    expect(harness.sent.filter((request) => request.path === "/v1/workspace/commands")).toEqual([]);
    expect(harness.sent.some((request) => request.commandId === commandId)).toBe(false);
    // The waiting save is settled as not sent, never as saved.
    expect((await outcome).status).not.toBe("accepted");
    expect(harness.view()?.pendingCount ?? 0).toBe(0);
    expect(harness.view()?.waiting ?? 0).toBe(0);
    harness.stop();
  });

  it("the second person gets their own board, and no view ever pairs them with the first person's board", async () => {
    const harness = setup();
    await workOfflineAsA(harness);
    harness.server.revokedA = true;
    const seen = harness.views.length;
    harness.device.signedIn = actorB;
    harness.device.online = true;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(12 * POLL_MS);

    expect(harness.view()?.status).toBe("ready");
    expect(harness.view()?.actorId).toBe(actorB);
    expect(harness.view()?.snapshot?.accessContext).toBe(contextB);
    expect(harness.view()?.access).toEqual({ role: "ward", scope: { kind: "ward", unitIds: [wardB] } });
    for (const view of harness.views.slice(seen)) {
      if (view.snapshot) expect(view.snapshot.accessContext).toBe(contextB);
      if (view.actorId) expect(view.actorId).toBe(actorB);
    }
    // Every request after the switch carried B's sign-in only.
    const afterSwitch = harness.sent;
    expect(afterSwitch.length).toBeGreaterThan(0);
    expect(new Set(afterSwitch.map((request) => request.token))).toEqual(new Set([actorA, actorB]));
    const firstB = afterSwitch.findIndex((request) => request.token === actorB);
    expect(afterSwitch.slice(firstB).every((request) => request.token === actorB)).toBe(true);
    harness.stop();
  });

  it("the first person's recovery note is never checked or reported under the second person", async () => {
    const harness = setup();
    await workOfflineAsA(harness);
    expect(window.localStorage.getItem(WARD_COMMAND_RECOVERY_KEY)).toContain(scopeA);
    harness.server.revokedA = true;
    harness.device.signedIn = actorB;
    harness.device.online = true;
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(12 * POLL_MS);

    expect(harness.sent.filter((request) => request.path === "/v1/workspace/receipt")).toEqual([]);
    expect(harness.view()?.recoveryResults ?? []).toEqual([]);
    expect(window.localStorage.getItem(WARD_COMMAND_RECOVERY_KEY) ?? "").not.toContain(scopeA);
    harness.stop();
  });

  it("signing out between the two people clears the first person's recovery note from the device", async () => {
    const harness = setup();
    await workOfflineAsA(harness);
    expect(window.localStorage.getItem(WARD_COMMAND_RECOVERY_KEY)).not.toBeNull();
    harness.stop();
    clearWardFlowBrowserData();
    expect(window.localStorage.getItem(WARD_COMMAND_RECOVERY_KEY)).toBeNull();
  });
});
