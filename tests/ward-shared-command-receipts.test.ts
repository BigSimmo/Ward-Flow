import { describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

const state = seedWardFlowStateAt(0);
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-24T00:00:00Z", startedAt: "2026-10-24T10:00:00Z" },
});
const event = { type: "RECORD_CLINICAL_CONTACT", role: "community", now: 642, teamId: "synthetic-team" } as const;

function harness() {
  let view: SharedView | undefined;
  let mode: "accepted" | "refused" | "drop" = "accepted";
  let revision = 1;
  let issued = 0;
  const sent: string[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    commandId: () => `synthetic-command-${++issued}`,
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, init) => {
      if (!init?.body) return Response.json({ snapshot: snapshot(revision) });
      sent.push(JSON.parse(String(init.body)).commandId);
      if (mode === "drop") throw new TypeError("Synthetic lost connection");
      if (mode === "refused")
        return Response.json({ snapshot: snapshot(revision), error: "Synthetic refusal" }, { status: 422 });
      revision++;
      return Response.json({ outcome: "accepted", snapshot: snapshot(revision) });
    },
  });
  return {
    client,
    sent,
    view: () => view!,
    mode: (next: typeof mode) => {
      mode = next;
    },
  };
}

describe("shared command reply attribution", () => {
  it.each(["accepted", "refused"] as const)(
    "ties a %s Retry receipt to the original failed command",
    async (terminal) => {
      const h = harness();
      try {
        await h.client.refresh();
        h.mode("drop");
        const original = await h.client.dispatch(event);
        expect(original.status).toBe("failed");
        expect(h.view().eventLog ?? []).toHaveLength(0);
        h.mode(terminal);
        await h.client.retry();
        const receipt = h.view().eventLog?.at(-1);
        expect(h.sent.every((id) => id === original.commandId)).toBe(true);
        expect(receipt && Reflect.get(receipt, "commandId")).toBe(original.commandId);
        expect(receipt?.accepted).toBe(terminal === "accepted");
        expect(original.status).toBe("failed"); // Retry does not re-settle the original Promise.
        await h.client.refresh();
        expect(h.view().eventLog).toHaveLength(1);
      } finally {
        h.client.dispose();
      }
    },
  );

  it("distinguishes two identical same-minute actions by command ID", async () => {
    const h = harness();
    try {
      await h.client.refresh();
      const first = await h.client.dispatch(event);
      const second = await h.client.dispatch(event);
      expect(first.status).toBe("accepted");
      expect(second.status).toBe("accepted");
      expect(first.commandId).not.toBe(second.commandId);
      expect(h.view().eventLog?.map((entry) => Reflect.get(entry, "commandId"))).toEqual([
        first.commandId,
        second.commandId,
      ]);
    } finally {
      h.client.dispose();
    }
  });
});
