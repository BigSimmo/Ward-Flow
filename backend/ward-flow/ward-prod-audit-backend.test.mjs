// @ts-check
// Production audit 24 Oct (BE-04, DB-02, DB-03): settings that used to fail silently, and the
// migration CLIs committing schema and runtime grants together.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readConfig } from "./config.mjs";
import { readPushConfig } from "./push.mjs";
import { migrate } from "./migrate.mjs";
import { migratePortablePostgres } from "./migrate-postgres.mjs";
import { migrateSupabasePostgres } from "./migrate-supabase.mjs";
import { APPROVED_SUPABASE_PROJECT, APPROVED_SUPABASE_URL } from "./supabase-config.mjs";

const environment = {
  WARD_COORDINATOR_USER_IDS: "22222222-2222-4222-8222-222222222222",
  WARD_SUPABASE_PROJECT_REF: APPROVED_SUPABASE_PROJECT,
  WARD_SUPABASE_URL: APPROVED_SUPABASE_URL,
  WARD_SUPABASE_PUBLISHABLE_KEY: ["sb", "publishable", "synthetic_offline_fixture"].join("_"),
};

test("BE-04: a partial VAPID key set keeps push off and warns once, without values", () => {
  const silent = [];
  assert.equal(
    readPushConfig({}, (event) => silent.push(event)),
    null,
  );
  assert.equal(
    readPushConfig({ WARD_FLOW_VAPID_SUBJECT: "  " }, (event) => silent.push(event)),
    null,
  );
  assert.deepEqual(silent, []);
  for (const partial of [
    { WARD_FLOW_VAPID_PUBLIC_KEY: "synthetic-public" },
    { WARD_FLOW_VAPID_PRIVATE_KEY: "synthetic-private" },
    { WARD_FLOW_VAPID_SUBJECT: "mailto:ward-flow-demo@example.org" },
    { WARD_FLOW_VAPID_PUBLIC_KEY: "synthetic-public", WARD_FLOW_VAPID_PRIVATE_KEY: "synthetic-private" },
  ]) {
    const events = [];
    assert.equal(
      readPushConfig(partial, (event) => events.push(event)),
      null,
    );
    assert.deepEqual(events, [
      { event: "ward_backend_config_warning", setting: "WARD_FLOW_VAPID", outcome: "push_off" },
    ]);
    assert.doesNotMatch(JSON.stringify(events), /synthetic|mailto/);
  }
});

test("BE-04: trusted proxy entries that are not * or a literal IP are ignored with one warning", () => {
  /** @param {string} [value] */
  const read = (value) => {
    const events = [];
    const env = value === undefined ? environment : { ...environment, WARD_TRUSTED_PROXY_ADDRESSES: value };
    return { addresses: readConfig(env, { log: (event) => events.push(event) }).trustedProxyAddresses, events };
  };
  const warning = {
    event: "ward_backend_config_warning",
    setting: "WARD_TRUSTED_PROXY_ADDRESSES",
    outcome: "entry_ignored",
  };
  for (const [value, kept] of [
    ["10.0.0.0/8", []],
    ["proxy.internal", []],
    ["10.0.0.1, railway, 10.0.0.0/8", ["10.0.0.1"]],
    ["*.example.org", []],
  ]) {
    const { addresses, events } = read(/** @type {string} */ (value));
    assert.deepEqual(addresses, kept);
    assert.deepEqual(events, [warning]);
    assert.doesNotMatch(JSON.stringify(events), /railway|proxy\.internal|10\.0/);
  }
  assert.deepEqual(read("*"), { addresses: ["*"], events: [] });
  assert.deepEqual(read(" 10.0.0.1, ::1 ,::ffff:10.0.0.2,"), {
    addresses: ["10.0.0.1", "::1", "10.0.0.2"],
    events: [],
  });
  assert.deepEqual(read(), { addresses: [], events: [] });
});

/**
 * A fake pool at migration 5 whose grant script can be made to fail.
 * @param {{ grantFailure?: Error | null, rollbackFailure?: Error | null }} [options]
 */
function fakePool({ grantFailure = null, rollbackFailure = null } = {}) {
  const queries = [];
  const releases = [];
  let connects = 0;
  const client = {
    query: async (/** @type {string} */ sql) => {
      queries.push(sql);
      if (sql.includes("Runtime role flags are unsafe") && grantFailure) throw grantFailure;
      if (sql === "ROLLBACK" && rollbackFailure) throw rollbackFailure;
      if (sql.includes("to_regclass")) return { rows: [{ relation: "ward_flow.migrations" }] };
      if (sql.includes("SELECT max(version)")) return { rows: [{ version: 5 }] };
      return { rows: [] };
    },
    release: (/** @type {unknown} */ error) => {
      releases.push(error);
    },
  };
  const pool = {
    query: async () => ({ rows: [{ owner: null }] }),
    connect: async () => {
      connects++;
      return client;
    },
  };
  return { pool, queries, releases, connects: () => connects };
}

test("DB-02: migrate() runs the afterMigrations step on the same client before COMMIT", async () => {
  const { pool, queries, connects } = fakePool();
  await migrate(pool, {
    afterMigrations: async (client) => {
      await client.query("-- synthetic grants");
    },
  });
  assert.equal(connects(), 1);
  assert.ok(queries.indexOf("-- synthetic grants") > queries.indexOf("SELECT pg_advisory_xact_lock(782322)"));
  assert.equal(queries.at(-1), "COMMIT");
  assert.equal(queries.at(-2), "-- synthetic grants");
});

for (const [name, run] of /** @type {const} */ ([
  ["Supabase", migrateSupabasePostgres],
  ["PostgreSQL", migratePortablePostgres],
])) {
  test(`DB-02: ${name} migration commits schema and runtime grants in one transaction`, async () => {
    const { pool, queries, connects } = fakePool();
    await run(pool);
    assert.equal(connects(), 1);
    assert.deepEqual(
      queries.filter((sql) => ["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)),
      ["BEGIN", "COMMIT"],
    );
    const grants = queries.findIndex((sql) => sql.includes("Runtime role flags are unsafe"));
    assert.ok(grants > 0 && grants < queries.indexOf("COMMIT"));
  });

  test(`DB-02: a ${name} grant refusal rolls back the migrations too, so nothing commits`, async () => {
    const refusal = new Error("synthetic grant refusal");
    const { pool, queries, releases } = fakePool({ grantFailure: refusal });
    await assert.rejects(run(pool), (error) => error === refusal);
    assert.ok(!queries.includes("COMMIT"));
    assert.equal(queries.at(-1), "ROLLBACK");
    assert.deepEqual(releases, [undefined]);
  });

  test(`DB-03: a ${name} failed ROLLBACK keeps the grant error and evicts the connection`, async () => {
    const refusal = new Error("synthetic grant refusal");
    const broken = new Error("synthetic connection lost");
    const { pool, releases } = fakePool({ grantFailure: refusal, rollbackFailure: broken });
    await assert.rejects(run(pool), (error) => error === refusal);
    assert.deepEqual(releases, [broken]);
  });
}
