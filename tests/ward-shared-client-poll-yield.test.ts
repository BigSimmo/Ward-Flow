import { describe, expect, it, vi } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { anySignal } from "../src/components/ward-management/ward-shared-client-helpers";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;

describe("a save does not wait behind a poll (#817)", () => {
  it("stops the poll in flight and sends the save at once", async () => {
    let view: SharedView | undefined;
    let polls = 0;
    let pollSignal: AbortSignal | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (url, init) => {
        if (String(url).endsWith("/commands")) return Response.json({ snapshot: snapshot(2) });
        polls += 1;
        if (polls === 1) return Response.json({ snapshot: snapshot(1) });
        // The second poll hangs until something aborts it, as a slow read would.
        pollSignal = init?.signal ?? undefined;
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
        );
      },
    });
    await client.refresh();
    void client.refresh();
    await vi.waitFor(() => expect(pollSignal).toBeDefined());
    const outcome = await client.dispatch(event);
    expect(pollSignal?.aborted).toBe(true);
    expect(outcome.status).toBe("accepted");
    expect(view?.status).toBe("ready");
    expect(view?.error ?? null).toBeNull();
    expect(view?.snapshot?.revision).toBe(2);
    client.dispose();
  });
});

describe("a save does not wait behind a poll's token refresh (#817)", () => {
  it("stops a poll still waiting for its token and sends the save", async () => {
    let tokens = 0;
    let releaseSlowToken: ((token: string) => void) | undefined;
    let polls = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      // The second poll's token waits on a slow session refresh; every other token is immediate.
      token: () => {
        tokens += 1;
        if (tokens === 2) return new Promise<string>((resolve) => (releaseSlowToken = resolve));
        return Promise.resolve("test");
      },
      changed: () => {},
      fetch: async (url) => {
        if (String(url).endsWith("/commands")) return Response.json({ snapshot: snapshot(2) });
        polls += 1;
        return Response.json({ snapshot: snapshot(1) });
      },
    });
    await client.refresh();
    void client.refresh();
    await vi.waitFor(() => expect(releaseSlowToken).toBeDefined());
    const outcome = await client.dispatch(event);
    expect(outcome.status).toBe("accepted");
    expect(polls).toBe(1);
    releaseSlowToken?.("late");
    client.dispose();
  });
});

describe("anySignal (H-0304)", () => {
  it("follows the first signal to abort when AbortSignal.any is missing, and lets go of the rest", () => {
    const any = AbortSignal.any;
    Reflect.deleteProperty(AbortSignal, "any");
    try {
      const first = new AbortController();
      const second = new AbortController();
      const remove = vi.spyOn(second.signal, "removeEventListener");
      const combined = anySignal([first.signal, second.signal]);
      expect(combined.aborted).toBe(false);
      first.abort("stop");
      expect(combined.aborted).toBe(true);
      expect(combined.reason).toBe("stop");
      expect(remove).toHaveBeenCalled();
      const already = anySignal([AbortSignal.abort("done")]);
      expect(already.aborted).toBe(true);
    } finally {
      Object.defineProperty(AbortSignal, "any", { value: any, configurable: true, writable: true });
    }
  });
});
