import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";

const FIXED_TIME = Date.parse("2026-11-02T00:00:00Z");
const COMMAND_ID = "11111111-1111-4111-8111-111111111111";
const actorId = "synthetic-command-actor";
const access = { role: "coordinator", scope: { kind: "statewide" } };
const state = seedWardFlowStateAt(0);
const snapshot = (revision = 1): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  accessContext: "a".repeat(64),
  payload: { version: 1, state, dayZero: "2026-11-02T00:00:00Z", startedAt: "2026-11-02T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "synthetic-unit" } as const;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function harness(authenticated: boolean, firstReply: unknown) {
  let view!: SharedView;
  let reply = firstReply;
  let holdFollowup = false;
  let reads = 0;
  const followupStarted = deferred<void>();
  const followup = deferred<Response>();
  const converged = deferred<void>();
  const storage = new Map<string, string>();
  const sent: string[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    ...(authenticated ? { authenticatedActorId: () => actorId } : {}),
    commandId: () => COMMAND_ID,
    changed: (next) => {
      view = next;
      if (next.status === "ready" && next.snapshot?.revision === 2) converged.resolve();
    },
    recoveryStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
      removeItem: (key) => void storage.delete(key),
    },
    fetch: async (_url, init) => {
      if (init?.method === "POST") {
        sent.push(JSON.parse(String(init.body)).commandId);
        return Response.json(reply);
      }
      if (++reads > 1 && holdFollowup) {
        followupStarted.resolve();
        return followup.promise;
      }
      return Response.json({
        actorId,
        access,
        accessUntil: FIXED_TIME + 60_000,
        receiptScope: "synthetic-command-desk",
        snapshot: snapshot(),
      });
    },
  });
  return {
    client,
    storage,
    sent,
    view: () => view,
    reply: (next: unknown) => {
      reply = next;
    },
    holdFollowup: () => {
      holdFollowup = true;
    },
    followupStarted: followupStarted.promise,
    converge: async () => {
      followup.resolve(Response.json({ actorId, access, accessUntil: FIXED_TIME + 60_000, snapshot: snapshot(2) }));
      await converged.promise;
    },
  };
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(FIXED_TIME);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const unprovenReplies = [
  {},
  { outcome: "accepted" },
  { commandRevision: 0 },
  { commandRevision: "2" },
  { commandRevision: 1.5 },
  { snapshot: {} },
  { snapshot: { ...snapshot(2), payload: { ...snapshot(2).payload, state: {} } } },
  { snapshot: { ...snapshot(2), payload: { ...snapshot(2).payload, dayZero: "invalid" } } },
  { snapshot: { ...snapshot(2), accessUntil: FIXED_TIME - 1 } },
];

describe.each([false, true])("shared command completion, authenticated=%s", (authenticated) => {
  it.each(unprovenReplies)("retains uncertain recovery and the original retry id for reply %#", async (reply) => {
    const h = harness(authenticated, reply);
    try {
      await h.client.refresh();
      expect(h.view().status).toBe("ready");
      const outcome = await h.client.dispatchConfirmed(event);
      expect(outcome.status).toBe("failed");
      expect(h.view().status).toBe("unavailable");
      expect(h.view().unconfirmedSave).toBe(true);
      expect(h.view().snapshot?.revision).toBe(1);
      expect(JSON.parse(h.storage.get(WARD_COMMAND_RECOVERY_KEY)!).commandId).toBe(COMMAND_ID);
      h.reply({ outcome: "accepted", commandRevision: 2, snapshot: snapshot(2) });
      await h.client.retry();
      await expect(outcome.confirmation).resolves.toMatchObject({ status: "accepted", commandId: COMMAND_ID });
      expect(h.sent).toEqual([COMMAND_ID, COMMAND_ID]);
      expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
      expect(h.view().snapshot?.revision).toBe(2);
      expect(h.view().unconfirmedSave).toBe(false);
    } finally {
      h.client.dispose();
    }
  });

  it.each([{ snapshot: snapshot(2) }, { commandRevision: 2 }, { commandRevision: 2, snapshot: snapshot(2) }])(
    "preserves compatible legacy and compact commit evidence %#",
    async (reply) => {
      const h = harness(authenticated, reply);
      try {
        await h.client.refresh();
        const outcome = await h.client.dispatchConfirmed(event);
        expect(outcome.status).toBe("accepted");
        expect(h.sent).toEqual([COMMAND_ID]);
        expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
        expect(h.view().unconfirmedSave).toBe(false);
      } finally {
        h.client.dispose();
      }
    },
  );

  it.each([{}, snapshot(1), { ...snapshot(2), accessUntil: FIXED_TIME - 1 }])(
    "keeps a definite commit accepted while an unusable display waits for an authoritative read: %#",
    async (display) => {
      const h = harness(authenticated, { commandRevision: 2, snapshot: display });
      try {
        await h.client.refresh();
        h.holdFollowup();
        const outcome = await h.client.dispatchConfirmed(event);
        expect(outcome.status).toBe("accepted");
        await h.followupStarted;
        expect(h.view().status).toBe("unavailable");
        expect(h.view().snapshot?.revision).toBe(1);
        expect(h.view().unconfirmedSave).toBe(false);
        expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
        await h.converge();
        expect(h.view().snapshot?.revision).toBe(2);
        expect(h.view().status).toBe("ready");
        expect(h.sent).toEqual([COMMAND_ID]);
      } finally {
        h.client.dispose();
      }
    },
  );
});
