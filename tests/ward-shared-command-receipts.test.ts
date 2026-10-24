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

describe("private shared command confirmation", () => {
  it.each(["accepted", "refused"] as const)("confirms only this failed command after a %s Retry", async (terminal) => {
    const h = harness();
    try {
      await h.client.refresh();
      h.mode("drop");
      const original = await h.client.dispatchConfirmed(event);
      expect(original.status).toBe("failed");
      expect(original.confirmation).toBeDefined();
      let settled = false;
      void original.confirmation!.then(() => {
        settled = true;
      });
      await h.client.refresh();
      expect(settled).toBe(false);
      h.mode(terminal);
      await h.client.retry();
      const final = await original.confirmation!;
      expect(final).toMatchObject({ commandId: original.commandId, status: terminal });
      expect(final.isCurrent?.()).toBe(true);
      expect(h.sent.every((id) => id === original.commandId)).toBe(true);
      expect(original.status).toBe("failed");
      expect(final.confirmation).toBeUndefined();
      expect(h.view().eventLog?.at(-1)).not.toHaveProperty("commandId");
    } finally {
      h.client.dispose();
    }
  });

  it("does not confirm a command while repeated Retry responses remain uncertain", async () => {
    const h = harness();
    try {
      await h.client.refresh();
      h.mode("drop");
      const original = await h.client.dispatchConfirmed(event);
      expect(original.confirmation).toBeDefined();
      let settled = false;
      void original.confirmation!.then(() => {
        settled = true;
      });
      await h.client.retry();
      expect(settled).toBe(false);
      h.mode("accepted");
      await h.client.retry();
      await expect(original.confirmation).resolves.toMatchObject({ status: "accepted", commandId: original.commandId });
    } finally {
      h.client.dispose();
    }
  });

  it.each(["accepted", "refused"] as const)(
    "also resolves a direct %s answer without exposing a shared log",
    async (terminal) => {
      const h = harness();
      try {
        await h.client.refresh();
        h.mode(terminal);
        const answer = await h.client.dispatchConfirmed(event);
        expect(answer.confirmation).toBeDefined();
        await expect(answer.confirmation).resolves.toMatchObject({ commandId: answer.commandId, status: terminal });
      } finally {
        h.client.dispose();
      }
    },
  );

  it("keeps identical same-minute commands' definitive answers separate", async () => {
    const h = harness();
    try {
      await h.client.refresh();
      const first = await h.client.dispatchConfirmed(event);
      h.mode("refused");
      const second = await h.client.dispatchConfirmed(event);
      expect(first.commandId).not.toBe(second.commandId);
      await expect(first.confirmation).resolves.toMatchObject({ commandId: first.commandId, status: "accepted" });
      await expect(second.confirmation).resolves.toMatchObject({ commandId: second.commandId, status: "refused" });
    } finally {
      h.client.dispose();
    }
  });

  it.each(["dispose", "switchRole"] as const)(
    "ends unresolved confirmation when %s retires its command",
    async (action) => {
      const h = harness();
      try {
        await h.client.refresh();
        h.mode("drop");
        const original = await h.client.dispatchConfirmed(event);
        expect(original.confirmation).toBeDefined();
        h.client[action]();
        const ended = await original.confirmation!;
        expect(ended).toMatchObject({ commandId: original.commandId, status: "cancelled" });
        expect(ended.isCurrent?.()).toBe(false);
      } finally {
        h.client.dispose();
      }
    },
  );
});
