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
  [null, [1, 2, 3, 4, 5, 6]],
  [1, [2, 3, 4, 5, 6]],
  [2, [3, 4, 5, 6]],
  [3, [4, 5, 6]],
  [4, [5, 6]],
  [5, [6]],
  [6, []],
]) {
  test(`migration runner advances ${from ?? "fresh"} to version 6 in order`, async () => {
    const db = database(from);
    await migrate(db.pool);
    assert.equal(db.current(), 6);
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
  for (const version of [0, 7, "5"]) {
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
