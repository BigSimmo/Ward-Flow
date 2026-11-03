// @ts-check
// Synthetic, isolated loopback PostgreSQL only; never a hosted migration run.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { MIGRATIONS, readMigration } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { planSave } from "./records.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

test("real PostgreSQL: archive rollback refreshes warm readers and old polls atomically", { skip: !url }, async () => {
  const engine = await import("./dist/engine.mjs");
  const admin = new Pool({ connectionString: url, max: 1 });
  const database = `wardflow_rollback_${randomUUID().replaceAll("-", "")}`;
  const target = new URL(/** @type {string} */ (url));
  target.pathname = `/${database}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = new Pool({ connectionString: target.href, max: 2 });
  const at = new Date("2026-10-25T00:00:00Z");
  try {
    for (const migration of MIGRATIONS.filter((row) => row.version <= 14))
      await pool.query(await readMigration(migration));
    const world = engine.seedWorld(at);
    world.state.worldGeneration = 3;
    const closed = world.state.movements.find((movement) => movement.closure);
    assert.ok(closed, "a seeded closed synthetic movement");
    const copy = { ...closed, id: `${closed.id}-rollback` };
    if (closed.referralId) {
      const referral = world.state.referrals.find((row) => row.id === closed.referralId);
      assert.ok(referral);
      copy.referralId = `${referral.id}-rollback`;
      world.state.referrals.push({ ...referral, id: copy.referralId });
    }
    world.state.movements.push(copy);
    const later = new Date(at.getTime() + 31 * 24 * 60 * 60_000);
    const archived = engine.archiveClosed(world, later);
    assert.ok(archived.archived.some((record) => record.id === copy.id));
    assert.ok(engine.validWorld(archived.world));
    const workspaceId = randomUUID();
    const untouchedId = randomUUID();
    const initialRevision = 7;
    const plan = planSave([], archived.world, initialRevision);
    for (const id of [workspaceId, untouchedId]) {
      await pool.query("INSERT INTO ward_flow.workspaces(id, revision, payload, updated_at) VALUES ($1,$2,$3,$4)", [
        id,
        initialRevision,
        plan.core,
        at,
      ]);
      for (const part of plan.upserts)
        await pool.query(
          "INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [id, part.collection, part.recordId, part.kind, part.ordinal, part.revision, part.body],
        );
    }
    const insertArchive = (record, generation) =>
      pool.query(
        "INSERT INTO ward_flow.archived_records(workspace_id, world_generation, collection, record_id, closed_at, archived_revision, body) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [workspaceId, generation, record.collection, record.id, record.closedAt, initialRevision, record.body],
      );
    for (const record of archived.archived) await insertArchive(record, world.state.worldGeneration);
    const old = { ...copy, id: `${copy.id}-older-generation` };
    await insertArchive({ collection: "movements", id: old.id, closedAt: 0, body: old }, 2);
    // An older archived copy must never replace the currently live record with that id.
    const live = archived.world.state.movements[0];
    await insertArchive(
      { collection: "movements", id: live.id, closedAt: 0, body: { ...live, flaggedUrgent: !live.flaggedUrgent } },
      world.state.worldGeneration,
    );
    const actor = randomUUID();
    const warm = createWorkspaceStore(pool, { workspaceId, engine, clock: () => later });
    const before = await warm.read(actor);
    assert.equal(before.revision, initialRevision);
    assert.ok(!before.payload.state.movements.some((row) => row.id === copy.id));
    const sql = await readFile(new URL("./infra/rollback-014-archived-records.sql", import.meta.url), "utf8");
    const client = await pool.connect();
    const late = { ...copy, id: `${copy.id}-concurrent` };
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("ROLLBACK");
      const rolledBack = await pool.query("SELECT revision FROM ward_flow.workspaces WHERE id=$1", [workspaceId]);
      assert.equal(Number(rolledBack.rows[0].revision), initialRevision);
      assert.ok((await pool.query("SELECT count(*)::int AS n FROM ward_flow.archived_records")).rows[0].n > 0);
      // A runtime archive writer holds the workspace while rollback begins. Its archived row
      // must be included after it commits, rather than dropped from an older statement snapshot.
      const writer = await pool.connect();
      try {
        await writer.query("BEGIN");
        await writer.query("UPDATE ward_flow.workspaces SET revision=revision+1 WHERE id=$1", [workspaceId]);
        const pid = (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
        await client.query("BEGIN");
        const pending = client.query(sql);
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const activity = await admin.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [pid]);
          if (activity.rows[0]?.wait_event_type === "Lock") {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(waiting, "rollback reached the concurrent writer's lock");
        await writer.query(
          "INSERT INTO ward_flow.archived_records(workspace_id, world_generation, collection, record_id, closed_at, archived_revision, body) VALUES ($1,3,'movements',$2,0,$3,$4)",
          [workspaceId, late.id, initialRevision + 1, late],
        );
        await writer.query("COMMIT");
        await pending;
        await client.query("COMMIT");
      } finally {
        await writer.query("ROLLBACK");
        writer.release();
      }
    } finally {
      client.release();
    }
    const after = await warm.read(actor);
    const cold = await createWorkspaceStore(pool, { workspaceId, engine, clock: () => later }).read(actor);
    const ids = (snapshot) => snapshot.payload.state.movements.map((row) => row.id).sort();
    assert.deepEqual(ids(after), ids(cold), "warm and cold readers must see the same restored records");
    assert.ok(ids(after).includes(copy.id));
    assert.ok(ids(after).includes(late.id), "the concurrent writer's archived record must also be restored");
    assert.ok(!ids(after).includes(old.id), "another generation stays excluded");
    const kept = await pool.query(
      "SELECT body FROM ward_flow.workspace_records WHERE workspace_id=$1 AND collection='movements' AND record_id=$2",
      [workspaceId, live.id],
    );
    assert.deepEqual(kept.rows[0].body, JSON.parse(JSON.stringify(live)));
    assert.equal(after.revision, initialRevision + 2);
    const polled = await warm.poll(actor, initialRevision);
    assert.equal(polled.notModified, false, "an old revision must receive a fresh snapshot");
    const restoredRows = await pool.query(
      "SELECT revision FROM ward_flow.workspace_records WHERE workspace_id=$1 AND record_id=$2",
      [workspaceId, copy.id],
    );
    assert.equal(Number(restoredRows.rows[0].revision), initialRevision + 2);
    const stamps = await pool.query("SELECT id, revision, updated_at FROM ward_flow.workspaces ORDER BY id");
    assert.equal(Number(stamps.rows.find((row) => row.id === untouchedId).revision), initialRevision);
    assert.equal(stamps.rows.find((row) => row.id === untouchedId).updated_at.getTime(), at.getTime());
    assert.ok(stamps.rows.find((row) => row.id === workspaceId).updated_at.getTime() > at.getTime());
  } finally {
    await pool.end();
    await dropTestDatabase(admin, database);
    await admin.end();
  }
});
