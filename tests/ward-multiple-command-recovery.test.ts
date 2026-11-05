import { describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { COMMAND_RECOVERY_KEY, readCommandRecovery } from "../src/components/ward-management/ward-command-recovery";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

const state = seedWardFlowStateAt(0);
const snapshot = (revision = 3): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-11-04T00:00:00Z", startedAt: "2026-11-04T10:00:00Z" },
});
function harness(entries: object[], offline = false) {
  const data = new Map([[COMMAND_RECOVERY_KEY, JSON.stringify({ version: 2, entries })]]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  const requests: string[] = [];
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://synthetic.invalid",
    token: async () => "synthetic-token",
    recoveryStorage: storage,
    manageDrafts: false,
    commandId: () => crypto.randomUUID(),
    changed: (next) => {
      view = next;
    },
    fetch: async (url, options) => {
      if (options?.body && offline) throw new Error("Synthetic offline");
      const path = String(url);
      if (path.includes("/receipt?")) {
        const id = new URL(path).searchParams.get("commandId")!;
        requests.push(id);
        return Response.json({
          receipt: { outcome: requests.length === 1 ? "accepted" : "refused", commandRevision: 3 },
        });
      }
      return Response.json({ snapshot: snapshot(), receiptScope: "desk", accessUntil: Date.now() + 60_000 });
    },
  });
  return { client, requests, view: () => view, storage };
}

describe("multi-command reload recovery", () => {
  it("checks sent identities in order and reports unsent content without replaying it", async () => {
    const originalIds = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ];
    const h = harness(
      originalIds.map((commandId, index) => ({
        commandId,
        receiptScope: "desk",
        expiresAt: Date.now() + 60_000,
        phase: index === 2 ? "queued" : "sent",
      })),
    );
    try {
      await h.client.refresh();
      expect(h.requests).toEqual(originalIds.slice(0, 2));
      expect(h.view()?.recoveryResults?.map((result) => result.outcome)).toEqual(["accepted", "refused", "unsent"]);
      expect(h.view()?.recovery).toMatch(/not sent|not retained/i);
      expect(readCommandRecovery(h.storage).entries).toEqual([]);
      h.client.dismissRecovery(h.view()?.recovery);
      expect(h.view()?.recoveryResults).toBeUndefined();
    } finally {
      h.client.dispose();
    }
  });
  it("does not ask for expired or other-scope receipts", async () => {
    const h = harness([
      { commandId: "11111111-1111-4111-8111-111111111111", receiptScope: "desk", expiresAt: 1, phase: "sent" },
      {
        commandId: "22222222-2222-4222-8222-222222222222",
        receiptScope: "other-desk",
        expiresAt: Date.now() + 60_000,
        phase: "sent",
      },
    ]);
    try {
      await h.client.refresh();
      expect(h.requests).toEqual([]);
      expect(h.view()?.recoveryResults?.map((result) => result.outcome)).toEqual(["expired"]);
    } finally {
      h.client.dispose();
    }
  });
  it("publishes the cleared gate at once when only another desk's entries were held", async () => {
    const h = harness([
      {
        commandId: "22222222-2222-4222-8222-222222222222",
        receiptScope: "other-desk",
        expiresAt: Date.now() + 60_000,
        phase: "sent",
      },
    ]);
    try {
      await h.client.refresh();
      expect(h.requests).toEqual([]);
      expect(h.view()?.recovering).toBe(false);
      expect(h.view()?.unconfirmedSave).toBe(false);
    } finally {
      h.client.dispose();
    }
  });
});

it("does not send while a durable queued identity cannot be marked sent, then retries once storage recovers", async () => {
  let refuseSent = true;
  let posts = 0;
  let view: SharedView | undefined;
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (refuseSent && JSON.parse(value).entries.some((entry: { phase: string }) => entry.phase === "sent"))
        throw new Error("Synthetic quota denial");
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  const client = new SharedWorkspaceClient({
    baseUrl: "https://synthetic.invalid",
    token: async () => "synthetic",
    manageDrafts: false,
    recoveryStorage: storage,
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, options) => {
      if (options?.body) {
        posts++;
        return Response.json({ error: "Synthetic refusal" }, { status: 422 });
      }
      return Response.json({ snapshot: snapshot(), receiptScope: "desk", accessUntil: Date.now() + 60_000 });
    },
  });
  try {
    await client.refresh();
    await client.dispatch({
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: 642,
      unitId: state.units[0]!.id,
    });
    expect(posts).toBe(0);
    expect(view?.recoveryStorageUnavailable).toBe(true);
    expect(readCommandRecovery(storage).entries).toEqual([expect.objectContaining({ phase: "queued" })]);
    refuseSent = false;
    await client.retry();
    expect(posts).toBe(1);
  } finally {
    client.dispose();
  }
});
