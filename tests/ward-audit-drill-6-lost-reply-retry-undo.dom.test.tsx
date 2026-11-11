import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";

// Compound drill 6 (master audit list item 7, 10 Nov 2026): a save whose reply is lost, plus a
// Retry, plus another desk's Undo of the same record before the Retry lands.
//
// The rule: Retry sends the same command identity, so the server answers with the receipt it kept
// (it never applies the change a second time on top of the other desk's Undo), and this tab ends on
// the board as it is now, Undo included, not the change it thought it made. The server half, with
// real PostgreSQL, is backend/ward-flow/ward-audit-drill-6-lost-reply-retry-undo.test.mjs.

type State = SharedSnapshot["payload"]["state"];
const actorId = "synthetic-actor-drill-6";
const seed = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as State;
const movementId = seed.movements.find((movement) => !movement.closure)!.id;
const event = {
  type: "RECORD_TRANSPORT_NEED",
  role: "coordinator",
  now: 642,
  movementId,
  needed: true,
} as unknown as WardFlowEvent;

function setup() {
  const server = {
    revision: 1,
    state: seed,
    applied: [] as string[],
    receipts: new Map<string, number>(),
    loseNextReply: true,
    answerNextWith503: false,
  };
  const posted: string[] = [];
  let view: SharedView | undefined;
  const snapshot = (): SharedSnapshot => ({
    dataMode: "prototype",
    revision: server.revision,
    now: 642,
    payload: { version: 1, state: server.state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
  });
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    changed: (next) => {
      view = next;
    },
    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path !== "/v1/workspace/commands") return Response.json({ actorId, snapshot: snapshot() });
      const command = JSON.parse(String(init?.body));
      posted.push(command.commandId);
      const kept = server.receipts.get(command.commandId);
      // A command identity already answered gets its kept receipt and today's board, never a re-run.
      if (kept !== undefined)
        return Response.json({ outcome: "accepted", commandRevision: kept, replayed: true, snapshot: snapshot() });
      server.state = wardFlowReducer(server.state, command.event);
      server.revision += 1;
      server.applied.push(command.commandId);
      server.receipts.set(command.commandId, server.revision);
      if (server.answerNextWith503) {
        server.answerNextWith503 = false;
        return Response.json({ error: "Synthetic gateway timeout after commit" }, { status: 503 });
      }
      if (server.loseNextReply) {
        server.loseNextReply = false;
        throw new TypeError("Synthetic lost reply: the save committed, the answer never arrived");
      }
      return Response.json({ outcome: "accepted", commandRevision: server.revision, snapshot: snapshot() });
    },
  });
  /** Another desk's Undo of the same record, landing on the server before this tab's Retry. */
  const otherDeskUndo = () => {
    server.state = seed;
    server.revision += 1;
  };
  return { client, server, posted, view: () => view, otherDeskUndo };
}

const transportOf = (state: State | undefined) =>
  JSON.stringify(state?.movements.find((movement) => movement.id === movementId)?.transportNeed ?? null);

describe("compound drill 6: lost reply, then Retry, then another desk's Undo of the same record", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-10T02:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("the change really moves the record, so the drill can tell a re-run from a replay", () => {
    expect(transportOf(wardFlowReducer(seed, event))).not.toBe(transportOf(seed));
  });

  it("Retry resends the same identity, the server does not apply it twice, and the tab shows the Undo", async () => {
    const harness = setup();
    await harness.client.refresh();
    const outcome = harness.client.dispatch(event);
    await vi.advanceTimersByTimeAsync(0);
    expect((await outcome).status).toBe("failed");
    expect(harness.view()?.status).toBe("unavailable");
    expect(harness.server.applied).toHaveLength(1);

    harness.otherDeskUndo();
    await harness.client.retry();
    await vi.advanceTimersByTimeAsync(0);

    // One identity, posted twice; applied once.
    expect(harness.posted).toHaveLength(2);
    expect(new Set(harness.posted).size).toBe(1);
    expect(harness.server.applied).toEqual([harness.posted[0]]);
    // The tab holds the board as it is now: the other desk's Undo, at the newest revision.
    expect(harness.view()?.snapshot?.revision).toBe(harness.server.revision);
    expect(transportOf(harness.view()?.snapshot?.payload.state)).toBe(transportOf(seed));
    expect(harness.view()?.status).toBe("ready");
    harness.client.dispose();
  });

  it("a lost reply that looks like a dropped connection is resent by the next read, still once only", async () => {
    // A network-shaped failure holds the save as waiting (offline hold), so the next successful read
    // sends it again by itself. It carries the same identity, so this is a replay, not a second save.
    const harness = setup();
    await harness.client.refresh();
    expect((await harness.client.dispatch(event)).status).toBe("failed");
    harness.otherDeskUndo();
    await harness.client.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.posted.length).toBeGreaterThanOrEqual(2);
    expect(new Set(harness.posted).size).toBe(1);
    expect(harness.server.applied).toEqual([harness.posted[0]]);
    expect(harness.view()?.snapshot?.revision).toBe(harness.server.revision);
    expect(transportOf(harness.view()?.snapshot?.payload.state)).toBe(transportOf(seed));
    harness.client.dispose();
  });

  it("a lost reply the server did answer (a 503) waits on Retry and is not resent by a read", async () => {
    const harness = setup();
    await harness.client.refresh();
    const fetchOk = harness.server.loseNextReply;
    expect(fetchOk).toBe(true);
    harness.server.loseNextReply = false;
    harness.server.answerNextWith503 = true;
    expect((await harness.client.dispatch(event)).status).toBe("failed");
    harness.otherDeskUndo();
    await harness.client.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.posted).toHaveLength(1);
    expect(harness.view()?.status).toBe("unavailable");
    expect(harness.view()?.boardCurrent).toBe(true);
    await harness.client.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(new Set(harness.posted).size).toBe(1);
    expect(harness.server.applied).toEqual([harness.posted[0]]);
    expect(transportOf(harness.view()?.snapshot?.payload.state)).toBe(transportOf(seed));
    expect(harness.view()?.status).toBe("ready");
    harness.client.dispose();
  });
});
