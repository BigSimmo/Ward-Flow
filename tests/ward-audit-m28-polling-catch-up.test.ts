/**
 * Master audit M28 (10 Nov 2026): polling catches up correctly. There is no Realtime, so the board
 * is only as current as its polls. Replies that land out of order, a record deleted between polls,
 * overlapping polls and repeated reconnects must all settle on the server's latest revision, with
 * one read in flight and one timer. Synthetic data only.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { startWardPolling } from "../src/components/ward-management/ward-shared-polling";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

type State = SharedSnapshot["payload"]["state"];
const seed = () => JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as State;
const snapshot = (revision: number, state: State = seed()): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642 + revision,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});

/** A server whose replies are released by hand, in whatever order the test chooses. */
function heldServer() {
  const waiting: { url: string; answer: (body: unknown) => void }[] = [];
  const fetch = vi.fn(
    (url: RequestInfo | URL) =>
      new Promise<Response>((resolve) => {
        waiting.push({ url: String(url), answer: (body) => resolve(Response.json(body)) });
      }),
  );
  return { fetch, waiting };
}

const flush = async () => {
  for (let pass = 0; pass < 10; pass += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

afterEach(() => vi.useRealTimers());

describe("M28: shared polling settles on the server's latest revision", () => {
  it("ignores an older reply that lands after a newer one, drops a deleted record, and ends at the latest revision", async () => {
    let view: SharedView | undefined;
    const replies: unknown[] = [];
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async () => Response.json(replies.shift()),
    });
    try {
      const full = seed();
      expect(full.movements.length).toBeGreaterThan(1);
      const deleted = full.movements[0].id;
      const withoutOne = seed();
      withoutOne.movements = withoutOne.movements.filter((movement) => movement.id !== deleted);

      replies.push({ snapshot: snapshot(3, full) });
      await client.refresh();
      expect(view?.snapshot?.revision).toBe(3);

      // A lagging reply (an older revision, as from a slow path or a retried request) lands late.
      replies.push({ snapshot: snapshot(2, full) });
      await client.refresh();
      expect(view?.snapshot?.revision).toBe(3);

      // Between polls another desk deleted a record: the next full read removes it from the board.
      replies.push({ snapshot: snapshot(4, withoutOne) });
      await client.refresh();
      expect(view?.snapshot?.revision).toBe(4);
      expect(view?.snapshot?.payload.state.movements.some((movement) => movement.id === deleted)).toBe(false);

      // An older copy that still holds the deleted record must not bring it back.
      replies.push({ snapshot: snapshot(3, full) });
      await client.refresh();
      expect(view?.snapshot?.revision).toBe(4);
      expect(view?.snapshot?.payload.state.movements.some((movement) => movement.id === deleted)).toBe(false);

      // An unchanged answer at the held revision keeps the board and only moves its clock.
      replies.push({ notModified: true, revision: 4, now: 700 });
      await client.refresh();
      expect(view?.snapshot?.revision).toBe(4);
      expect(view?.snapshot?.now).toBe(700);
      expect(view?.status).toBe("ready");
    } finally {
      client.dispose();
    }
  });

  it("runs one read at a time: overlapping polls and repeated reconnects send a single request", async () => {
    const server = heldServer();
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: server.fetch,
    });
    try {
      const first = client.refresh();
      await flush();
      expect(server.fetch).toHaveBeenCalledTimes(1);
      // An overlapping poll and five reconnects while the read is out (the client's online handler
      // calls refresh() on each browser online event).
      expect(await client.refresh()).toBe("skipped");
      for (let reconnect = 0; reconnect < 5; reconnect += 1) expect(await client.refresh()).toBe("skipped");
      await flush();
      expect(server.fetch).toHaveBeenCalledTimes(1);
      server.waiting[0].answer({ snapshot: snapshot(5) });
      await first;
      expect(view?.snapshot?.revision).toBe(5);

      // The next poll names the revision it holds, so the server can answer with only what changed.
      const next = client.refresh();
      await flush();
      expect(server.fetch).toHaveBeenCalledTimes(2);
      expect(server.waiting[1].url).toContain("since=5");
      server.waiting[1].answer({ snapshot: snapshot(6) });
      await next;
      expect(view?.snapshot?.revision).toBe(6);
    } finally {
      client.dispose();
    }
  });

  it("keeps exactly one poll timer however often a reconnect asks for a fresh cadence", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    const polling = startWardPolling({ refresh, visible: () => true });
    // Repeated reconnects each reset the cadence; none may add a second timer.
    for (let reconnect = 0; reconnect < 10; reconnect += 1) polling.refreshed();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_000 * 10);
    // One timer: eleven reads in 33 seconds at a three-second cadence, never twenty or more.
    expect(refresh).toHaveBeenCalledTimes(11);
    polling.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(11);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a second read when a reconnect lands while a read is still out", async () => {
    vi.useFakeTimers();
    let release: (value: boolean) => void = () => {};
    const refresh = vi.fn(() => new Promise<boolean>((resolve) => (release = resolve)));
    const polling = startWardPolling({ refresh, visible: () => true });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    for (let reconnect = 0; reconnect < 5; reconnect += 1) polling.refreshed();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    release(true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    polling.stop();
  });
});
