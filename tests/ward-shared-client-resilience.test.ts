import { describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// Audit 4 (shared mode and resilience): A4-02, A4-03, A4-08 and A4-09.
const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;

function setup(answer: (call: { read: boolean; token: string }) => Response | Promise<Response>) {
  let view: SharedView | undefined;
  let tokens = 0;
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => `token-${++tokens}`,
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, options) =>
      answer({
        read: !options?.body,
        token: String((options?.headers as Record<string, string>).authorization),
      }),
  });
  return { client, view: () => view };
}

describe("shared workspace resilience (audit 4)", () => {
  it("treats a proxy's own 403 page as a lost connection, not a sign-out (A4-02)", async () => {
    let first = true;
    const { client, view } = setup(({ read }) => {
      if (read && first) {
        first = false;
        return Response.json({ snapshot: snapshot(1) });
      }
      return new Response("<html>Blocked by proxy</html>", { status: 403 });
    });
    await client.refresh();
    expect((await client.dispatch(event)).status).toBe("failed");
    expect(view()?.status).toBe("unavailable");
    expect(view()?.snapshot).not.toBeNull();
    client.dispose();
  });

  it("asks once more with a fresh token after the server's first 401 (A4-02)", async () => {
    const seen: string[] = [];
    const { client, view } = setup(({ read, token }) => {
      seen.push(token);
      if (read && seen.length === 1)
        return Response.json({ error: "Sign in with the authorised account" }, { status: 401 });
      return Response.json({ snapshot: snapshot(1) });
    });
    await client.refresh();
    expect(view()?.status).toBe("ready");
    expect(seen).toEqual(["Bearer token-1", "Bearer token-2"]);
    client.dispose();
  });

  it("keeps reading the board while a save waits on Retry, and keeps the Retry message (A4-03, A4-09)", async () => {
    let online = true;
    let reads = 0;
    const { client, view } = setup(({ read }) => {
      if (!online) throw new TypeError("offline");
      if (read) return Response.json({ snapshot: snapshot(++reads) });
      return Response.json({ outcome: "accepted", commandRevision: 9, snapshot: snapshot(9) });
    });
    await client.refresh();
    online = false;
    expect((await client.dispatch(event)).status).toBe("failed");
    expect(view()?.error).toBe(
      "Your change may not have been saved. Keep this page open and press Retry to confirm this change. Retry uses the same command, so it will not be saved twice.",
    );
    online = true;
    await client.refresh();
    // Tier 1 item 1: once the board reads again, the waiting save goes by itself with the same ID.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view()?.snapshot?.revision).toBe(9);
    expect(view()?.status).toBe("ready");
    expect(view()?.unconfirmedSave).toBe(false);
    client.dispose();
  });

  it("keeps saves made while offline and sends them in order, each on the board it was made on (Tier 1 item 1)", async () => {
    let online = true;
    const sent: { commandId: string; expectedRevision: number; event: WardFlowEvent }[] = [];
    let revision = 4;
    const { client, view } = setup(({ read }) => {
      if (!online) throw new TypeError("offline");
      if (read) return Response.json({ snapshot: snapshot(revision) });
      return Response.json({ outcome: "accepted", commandRevision: ++revision, snapshot: snapshot(revision) });
    });
    const capture = client as unknown as { options: { fetch: typeof fetch } };
    const answer = capture.options.fetch;
    capture.options.fetch = async (url, options) => {
      if (options?.body) sent.push(JSON.parse(String(options.body)));
      return answer(url, options);
    };
    await client.refresh();
    online = false;
    const first = await client.dispatch(event);
    expect(first.status).toBe("failed");
    const second = { ...event, unitId: "ward-other" } as WardFlowEvent;
    const held = await client.dispatch(second);
    expect(held.status).toBe("failed");
    expect(held.message).toContain("waiting on this page");
    expect(view()?.status).toBe("unavailable");
    expect(view()?.waiting).toBe(2);
    // Another desk saves meanwhile: the board moves on to revision 6 before this tab reconnects.
    revision = 6;
    online = true;
    sent.length = 0;
    await client.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent.map((body) => (body.event as { unitId?: string }).unitId)).toEqual(["ward-test", "ward-other"]);
    // Both were made on revision 4, so the server checks them against 4, not the newer board.
    expect(sent.map((body) => body.expectedRevision)).toEqual([4, 4]);
    expect(view()?.waiting).toBe(0);
    expect(view()?.status).toBe("ready");
    expect((await first.confirmation)?.status).toBe("accepted");
    client.dispose();
  });

  it("pins an action made while a save waits, even when the connection returns before the next read (Tier 1 item 1)", async () => {
    let online = true;
    const sent: { expectedRevision: number; event: WardFlowEvent }[] = [];
    const { client } = setup(({ read }) => {
      if (!online) throw new TypeError("offline");
      if (read) return Response.json({ snapshot: snapshot(4) });
      // Another desk saved meanwhile: the resend lands on revision 7.
      return Response.json({ outcome: "accepted", commandRevision: 7, snapshot: snapshot(7) });
    });
    const capture = client as unknown as { options: { fetch: typeof fetch } };
    const answer = capture.options.fetch;
    capture.options.fetch = async (url, options) => {
      if (options?.body) sent.push(JSON.parse(String(options.body)));
      return answer(url, options);
    };
    await client.refresh();
    online = false;
    expect((await client.dispatch(event)).status).toBe("failed");
    online = true;
    sent.length = 0;
    const later = client.dispatch({ ...event, unitId: "ward-other" } as WardFlowEvent);
    await later;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent.map((body) => body.expectedRevision)).toEqual([4, 4]);
    client.dispose();
  });

  it("stops sending by itself once the server answers a resend with an error (Tier 1 item 1)", async () => {
    let online = true;
    let posts = 0;
    const { client } = setup(({ read }) => {
      if (!online) throw new TypeError("offline");
      if (read) return Response.json({ snapshot: snapshot(3) });
      posts++;
      return new Response("busy", { status: 500 });
    });
    await client.refresh();
    online = false;
    expect((await client.dispatch(event)).status).toBe("failed");
    online = true;
    await client.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(posts).toBe(1);
    await client.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(posts).toBe(1);
    client.dispose();
  });

  it("still refuses a waiting save another desk changed first, and does not resend it (Tier 1 item 1)", async () => {
    let online = true;
    let posts = 0;
    const { client, view } = setup(({ read }) => {
      if (!online) throw new TypeError("offline");
      if (read) return Response.json({ snapshot: snapshot(3) });
      posts++;
      return Response.json({ error: "stale", code: "stale", snapshot: snapshot(3) }, { status: 409 });
    });
    await client.refresh();
    online = false;
    const first = await client.dispatch(event);
    expect(first.status).toBe("failed");
    online = true;
    await client.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await first.confirmation)?.status).toBe("refused");
    expect(view()?.waiting).toBe(0);
    await client.refresh();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(posts).toBe(1);
    client.dispose();
  });

  it("says the server is busy after a 429, not to review the workflow (A4-08)", async () => {
    const { client, view } = setup(({ read }) =>
      read
        ? Response.json({ snapshot: snapshot(1) })
        : Response.json({ error: "Too many requests", snapshot: snapshot(1) }, { status: 429 }),
    );
    await client.refresh();
    expect((await client.dispatch(event)).status).toBe("refused");
    expect(view()?.error).toBe("The server is busy. Nothing was saved. Try again in a moment.");
    client.dispose();
  });
});
