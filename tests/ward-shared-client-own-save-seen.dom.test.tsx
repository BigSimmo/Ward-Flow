import { describe, expect, it } from "vitest";
import { SharedWorkspaceClient, type SharedSnapshot } from "../src/components/ward-management/ward-shared-client";
import { noteOwnSeen, ownSeenSince } from "../src/components/ward-management/ward-shared-pending-command";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// D-237 (Together-X1b-2): an officer's quick second step (Accepted, then En route) was refused as
// "Another desk changed this movement first" when another desk saved something else in between:
// with no popup open, the tab's own first save could not move its basis on, so the server counted
// that save as someone else's change. The tab now reports the records its own save changed as seen.
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;
const record = "0123456789abcdef";

describe("a tab's own save is not another desk's change (D-237)", () => {
  it("sends the records its own save changed as seen when another desk saved in between", async () => {
    const sent: { expectedRevision: number; seen?: unknown }[] = [];
    let release!: () => void;
    const firstHeld = new Promise<void>((resolve) => (release = resolve));
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: () => undefined,
      fetch: async (_url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot(1) });
        const body = JSON.parse(String(options.body));
        sent.push({ expectedRevision: body.expectedRevision, seen: body.seen });
        if (sent.length === 1) {
          await firstHeld;
          // Its own save lands at 3: another desk saved at 2. A queued step asked for the revision only.
          return Response.json({ outcome: "accepted", commandRevision: 3, covered: [record] });
        }
        return Response.json({ outcome: "accepted", commandRevision: 4, snapshot: snapshot(4) });
      },
    });
    await client.refresh();
    const first = client.dispatch(event);
    const second = client.dispatch(event);
    release();
    await Promise.all([first, second]);
    expect(sent.map((each) => each.expectedRevision)).toEqual([1, 1]);
    expect(sent[0].seen).toBeUndefined();
    expect(sent[1].seen).toEqual({ [record]: 3 });
    client.dispose();
  });

  it("drops own-save records once the board has caught up with them", () => {
    const ownSeen = new Map<string, number>();
    noteOwnSeen(ownSeen, 3, [record, 42]);
    expect(ownSeenSince(ownSeen, 1)).toEqual({ [record]: 3 });
    expect(ownSeenSince(ownSeen, 3)).toEqual({});
    expect(ownSeen.size).toBe(0);
  });
});
