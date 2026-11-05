// @ts-check
// Synthetic, isolated loopback PostgreSQL only; never a hosted migration run.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";

import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { MIGRATIONS, readMigration } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { planSave } from "./records.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

// Incident 4 Nov 2026: a process that read an invalid workspace kept its cached rows, so it answered
// 503 until a restart even after the rows were put right by hand (no revision bump). It must recover
// on the next request instead.
test(
  "real PostgreSQL: an invalid read is not cached, so hand-corrected rows recover without a restart",
  {
    skip: !url,
  },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_stale_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(/** @type {string} */ (url));
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: target.href, max: 2 });
    const at = new Date("2026-11-04T13:00:00Z");
    try {
      for (const migration of MIGRATIONS.filter((row) => row.version <= 14))
        await pool.query(await readMigration(migration));
      const workspaceId = randomUUID();
      const revision = 7;
      const plan = planSave([], engine.seedWorld(at), revision);
      await pool.query("INSERT INTO ward_flow.workspaces(id, revision, payload, updated_at) VALUES ($1,$2,$3,$4)", [
        workspaceId,
        revision,
        plan.core,
        at,
      ]);
      for (const part of plan.upserts)
        await pool.query(
          "INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [workspaceId, part.collection, part.recordId, part.kind, part.ordinal, part.revision, part.body],
        );
      const part = plan.upserts.find((row) => row.collection === "movements");
      assert.ok(part, "a seeded synthetic movement");
      // A hand edit in the SQL editor: the body changes, and no revision or updated_at moves.
      const handEdit = (body) =>
        pool.query(
          "UPDATE ward_flow.workspace_records SET body=$4 WHERE workspace_id=$1 AND collection=$2 AND record_id=$3",
          [workspaceId, part.collection, part.recordId, body],
        );
      await handEdit({ id: part.recordId });

      const actor = randomUUID();
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
      await assert.rejects(store.read(actor), /Stored workspace is incompatible/);
      // Still broken: the store keeps refusing rather than inventing a world.
      await assert.rejects(store.read(actor), /Stored workspace is incompatible/);

      await handEdit(part.body);
      const recovered = await store.read(actor);
      assert.equal(recovered.revision, revision);
      assert.ok(recovered.payload.state.movements.some((row) => row.id === part.recordId));
      const unchanged = await pool.query("SELECT revision FROM ward_flow.workspaces WHERE id=$1", [workspaceId]);
      assert.equal(Number(unchanged.rows[0].revision), revision, "recovery is a read, not a save");
    } finally {
      await pool.end();
      await dropTestDatabase(admin, database);
      await admin.end();
    }
  },
);
