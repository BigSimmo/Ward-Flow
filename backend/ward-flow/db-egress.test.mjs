// @ts-check
// The limits audit (25 Oct 2026): the store read the whole board from the database on every save
// and refresh, which would use up Supabase's monthly data allowance in about a day. It now keeps the
// board it last read or saved and reads only what changed. Synthetic data only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

/**
 * A pool that counts the bytes of every row the database sends back, and can make the next COMMIT
 * fail after the transaction's writes, as a lost connection would.
 */
function countingPool(pool) {
  const meter = { bytes: 0, failCommit: false };
  const measure = (result) => {
    for (const row of result?.rows ?? []) meter.bytes += JSON.stringify(row).length;
    return result;
  };
  const wrap = (target) => ({
    query: async (sql, args) => {
      if (meter.failCommit && sql === "COMMIT") {
        meter.failCommit = false;
        await target.query("ROLLBACK");
        throw Object.assign(new Error("Connection terminated unexpectedly"), { code: "08006" });
      }
      return measure(await target.query(sql, args));
    },
  });
  return {
    meter,
    pool: {
      ...wrap(pool),
      connect: async () => {
        const client = await pool.connect();
        return { ...wrap(client), release: (error) => client.release(error) };
      },
    },
  };
}

test(
  "real PostgreSQL: saves and refreshes read only what changed, and stay exact across servers and failed saves",
  { skip: !url, timeout: 60_000 },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const raw = new Pool({ connectionString: url, max: 4 });
    const workspaceId = randomUUID();
    let at = new Date("2026-10-25T02:00:00Z");
    const clock = () => at;
    const { pool, meter } = countingPool(raw);
    const store = createWorkspaceStore(/** @type {any} */ (pool), { workspaceId, engine, clock });
    // A second server on the same database, and a fresh one that always reads everything.
    const other = createWorkspaceStore(raw, { workspaceId, engine, clock });
    const truth = async () => (await createWorkspaceStore(raw, { workspaceId, engine, clock }).read(actor)).payload;
    const actor = randomUUID();
    const refresh = (unitId) => ({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId });
    try {
      await migrate(raw);
      const first = await store.read(actor);
      const boardBytes = JSON.stringify(first.payload).length;
      const units = first.payload.state.units.map((unit) => unit.id);
      let revision = first.revision;

      // A new workspace is read in full once, by its first save.
      assert.equal((await store.command(actor, randomUUID(), revision, refresh(units[0]))).status, 200);
      revision += 1;
      // Ten saves, each followed by a full refresh, as a busy desk would.
      meter.bytes = 0;
      for (let step = 0; step < 10; step++) {
        at = new Date(at.getTime() + 60_000);
        assert.equal(
          (await store.command(actor, randomUUID(), revision, refresh(units[step % units.length]))).status,
          200,
        );
        revision += 1;
        assert.deepEqual((await store.read(actor)).payload, await truth());
      }
      // Before, each save and each refresh read the whole board: 20 boards. Now it is a small part
      // of one.
      assert.ok(
        meter.bytes < boardBytes / 4,
        `read ${meter.bytes} bytes for 20 requests on a ${boardBytes}-byte board`,
      );

      // Another server saves: this one reads only the changed records and sees the same board.
      at = new Date(at.getTime() + 60_000);
      assert.equal((await other.command(actor, randomUUID(), revision, refresh(units[0]))).status, 200);
      revision += 1;
      meter.bytes = 0;
      assert.deepEqual((await store.read(actor)).payload, await truth());
      assert.ok(meter.bytes < boardBytes / 2, `read ${meter.bytes} bytes after another server's save`);

      // A save whose commit is lost leaves nothing behind in the cache.
      const before = await truth();
      at = new Date(at.getTime() + 60_000);
      meter.failCommit = true;
      await assert.rejects(store.command(actor, randomUUID(), revision, refresh(units[1])));
      // Another writer commits distinct content at the failed candidate's exact revision/time,
      // before this process observes the rollback. It must not promote that failed candidate.
      assert.equal((await other.command(actor, randomUUID(), revision, refresh(units[0]))).status, 200);
      revision += 1;
      assert.notDeepEqual(await truth(), before);
      assert.deepEqual((await store.read(actor)).payload, await truth());
      assert.equal((await store.command(actor, randomUUID(), revision, refresh(units[1]))).status, 200);
      assert.deepEqual((await store.read(actor)).payload, await truth());
    } finally {
      await raw.end();
    }
  },
);

test(
  "real PostgreSQL: valid restored revisions replace warm bodies before reads and unrelated saves",
  { skip: !url },
  async (t) => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    try {
      await migrate(pool);
      for (const sameRevision of [false, true])
        for (const commandFirst of [false, true]) {
          await t.test(
            `${sameRevision ? "replacement stamp" : "older revision"}, ${commandFirst ? "locked save first" : "unlocked read first"}`,
            async () => {
              const workspaceId = randomUUID(),
                actor = randomUUID();
              let at = new Date("2026-11-05T02:00:00Z");
              const options = { workspaceId, engine, clock: () => at };
              const warm = createWorkspaceStore(pool, options);
              const first = await warm.read(actor);
              const older = (
                await pool.query("SELECT revision, payload, updated_at FROM ward_flow.workspaces WHERE id=$1", [
                  workspaceId,
                ])
              ).rows[0];
              const records = (
                await pool.query(
                  "SELECT collection, record_id, kind, ordinal, revision, body FROM ward_flow.workspace_records WHERE workspace_id=$1",
                  [workspaceId],
                )
              ).rows;
              const units = first.payload.state.units.map((unit) => unit.id);
              const refresh = (unitId) => ({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId });
              at = new Date(at.getTime() + 60_000);
              const admission = first.payload.state.admissions[0];
              assert.equal(
                (
                  await warm.command(actor, randomUUID(), first.revision, {
                    type: "SET_STEP_DOWN_CANDIDATE",
                    role: "coordinator",
                    admissionId: admission.id,
                    stepDownCandidate: !admission.stepDownCandidate,
                  })
                ).status,
                200,
              );
              // Also hold a future archive/count for this same generation, then restore it away.
              const closed = first.payload.state.movements.find((movement) => movement.closure);
              const archivedBody = { ...closed, id: `${closed.id}-cache-restore` };
              await pool.query(
                "INSERT INTO ward_flow.archived_records(workspace_id,world_generation,collection,record_id,closed_at,archived_revision,body) VALUES($1,$2,'movements',$3,0,3,$4)",
                [workspaceId, first.payload.state.worldGeneration, archivedBody.id, archivedBody],
              );
              await pool.query("UPDATE ward_flow.workspaces SET revision=3,updated_at=$2 WHERE id=$1", [
                workspaceId,
                at,
              ]);
              assert.notDeepEqual(
                (await warm.read(actor)).payload,
                first.payload,
                "warm a different, valid future body",
              );
              const view = await warm.viewer(actor, { bootstrap: true });
              assert.equal((await warm.read(actor)).archived, 1);
              assert.equal((await warm.archive(view)).archived, 1);
              const restoredRevision = sameRevision ? 3 : Number(older.revision);
              const restoredStamp = sameRevision ? new Date(at.getTime() + 1) : older.updated_at;
              const client = await pool.connect();
              try {
                await client.query("BEGIN");
                await client.query("SELECT id FROM ward_flow.workspaces WHERE id=$1 FOR UPDATE", [workspaceId]);
                await client.query("UPDATE ward_flow.workspaces SET revision=$2,payload=$3,updated_at=$4 WHERE id=$1", [
                  workspaceId,
                  restoredRevision,
                  older.payload,
                  restoredStamp,
                ]);
                await client.query("DELETE FROM ward_flow.archived_records WHERE workspace_id=$1", [workspaceId]);
                await client.query("DELETE FROM ward_flow.workspace_records WHERE workspace_id=$1", [workspaceId]);
                for (const record of records)
                  await client.query(
                    "INSERT INTO ward_flow.workspace_records(workspace_id,collection,record_id,kind,ordinal,revision,body) VALUES($1,$2,$3,$4,$5,$6,$7)",
                    [
                      workspaceId,
                      record.collection,
                      record.record_id,
                      record.kind,
                      record.ordinal,
                      record.revision,
                      record.body,
                    ],
                  );
                await client.query("COMMIT");
              } catch (error) {
                await client.query("ROLLBACK");
                throw error;
              } finally {
                client.release();
              }
              const truth = () => createWorkspaceStore(pool, options).read(actor);
              if (!commandFirst)
                assert.deepEqual(
                  (await warm.read(actor)).payload,
                  (await truth()).payload,
                  "restored body is authoritative",
                );
              // The save touches a different record, so a retained future body would contaminate its world.
              assert.equal((await warm.command(actor, randomUUID(), restoredRevision, refresh(units[1]))).status, 200);
              const actual = await warm.read(actor);
              assert.deepEqual(actual.payload, (await truth()).payload);
              const expected = engine.applyCommand(first.payload, refresh(units[1]), at).world;
              assert.deepEqual(
                actual.payload.state.admissions,
                first.payload.state.admissions,
                "unrelated save preserves restored bodies",
              );
              assert.deepEqual(actual.payload.state.refreshRequests, expected.state.refreshRequests);
              assert.equal(actual.archived, 0, "the count must not survive restoration");
              assert.equal((await warm.archive(view)).archived, 0, "held archive rows must not survive restoration");
            },
          );
        }
    } finally {
      await pool.end();
    }
  },
);
