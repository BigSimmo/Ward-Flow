import { expect, it } from "vitest";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";

const SAFE_PARTIAL_RECEIPT =
  "Part of this change was saved. The remaining details are unavailable in your current role.";

it("keeps the partial-save warning when a same-role lost-response retry receives a sanitised receipt", async () => {
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
  const snapshot = (revision: number): SharedSnapshot => ({
    dataMode: "prototype",
    revision,
    now: 642,
    accessContext: "a".repeat(64),
    payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  });
  const event: WardFlowEvent = {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: 642,
    movementId: "WF-009",
    unitIds: ["rph-adult-secure", "fsh-adult-secure"],
  };
  let view: SharedView | undefined;
  const requests: string[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-offline-token",
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, options) => {
      if (!options?.body) return Response.json({ snapshot: snapshot(1) });
      requests.push(String(options.body));
      if (requests.length === 1) throw new Error("Synthetic lost save response");
      return Response.json({
        outcome: "partly",
        commandRevision: 2,
        error: SAFE_PARTIAL_RECEIPT,
        replayed: true,
        snapshot: snapshot(2),
      });
    },
  });
  try {
    await client.refresh();
    const uncertain = await client.dispatch(event);
    expect(uncertain.status).toBe("failed");
    expect(view?.status).toBe("unavailable");
    expect(uncertain.confirmation).toBeDefined();
    await client.retry();
    const confirmed = await uncertain.confirmation;
    expect(requests).toHaveLength(2);
    expect(requests[1]).toBe(requests[0]);
    expect(confirmed).toMatchObject({ status: "accepted", partly: SAFE_PARTIAL_RECEIPT });
    expect(view?.status).toBe("ready");
    expect(view?.snapshot?.revision).toBe(2);
    expect(view?.error).toBe(`Sent to the suitable wards only. ${SAFE_PARTIAL_RECEIPT}`);
  } finally {
    client.dispose();
  }
});
