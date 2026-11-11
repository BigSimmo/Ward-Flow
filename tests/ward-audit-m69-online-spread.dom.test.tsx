// M69 (master audit list, 10 Nov 2026): when a ward's network comes back, each desk's first read is
// spread like a backed-off retry, so the desks do not all read in the same second. Synthetic data and
// fake timers only; no network.
import { afterEach, expect, it, vi } from "vitest";

import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { SharedWorkspaceClient, type SharedSnapshot } from "@/components/ward-management/ward-shared-client";
import { ONLINE_SPREAD_MS } from "@/components/ward-management/ward-shared-pacing";

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot: SharedSnapshot = {
  dataMode: "prototype",
  revision: 1,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A desk whose reads are recorded by when each one starts (its token and request follow). */
function desk(random: () => number) {
  const reads: number[] = [];
  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-test-token",
    changed: () => {},
    random,
    fetch: async () => Response.json({ snapshot, accessUntil: Date.now() + 600_000 }),
  });
  vi.spyOn(client, "refresh").mockImplementation(async () => {
    reads.push(Date.now());
  });
  return { client, reads };
}

it("waits a random part of the spread before the first read after the network returns", async () => {
  vi.useFakeTimers();
  const { client, reads } = desk(() => 0.5);
  const start = Date.now();
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(ONLINE_SPREAD_MS / 2 - 1);
  expect(reads).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(reads.map((at) => at - start)).toEqual([ONLINE_SPREAD_MS / 2]);
  client.dispose();
});

it("reads once for a burst of online events, and not at all after the desk closes", async () => {
  vi.useFakeTimers();
  const burst = desk(() => 0.2);
  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(ONLINE_SPREAD_MS);
  expect(burst.reads).toHaveLength(1);
  burst.client.dispose();
  const closed = desk(() => 0.999);
  window.dispatchEvent(new Event("online"));
  closed.client.dispose();
  await vi.advanceTimersByTimeAsync(ONLINE_SPREAD_MS);
  expect(closed.reads).toHaveLength(0);
});

it("spreads 50 desks' first reads across the spread rather than one moment", async () => {
  vi.useFakeTimers();
  const start = Date.now();
  const desks = Array.from({ length: 50 }, (_, index) => desk(() => index / 50));
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(ONLINE_SPREAD_MS);
  desks.forEach(({ client }) => client.dispose());
  const firsts = desks.map(({ reads }) => reads[0] - start);
  expect(desks.every(({ reads }) => reads.length === 1)).toBe(true);
  expect(firsts.every((at) => at >= 0 && at < ONLINE_SPREAD_MS)).toBe(true);
  // No second takes more than a fifth of the desks.
  const perSecond = new Map<number, number>();
  for (const at of firsts) perSecond.set(Math.floor(at / 1000), (perSecond.get(Math.floor(at / 1000)) ?? 0) + 1);
  expect(Math.max(...perSecond.values())).toBeLessThanOrEqual(10);
});
