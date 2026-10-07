import { describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as SharedSnapshot["payload"]["state"];
const snapshot = (revision: number): SharedSnapshot => ({
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as WardFlowEvent;
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("shared workspace connection", () => {
  it("retries an uncertain save with the exact command ID and expected revision", async () => {
    const requests: string[] = [];
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      commandId: () => "test-id",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot(1) });
        requests.push(String(options.body));
        if (requests.length === 1) throw new Error("response lost");
        return Response.json({ snapshot: snapshot(2), replayed: true });
      },
    });
    await client.refresh();
    client.dispatch(event);
    await settle();
    expect(view?.status).toBe("unavailable");
    expect(view?.snapshot?.revision).toBe(1);
    await client.retry();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toBe(requests[1]);
    expect(view?.snapshot?.revision).toBe(2);
    expect(view?.status).toBe("ready");
    client.dispose();
  });
  it("shows committed winner state after a conflict and does not silently retry", async () => {
    let commands = 0;
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (_url, options) => {
        if (!options?.body) return Response.json({ snapshot: snapshot(1) });
        commands++;
        return Response.json({ snapshot: snapshot(2), error: "stale" }, { status: 409 });
      },
    });
    await client.refresh();
    client.dispatch(event);
    await settle();
    expect(commands).toBe(1);
    expect(view?.snapshot?.revision).toBe(2);
    expect(view?.error).toContain("not applied");
    client.dispose();
  });
  it("clears protected state after access is revoked", async () => {
    let calls = 0;
    let view: SharedView | undefined;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async () =>
        ++calls === 1 ? Response.json({ snapshot: snapshot(1) }) : Response.json({}, { status: 403 }),
    });
    await client.refresh();
    await client.refresh();
    expect(view?.snapshot).toBeNull();
    expect(view?.status).toBe("not-authorised");
    client.dispatch(event);
    await settle();
    expect(calls).toBe(2);
    client.dispose();
  });
  it("keeps queued actions moving when a refresh was already in flight", async () => {
    let resolve: (() => void) | undefined;
    let reads = 0;
    let commands = 0;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: () => {},
      fetch: async (_url, options) => {
        if (options?.body) {
          commands++;
          return Response.json({ snapshot: snapshot(2) });
        }
        if (++reads === 2)
          await new Promise<void>((done) => {
            resolve = done;
          });
        return Response.json({ snapshot: snapshot(1) });
      },
    });
    await client.refresh();
    const refresh = client.refresh();
    await settle();
    client.dispatch(event);
    resolve!();
    await refresh;
    await settle();
    expect(commands).toBe(1);
    client.dispose();
  });
});
