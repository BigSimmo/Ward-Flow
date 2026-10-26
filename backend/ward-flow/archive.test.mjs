// @ts-check
// Migration 14: closed records older than 30 days leave the live workspace for an archive that
// History still reads (Josh, 25 Oct 2026). Synthetic data only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { WARN_WORLD_BYTES, createWorkspaceStore } from "./postgres.mjs";
import { planSave } from "./records.mjs";
import { STATEWIDE_VIEW } from "./viewer.test-support.mjs";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");
const MAX_WORLD_BYTES = 8_388_608;
const start = new Date("2026-10-25T00:00:00Z");
const monthLater = new Date(start.getTime() + 31 * 24 * 60 * 60_000);

/** The seed world padded past the size limit with copies of its closed movements and referrals. */
function overfullWorld(engine) {
  const world = engine.seedWorld(start);
  const closed = world.state.movements.filter((movement) => movement.closure);
  const referrals = new Map(world.state.referrals.map((referral) => [referral.id, referral]));
  const movements = [];
  const copied = [];
  // Sized from one round of copies, so the world is measured once rather than after every round.
  const round = JSON.stringify(closed).length + closed.length;
  const rounds = Math.ceil((MAX_WORLD_BYTES + 20_000 - JSON.stringify(world).length) / round) + 1;
  for (let copy = 0; copy < rounds; copy++)
    for (const movement of closed) {
      const referral = movement.referralId ? referrals.get(movement.referralId) : undefined;
      const copiedMovement = { ...movement, id: `${movement.id}-copy-${copy}` };
      if (referral) {
        copiedMovement.referralId = `${referral.id}-copy-${copy}`;
        copied.push({ ...referral, id: copiedMovement.referralId });
      }
      movements.push(copiedMovement);
    }
  world.state.movements = [...movements, ...world.state.movements];
  world.state.referrals = [...copied, ...world.state.referrals];
  assert.ok(JSON.stringify(world).length > MAX_WORLD_BYTES);
  return { world, padded: movements.length };
}

test("archiving: an engine world past the limit splits into a live world under the warning", async () => {
  const engine = await import("./dist/engine.mjs");
  const { world, padded } = overfullWorld(engine);
  assert.ok(engine.validWorld(JSON.parse(JSON.stringify(world))));
  assert.deepEqual(engine.archiveClosed(world, start).archived, [], "nothing is archived before 30 days");
  const { world: kept, archived } = engine.archiveClosed(world, monthLater);
  assert.ok(archived.length >= padded);
  assert.ok(JSON.stringify(kept).length < WARN_WORLD_BYTES);
  assert.ok(engine.validWorld(JSON.parse(JSON.stringify(kept))));
});

test(
  "real PostgreSQL: a workspace past the size limit archives on its next save, and History reads the archive",
  { skip: !url, timeout: 60_000 },
  async () => {
    const engine = await import("./dist/engine.mjs");
    // A database of its own: the overfull workspace would otherwise stay in the shared test
    // database, where other tests roll the schema back through it.
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_archive_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(/** @type {string} */ (url));
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: target.href, max: 2 });
    const workspaceId = randomUUID();
    try {
      await migrate(pool);
      // The overfull world written as the store writes rows. Revision 6: the next save is not one
      // of the every-20 checks, so only the size makes it archive.
      const { world, padded } = overfullWorld(engine);
      const plan = planSave([], world, 6);
      await pool.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 6, $2)", [
        workspaceId,
        plan.core,
      ]);
      await pool.query(
        "INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body) SELECT $1, r.collection, r.record_id, r.kind, r.ordinal, r.revision, r.body FROM jsonb_to_recordset($2::jsonb) AS r(collection text, record_id text, kind text, ordinal integer, revision bigint, body jsonb)",
        [
          workspaceId,
          JSON.stringify(
            plan.upserts.map((part) => ({
              collection: part.collection,
              record_id: part.recordId,
              kind: part.kind,
              ordinal: part.ordinal,
              revision: part.revision,
              body: part.body,
            })),
          ),
        ],
      );
      let at = monthLater;
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
      const actor = randomUUID();
      const before = await store.read(actor);
      assert.equal(before.archived, 0);
      assert.ok(JSON.stringify(before.payload).length > MAX_WORLD_BYTES);

      const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
      const saved = await store.command(actor, randomUUID(), 6, refresh);
      assert.equal(saved.status, 200, "the save past the limit is kept");
      const after = await store.read(actor);
      assert.equal(after.revision, 7);
      assert.ok(after.archived >= padded);
      assert.ok(JSON.stringify(after.payload).length < WARN_WORLD_BYTES);
      assert.ok(!after.payload.state.movements.some((movement) => movement.id.includes("-copy-")));

      // History reads every archived record back for the whole network.
      const archive = await store.archive({ ...STATEWIDE_VIEW, actorId: actor });
      assert.equal(archive.archived, after.archived);
      // The newest 5,000 are read; this world archived more than that.
      assert.equal(archive.records.length, Math.min(after.archived, 5000));
      const archivedIds = new Set(world.state.movements.filter((row) => row.closure).map((row) => row.id));
      for (const record of archive.records) assert.ok(archivedIds.has(record.body.id), record.body.id);
      // Audit PS-01: a desk holding the archive is sent only what was archived after it. Nothing
      // new has been archived, so the delta is empty and sums the same; a fresh store agrees.
      assert.equal(archive.through, 7);
      const delta = await store.archive({ ...STATEWIDE_VIEW, actorId: actor }, archive.through);
      assert.equal(delta.since, 7);
      assert.deepEqual(delta.records, []);
      assert.equal(delta.sum, archive.sum);
      if (after.archived > 5000) assert.equal(delta.floor?.length, 3, "a capped archive names its floor");
      const elsewhere = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
      assert.equal((await elsewhere.archive({ ...STATEWIDE_VIEW, actorId: actor })).sum, archive.sum);

      // A ward desk reads only what its own live rule would show it.
      const unitId = after.payload.state.units[0].id;
      const ward = await store.archive({
        ...STATEWIDE_VIEW,
        actorId: actor,
        access: { role: "ward", scope: { kind: "ward", unitIds: [unitId] } },
      });
      assert.ok(ward.records.length < archive.records.length);

      // Saves keep working, and an archived record is never written twice.
      at = new Date(monthLater.getTime() + 60_000);
      assert.equal((await store.command(actor, randomUUID(), 7, refresh)).status, 200);
      const { rows } = await pool.query(
        "SELECT count(*)::integer AS n, count(DISTINCT record_id)::integer AS ids FROM ward_flow.archived_records WHERE workspace_id=$1",
        [workspaceId],
      );
      assert.equal(rows[0].n, rows[0].ids);

      // GV-27: the move has its own audit row, naming each record it moved.
      const { rows: moves } = await pool.query(
        "SELECT actor_id, changes FROM ward_flow.audit WHERE workspace_id=$1 AND action='ARCHIVE_CLOSED_RECORDS' ORDER BY sequence",
        [workspaceId],
      );
      assert.ok(moves.length >= 1);
      assert.equal(moves[0].actor_id, actor);
      assert.equal(
        moves.reduce((sum, move) => sum + move.changes.archived.length, 0),
        rows[0].n,
        "every archived record is named once",
      );

      // GV-27: the rollback, run on this copy, puts every archived record back without loss.
      const archivedIdsBefore = (
        await pool.query("SELECT collection, record_id FROM ward_flow.archived_records WHERE workspace_id=$1", [
          workspaceId,
        ])
      ).rows.map((row) => `${row.collection}:${row.record_id}`);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const file of ["./infra/rollback-015-list-and-tv-views.sql", "./infra/rollback-014-archived-records.sql"])
          await client.query(await readFile(new URL(file, import.meta.url), "utf8"));
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      const { rows: restored } = await pool.query(
        "SELECT collection, record_id FROM ward_flow.workspace_records WHERE workspace_id=$1",
        [workspaceId],
      );
      const live = new Set(restored.map((row) => `${row.collection}:${row.record_id}`));
      for (const id of archivedIdsBefore) assert.ok(live.has(id), id);
    } finally {
      await pool.end();
      await dropTestDatabase(admin, database);
      await admin.end();
    }
  },
);
