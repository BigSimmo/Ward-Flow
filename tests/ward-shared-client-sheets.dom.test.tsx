import { afterEach, describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { popSheet, pushSheet } from "../src/components/wf/sheet-focus";

// Audit CS-19: an edit made from a popup is checked against the board the popup opened on, so a
// change another desk made while the person was looking is reported instead of overwritten.
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;
const opened: string[] = [];

afterEach(() => {
  for (const id of opened.splice(0).reverse()) popSheet(id);
});

function open(id: string) {
  opened.push(id);
  pushSheet(id);
}

/** A server at `board.revision`; each command answers with `answer(expectedRevision)`. */
function setup(
  answer: (expectedRevision: number) => { status?: number; revision: number; gap?: number; covered?: string[] },
) {
  const board = { revision: 1 };
  const sent: number[] = [];
  const seen: unknown[] = [];
  let view: SharedView | undefined;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "test",
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, options) => {
      if (!options?.body) return Response.json({ snapshot: snapshot(board.revision) });
      const body = JSON.parse(String(options.body));
      const { expectedRevision } = body;
      sent.push(expectedRevision);
      seen.push(body.seen);
      const reply = answer(expectedRevision);
      board.revision = reply.revision;
      return Response.json(
        reply.status === 409
          ? { outcome: "stale", commandRevision: reply.revision, snapshot: snapshot(reply.revision), error: "stale" }
          : {
              outcome: "accepted",
              commandRevision: reply.revision,
              snapshot: snapshot(reply.revision),
              ...(reply.covered ? { covered: reply.covered } : {}),
            },
        { status: reply.status ?? 200 },
      );
    },
  });
  return { client, board, sent, seen, view: () => view };
}

describe("an edit made from a popup (audit CS-19)", () => {
  it("is checked against the board the popup opened on, then works once the person has seen the change", async () => {
    let calls = 0;
    const { client, board, sent, view } = setup(() => (++calls === 1 ? { status: 409, revision: 2 } : { revision: 3 }));
    await client.refresh();
    open("edit-record");
    // Another desk saves while the popup is open, and the next poll brings it in.
    board.revision = 2;
    await client.refresh();
    expect(view()?.snapshot?.revision).toBe(2);

    const refused = await client.dispatch(event);
    expect(refused.status).toBe("refused");
    expect(view()?.error).toBe(
      "This record changed while you were looking. Your action was not applied; review the latest details and try again.",
    );
    // Asked again from the same popup, after the warning and the latest board.
    expect((await client.dispatch(event)).status).toBe("accepted");
    expect(sent).toEqual([1, 2]);
    client.dispose();
  });

  it("notes a popup opened before the board arrived against the first board it shows", async () => {
    const { client, board, sent } = setup((expected) => ({ revision: expected + 1 }));
    open("record");
    await client.refresh();
    board.revision = 2;
    await client.refresh();
    await client.dispatch(event);
    expect(sent).toEqual([1]);
    client.dispose();
  });

  it("uses the oldest open popup when popups are stacked", async () => {
    const { client, board, sent } = setup((expected) => ({ revision: expected + 1 }));
    await client.refresh();
    open("record");
    board.revision = 2;
    await client.refresh();
    open("confirm");
    await client.dispatch(event);
    expect(sent).toEqual([1]);
    client.dispose();
  });

  it("moves on with the popup's own saves, but not past another desk's save in between", async () => {
    let calls = 0;
    const { client, sent } = setup((expected) => ({ revision: expected + (++calls === 2 ? 2 : 1) }));
    await client.refresh();
    open("record");
    await client.dispatch(event); // 1 -> 2: its own save, nothing in between
    await client.dispatch(event); // 2 -> 4: another desk saved at 3
    await client.dispatch(event);
    expect(sent).toEqual([1, 2, 2]);
    client.dispose();
  });

  it("tells the server which records a popup saw through its own save across another desk's save", async () => {
    // Josh, 20 Oct 2026 ("Fix it properly"): a second save of the same record from the same popup is
    // not refused because another desk saved something else in between. Its first save lands at 3,
    // on top of another desk's save at 2; the second is still checked from 1 for everything else.
    const record = "0123456789abcdef";
    let calls = 0;
    const { client, sent, seen } = setup(() => (++calls === 1 ? { revision: 3, covered: [record] } : { revision: 4 }));
    await client.refresh();
    open("record");
    await client.dispatch(event);
    await client.dispatch(event);
    expect(sent).toEqual([1, 1]);
    expect(seen).toEqual([undefined, { [record]: 3 }]);
    client.dispose();
  });

  it("is checked against the latest board when no popup is open", async () => {
    const { client, board, sent } = setup((expected) => ({ revision: expected + 1 }));
    await client.refresh();
    open("record");
    popSheet(opened.pop()!);
    board.revision = 2;
    await client.refresh();
    await client.dispatch(event);
    expect(sent).toEqual([2]);
    client.dispose();
  });
});
