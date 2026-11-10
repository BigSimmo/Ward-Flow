// @ts-check
// M40 (master audit list, 10 Nov 2026): the restore drill as a repeatable, checked-in test.
// LOCAL OR CI POSTGRESQL ONLY, synthetic data only. It builds a ward_flow database, writes synthetic
// commands, takes the same `pg_dump -Fc` the operations runbook names, restores it with
// `pg_restore --exit-on-error` into an empty database, and checks: row counts, the migration
// ledger, triggers, functions and check constraints, grants, row-level security, the append-only
// tables, that a lost-response retry replays instead of applying twice (no duplicate audit), and
// that a new save and a stale-revision 409 behave as normal on the copy. It prints the timings so
// a dated drill record can quote them. It never touches a hosted database.
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";

const run = promisify(execFile);
const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

/** The pg_dump and pg_restore binaries; CI's Ubuntu runner has PostgreSQL client tools on PATH. */
const bin = (name) => (process.env.WARD_PG_BIN ? path.join(process.env.WARD_PG_BIN, name) : name);

/** Metadata only: counts, versions, flags, grants and hashes. Never record contents. */
async function snapshot(pool) {
  const { rows: tables } = await pool.query(
    "SELECT relname, relrowsecurity, coalesce(relacl::text, '') AS acl FROM pg_class WHERE relnamespace='ward_flow'::regnamespace AND relkind='r' ORDER BY relname",
  );
  const counts = {};
  for (const { relname } of tables)
    counts[relname] = (await pool.query(`SELECT count(*)::integer AS n FROM ward_flow.${relname}`)).rows[0].n;
  const one = async (sql) => (await pool.query(sql)).rows[0].n;
  return {
    counts,
    migrations: (await pool.query("SELECT version FROM ward_flow.migrations ORDER BY version")).rows.map(
      (row) => row.version,
    ),
    triggers: await one(
      "SELECT count(*)::integer AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='ward_flow'::regnamespace AND NOT t.tgisinternal",
    ),
    functions: await one("SELECT count(*)::integer AS n FROM pg_proc WHERE pronamespace='ward_flow'::regnamespace"),
    checks: await one(
      "SELECT count(*)::integer AS n FROM pg_constraint WHERE connamespace='ward_flow'::regnamespace AND contype='c'",
    ),
    views: await one(
      "SELECT count(*)::integer AS n FROM pg_class WHERE relnamespace='ward_flow'::regnamespace AND relkind='v'",
    ),
    rls: Object.fromEntries(tables.map((row) => [row.relname, row.relrowsecurity])),
    tableGrants: Object.fromEntries(tables.map((row) => [row.relname, row.acl])),
    columnGrants: (
      await pool.query(
        "SELECT c.relname || '.' || a.attname || '=' || a.attacl::text AS grant FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='ward_flow'::regnamespace AND a.attacl IS NOT NULL ORDER BY 1",
      )
    ).rows.map((row) => row.grant),
    auditHash: await one(
      "SELECT md5(coalesce(string_agg(to_jsonb(a)::text, '|' ORDER BY sequence), '')) AS n FROM ward_flow.audit a",
    ),
    commandHash: await one(
      "SELECT md5(coalesce(string_agg(to_jsonb(c)::text, '|' ORDER BY workspace_id, actor_id, command_id), '')) AS n FROM ward_flow.commands c",
    ),
    workspaceHash: await one(
      "SELECT md5(coalesce(string_agg(id::text || ':' || revision || ':' || md5(payload::text), '|' ORDER BY id), '')) AS n FROM ward_flow.workspaces",
    ),
  };
}

const duplicateAudit = async (pool) =>
  (
    await pool.query(
      "SELECT count(*)::integer AS n FROM (SELECT 1 FROM ward_flow.audit WHERE command_id IS NOT NULL GROUP BY workspace_id, actor_id, command_id HAVING count(*) > 1) d",
    )
  ).rows[0].n;

test(
  "real PostgreSQL: M40 restore drill: pg_dump -Fc then pg_restore brings back the same data, grants, locks and replay",
  { skip: !url, timeout: 120_000 },
  async (t) => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 2 });
    const id = randomUUID().replaceAll("-", "");
    const source = `wardflow_drill_src_${id}`;
    const target = `wardflow_drill_dst_${id}`;
    const urlFor = (database, role) => {
      const next = new URL(/** @type {string} */ (url));
      next.pathname = `/${database}`;
      return { connectionString: next.href, max: 2, ...(role && { options: `-c role=${role}` }) };
    };
    const pools = [];
    const pool = (database, role) => {
      const created = new Pool(urlFor(database, role));
      created.on("error", () => {});
      pools.push(created);
      return created;
    };
    const folder = await mkdtemp(path.join(tmpdir(), "ward-restore-drill-"));
    const dump = path.join(folder, "ward_flow.dump");
    const runtimeRoleSql = await readFile(new URL("./infra/postgres-runtime-role.sql", import.meta.url), "utf8");
    const at = new Date("2026-10-26T01:00:00Z");
    const workspaceId = randomUUID();
    const actor = "11111111-1111-4111-8111-111111111111";
    const refresh = (unitId) => ({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId });
    await admin.query(`CREATE DATABASE ${source}`);
    await admin.query(`CREATE DATABASE ${target}`);
    try {
      // 1. A live-like source: latest schema, runtime grants, synthetic saves through the runtime role.
      const owner = pool(source);
      await migrate(owner);
      await owner.query(runtimeRoleSql);
      const runtime = pool(source, "wardflow_backend");
      const store = createWorkspaceStore(runtime, { workspaceId, engine, clock: () => at });
      await store.ready();
      const seed = await store.read(actor);
      const units = seed.payload.state.units.map((unit) => unit.id).slice(0, 5);
      let revision = seed.revision;
      const sent = [];
      for (const unitId of units) {
        const commandId = randomUUID();
        const saved = await store.command(actor, commandId, revision, refresh(unitId));
        assert.equal(saved.status, 200, "the synthetic save must be accepted before the drill");
        sent.push({ commandId, revision, unitId });
        revision = saved.body.snapshot.revision;
      }
      const before = await snapshot(owner);
      assert.equal(before.migrations.at(-1), LATEST_MIGRATION);
      assert.equal(await duplicateAudit(owner), 0, "the source has no duplicate audit rows");

      // 2. Back up and restore exactly as the runbook says, timing each step.
      const started = performance.now();
      await run(bin("pg_dump"), ["-Fc", "-n", "ward_flow", "-f", dump, `--dbname=${urlFor(source).connectionString}`]);
      const dumped = performance.now();
      await run(bin("pg_restore"), ["--exit-on-error", `--dbname=${urlFor(target).connectionString}`, dump]);
      const restoredOwner = pool(target);
      // Daily backups and dumps do not carry role settings; re-run the grants and timeouts.
      await restoredOwner.query(runtimeRoleSql);
      const restored = performance.now();
      t.diagnostic(
        `M40 timings: dump ${Math.round(dumped - started)} ms, restore and grants ${Math.round(restored - dumped)} ms, total ${Math.round(restored - started)} ms`,
      );

      await t.test("every table, count, ledger, trigger, function, check, view, grant and hash matches", async () => {
        const after = await snapshot(restoredOwner);
        t.diagnostic(
          `M40 checked: ${Object.keys(after.counts).length} tables, ${Object.values(after.counts).reduce((a, b) => a + b, 0)} rows, ${after.triggers} triggers, ${after.functions} functions, ${after.checks} checks, ${after.columnGrants.length} column grants`,
        );
        assert.deepEqual(after, before);
        assert.ok(Object.values(after.rls).every(Boolean), "row-level security is on for every table");
      });

      await t.test("audit, record_access and break_glass still refuse UPDATE, DELETE and TRUNCATE", async () => {
        for (const table of ["audit", "record_access", "break_glass"])
          for (const statement of [
            `UPDATE ward_flow.${table} SET workspace_id=workspace_id WHERE false`,
            `DELETE FROM ward_flow.${table} WHERE false`,
            `TRUNCATE ward_flow.${table} CASCADE`,
          ])
            await assert.rejects(restoredOwner.query(statement), /append-only/, statement);
      });

      await t.test("the copy reads, replays a lost-response retry once, saves and refuses a stale save", async () => {
        const copy = createWorkspaceStore(pool(target, "wardflow_backend"), { workspaceId, engine, clock: () => at });
        await copy.ready();
        const read = await copy.read(actor);
        assert.equal(read.revision, revision, "the copy serves the same revision");
        const auditBefore = (await copy.audit()).length;
        const last = sent.at(-1);
        assert.ok(last);
        const replay = await copy.command(actor, last.commandId, last.revision, refresh(last.unitId));
        assert.equal(replay.status, 200);
        assert.equal(replay.body.replayed, true, "a retry after restore replays the stored receipt");
        assert.equal((await copy.audit()).length, auditBefore, "the replay adds no audit row");
        const urgency = (value) => ({
          type: "CHANGE_URGENCY",
          role: "coordinator",
          movementId: "WF-001",
          urgency: value,
          reason: "reassessed",
        });
        const fresh = await copy.command(actor, randomUUID(), revision, urgency(2));
        assert.equal(fresh.status, 200, "a new save works on the restored copy");
        // Another desk still holding the pre-save revision changes the same movement: a normal 409.
        const otherDesk = "22222222-2222-4222-8222-222222222222";
        await copy.read(otherDesk);
        const stale = await copy.command(otherDesk, randomUUID(), revision, urgency(3));
        assert.equal(stale.status, 409, "a save against the old revision is a normal conflict");
        assert.equal(await duplicateAudit(restoredOwner), 0, "no unexplained duplicate audit rows");
      });
    } finally {
      await Promise.all(pools.map((created) => created.end().catch(() => {})));
      await dropTestDatabase(admin, source);
      await dropTestDatabase(admin, target);
      await admin.end();
      await rm(folder, { recursive: true, force: true });
    }
  },
);
