import { describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const context = "a".repeat(64);
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  accessContext: context,
  payload: {
    version: 1,
    state,
    dayZero: "2026-10-07T00:00:00Z",
    startedAt: "2026-10-07T10:00:00Z",
  },
});
const event = {
  type: "REQUEST_CAPACITY_REFRESH",
  role: "coordinator",
  now: 642,
  unitId: "synthetic-unit",
} as const;
const commandId = "11111111-1111-4111-8111-111111111111";

function harness(answer: () => Response, authenticated = true) {
  const storage = new Map<string, string>();
  const sent: string[] = [];
  let view: SharedView | undefined;
  let retry = false;
  let readRevision = 1;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://synthetic.invalid",
    ...(authenticated ? { authenticatedActorId: () => "synthetic-actor" } : {}),
    token: async () => "synthetic-token",
    commandId: () => commandId,
    manageDrafts: false,
    changed: (next) => {
      view = next;
    },
    recoveryStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      },
    },
    fetch: async (_url, init) => {
      if (!init?.body)
        return Response.json({
          snapshot: snapshot(readRevision),
          actorId: "synthetic-actor",
          access: { role: "coordinator", scope: { kind: "statewide" } },
          workingAs: "bootstrap",
          receiptScope: "synthetic-receipt",
          accessUntil: Date.now() + 60_000,
        });
      sent.push(String(init.body));
      if (!retry) return answer();
      readRevision = 2;
      return Response.json({
        snapshot: snapshot(2),
        commandRevision: 2,
        outcome: "accepted",
      });
    },
  });
  return {
    client,
    storage,
    sent,
    view: () => view!,
    retry: async () => {
      retry = true;
      await client.retry();
    },
    advanceRead: () => {
      readRevision = 2;
    },
  };
}

const invalidState = {
  ...snapshot(2),
  payload: { ...snapshot(2).payload, state: {} },
};
const malformedReplies = [
  ["empty JSON", {}],
  ["invalid legacy snapshot", { snapshot: invalidState }],
  ["invalid snapshot with revision", { commandRevision: 2, snapshot: invalidState }],
] as const;

describe.each([true, false])("command acknowledgement validation (authenticated=%s)", (authenticated) => {
  it.each(malformedReplies)(
    "retains uncertain-save recovery for %s and retries the exact command",
    async (_name, body) => {
      const h = harness(() => Response.json(body), authenticated);
      try {
        await h.client.refresh();
        const result = await h.client.dispatchConfirmed(event);
        expect(result.status).toBe("failed");
        expect(h.view().status).toBe("unavailable");
        expect(h.view().snapshot?.revision).toBe(1);
        expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(true);
        expect(h.view().eventLog).toEqual([]);
        await h.retry();
        expect(h.sent).toHaveLength(2);
        expect(h.sent[0]).toBe(h.sent[1]);
        expect(JSON.parse(h.sent[1]).commandId).toBe(commandId);
        expect(h.view().snapshot?.revision).toBe(2);
        expect(h.view().status).toBe("ready");
        expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
        expect((await result.confirmation!).status).toBe("accepted");
      } finally {
        h.client.dispose();
      }
    },
  );
});

describe("command acknowledgement compatibility", () => {
  it("accepts a valid legacy snapshot without outer receipt metadata", async () => {
    const h = harness(() => Response.json({ snapshot: snapshot(2) }));
    try {
      await h.client.refresh();
      expect((await h.client.dispatchConfirmed(event)).status).toBe("accepted");
      expect(h.view().snapshot?.revision).toBe(2);
      expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
    } finally {
      h.client.dispose();
    }
  });

  it("accepts a revision-only acknowledgement and refreshes the board", async () => {
    const h = harness(() => {
      h.advanceRead();
      return Response.json({ commandRevision: 2, outcome: "accepted" });
    });
    try {
      await h.client.refresh();
      expect((await h.client.dispatch(event)).status).toBe("accepted");
      await expect.poll(() => h.view().snapshot?.revision).toBe(2);
      expect(h.view().status).toBe("ready");
      expect(h.storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
    } finally {
      h.client.dispose();
    }
  });

  it("reconciles a definitive revision after a response binding change without replaying the command", async () => {
    const h = harness(() => {
      h.advanceRead();
      return Response.json({
        commandRevision: 2,
        outcome: "accepted",
        actorId: "another-synthetic-actor",
        access: { role: "coordinator", scope: { kind: "statewide" } },
        snapshot: snapshot(2),
      });
    });
    try {
      await h.client.refresh();
      expect((await h.client.dispatch(event)).status).toBe("accepted");
      await expect.poll(() => h.view().status).toBe("ready");
      expect(h.view().snapshot?.revision).toBe(2);
      expect(h.sent).toHaveLength(1);
    } finally {
      h.client.dispose();
    }
  });
});
