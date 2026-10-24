import { describe, expect, it } from "vitest";
import { SharedWorkspaceClient, type SharedSnapshot } from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { holdOpenForm } from "../src/components/wf/sheet-focus";

// Audit 4 A4-01: an inline form held open is checked like a popup (CS-19), so a save from it is
// sent against the board it opened on, not the newest board, and the server can refuse it.
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;

function setup() {
  const board = { revision: 1 };
  const sent: number[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "test",
    changed: () => {},
    fetch: async (_url, options) => {
      if (!options?.body) return Response.json({ snapshot: snapshot(board.revision) });
      sent.push(JSON.parse(String(options.body)).expectedRevision);
      board.revision += 1;
      return Response.json({ outcome: "accepted", commandRevision: board.revision, snapshot: snapshot(board.revision) });
    },
  });
  return { client, board, sent };
}

describe("an inline edit form held open (audit A4-01)", () => {
  it("sends the revision the form opened on, so another desk's change meanwhile is checked", async () => {
    const { client, board, sent } = setup();
    await client.refresh();
    const release = holdOpenForm();
    board.revision = 2; // another desk saves while the form is open
    await client.refresh();
    await client.dispatch(event);
    release();
    release(); // safe twice
    expect(sent).toEqual([1]);
    client.dispose();
  });

  it("without an open form, sends the newest board as before", async () => {
    const { client, board, sent } = setup();
    await client.refresh();
    board.revision = 2;
    await client.refresh();
    await client.dispatch(event);
    expect(sent).toEqual([2]);
    client.dispose();
  });
});
