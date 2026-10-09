import { DataType, newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_STORED_STATE_VERSION } from "../src/components/ward-management/ward-flow-storage-validation";
import { loadSharedMigrations } from "../src/components/ward-management/shared/server/migrations";
import { createSharedWorldService } from "../src/components/ward-management/shared/server/service";
import { createPgSharedStateStore, type PoolLike } from "../src/components/ward-management/shared/server/store";

/**
 * The Postgres store on `pg-mem`, an in-memory Postgres substitute: the real SQL migration and the
 * real queries, without a server. `pg_advisory_xact_lock` is not built into pg-mem, so it is
 * registered as a no-op; the real lock is only exercised against a real Postgres.
 */

const DAY_ZERO = Date.UTC(2026, 9, 8, 16, 0, 0);
const SERVER_NOW = DAY_ZERO + 9 * 60 * 60 * 1000;
const WORLD = "11111111-1111-4111-8111-111111111111";

function memoryPool() {
  // pg-mem refuses `CREATE TABLE IF NOT EXISTS` on an existing table unless its coverage check is
  // off: it reports the skipped column defaults as "unread". Real Postgres simply skips the table.
  const db = newDb({ noAstCoverageCheck: true });
  db.public.registerFunction({
    name: "pg_advisory_xact_lock",
    args: [DataType.integer],
    returns: DataType.text,
    implementation: () => "",
  });
  const { Pool } = db.adapters.createPg();
  return { db, pool: new Pool() as unknown as PoolLike };
}

const confirmRelease: WardFlowEvent = {
  type: "CONFIRM_BED_RELEASE",
  role: "ward",
  now: 642,
  releaseId: "derived-expected-AD-RPHS-05",
  actingUnitId: "rph-adult-secure",
};
const refresh: WardFlowEvent = {
  type: "REQUEST_CAPACITY_REFRESH",
  role: "coordinator",
  now: 643,
  unitId: "rph-adult-secure",
};

describe("Postgres shared-state store (pg-mem)", () => {
  it("applies the SQL migration idempotently and records it once", async () => {
    const { db, pool } = memoryPool();
    const store = createPgSharedStateStore(pool, loadSharedMigrations());
    await store.migrate();
    await store.migrate();
    const applied = db.public.many("SELECT name FROM ward_flow_shared_migrations");
    expect(applied).toEqual([{ name: "001_shared_state.sql" }]);
    // Re-running the file itself also changes nothing: every statement is IF NOT EXISTS.
    db.public.none(loadSharedMigrations()[0]!.sql);
  });

  it("stores the world, the seed checkpoint and accepted events, and refuses taken keys", async () => {
    const { db, pool } = memoryPool();
    const store = createPgSharedStateStore(pool, loadSharedMigrations());
    await store.migrate();
    const world = {
      worldId: WORLD,
      stateVersion: WARD_FLOW_STORED_STATE_VERSION,
      dayZeroMs: DAY_ZERO,
      startedAtMs: SERVER_NOW,
    };
    const seed = seedWardFlowStateAt(0);
    expect(await store.createWorld(world, seed)).toEqual(world);
    // The same day again returns the existing world, not a second one.
    expect(await store.createWorld({ ...world, worldId: "22222222-2222-4222-8222-222222222222" }, seed)).toEqual(world);
    expect(await store.currentWorld(WARD_FLOW_STORED_STATE_VERSION)).toEqual(world);
    expect(await store.getWorld(WORLD)).toEqual(world);
    const checkpoint = await store.latestCheckpoint(WORLD);
    expect(checkpoint?.seq).toBe(0);
    expect(checkpoint?.state).toEqual(seed);

    expect(
      await store.appendEvent(WORLD, { seq: 1, eventId: "client-a-0001", event: confirmRelease, typedText: false }),
    ).toBe("appended");
    expect(await store.appendEvent(WORLD, { seq: 1, eventId: "client-b-0001", event: refresh, typedText: false })).toBe(
      "seq-taken",
    );
    expect(await store.appendEvent(WORLD, { seq: 2, eventId: "client-a-0001", event: refresh, typedText: false })).toBe(
      "duplicate-event",
    );
    expect(await store.headSeq(WORLD)).toBe(1);
    expect(await store.findEventSeq(WORLD, "client-a-0001")).toBe(1);
    expect(await store.eventsAfter(WORLD, 0, 10)).toEqual([
      { seq: 1, eventId: "client-a-0001", event: confirmRelease },
    ]);

    const rows = db.public.many(
      "SELECT event_type, role, board_at, typed_text, classification FROM ward_flow_shared_events",
    );
    expect(rows).toEqual([
      {
        event_type: "CONFIRM_BED_RELEASE",
        role: "ward",
        board_at: 642,
        typed_text: false,
        classification: "synthetic",
      },
    ]);
  });

  it("runs the whole service on the Postgres store: save, reload in a new process, conflict", async () => {
    const { pool } = memoryPool();
    const service = createSharedWorldService({
      store: createPgSharedStateStore(pool, loadSharedMigrations()),
      nowMs: () => SERVER_NOW,
      newWorldId: () => WORLD,
    });
    const joined = await service.join({ dayZeroMs: DAY_ZERO, stateVersion: WARD_FLOW_STORED_STATE_VERSION });
    expect(joined.kind).toBe("ok");
    expect(
      await service.append({ worldId: WORLD, baseSeq: 0, eventId: "client-a-0001", event: confirmRelease }),
    ).toEqual({
      kind: "accepted",
      seq: 1,
      duplicate: false,
    });
    expect(await service.append({ worldId: WORLD, baseSeq: 0, eventId: "client-b-0001", event: refresh })).toEqual({
      kind: "conflict",
      headSeq: 1,
    });
    expect(
      await service.append({ worldId: WORLD, baseSeq: 1, eventId: "client-b-0002", event: confirmRelease }),
    ).toEqual({
      kind: "refused",
    });

    // A second service on the same database stands in for a restarted server: it reloads from
    // the checkpoint and the log.
    const restarted = createSharedWorldService({
      store: createPgSharedStateStore(pool, loadSharedMigrations()),
      nowMs: () => SERVER_NOW,
    });
    const reloaded = await restarted.join({ dayZeroMs: DAY_ZERO, stateVersion: WARD_FLOW_STORED_STATE_VERSION });
    if (reloaded.kind !== "ok") throw new Error("reload failed");
    expect(reloaded.body.seq).toBe(1);
    expect(reloaded.body.state.bedReleases.find((release) => release.id === "derived-expected-AD-RPHS-05")?.state).toBe(
      "confirmed",
    );
  });
});
