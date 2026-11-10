// Audit M53 (master audit list, 10 Nov 2026): the browser half of the save limit. A 429 on
// /v1/workspace/commands was refused before any work, so the browser keeps the save and the ones
// queued after it, waits for Retry-After, and sends them again with the same command IDs. Nothing
// is cancelled. Synthetic board; fetch and timers are faked.
import { afterEach, expect, it, vi } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { saveProblem } from "../src/components/ward-management/ward-save-failure";

afterEach(() => vi.useRealTimers());

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;

function setup(limited: number, retryAfter: string | null) {
  let view: SharedView | undefined;
  let revision = 1;
  let ids = 0;
  const posts: { at: number; commandId: string }[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    manageDrafts: false,
    commandId: () => `00000000-0000-4000-8000-00000000000${++ids}`,
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, options) => {
      if (!options?.body) return Response.json({ snapshot: snapshot(revision), accessUntil: Date.now() + 3_600_000 });
      const body = JSON.parse(String(options.body)) as { commandId: string };
      posts.push({ at: Date.now(), commandId: body.commandId });
      if (posts.length <= limited)
        return Response.json(
          { code: "rate-limited", error: "Too many saves; try again shortly" },
          { status: 429, headers: retryAfter === null ? {} : { "retry-after": retryAfter } },
        );
      revision += 1;
      return Response.json({ snapshot: snapshot(revision) });
    },
  });
  return { client, posts, view: () => view };
}

it("keeps a limited save and the save behind it, then sends both after Retry-After", async () => {
  vi.useFakeTimers();
  const { client, posts, view } = setup(1, "7");
  await client.refresh();
  const start = Date.now();
  const first = client.dispatch(event);
  const second = client.dispatch(event);
  expect((await first).status).toBe("failed");
  expect((await second).status).toBe("failed");
  expect(view()?.status).toBe("ready");
  expect(view()?.error).toBe(saveProblem("busy"));
  expect(view()?.pendingCount).toBe(2);
  // Polls and Retry inside the wait do not resend early.
  await vi.advanceTimersByTimeAsync(6_999);
  await client.retry();
  expect(posts).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1);
  await vi.waitFor(() => expect(posts).toHaveLength(3));
  expect(posts[1].at - start).toBe(7_000);
  // The same command goes again, then the one queued behind it.
  expect(posts.map((post) => post.commandId)).toEqual([posts[0].commandId, posts[0].commandId, posts[2].commandId]);
  expect(posts[2].commandId).not.toBe(posts[0].commandId);
  await vi.waitFor(() => expect(view()?.pendingCount).toBe(0));
  expect(view()?.error).toBeNull();
  client.dispose();
});

it("waits 10 seconds without a Retry-After and at most two minutes for a long one", async () => {
  vi.useFakeTimers();
  for (const [header, wait] of [
    [null, 10_000],
    ["86400", 120_000],
  ] as const) {
    const { client, posts } = setup(1, header);
    await client.refresh();
    const start = Date.now();
    void client.dispatch(event);
    await vi.advanceTimersByTimeAsync(wait - 1);
    expect(posts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].at - start).toBe(wait);
    client.dispose();
  }
});

it("sends nothing after the desk closes during the wait", async () => {
  vi.useFakeTimers();
  const { client, posts } = setup(1, "5");
  await client.refresh();
  void client.dispatch(event);
  await vi.advanceTimersByTimeAsync(0);
  client.dispose();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(posts).toHaveLength(1);
});
