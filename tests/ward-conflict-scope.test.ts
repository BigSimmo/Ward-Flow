import { describe, expect, it, vi } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// P058: a "changed first" refusal cancels only the queued actions on the record it clashed on.
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const on = (unitId: string) =>
  ({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId }) as WardFlowEvent;
const patient = { name: "Jane Citizen", umrn: "U1234567", bed: "Bed 14", id: "PT-0042" };

function harness() {
  const sent: string[] = [];
  const revisions: number[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "test",
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, options) => {
      if (!options?.body) return Response.json({ snapshot: snapshot(1) });
      const body = JSON.parse(String(options.body)) as { event: { unitId: string } };
      sent.push(body.event.unitId);
      revisions.push((JSON.parse(String(options.body)) as { expectedRevision: number }).expectedRevision);
      if (sent.length === 1) {
        await gate;
        return Response.json(
          {
            outcome: "stale",
            code: "stale",
            recordType: "bed",
            error: "Another desk changed this bed first. Review the latest board before trying again.",
            snapshot: snapshot(2),
          },
          { status: 409 },
        );
      }
      return Response.json({ outcome: "accepted", snapshot: snapshot(sent.length + 1) });
    },
  });
  return { client, sent, revisions, release, view: () => view };
}

describe("P058 conflict scope", () => {
  it("a 409 on ward 1 does not cancel ward 2's queued action; ward 1's queued action is not sent", async () => {
    const { client, sent, release } = harness();
    await client.refresh();
    const first = client.dispatch(on("ward-1"));
    const sameRecord = client.dispatch(on("ward-1"));
    const otherWard = client.dispatch(on("ward-2"));
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    release();
    const refused = await first;
    expect(refused.status).toBe("refused");
    const same = await sameRecord;
    expect(same.status).toBe("cancelled");
    expect(same.message).toBe("1 queued action on this bed was not sent. Check the board, then try again.");
    expect((await otherWard).status).toBe("accepted");
    expect(sent).toEqual(["ward-1", "ward-2"]);
    expect(refused.message).toBe(
      "Another desk changed this bed while you were looking. Your action was not applied. Check the latest details, then try again.",
    );
    client.dispose();
  });

  it("a queued action that survives the conflict keeps the revision it was prepared against", async () => {
    const { client, sent, revisions, release } = harness();
    await client.refresh();
    const first = client.dispatch(on("ward-1"));
    const otherWard = client.dispatch(on("ward-2"));
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    release();
    await first;
    await otherWard;
    expect(sent).toEqual(["ward-1", "ward-2"]);
    expect(revisions).toEqual([1, 1]);
    client.dispose();
  });

  it("names no patient, UMRN, bed, patient id or record id in the board message or settle messages", async () => {
    const { client, release, view } = harness();
    await client.refresh();
    const outcomes = [client.dispatch(on("ward-1")), client.dispatch(on("ward-1"))];
    release();
    const messages = [view()?.error, ...(await Promise.all(outcomes)).map((outcome) => outcome.message)];
    await vi.waitFor(() => expect(view()?.error).toBeTruthy());
    messages.push(view()?.error);
    for (const message of messages.filter(Boolean)) {
      for (const secret of [patient.name, patient.umrn, patient.bed, patient.id, "ward-1"])
        expect(message).not.toContain(secret);
      expect(message).not.toMatch(/PT-\d+/u);
    }
    client.dispose();
  });
});
