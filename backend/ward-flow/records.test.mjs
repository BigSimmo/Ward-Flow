// @ts-check
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { MIGRATIONS, RECORDS_MIGRATION, readMigration } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { assembleWorld, conflicts, markerKind, partKey, planSave, splitWorld } from "./records.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

const at = new Date("2026-10-07T10:00:00Z");
const urgency = (movementId, value) => ({
  type: "CHANGE_URGENCY",
  role: "coordinator",
  now: 600,
  movementId,
  urgency: value,
  reason: "reassessed",
});

/** The rows a save leaves behind, as the database would hold them. */
function stored(rows, plan) {
  const byKey = new Map(rows.map((row) => [partKey(row.collection, row.record_id), row]));
  for (const row of plan.deletes) byKey.delete(partKey(row.collection, row.recordId));
  for (const part of plan.upserts)
    byKey.set(partKey(part.collection, part.recordId), {
      collection: part.collection,
      record_id: part.recordId,
      kind: part.kind,
      ordinal: part.ordinal,
      revision: part.revision,
      body: part.body,
    });
  return [...byKey.values()];
}

test("a world split into rows and put back together is the same world", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const plan = planSave([], world, 1);
  assert.deepEqual(assembleWorld(plan.core, stored([], plan)), world);
  assert.equal(plan.deletes.length, 0);
  // The workspace row keeps only the small fields and a marker for each list or map.
  for (const [field, value] of Object.entries(plan.core.state)) {
    const original = world.state[field];
    if (original && typeof original === "object") assert.ok(markerKind(value), field);
    else assert.equal(value, original);
  }
  assert.ok(JSON.stringify(plan.core).length < 2_000);
  // Referrals, beds (wards) and movements are one row each, keyed by their own id.
  const keys = new Set(plan.upserts.map((part) => partKey(part.collection, part.recordId)));
  for (const field of ["referrals", "units", "movements"])
    for (const record of world.state[field]) assert.ok(keys.has(partKey(field, record.id)), `${field} ${record.id}`);
});

test("a save writes only the records it changed, and each keeps the revision its content last changed at", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const rows = stored([], planSave([], world, 1));
  const applied = engine.applyCommand(world, urgency("WF-001", 2), at);
  assert.equal(applied.outcome, "accepted");
  const plan = planSave(rows, applied.world, 2);
  const changed = plan.upserts
    .filter((part) => part.revision === 2)
    .map((part) => partKey(part.collection, part.recordId));
  assert.ok(changed.includes("movements/WF-001"));
  assert.ok(!changed.some((key) => key.startsWith("movements/") && key !== "movements/WF-001"));
  assert.ok(plan.upserts.length < 10, "an urgency change rewrites a handful of rows, not the workspace");
  const next = stored(rows, plan);
  assert.deepEqual(assembleWorld(plan.core, next), applied.world);
  assert.equal(next.find((row) => row.record_id === "WF-002").revision, 1);
  // A list entry removed by a save is removed from the rows too.
  const fewer = structuredClone(applied.world);
  const gone = fewer.state.leaveBeds.pop();
  assert.deepEqual(planSave(next, fewer, 3).deletes, [{ collection: "leaveBeds", recordId: gone.id }]);
});

test("lists without their own ids are kept by position, so adding to one never clashes", () => {
  const world = { version: 1, state: { log: [{ at: 1 }], tags: ["a", "b"], same: [{ id: "x" }, { id: "x" }] } };
  const { parts } = splitWorld(world);
  assert.deepEqual(
    [...parts.values()].map((part) => [part.collection, part.recordId, part.kind]),
    [
      ["log", "0", "index"],
      ["tags", "0", "index"],
      ["tags", "1", "index"],
      ["same", "0", "index"],
      ["same", "1", "index"],
    ],
  );
  const rows = stored([], planSave([], world, 1));
  const added = { ...world, state: { ...world.state, log: [{ at: 1 }, { at: 2 }] } };
  const plan = planSave(rows, added, 2);
  assert.deepEqual(
    plan.upserts.map((part) => [part.recordId, part.revision]),
    [["1", 2]],
  );
});

test("a save against an older revision clashes only with someone else's change to the same record", async () => {
  const engine = await import("./dist/engine.mjs");
  const base = engine.seedWorld(at);
  const rows = stored([], planSave([], base, 1));
  const first = engine.applyCommand(base, urgency("WF-001", 2), at);
  const plan = planSave(rows, first.world, 2);
  const now = stored(rows, plan);
  const check = (event) => {
    const applied = engine.applyCommand(first.world, event, at);
    return conflicts({
      stored: now,
      core: plan.core,
      before: first.world,
      after: applied.outcome === "accepted" ? applied.world : first.world,
      event,
      expectedRevision: 1,
      priorRevision: 2,
    });
  };
  assert.equal(check(urgency("WF-002", 1)), false, "another movement");
  assert.equal(check(urgency("WF-001", 3)), true, "the same movement");
  // Naming a ward nobody changed is fine.
  assert.equal(check({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" }), false);
  // A command sent against the latest revision never clashes.
  assert.equal(
    conflicts({
      stored: now,
      core: plan.core,
      before: first.world,
      after: first.world,
      event: urgency("WF-001", 3),
      expectedRevision: 2,
      priorRevision: 2,
    }),
    false,
  );
  // A field still kept whole (from before 10) has no revision of its own: any change since counts.
  const whole = { ...plan.core, state: { ...plan.core.state, movements: first.world.state.movements } };
  const applied = engine.applyCommand(first.world, urgency("WF-002", 1), at);
  assert.equal(
    conflicts({
      stored: now,
      core: whole,
      before: first.world,
      after: applied.world,
      event: urgency("WF-002", 1),
      expectedRevision: 1,
      priorRevision: 2,
    }),
    true,
  );
});

test(
  "real PostgreSQL: migration 10 moves an existing workspace into rows exactly as the store would, and its rollback restores it",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_records_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(url);
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: target.href, max: 2 });
    try {
      // A database at 9 with a workspace saved as one record, a few saves in.
      for (const migration of MIGRATIONS.filter((row) => row.version < RECORDS_MIGRATION))
        await pool.query(await readMigration(migration));
      const workspaceId = randomUUID();
      const world = engine.applyCommand(engine.seedWorld(at), urgency("WF-001", 2), at).world;
      await pool.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 4, $2)", [
        workspaceId,
        world,
      ]);
      await migrate(pool);
      const { rows: workspace } = await pool.query("SELECT revision, payload FROM ward_flow.workspaces WHERE id=$1", [
        workspaceId,
      ]);
      const { rows } = await pool.query(
        "SELECT collection, record_id, kind, ordinal, revision, body FROM ward_flow.workspace_records WHERE workspace_id=$1",
        [workspaceId],
      );
      const expected = planSave([], world, 4);
      assert.equal(workspace[0].revision, "4");
      assert.deepEqual(workspace[0].payload, expected.core);
      const shape = (list) =>
        list
          .map((row) => JSON.stringify([row.collection, row.record_id, row.kind, row.ordinal, Number(row.revision)]))
          .sort();
      assert.deepEqual(shape(rows), shape(expected.upserts.map((part) => ({ ...part, record_id: part.recordId }))));
      assert.deepEqual(assembleWorld(workspace[0].payload, rows), world);

      // The store reads the moved workspace as the same world and saves on top of it.
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
      assert.deepEqual((await store.read(randomUUID())).payload, world);
      const actor = randomUUID();
      assert.equal((await store.command(actor, randomUUID(), 4, urgency("WF-002", 1))).status, 200);
      assert.equal((await store.command(actor, randomUUID(), 4, urgency("WF-003", 2))).status, 200);
      assert.equal((await store.command(actor, randomUUID(), 4, urgency("WF-002", 3))).status, 409);
      const saved = (await store.read(actor)).payload;
      assert.deepEqual(
        ["WF-001", "WF-002", "WF-003"].map((id) => saved.state.movements.find((row) => row.id === id).urgency),
        [2, 1, 2],
      );

      // The rollback puts every record back in the workspace row, in order.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          await readFile(new URL("./infra/rollback-010-workspace-records.sql", import.meta.url), "utf8"),
        );
        await client.query("COMMIT");
      } finally {
        client.release();
      }
      const { rows: after } = await pool.query("SELECT payload FROM ward_flow.workspaces WHERE id=$1", [workspaceId]);
      assert.deepEqual(after[0].payload, saved);
      assert.ok(engine.validWorld(after[0].payload));
      // And migrating again moves it back into rows unchanged.
      await migrate(pool);
      assert.deepEqual((await createWorkspaceStore(pool, { workspaceId, engine }).read(actor)).payload, saved);
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await admin.end();
    }
  },
);
