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
  [null, [1, 2, 3, 4]],
  [1, [2, 3, 4]],
  [2, [3, 4]],
  [3, [4]],
  [4, []],
]) {
  test(`migration runner advances ${from ?? "fresh"} to version 4 in order`, async () => {
    const db = database(from);
    await migrate(db.pool);
    assert.equal(db.current(), 4);
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
  for (const version of [0, 5, "4"]) {
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
