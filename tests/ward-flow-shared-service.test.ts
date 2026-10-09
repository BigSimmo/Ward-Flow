import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_STORED_STATE_VERSION } from "../src/components/ward-management/ward-flow-storage-validation";
import { applySharedEvent } from "../src/components/ward-management/shared/ward-flow-shared-core";
import {
  createSharedWorldService,
  SHARED_NEW_DAY_THRESHOLD_MS,
} from "../src/components/ward-management/shared/server/service";
import { createMemorySharedStateStore } from "./helpers/ward-flow-shared-memory-store";

// Synthetic fixture ids only.
const DAY_ZERO = Date.UTC(2026, 9, 8, 16, 0, 0); // local midnight 9 Oct in Perth
const SERVER_NOW = DAY_ZERO + 9 * 60 * 60 * 1000;
const WORLD_A = "11111111-1111-4111-8111-111111111111";
const WORLD_B = "22222222-2222-4222-8222-222222222222";

const confirmRelease = (now = 642): WardFlowEvent => ({
  type: "CONFIRM_BED_RELEASE",
  role: "ward",
  now,
  releaseId: "derived-expected-AD-RPHS-05",
  actingUnitId: "rph-adult-secure",
});
const refreshRequest = (unitId: string, now = 642): WardFlowEvent => ({
  type: "REQUEST_CAPACITY_REFRESH",
  role: "coordinator",
  now,
  unitId,
});

function setUp(options: { checkpointEvery?: number; typedTextAllowed?: boolean } = {}) {
  const memory = createMemorySharedStateStore();
  const ids = [WORLD_A, WORLD_B];
  let clock = SERVER_NOW;
  const service = createSharedWorldService({
    store: memory.store,
    nowMs: () => clock,
    newWorldId: () => ids.shift() ?? "33333333-3333-4333-8333-333333333333",
    ...options,
  });
  return {
    memory,
    service,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

async function joinOk(service: ReturnType<typeof setUp>["service"], dayZeroMs = DAY_ZERO) {
  const result = await service.join({ dayZeroMs, stateVersion: WARD_FLOW_STORED_STATE_VERSION });
  if (result.kind !== "ok") throw new Error(`join failed: ${result.kind}`);
  return result.body;
}

describe("shared world service: event log", () => {
  it("creates one world per day with the seed at sequence 0 and the server's start time", async () => {
    const { service, memory } = setUp();
    const first = await joinOk(service);
    const second = await joinOk(service);
    expect(first.worldId).toBe(WORLD_A);
    expect(second.worldId).toBe(WORLD_A);
    expect(first.seq).toBe(0);
    expect(first.startedAtMs).toBe(SERVER_NOW);
    expect(first.dayZeroMs).toBe(DAY_ZERO);
    expect(first.typedTextAllowed).toBe(false);
    expect(first.state).toEqual(seedWardFlowStateAt(0));
    expect(memory.worldCount()).toBe(1);
    expect(memory.checkpointSeqs(WORLD_A)).toEqual([0]);
  });

  it("appends accepted events with consecutive sequence numbers and replays them on join", async () => {
    const { service, memory } = setUp();
    await joinOk(service);
    const one = await service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-a-0001",
      event: confirmRelease(),
    });
    const two = await service.append({
      worldId: WORLD_A,
      baseSeq: 1,
      eventId: "client-a-0002",
      event: refreshRequest("rph-adult-secure"),
    });
    expect(one).toEqual({ kind: "accepted", seq: 1, duplicate: false });
    expect(two).toEqual({ kind: "accepted", seq: 2, duplicate: false });
    const rows = memory.eventRows(WORLD_A);
    expect(rows.map((row) => [row.seq, row.eventId, row.typedText])).toEqual([
      [1, "client-a-0001", false],
      [2, "client-a-0002", false],
    ]);

    const rejoined = await joinOk(service);
    expect(rejoined.seq).toBe(2);
    let expected = seedWardFlowStateAt(0);
    for (const event of [confirmRelease(), refreshRequest("rph-adult-secure")])
      expected = applySharedEvent(expected, event).next;
    expect(rejoined.state).toEqual(expected);
    expect(rejoined.state.bedReleases.find((release) => release.id === "derived-expected-AD-RPHS-05")?.state).toBe(
      "confirmed",
    );
  });

  it("reports a conflict when the base sequence is behind and stores nothing", async () => {
    const { service, memory } = setUp();
    await joinOk(service);
    await service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-a-0001",
      event: refreshRequest("rph-adult-secure"),
    });
    const stale = await service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-b-0001",
      event: confirmRelease(),
    });
    expect(stale).toEqual({ kind: "conflict", headSeq: 1 });
    expect(memory.eventRows(WORLD_A)).toHaveLength(1);
  });

  it("refuses an event the reducer refuses, and never stores it", async () => {
    const { service, memory } = setUp();
    await joinOk(service);
    await service.append({ worldId: WORLD_A, baseSeq: 0, eventId: "client-a-0001", event: confirmRelease() });
    // The same release confirmed again: the reducer allows expected -> confirmed only.
    const again = await service.append({
      worldId: WORLD_A,
      baseSeq: 1,
      eventId: "client-b-0001",
      event: confirmRelease(),
    });
    expect(again).toEqual({ kind: "refused" });
    const unknownUnit = await service.append({
      worldId: WORLD_A,
      baseSeq: 1,
      eventId: "client-b-0002",
      event: refreshRequest("no-such-unit"),
    });
    expect(unknownUnit).toEqual({ kind: "refused" });
    expect(memory.eventRows(WORLD_A).map((row) => row.eventId)).toEqual(["client-a-0001"]);
  });

  it("treats a repeated event id as the same event, so a lost response can be retried", async () => {
    const { service, memory } = setUp();
    await joinOk(service);
    const first = await service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-a-0001",
      event: confirmRelease(),
    });
    const retry = await service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-a-0001",
      event: confirmRelease(),
    });
    expect(first).toEqual({ kind: "accepted", seq: 1, duplicate: false });
    expect(retry).toEqual({ kind: "accepted", seq: 1, duplicate: true });
    expect(memory.eventRows(WORLD_A)).toHaveLength(1);
  });

  it("does not send typed free text to the store unless typed text is allowed", async () => {
    const typedEscalation = {
      type: "RECORD_ESCALATION",
      role: "coordinator",
      now: 642,
    } as unknown as WardFlowEvent;
    const closed = setUp();
    await joinOk(closed.service);
    const refused = await closed.service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-a-0001",
      event: typedEscalation,
    });
    expect(refused).toEqual({ kind: "typed-text-not-shared" });
    expect(closed.memory.eventRows(WORLD_A)).toHaveLength(0);

    const open = setUp({ typedTextAllowed: true });
    const joined = await joinOk(open.service);
    expect(joined.typedTextAllowed).toBe(true);
    // Allowed through the gate, then judged by the reducer like any event (this one is incomplete).
    const judged = await open.service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-a-0001",
      event: typedEscalation,
    });
    expect(judged.kind).not.toBe("typed-text-not-shared");
  });

  it("rejects malformed input before the reducer sees it", async () => {
    const { service } = setUp();
    await joinOk(service);
    const bad = [
      { worldId: "not-a-uuid", baseSeq: 0, eventId: "client-a-0001", event: confirmRelease() },
      { worldId: WORLD_A, baseSeq: -1, eventId: "client-a-0001", event: confirmRelease() },
      { worldId: WORLD_A, baseSeq: 0, eventId: "bad id!", event: confirmRelease() },
      { worldId: WORLD_A, baseSeq: 0, eventId: "client-a-0001", event: { type: "NOT_AN_EVENT", role: "ward", now: 1 } },
      { worldId: WORLD_A, baseSeq: 0, eventId: "client-a-0001", event: { ...confirmRelease(), role: "admin" } },
      { worldId: WORLD_A, baseSeq: 0, eventId: "client-a-0001", event: { ...confirmRelease(), now: Number.NaN } },
    ];
    for (const input of bad) expect(await service.append(input)).toEqual({ kind: "bad-request" });
  });

  it("refuses a payload that makes the reducer throw rather than failing the request", async () => {
    const { service, memory } = setUp();
    await joinOk(service);
    const broken = {
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now: 642,
      configuration: null,
    } as unknown as WardFlowEvent;
    const result = await service.append({ worldId: WORLD_A, baseSeq: 0, eventId: "client-a-0001", event: broken });
    expect(result.kind).toBe("refused");
    expect(memory.eventRows(WORLD_A)).toHaveLength(0);
  });
});

describe("shared world service: worlds, days and other server instances", () => {
  it("starts a new world on a new day and tells a browser on the old one", async () => {
    const { service, advance } = setUp();
    await joinOk(service);
    advance(24 * 60 * 60 * 1000);
    const nextDay = await joinOk(service, DAY_ZERO + 24 * 60 * 60 * 1000);
    expect(nextDay.worldId).toBe(WORLD_B);
    expect(nextDay.seq).toBe(0);
    const stale = await service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-a-0001",
      event: confirmRelease(),
    });
    expect(stale).toEqual({ kind: "world-replaced", currentWorldId: WORLD_B });
    const polled = await service.eventsAfter({ worldId: WORLD_A, after: 0 });
    expect(polled).toEqual({ kind: "ok", body: { currentWorldId: WORLD_B, headSeq: 0, events: [], truncated: false } });
  });

  it("joins the same world from a browser a few time zones away", async () => {
    const { service } = setUp();
    await joinOk(service);
    const eastern = await joinOk(service, DAY_ZERO + SHARED_NEW_DAY_THRESHOLD_MS - 60_000);
    expect(eastern.worldId).toBe(WORLD_A);
  });

  it("refuses a day zero far from the server clock, and an older stored-state version", async () => {
    const { service } = setUp();
    expect(
      await service.join({
        dayZeroMs: DAY_ZERO - 3 * 24 * 60 * 60 * 1000,
        stateVersion: WARD_FLOW_STORED_STATE_VERSION,
      }),
    ).toEqual({
      kind: "bad-request",
    });
    expect(await service.join({ dayZeroMs: DAY_ZERO, stateVersion: WARD_FLOW_STORED_STATE_VERSION - 1 })).toEqual({
      kind: "version-mismatch",
    });
  });

  it("catches up on events another server instance appended, and loses the race honestly", async () => {
    const { service, memory } = setUp();
    await joinOk(service);
    await service.append({
      worldId: WORLD_A,
      baseSeq: 0,
      eventId: "client-a-0001",
      event: refreshRequest("rph-adult-secure"),
    });
    // Another instance writes seq 2 straight to the database.
    await memory.appendBehindTheServiceBack(WORLD_A, {
      seq: 2,
      eventId: "client-c-0001",
      event: confirmRelease(),
      typedText: false,
    });
    const behind = await service.append({
      worldId: WORLD_A,
      baseSeq: 1,
      eventId: "client-a-0002",
      event: refreshRequest("rph-adult-secure"),
    });
    expect(behind).toEqual({ kind: "conflict", headSeq: 2 });
    const polled = await service.eventsAfter({ worldId: WORLD_A, after: 1 });
    expect(polled.kind === "ok" && polled.body.events.map((record) => record.eventId)).toEqual(["client-c-0001"]);
    const caughtUp = await service.append({
      worldId: WORLD_A,
      baseSeq: 2,
      eventId: "client-a-0002",
      event: refreshRequest("rph-adult-secure"),
    });
    expect(caughtUp).toEqual({ kind: "accepted", seq: 3, duplicate: false });
  });

  it("writes checkpoints as the log grows and rebuilds a cold server from the latest one", async () => {
    const { service, memory } = setUp({ checkpointEvery: 2 });
    await joinOk(service);
    for (let seq = 0; seq < 5; seq += 1) {
      const result = await service.append({
        worldId: WORLD_A,
        baseSeq: seq,
        eventId: `client-a-${String(seq).padStart(4, "0")}`,
        event: refreshRequest("rph-adult-secure", 642 + seq),
      });
      expect(result.kind).toBe("accepted");
    }
    expect(memory.checkpointSeqs(WORLD_A)).toEqual([0, 2, 4]);
    const warm = await joinOk(service);
    const cold = createSharedWorldService({ store: memory.store, nowMs: () => SERVER_NOW });
    const coldJoin = await cold.join({ dayZeroMs: DAY_ZERO, stateVersion: WARD_FLOW_STORED_STATE_VERSION });
    expect(coldJoin.kind === "ok" && coldJoin.body.seq).toBe(5);
    expect(coldJoin.kind === "ok" && coldJoin.body.state).toEqual(warm.state);
    expect(warm.state.refreshRequests.length).toBe(seedWardFlowStateAt(0).refreshRequests.length + 5);
  });

  it("serialises concurrent appends in one process so exactly one wins each sequence", async () => {
    const { service, memory } = setUp();
    await joinOk(service);
    const results = await Promise.all(
      ["a", "b", "c"].map((client) =>
        service.append({
          worldId: WORLD_A,
          baseSeq: 0,
          eventId: `client-${client}-0001`,
          event: refreshRequest("rph-adult-secure"),
        }),
      ),
    );
    expect(results.filter((result) => result.kind === "accepted")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "conflict")).toHaveLength(2);
    expect(memory.eventRows(WORLD_A)).toHaveLength(1);
  });

  it("applies the schema once and retries it after a failure", async () => {
    const memory = createMemorySharedStateStore();
    let failures = 1;
    const flaky = {
      ...memory.store,
      migrate: async () => {
        if (failures-- > 0) throw new Error("database starting");
        await memory.store.migrate();
      },
    };
    const service = createSharedWorldService({ store: flaky, nowMs: () => SERVER_NOW, newWorldId: () => WORLD_A });
    await expect(service.join({ dayZeroMs: DAY_ZERO, stateVersion: WARD_FLOW_STORED_STATE_VERSION })).rejects.toThrow();
    await joinOk(service as ReturnType<typeof setUp>["service"]);
    await joinOk(service as ReturnType<typeof setUp>["service"]);
    expect(memory.migrationCalls()).toBe(1);
  });
});
