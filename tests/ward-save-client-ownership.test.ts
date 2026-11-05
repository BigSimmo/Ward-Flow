import { expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

const commandId = "11111111-1111-4111-8111-111111111111";
const state = seedWardFlowStateAt(0);
const snapshot = (revision: number, worldGeneration = 0): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  accessContext: "a".repeat(64),
  payload: {
    version: 1,
    state: { ...state, worldGeneration },
    dayZero: "2026-10-24T00:00:00Z",
    startedAt: "2026-10-24T10:00:00Z",
  },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "synthetic-unit" } as const;

it("retains a reloaded command identity while its original request can still commit", async () => {
  const expiresAt = Date.now() + 60_000;
  const held = JSON.stringify({ commandId, receiptScope: "synthetic-desk", expiresAt });
  const storage = new Map([[WARD_COMMAND_RECOVERY_KEY, held]]);
  let committed = false;
  let posts = 0;
  let view!: SharedView;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic",
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
    fetch: async (url, init) => {
      if (init?.method === "POST") {
        posts++;
        throw new Error("Unexpected second command");
      }
      if (String(url).includes("/receipt?"))
        return Response.json({ receipt: committed ? { outcome: "accepted", commandRevision: 2 } : null });
      return Response.json({
        snapshot: snapshot(committed ? 2 : 1),
        receiptScope: "synthetic-desk",
        accessUntil: expiresAt,
      });
    },
  });
  try {
    await client.refresh();
    expect(view.recovering).toBe(true);
    expect(view.status).toBe("unavailable"); // Existing strip offers Retry while writes stay locked.
    expect(view.boardCurrent).toBe(true);
    expect(view.unconfirmedSave).toBe(true);
    expect(storage.get(WARD_COMMAND_RECOVERY_KEY)).toBe(held);
    await expect(client.dispatch(event)).resolves.toMatchObject({ status: "cancelled" });
    client.dismissRecovery();
    expect(view.recovery).toMatch(/unresolved/);
    await client.retry();
    expect(storage.get(WARD_COMMAND_RECOVERY_KEY)).toBe(held);
    committed = true; // The original request finally acquires its write lock and commits.
    await client.retry();
    expect(view.recovering).toBe(false);
    expect(view.snapshot?.revision).toBe(2);
    expect(view.recovery).toMatch(/accepted/);
    expect(storage.has(WARD_COMMAND_RECOVERY_KEY)).toBe(false);
    expect(posts).toBe(0);
  } finally {
    client.dispose();
  }
});

it("keeps late old-world confirmation permanently outside the new world's notification lifetime", async () => {
  let generation = 0;
  let replyLost = true;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic",
    manageDrafts: false,
    changed: () => {},
    fetch: async (_url, init) => {
      if (init?.method === "POST") {
        if (replyLost) throw new Error("Synthetic lost response");
        return Response.json({ outcome: "accepted", commandRevision: 2 });
      }
      return Response.json({ snapshot: snapshot(generation ? 2 : 1, generation) });
    },
  });
  try {
    await client.refresh();
    const original = await client.dispatchConfirmed(event);
    expect(original.isCurrent?.()).toBe(true);
    generation = 1;
    await client.refresh();
    replyLost = false;
    await client.retry();
    const confirmed = await original.confirmation!;
    expect(confirmed.status).toBe("accepted");
    expect(confirmed.isCurrent?.()).toBe(false);
    expect(original.isCurrent?.()).toBe(false);
  } finally {
    client.dispose();
  }
});

it("keeps the replacement command's own accepted transition current", async () => {
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic",
    manageDrafts: false,
    changed: () => {},
    fetch: async (_url, init) =>
      Response.json({ snapshot: snapshot(init?.method === "POST" ? 2 : 1, init?.method === "POST" ? 1 : 0) }),
  });
  try {
    await client.refresh();
    const answer = await client.dispatchConfirmed({ type: "RESET_SCENARIO", role: "demo", now: 642 });
    expect(answer.status).toBe("accepted");
    expect(answer.isCurrent?.()).toBe(true);
  } finally {
    client.dispose();
  }
});

it("does not attribute a later replacement world to an old accepted reset", async () => {
  let current = snapshot(1, 0);
  let lost = true;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic",
    manageDrafts: false,
    changed: () => {},
    fetch: async (_url, init) => {
      if (init?.method === "POST") {
        if (lost) throw new Error("Synthetic reset committed but reply lost");
        return Response.json({ snapshot: snapshot(2, 1), replayed: true });
      }
      return Response.json({ snapshot: current });
    },
  });
  try {
    await client.refresh();
    const original = await client.dispatchConfirmed({ type: "RESET_SCENARIO", role: "demo", now: 642 });
    current = snapshot(3, 2); // Another reset followed the original committed reset.
    await client.refresh();
    lost = false;
    await client.retry();
    const confirmed = await original.confirmation!;
    expect(confirmed.status).toBe("accepted");
    expect(confirmed.isCurrent?.()).toBe(false);
  } finally {
    client.dispose();
  }
});
