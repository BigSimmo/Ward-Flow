import { expect, it } from "vitest";
import { SharedWorkspaceClient, WARD_COMMAND_RECOVERY_KEY } from "../src/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
it("preserves partial completion through a lost response and reload without resending", async () => {
  const commandId = "44444444-4444-4444-8444-444444444444";
  const expiresAt = Date.now() + 60_000;
  const storage = new Map<string, string>();
  const port = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
  let committed = false;
  let posts = 0;
  let receiptGets = 0;
  let readsAfterCommit = 0;
  let latest!: import("../src/components/ward-management/ward-shared-client").SharedView;
  const persisted = {
    status: 200,
    result: { outcome: "partly", commandRevision: 2, error: "Synthetic unsuitable ward held back." },
  };
  const state = seedWardFlowStateAt(0);
  const makeSnapshot = (revision: number) => ({
    dataMode: "prototype",
    revision,
    now: 642,
    payload: { version: 1, state, dayZero: "2026-10-23T00:00:00Z", startedAt: "2026-10-23T10:00:00Z" },
  });
  const fetcher = async (url: string | URL | Request) => {
    if (String(url).endsWith("/commands")) {
      posts++;
      committed = true;
      throw new Error("Synthetic lost response after commit");
    }
    if (String(url).includes("/receipt?")) {
      receiptGets++;
      // The backend projection is independently exercised with a fake pool in its own test.
      const receipt = { outcome: persisted.result.outcome, commandRevision: persisted.result.commandRevision };
      return Response.json({ receipt });
    }
    return Response.json({
      snapshot: makeSnapshot(committed && ++readsAfterCommit > 1 ? 2 : 1),
      receiptScope: "synthetic-receipt-scope",
      accessUntil: expiresAt,
    });
  };
  const options = {
    baseUrl: "https://example.test",
    manageDrafts: false,
    token: async () => "synthetic-only",
    commandId: () => commandId,
    recoveryStorage: port,
    fetch: fetcher as typeof fetch,
    changed: (view: import("../src/components/ward-management/ward-shared-client").SharedView) => {
      latest = view;
    },
  };
  const first = new SharedWorkspaceClient(options);
  try {
    await first.refresh();
    expectEqual(latest.status, "ready");
    const answer = await first.dispatchConfirmed({
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: 642,
      movementId: "WF-009",
      unitIds: ["rph-adult-secure", "fsh-adult-secure"],
    });
    expectEqual(answer.status, "failed");
    expectEqual(storage.has(WARD_COMMAND_RECOVERY_KEY), true);
  } finally {
    first.dispose();
  }
  const second = new SharedWorkspaceClient(options);
  try {
    await second.refresh();
    expectEqual(latest.status, "ready");
    expectEqual(receiptGets, 1);
    expectEqual(posts, 1);
    expect(latest.recovery).toMatch(/partially applied/);
    expect(latest.error).toBeNull();
    expect(latest.snapshot?.revision).toBe(2);
  } finally {
    second.dispose();
  }
});
function expectEqual(actual: unknown, expected: unknown) {
  expect(actual).toEqual(expected);
}
