import { describe, expect, it } from "vitest";
import { payloadUnchanged, reuseUnchangedPayload } from "../src/components/ward-management/ward-shared-client-reuse";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// Audit PS-06 / H-0954: a shared change keeps every unchanged record, list and map it can.
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const seed = copy(seedWardFlowStateAt(0)) as SharedSnapshot["payload"]["state"];
const payloadOf = (state: SharedSnapshot["payload"]["state"]): SharedSnapshot["payload"] => ({
  version: 1,
  state,
  dayZero: "2026-10-07T00:00:00Z",
  startedAt: "2026-10-07T10:00:00Z",
});

describe("reuseUnchangedPayload", () => {
  it("returns the held payload itself when a fresh copy has identical content", () => {
    const held = payloadOf(copy(seed));
    expect(reuseUnchangedPayload(held, copy(held))).toBe(held);
    expect(payloadUnchanged(held, copy(held))).toBe(true);
    expect(payloadUnchanged(null, copy(held))).toBe(false);
  });

  it("replaces only the changed record and the lists and objects that hold it", () => {
    const held = payloadOf(copy(seed));
    const next = copy(held);
    next.state.movements[1] = { ...next.state.movements[1]!, status: "cancelled" } as never;
    expect(payloadUnchanged(held, next)).toBe(false);
    const result = reuseUnchangedPayload(held, next);
    expect(result).not.toBe(held);
    expect(result.state).not.toBe(held.state);
    expect(result.state.movements).not.toBe(held.state.movements);
    expect(result.state.movements[1]).toBe(next.state.movements[1]);
    expect(result.state.movements[0]).toBe(held.state.movements[0]);
    expect(result.state.movements[2]).toBe(held.state.movements[2]);
    // Untouched collections, maps and scalars keep their identity.
    expect(result.state.units).toBe(held.state.units);
    expect(result.state.patients).toBe(held.state.patients);
    expect(result.state.dischargeRevisions).toBe(held.state.dischargeRevisions);
  });

  it("matches records by id across additions, deletions and reordering", () => {
    const held = payloadOf(copy(seed));
    const [first, second, third, ...rest] = held.state.movements;
    const added = { ...copy(first!), id: "WF-NEW" as const };
    const next = copy(held);
    // Third moves to the front, second is deleted, a new record is added at the end.
    next.state.movements = copy([third!, first!, ...rest, added]);
    const result = reuseUnchangedPayload(held, next);
    expect(result.state.movements).not.toBe(held.state.movements);
    expect(result.state.movements.map((movement) => movement.id)).toEqual(
      next.state.movements.map((movement) => movement.id),
    );
    expect(result.state.movements[0]).toBe(third);
    expect(result.state.movements[1]).toBe(first);
    expect(result.state.movements.at(-1)).toBe(next.state.movements.at(-1));
    expect(result.state.movements).not.toContain(second);
    expect(result.state.units).toBe(held.state.units);
  });

  it("falls back to position for lists without unique ids", () => {
    const held = { state: { list: [{ a: 1 }, { a: 2 }], dupes: [{ id: "x" }, { id: "x", b: 1 }] } };
    const next = { state: { list: [{ a: 1 }, { a: 3 }], dupes: [{ id: "x" }, { id: "x", b: 1 }] } };
    const result = reuseUnchangedPayload(held, next);
    expect(result.state.list[0]).toBe(held.state.list[0]);
    expect(result.state.list[1]).toBe(next.state.list[1]);
    expect(result.state.dupes).toBe(held.state.dupes);
  });
});

describe("SharedWorkspaceClient adopt keeps unchanged records (PS-06)", () => {
  it("keeps unchanged records and collections when a newer revision changes one record", async () => {
    let view: SharedView | undefined;
    let state = copy(seed);
    let revision = 1;
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async () =>
        Response.json({ snapshot: { dataMode: "prototype", revision, now: 642, payload: payloadOf(state) } }),
    });
    try {
      await client.refresh();
      const held = view!.snapshot!.payload;
      state = copy(seed);
      state.units[0] = { ...state.units[0]!, name: "Renamed synthetic ward" };
      revision = 2;
      await client.refresh();
      const next = view!.snapshot!.payload;
      expect(view?.snapshot?.revision).toBe(2);
      expect(next).not.toBe(held);
      expect(next.state.units).not.toBe(held.state.units);
      expect(next.state.units[0]!.name).toBe("Renamed synthetic ward");
      expect(next.state.units[1]).toBe(held.state.units[1]);
      expect(next.state.movements).toBe(held.state.movements);
      expect(next.state.referrals).toBe(held.state.referrals);
      // The same content again at a newer revision keeps the whole payload.
      revision = 3;
      await client.refresh();
      expect(view?.snapshot?.revision).toBe(3);
      expect(view!.snapshot!.payload).toBe(next);
    } finally {
      client.dispose();
    }
  });
});
