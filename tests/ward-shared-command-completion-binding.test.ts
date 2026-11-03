import { describe, expect, it, vi } from "vitest";

import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import { verifyResponseBinding } from "@/components/ward-management/ward-shared-role-binding";

const actorId = "synthetic-command-actor";
const access = { role: "coordinator", scope: { kind: "statewide" } };
const context = "a".repeat(64);
const state = seedWardFlowStateAt(0);
const snapshot = (revision = 1): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  accessContext: context,
  payload: { version: 1, state, dayZero: "2026-10-24T00:00:00Z", startedAt: "2026-10-24T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "synthetic-unit" } as const;

function harness(firstReply: unknown) {
  let view: SharedView | undefined;
  let reply = firstReply;
  const receipts = new Map<string, string>();
  const sent: string[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    authenticatedActorId: () => actorId,
    commandId: () => "11111111-1111-4111-8111-111111111111",
    changed: (next) => {
      view = next;
    },
    recoveryStorage: {
      getItem: (key) => receipts.get(key) ?? null,
      setItem: (key, value) => {
        receipts.set(key, value);
      },
      removeItem: (key) => {
        receipts.delete(key);
      },
    },
    fetch: async (_url, init) => {
      if (init?.method === "POST") {
        sent.push(JSON.parse(String(init.body)).commandId);
        return Response.json(reply);
      }
      return Response.json({
        actorId,
        access,
        accessUntil: Date.now() + 60_000,
        receiptScope: "synthetic-command-desk",
        snapshot: snapshot(),
      });
    },
  });
  return {
    client,
    receipts,
    sent,
    view: () => view!,
    reply: (next: unknown) => {
      reply = next;
    },
  };
}

const malformedReplies = [
  {},
  { outcome: "accepted" },
  { outcome: "accepted", commandRevision: 0 },
  { outcome: "accepted", commandRevision: -1 },
  { outcome: "accepted", commandRevision: 1.5 },
  { outcome: "accepted", commandRevision: "2" },
  { outcome: "accepted", commandRevision: Number.MAX_SAFE_INTEGER + 1 },
  { snapshot: null },
  { snapshot: {} },
  { snapshot: 42 },
  { snapshot: { ...snapshot(), revision: 0 } },
  { snapshot: { ...snapshot(), now: null } },
  { snapshot: { ...snapshot(), accessContext: "invalid" } },
  { snapshot: { ...snapshot(), payload: { ...snapshot().payload, dayZero: "invalid" } } },
  { snapshot: { ...snapshot(), payload: { ...snapshot().payload, state: {} } } },
];

describe("authenticated successful command completion evidence", () => {
  it.each(malformedReplies)("keeps an unproven reply uncertain and retries its same command id: %#", async (reply) => {
    const h = harness(reply);
    try {
      await h.client.refresh();
      expect(h.view().status).toBe("ready");
      const answer = await h.client.dispatchConfirmed(event);
      expect(answer.status).toBe("failed");
      expect(h.view().unconfirmedSave).toBe(true);
      expect(h.view().snapshot?.revision).toBe(1);
      const receipt = h.receipts.get(WARD_COMMAND_RECOVERY_KEY);
      expect(JSON.parse(receipt!).commandId).toBe(answer.commandId);
      let confirmed = false;
      void answer.confirmation!.then(() => {
        confirmed = true;
      });
      await h.client.retry();
      expect(confirmed).toBe(false);
      expect(h.receipts.get(WARD_COMMAND_RECOVERY_KEY)).toBe(receipt);
      h.reply({ outcome: "accepted", commandRevision: 2, snapshot: snapshot(2) });
      await h.client.retry();
      await expect(answer.confirmation).resolves.toMatchObject({ status: "accepted", commandId: answer.commandId });
      expect(h.sent).toEqual([answer.commandId, answer.commandId, answer.commandId]);
      expect(h.receipts.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
    } finally {
      h.client.dispose();
    }
  });

  it.each([
    { snapshot: snapshot(2) },
    { outcome: "accepted", snapshot: snapshot(2) },
    { commandRevision: 2 },
    { outcome: "accepted", commandRevision: 2 },
    { outcome: "partly", commandRevision: 2, error: "One synthetic ward was not asked." },
    { outcome: "applied", commandRevision: 2 },
  ])("keeps valid legacy and compact completion compatibility: %#", async (reply) => {
    const h = harness(reply);
    try {
      await h.client.refresh();
      const answer = await h.client.dispatchConfirmed(event);
      expect(answer.status).toBe("accepted");
      if (reply.outcome === "partly") expect(answer.partly).toBe(reply.error);
      expect(h.sent).toHaveLength(1);
      expect(h.receipts.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
    } finally {
      h.client.dispose();
    }
  });

  it("rejects missing completion evidence before a changed binding can clear recovery or cancel work", async () => {
    const host = {
      view: (): SharedView => ({ snapshot: snapshot(), actorId, access, receivedAt: 0, status: "ready", error: null }),
      publish: vi.fn(),
      endRole: vi.fn(),
      current: vi.fn(),
      cancelQueued: vi.fn(),
      clearRecovery: vi.fn(),
      hasPending: () => true,
      newRoleEpoch: vi.fn(),
      roleEpoch: () => 0,
      grantGeneration: () => 0,
    };
    await expect(
      verifyResponseBinding(host, {
        path: "/v1/workspace/commands",
        body: { commandId: "synthetic-command" },
        response: Response.json({}),
        value: { actorId: "another-synthetic-actor", access },
        sentBinding: { access: JSON.stringify(access), context, epoch: 0, grant: 0 },
        authenticatedActor: actorId,
        workspaceRead: false,
      }),
    ).rejects.toThrow();
    expect(host.clearRecovery).not.toHaveBeenCalled();
    expect(host.cancelQueued).not.toHaveBeenCalled();
    expect(host.newRoleEpoch).not.toHaveBeenCalled();
    expect(host.endRole).not.toHaveBeenCalled();
    expect(host.publish).not.toHaveBeenCalled();
  });
});
