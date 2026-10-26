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
      assert.deepEqual((await store.read(actor)).payload, before);
      assert.equal((await store.command(actor, randomUUID(), revision, refresh(units[1]))).status, 200);
      assert.deepEqual((await store.read(actor)).payload, await truth());
    } finally {
      await raw.end();
    }
  },
);
