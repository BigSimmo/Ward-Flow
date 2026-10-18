// @ts-check
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { migrate } from "./migrate.mjs";

function database(version) {
  let current = version;
  const queries = [];
  let released = false;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("to_regclass"))
        return { rows: [{ relation: current === null ? null : "ward_flow.migrations" }] };
      if (sql.includes("SELECT max(version)")) return { rows: [{ version: current }] };
      const inserted = /INSERT INTO ward_flow\.migrations\(version\) VALUES\((\d+)\)/.exec(sql);
      if (inserted) current = Number(inserted[1]);
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  return { pool: { connect: async () => client }, queries, current: () => current, released: () => released };
}

for (const [from, expected] of [
  [null, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  [1, [2, 3, 4, 5, 6, 7, 8, 9, 10]],
  [2, [3, 4, 5, 6, 7, 8, 9, 10]],
  [3, [4, 5, 6, 7, 8, 9, 10]],
  [4, [5, 6, 7, 8, 9, 10]],
  [5, [6, 7, 8, 9, 10]],
  [6, [7, 8, 9, 10]],
  [7, [8, 9, 10]],
  [8, [9, 10]],
  [9, [10]],
  [10, []],
]) {
  test(`migration runner advances ${from ?? "fresh"} to version 10 in order`, async () => {
    const db = database(from);
    await migrate(db.pool);
    assert.equal(db.current(), 10);
    assert.deepEqual(
      db.queries.flatMap((sql) => {
        const match = /INSERT INTO ward_flow\.migrations\(version\) VALUES\((\d+)\)/.exec(sql);
        return match ? [Number(match[1])] : [];
      }),
      expected,
    );
    assert.equal(db.queries[0], "BEGIN");
    assert.equal(db.queries[1], "SELECT pg_advisory_xact_lock(782322)");
    assert.equal(db.queries.at(-1), "COMMIT");
    assert.equal(db.released(), true);
  });
}

test("unknown migration versions fail closed and roll back", async () => {
  for (const version of [0, 11, "5"]) {
    const db = database(version);
    await assert.rejects(migrate(db.pool), /Unsupported database migration version/);
    assert.equal(db.queries.at(-1), "ROLLBACK");
    assert.equal(db.released(), true);
  }
});

test("migration 4 pins both existing trigger function search paths without replacing their bodies", async () => {
  const sql = await readFile(new URL("./migrations/004-trigger-search-path.sql", import.meta.url), "utf8");
  for (const fn of ["protect_audit", "protect_workspace_mode"])
    assert.match(sql, new RegExp(`ALTER FUNCTION ward_flow\\.${fn}\\(\\) SET search_path = pg_catalog, ward_flow;`));
  assert.match(sql, /INSERT INTO ward_flow\.migrations\(version\) VALUES\(4\);/);
  assert.doesNotMatch(sql, /CREATE (?:OR REPLACE )?FUNCTION|DROP FUNCTION/);
});

test("migration 5 adds composite active push subscription and chronological command receipt indexes", async () => {
  const sql = await readFile(new URL("./migrations/005-retention-and-indexes.sql", import.meta.url), "utf8");
  assert.match(
    sql,
    /CREATE INDEX commands_workspace_committed ON ward_flow\.commands\(workspace_id, committed_at DESC\);/,
  );
  assert.match(
    sql,
    /CREATE INDEX push_subscriptions_actor_active ON ward_flow\.push_subscriptions\(workspace_id, actor_id\) WHERE revoked_at IS NULL;/,
  );
  assert.match(sql, /INSERT INTO ward_flow\.migrations\(version\) VALUES\(5\);/);
});

test("migration 6 turns on row-level security for the runtime role only, and its rollback undoes exactly that", async () => {
  const sql = await readFile(new URL("./migrations/006-row-level-security.sql", import.meta.url), "utf8");
  const undo = await readFile(new URL("./infra/rollback-006-row-level-security.sql", import.meta.url), "utf8");
  const tables = [...sql.matchAll(/ALTER TABLE ward_flow\.(\w+) ENABLE ROW LEVEL SECURITY;/g)].map((m) => m[1]);
  assert.deepEqual(tables.sort(), [
    "audit",
    "commands",
    "migrations",
    "push_baselines",
    "push_deliveries",
    "push_subscriptions",
    "workspaces",
  ]);
  for (const table of tables) {
    assert.ok(
      sql.includes(
        `CREATE POLICY runtime_only ON ward_flow.${table} USING (current_user = 'wardflow_backend') WITH CHECK (current_user = 'wardflow_backend');`,
      ),
    );
    assert.ok(undo.includes(`DROP POLICY runtime_only ON ward_flow.${table};`));
    assert.ok(undo.includes(`ALTER TABLE ward_flow.${table} DISABLE ROW LEVEL SECURITY;`));
  }
  assert.doesNotMatch(sql, /FORCE ROW LEVEL SECURITY|BYPASSRLS|GRANT|REVOKE/);
  assert.match(sql, /INSERT INTO ward_flow\.migrations\(version\) VALUES\(6\);/);
  assert.match(undo, /DELETE FROM ward_flow\.migrations WHERE version = 6;/);
});

test("migration 7 refuses a live workspace before changing anything, and its rollback restores the old check", async () => {
  const sql = await readFile(new URL("./migrations/007-prototype-only.sql", import.meta.url), "utf8");
  const undo = await readFile(new URL("./infra/rollback-007-prototype-only.sql", import.meta.url), "utf8");
  assert.ok(sql.indexOf("RAISE EXCEPTION") < sql.indexOf("DROP CONSTRAINT"));
  assert.match(sql, /ADD CONSTRAINT workspaces_data_mode_check CHECK \(data_mode = 'prototype'\);/);
  assert.match(undo, /ADD CONSTRAINT workspaces_data_mode_check CHECK \(data_mode IN \('prototype', 'live'\)\);/);
  assert.match(undo, /DELETE FROM ward_flow\.migrations WHERE version = 7;/);
  assert.doesNotMatch(sql, /DROP TRIGGER|workspace_mode_unique|DELETE|UPDATE/);
});

test("migration 9 adds cover, requests and alerts by role without dropping anything, and its rollback ends cover first", async () => {
  const sql = await readFile(new URL("./migrations/009-access-cover-requests.sql", import.meta.url), "utf8");
  const undo = await readFile(new URL("./infra/rollback-009-access-cover-requests.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /DROP|DELETE/);
  assert.match(sql, /CREATE UNIQUE INDEX access_requests_one_open .* WHERE decision IS NULL;/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  // Every role held when 9 runs starts its "not used" count then, so none switches off at once.
  assert.match(sql, /UPDATE ward_flow\.memberships SET last_used_at = now\(\) WHERE revoked_at IS NULL;/);
  const endCover = undo.indexOf(
    "UPDATE ward_flow.memberships SET revoked_at = now(), revoked_by = granted_by WHERE kind = 'cover' AND revoked_at IS NULL;",
  );
  const dropKind = undo.indexOf("ALTER TABLE ward_flow.memberships DROP COLUMN kind;");
  assert.ok(endCover >= 0 && dropKind >= 0 && endCover < dropKind);
  assert.match(undo, /IS DISTINCT FROM 9/);
  assert.match(undo, /DELETE FROM ward_flow\.migrations WHERE version = 9;/);
});

test("migration 10 moves each list and map into its own rows, and its rollback puts them back first", async () => {
  const sql = await readFile(new URL("./migrations/010-workspace-records.sql", import.meta.url), "utf8");
  const undo = await readFile(new URL("./infra/rollback-010-workspace-records.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /DROP|DELETE|TRUNCATE/);
  assert.match(sql, /CREATE TABLE ward_flow\.workspace_records/);
  assert.match(sql, /ALTER TABLE ward_flow\.workspace_records ENABLE ROW LEVEL SECURITY;/);
  assert.match(sql, /REFERENCES ward_flow\.workspaces\(id, data_mode\)/);
  assert.match(undo, /IS DISTINCT FROM 10/);
  const restore = undo.indexOf("UPDATE ward_flow.workspaces w SET payload");
  const drop = undo.indexOf("DROP TABLE ward_flow.workspace_records;");
  assert.ok(restore >= 0 && drop >= 0 && restore < drop);
  assert.match(undo, /DELETE FROM ward_flow\.migrations WHERE version = 10;/);
});

test("one migration list: every SQL file is listed once, in order, and matches its checksum", async () => {
  const { readdir } = await import("node:fs/promises");
  const { LATEST_MIGRATION, MIGRATIONS, readMigration } = await import("./migrations.mjs");
  const files = (await readdir(new URL("./migrations/", import.meta.url))).filter((name) => name.endsWith(".sql"));
  assert.deepEqual(
    MIGRATIONS.map((migration) => migration.file),
    files.sort(),
  );
  assert.deepEqual(
    MIGRATIONS.map((migration) => migration.version),
    MIGRATIONS.map((_, index) => index + 1),
  );
  assert.equal(LATEST_MIGRATION, MIGRATIONS.length);
  for (const migration of MIGRATIONS)
    assert.match(await readMigration(migration), new RegExp(`VALUES\\(${migration.version}\\);`));
});

test("a migration file that no longer matches its checksum is refused before any SQL runs", async () => {
  const { MIGRATIONS, readMigration } = await import("./migrations.mjs");
  await assert.rejects(readMigration({ ...MIGRATIONS[0], sha256: "0".repeat(64) }), /checksum mismatch/);
});

for (const rollbackFails of [false, true]) {
  test(`migration failure keeps its original cause when rollback ${rollbackFails ? "fails" : "succeeds"}`, async () => {
    const original = Object.assign(new Error("synthetic migration failure"), { code: "42P01" });
    const rollback = Object.assign(new Error("synthetic connection failure"), { code: "ECONNRESET" });
    const queries = [];
    const releases = [];
    const client = {
      async query(sql) {
        queries.push(sql);
        if (sql === "ROLLBACK") {
          if (rollbackFails) throw rollback;
          return { rows: [] };
        }
        if (sql === "BEGIN") return { rows: [] };
        throw original;
      },
      release(error) {
        releases.push(error);
      },
    };
    await assert.rejects(migrate({ connect: async () => client }), (error) => error === original);
    assert.deepEqual(queries, ["BEGIN", "SELECT pg_advisory_xact_lock(782322)", "ROLLBACK"]);
    assert.deepEqual(releases, [rollbackFails ? rollback : undefined]);
  });
}

test("pruneReceipts refuses invalid retention windows and prunes expired command receipts in 5,000-row batches per workspace", async () => {
  const { RECEIPT_RETENTION_DAYS, pruneReceipts } = await import("./prune-receipts.mjs");
  assert.equal(RECEIPT_RETENTION_DAYS, 7);

  for (const invalid of [0, -1, 1.5, Number.NaN, "7"]) {
    await assert.rejects(
      pruneReceipts({ query: async () => ({ rows: [] }) }, { days: /** @type {any} */ (invalid) }),
      /Invalid receipt retention/,
    );
  }

  const calls = [];
  const counts = [5_000, 120, 0];
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql === "SELECT id FROM ward_flow.workspaces") {
        return { rows: [{ id: "ws-alpha" }, { id: "ws-beta" }] };
      }
      return { rowCount: counts.shift() ?? 0, rows: [] };
    },
  };

  const removed = await pruneReceipts(pool, { days: 14 });
  assert.equal(removed, 5_120);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[1]?.params, ["ws-alpha", 14, 5_000]);
  assert.deepEqual(calls[2]?.params, ["ws-alpha", 14, 5_000]);
  assert.deepEqual(calls[3]?.params, ["ws-beta", 14, 5_000]);
  const deletionCalls = calls.slice(1);
  for (const call of deletionCalls) {
    assert.match(call.sql, /DELETE FROM ward_flow\.commands WHERE ctid IN/);
    assert.match(call.sql, /workspace_id=\$1/);
    assert.match(call.sql, /committed_at < now\(\) - make_interval\(days => \$2\)/);
    assert.match(call.sql, /LIMIT \$3/);
    assert.deepEqual(call.params?.slice(1), [14, 5_000]);
  }
});
