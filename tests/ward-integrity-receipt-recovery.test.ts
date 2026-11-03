import { expect, it } from "vitest";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  WARD_COMMAND_RECOVERY_KEY,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";

const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: {
    version: 1,
    state: seedWardFlowStateAt(0),
    dayZero: "2026-10-07T00:00:00Z",
    startedAt: "2026-10-07T10:00:00Z",
  },
});

for (const [outcome, message] of [
  ["partly", /previous uncertain save was only partly applied/i],
  ["accepted", /previous uncertain save was accepted/i],
  ["refused", /previous uncertain save was not applied/i],
  [null, /outcome is unknown/i],
] as const) {
  it(`recovers ${outcome ?? "missing"} receipt without claiming full acceptance`, async () => {
    const commandId = "33333333-3333-4333-8333-333333333333";
    const held = new Map([
      [
        WARD_COMMAND_RECOVERY_KEY,
        JSON.stringify({ commandId, receiptScope: "synthetic-scope", expiresAt: Date.now() + 60_000 }),
      ],
    ]);
    let view: SharedView | undefined;
    let reads = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "synthetic-token",
      changed: (next) => {
        view = next;
      },
      recoveryStorage: {
        getItem: (key) => held.get(key) ?? null,
        setItem: (key, value) => {
          held.set(key, value);
        },
        removeItem: (key) => {
          held.delete(key);
        },
      },
      fetch: async (url) => {
        if (String(url).includes("/receipt?"))
          return Response.json({ receipt: outcome === null ? null : { outcome, commandRevision: 2 } });
        reads++;
        return Response.json({
          snapshot: snapshot(reads === 1 ? 1 : 2),
          receiptScope: "synthetic-scope",
          accessUntil: Date.now() + 60_000,
        });
      },
    });
    try {
      await client.refresh();
      expect(view?.status).toBe("ready");
      expect(view?.recovery).toMatch(message);
      expect(held.size).toBe(0);
      if (outcome === "partly" || outcome === "accepted") expect(view?.snapshot?.revision).toBe(2);
      if (outcome === "partly") expect(view?.recovery).toMatch(/review the refreshed board before acting again/i);
    } finally {
      client.dispose();
    }
  });
}
