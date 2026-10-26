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
      "Your change may not have been saved. Press Retry when you are back online. It will not be saved twice.",
    );
    online = true;
    await client.refresh();
    expect(view()?.snapshot?.revision).toBe(2);
    expect(view()?.status).toBe("unavailable");
    expect(view()?.error).toBe("Your last change was not confirmed. The board is up to date. Press Retry to send it.");
    expect(view()?.boardCurrent).toBe(true);
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
