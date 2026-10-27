// @ts-check
// Shared forecast history (proposal 013, migration 16). Counts and closed-list values only, kept
// per desk and per world generation. Synthetic data only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { forecastHistoryInput, forecastHistoryStore, forecastScopeKey } from "./forecast-history.mjs";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { createSharedHandler } from "./shared-http.mjs";
import { STATEWIDE_VIEW } from "./viewer.test-support.mjs";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

const snapshot = { day: 3, at: 3 * 1440 + 480, nowGap: -2, tomorrow: { low: -4, likely: -1, high: 2 } };
const reason = { day: 3, reason: "discharge_postponed", by: "coordinator", at: 3 * 1440 + 600 };

test("a forecast history body is checked: whole numbers, an ordered range and the closed lists", () => {
  assert.deepEqual(forecastHistoryInput({ generation: 0, snapshot }), { generation: 0, snapshot });
  assert.deepEqual(forecastHistoryInput({ generation: 2, reason }), { generation: 2, reason });
  // Extra fields are dropped, never stored.
  assert.deepEqual(forecastHistoryInput({ generation: 1, reason: { ...reason, note: "typed text" } }), {
    generation: 1,
    reason,
  });
  for (const body of [
    null,
    {},
    { generation: 1 },
    { generation: -1, snapshot },
    { generation: "1", snapshot },
    { generation: 1, snapshot: { ...snapshot, nowGap: 1.5 } },
    { generation: 1, snapshot: { ...snapshot, tomorrow: { low: 3, likely: 2, high: 4 } } },
    { generation: 1, snapshot: { ...snapshot, day: 2 ** 31 } },
    { generation: 1, reason: { ...reason, reason: "free text" } },
    { generation: 1, reason: { ...reason, by: "admin" } },
  ])
    assert.equal(forecastHistoryInput(body), null, JSON.stringify(body));
});

test("each desk's history is its own: the key is its role and place", () => {
  const statewide = forecastScopeKey(STATEWIDE_VIEW);
  const ward = forecastScopeKey({ access: { role: "ward", scope: { kind: "ward", unitIds: ["a"] } } });
  const otherWard = forecastScopeKey({ access: { role: "ward", scope: { kind: "ward", unitIds: ["b"] } } });
  assert.match(statewide, /^[0-9a-f]{64}$/);
  assert.notEqual(statewide, ward);
  assert.notEqual(ward, otherWard);
  assert.equal(forecastScopeKey({ ...STATEWIDE_VIEW, actorId: randomUUID() }), statewide, "not the person");
});

test("before migration 16 the store says the history is not shared, and touches no table", async () => {
  const queries = [];
  const store = forecastHistoryStore({
    pool: { query: async (sql) => (queries.push(sql), { rows: [] }) },
    workspaceId: randomUUID(),
    schemaVersion: async () => 15,
    worldGeneration: async () => 0,
    forgetVersionOnMissing: () => {},
  });
  assert.deepEqual(await store.forecastHistory(STATEWIDE_VIEW), { shared: false });
  assert.deepEqual(await store.recordForecast(STATEWIDE_VIEW, { generation: 0, snapshot }), {
    status: 200,
    body: { shared: false },
  });
  assert.deepEqual(queries, []);
});

test("the route answers a store without the history as not shared, checks the body, and passes the desk through", async () => {
  const actor = "11111111-1111-4111-8111-111111111111";
  const seen = [];
  const handler = (store) =>
    createSharedHandler({
      config: { coordinatorIds: [actor], workspaceId: "synthetic-workspace" },
      store: {
        viewer: async () => ({ ...STATEWIDE_VIEW, actorId: actor }),
        ...store,
      },
      authenticate: async () => actor,
      readBody: async (incoming) => incoming.json(),
      verifierUnavailable: Error,
      log: () => {},
    });
  const request = (method = "GET", body) =>
    new Request("https://example.test/v1/workspace/forecast-history", {
      method,
      headers: { authorization: "Bearer synthetic", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const older = handler({});
  assert.deepEqual(await (await older(request())).json(), { shared: false });

  const shared = handler({
    forecastHistory: async (view) => (seen.push(["read", view.access.role]), { shared: true, snapshots: [] }),
    recordForecast: async (view, input) => (seen.push(["record", input]), { status: 200, body: { shared: true } }),
  });
  assert.deepEqual(await (await shared(request())).json(), { shared: true, snapshots: [] });
  assert.equal((await shared(request("POST", { generation: 0, snapshot: { day: 1 } }))).status, 400);
  assert.equal((await shared(request("POST", { generation: 0, snapshot }))).status, 200);
  assert.deepEqual(seen, [
    ["read", "coordinator"],
    ["record", { generation: 0, snapshot }],
  ]);
});

test(
  "real PostgreSQL: one shared track record per desk, the first snapshot of a day stands, and another world generation is refused",
  { skip: !url, timeout: 60_000 },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_forecast_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(/** @type {string} */ (url));
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: target.href, max: 2 });
    const workspaceId = randomUUID();
    try {
      await migrate(pool);
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date() });
      const actor = randomUUID();
      const world = await store.read(actor);
      const generation = world.payload.state.worldGeneration;
      const coordinator = { ...STATEWIDE_VIEW, actorId: actor };
      // A colleague on another device at the same desk.
      const colleague = { ...STATEWIDE_VIEW, actorId: randomUUID() };
      const ward = {
        ...STATEWIDE_VIEW,
        actorId: randomUUID(),
        access: { role: "ward", scope: { kind: "ward", unitIds: [world.payload.state.units[0].id] } },
      };

      assert.deepEqual(await store.forecastHistory(coordinator), {
        shared: true,
        generation,
        snapshots: [],
        reasons: [],
      });
      const recorded = await store.recordForecast(coordinator, { generation, snapshot });
      assert.equal(recorded.status, 200);
      assert.deepEqual(recorded.body.snapshots, [snapshot]);

      // The colleague's later view the same day changes nothing; their next day adds one.
      const later = { ...snapshot, at: snapshot.at + 60, nowGap: 5, tomorrow: { low: 0, likely: 1, high: 9 } };
      await store.recordForecast(colleague, { generation, snapshot: later });
      const nextDay = { ...snapshot, day: 4, at: 4 * 1440 + 480 };
      await store.recordForecast(colleague, { generation, snapshot: nextDay });
      assert.deepEqual((await store.forecastHistory(coordinator)).snapshots, [snapshot, nextDay]);

      // A later reason for the same day replaces the earlier one, whoever chose it.
      await store.recordForecast(coordinator, { generation, reason });
      const changed = { ...reason, reason: "capacity_changed", by: "bed_manager", at: reason.at + 30 };
      await store.recordForecast(colleague, { generation, reason: changed });
      assert.deepEqual((await store.forecastHistory(coordinator)).reasons, [changed]);

      // A ward desk counts only its own records, so it keeps its own history.
      assert.deepEqual((await store.forecastHistory(ward)).snapshots, []);

      // A browser still counting in another world generation is refused, and nothing is written.
      const stale = await store.recordForecast(coordinator, { generation: generation + 1, snapshot: nextDay });
      assert.equal(stale.status, 409);
      assert.equal(stale.body.code, "world-changed");

      // The table refuses a range out of order even if a caller skipped the check.
      await assert.rejects(
        pool.query(
          "INSERT INTO ward_flow.forecast_snapshots(workspace_id, world_generation, scope_key, demo_day, taken_at, ready_gap_now, tomorrow_low, tomorrow_likely, tomorrow_high) VALUES ($1, 0, $2, 9, 0, 0, 3, 2, 4)",
          [workspaceId, forecastScopeKey(coordinator)],
        ),
        /check constraint/,
      );

      // The rollback drops the history, and the same store goes back to the browser's own.
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          await readFile(new URL("./infra/rollback-016-forecast-history.sql", import.meta.url), "utf8"),
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      const afterRollback = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date() });
      assert.deepEqual(await afterRollback.forecastHistory(coordinator), { shared: false });
    } finally {
      await pool.end();
      await dropTestDatabase(admin, database);
      await admin.end();
    }
  },
);
