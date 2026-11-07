// @ts-check
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { forecastHistoryStore, forecastScopeKey } from "./forecast-history.mjs";
import { migrate } from "./migrate.mjs";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";

const actorId = "11111111-1111-4111-8111-111111111111";
const ward = (...unitIds) => ({ actorId, access: { role: "ward", scope: { kind: "ward", unitIds } } });
const legacyKey = (view) =>
  createHash("sha256")
    .update(JSON.stringify([view.access.role, view.access.scope]))
    .digest("hex");
const reverse = ward("synthetic-b", "synthetic-a");
const sorted = ward("synthetic-a", "synthetic-b");
const snapshot = { day: 3, at: 4800, nowGap: -2, tomorrow: { low: -4, likely: -1, high: 2 } };
const reason = { day: 3, at: 4900, reason: "other", by: "ward" };
const version = "2026-11-05T12:00:00.000001Z";
const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Forecast compatibility tests require isolated loopback PostgreSQL");

test("equivalent ward sets have one forecast identity without changing authority", () => {
  const before = structuredClone(reverse);
  assert.equal(forecastScopeKey(reverse), forecastScopeKey(sorted));
  assert.deepEqual(reverse, before);
  assert.equal(forecastScopeKey(sorted), legacyKey(sorted), "sorted existing identity remains compatible");
  assert.notEqual(forecastScopeKey(sorted), forecastScopeKey(ward("synthetic-a")));
  assert.notEqual(forecastScopeKey(sorted), forecastScopeKey(ward("synthetic-a", "synthetic-c")));
  assert.equal(
    forecastScopeKey({ access: { role: "coordinator", scope: { kind: "statewide" } } }),
    legacyKey({ access: { role: "coordinator", scope: { kind: "statewide" } } }),
    "other existing desks retain their identity",
  );
});

test("history reconciles only the verified raw key and returns canonical-bound reason versions", async () => {
  const queries = [];
  const oldKey = legacyKey(reverse);
  const store = forecastHistoryStore({
    workspaceId: "22222222-2222-4222-8222-222222222222",
    schemaVersion: async () => 16,
    worldGeneration: async () => 7,
    forgetVersionOnMissing() {},
    pool: {
      query: async (sql, params) => {
        queries.push({ sql, params });
        return {
          rows: sql.includes("forecast_miss_reasons")
            ? [{ demo_day: 3, reason: "other", chosen_by: "ward", chosen_at: 4900, scope_key: oldKey, version }]
            : [],
        };
      },
    },
  });
  const history = await store.forecastHistory(reverse);
  assert.equal(history.reasons[0].version, `${legacyKey(sorted)}:${version}`);
  for (const { sql, params } of queries) {
    assert.deepEqual(params.slice(0, 2), ["22222222-2222-4222-8222-222222222222", 7]);
    assert.equal(params[2], legacyKey(sorted));
    if (sql.startsWith("INSERT")) assert.equal(params[3], oldKey);
    else assert.equal(params.length, 3, "reads use only the canonical address");
  }
});

test(
  "real PostgreSQL: known legacy forecast history and protected edits survive canonicalisation",
  { skip: !url, timeout: 60_000 },
  async (t) => {
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_forecast_scope_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(/** @type {string} */ (url));
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: target.href, max: 3 });
    const workspaceId = randomUUID();
    const otherWorkspaceId = randomUUID();
    const canonical = legacyKey(sorted);
    const oldKey = legacyKey(reverse);
    const unknownKey = legacyKey(ward("synthetic-c", "synthetic-b", "synthetic-a"));
    const store = forecastHistoryStore({
      pool,
      workspaceId,
      schemaVersion: async () => 16,
      worldGeneration: async () => 7,
      forgetVersionOnMissing() {},
    });
    async function seedSnapshot(
      key,
      day,
      gap,
      createdAt = "2026-11-05T10:00:00Z",
      workspace = workspaceId,
      generation = 7,
    ) {
      await pool.query(
        "INSERT INTO ward_flow.forecast_snapshots(workspace_id,world_generation,scope_key,demo_day,taken_at,ready_gap_now,tomorrow_low,tomorrow_likely,tomorrow_high,created_at) VALUES($1,$2,$3,$4,$5,$6,-4,-1,2,$7)",
        [workspace, generation, key, day, day * 1440 + 480, gap, createdAt],
      );
    }
    async function seedReason(key, day, text, updatedAt = version) {
      await pool.query(
        "INSERT INTO ward_flow.forecast_miss_reasons(workspace_id,world_generation,scope_key,demo_day,reason,chosen_by,chosen_at,actor_id,updated_at) VALUES($1,7,$2,$3,$4,'ward',4900,$5,$6)",
        [workspaceId, key, day, text, actorId, updatedAt],
      );
    }
    try {
      await migrate(pool);
      for (const id of [workspaceId, otherWorkspaceId])
        await pool.query("INSERT INTO ward_flow.workspaces(id,revision,payload) VALUES($1,1,'{}')", [id]);

      await t.test(
        "reads only known legacy keys; preserves unknown rows and workspace/generation isolation",
        async () => {
          await seedSnapshot(oldKey, 3, -2);
          await seedReason(oldKey, 3, "other");
          await seedSnapshot(unknownKey, 99, 99);
          await seedSnapshot(canonical, 98, 98, undefined, otherWorkspaceId);
          await seedSnapshot(canonical, 97, 97, undefined, workspaceId, 6);
          const history = await store.forecastHistory(reverse);
          assert.deepEqual(history.snapshots, [snapshot]);
          assert.equal(history.reasons[0].version, `${canonical}:${version}`);
          assert.deepEqual(
            await store.forecastHistory(sorted),
            history,
            "a verified view's discovered history is durably shared with equivalent desks",
          );
          const threeWards = ward("synthetic-c", "synthetic-a", "synthetic-b");
          assert.deepEqual(
            (await store.forecastHistory(threeWards)).snapshots,
            [],
            "even an unseen permutation of the same three-ward set cannot be inferred from its hash",
          );
          assert.equal(
            (
              await pool.query("SELECT count(*)::integer AS n FROM ward_flow.forecast_snapshots WHERE scope_key=$1", [
                unknownKey,
              ])
            ).rows[0].n,
            1,
          );
        },
      );

      await t.test("updates the canonical copy with CAS while retaining the original legacy reason", async () => {
        const held = (await store.forecastHistory(reverse)).reasons[0];
        const changed = await store.recordForecast(reverse, {
          generation: 7,
          reason: { ...reason, reason: "capacity_changed" },
          expectedVersion: held.version,
        });
        assert.equal(changed.status, 200);
        assert.equal(changed.body.reasons[0].reason, "capacity_changed");
        assert.notEqual(changed.body.reasons[0].version, held.version);
        assert.deepEqual(
          (
            await pool.query(
              "SELECT scope_key,reason FROM ward_flow.forecast_miss_reasons WHERE demo_day=3 ORDER BY scope_key",
            )
          ).rows,
          [
            { scope_key: oldKey, reason: "other" },
            { scope_key: canonical, reason: "capacity_changed" },
          ].sort((a, b) => a.scope_key.localeCompare(b.scope_key)),
        );
        for (const expectedVersion of [held.version, `${oldKey}:${version}`, `${unknownKey}:${version}`, null]) {
          const stale = await store.recordForecast(reverse, { generation: 7, reason, expectedVersion });
          assert.equal(stale.status, 409);
          assert.equal(stale.body.code, "reason-conflict");
        }
        assert.equal((await store.forecastHistory(reverse)).reasons[0].reason, "capacity_changed");
      });

      await t.test(
        "cached raw-address timestamp tokens conflict; an unchanged canonical address retains CAS",
        async () => {
          await seedReason(oldKey, 4, "other");
          const cached = await store.recordForecast(reverse, {
            generation: 7,
            reason: { ...reason, day: 4 },
            expectedVersion: version,
          });
          assert.equal(cached.status, 409, "a raw cached token must not be retargeted to a canonical copy");
          const stillCanonical = await store.recordForecast(sorted, {
            generation: 7,
            reason: { ...reason, day: 4 },
            expectedVersion: version,
          });
          assert.equal(stillCanonical.status, 200);
          await seedReason(oldKey, 5, "other");
          await seedReason(canonical, 5, "capacity_changed");
          const ambiguous = await store.recordForecast(reverse, {
            generation: 7,
            reason: { ...reason, day: 5 },
            expectedVersion: version,
          });
          assert.equal(ambiguous.status, 409);
          const winner = (await store.forecastHistory(reverse)).reasons.find((entry) => entry.day === 5);
          const edited = await store.recordForecast(reverse, {
            generation: 7,
            reason: { ...reason, day: 5, reason: "transfer_cancelled" },
            expectedVersion: winner.version,
          });
          assert.equal(edited.status, 200);
          assert.equal(edited.body.reasons.find((entry) => entry.day === 5).reason, "transfer_cancelled");
        },
      );

      await t.test("canonical reasons win existing alias conflicts even if legacy metadata is newer", async () => {
        await seedReason(oldKey, 7, "other", "2026-11-05T12:01:00.000001Z");
        await seedReason(canonical, 7, "unexpected_admission");
        const stale = await store.recordForecast(reverse, {
          generation: 7,
          reason: { ...reason, day: 7 },
          expectedVersion: `${oldKey}:${version}`,
        });
        assert.equal(stale.status, 409);
        const latest = stale.body.history.reasons.find((entry) => entry.day === 7);
        assert.equal(latest.reason, "unexpected_admission");
        assert.match(latest.version, new RegExp(`^${canonical}:`));
        assert.ok(latest.version.length <= 100, "source-bound token fits the existing browser/API contract");
        const accepted = await store.recordForecast(reverse, {
          generation: 7,
          reason: { ...reason, day: 7, reason: "transfer_cancelled" },
          expectedVersion: latest.version,
        });
        assert.equal(accepted.status, 200);
        assert.equal(accepted.body.reasons.find((entry) => entry.day === 7).reason, "transfer_cancelled");
      });

      await t.test("new writes converge, canonical snapshots stand and reconciliation is bounded", async () => {
        await store.recordForecast(reverse, { generation: 7, snapshot: { ...snapshot, nowGap: 100 } });
        assert.equal((await store.forecastHistory(reverse)).snapshots[0].nowGap, -2);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::integer AS n FROM ward_flow.forecast_snapshots WHERE workspace_id=$1 AND world_generation=7 AND scope_key=$2 AND demo_day=3",
              [workspaceId, canonical],
            )
          ).rows[0].n,
          1,
        );
        const next = { ...snapshot, day: 6, at: 9120 };
        await Promise.all([
          store.recordForecast(reverse, { generation: 7, snapshot: next }),
          store.recordForecast(sorted, { generation: 7, snapshot: { ...next, nowGap: 100 } }),
        ]);
        for (const view of [reverse, sorted])
          assert.equal((await store.forecastHistory(view)).snapshots.filter((entry) => entry.day === 6).length, 1);
        await seedSnapshot(canonical, 9, 100, "2026-11-05T11:00:00Z");
        await seedSnapshot(oldKey, 9, -100);
        assert.equal((await store.forecastHistory(reverse)).snapshots.find((entry) => entry.day === 9).nowGap, 100);
        await Promise.all([
          store.recordForecast(reverse, { generation: 7, reason: { ...reason, day: 6 }, expectedVersion: null }),
          store.recordForecast(sorted, { generation: 7, reason: { ...reason, day: 6 }, expectedVersion: null }),
        ]).then((results) => assert.deepEqual(results.map((entry) => entry.status).sort(), [200, 409]));
        assert.equal(
          (await pool.query("SELECT scope_key FROM ward_flow.forecast_miss_reasons WHERE demo_day=6")).rows[0]
            .scope_key,
          canonical,
        );
        for (let day = 10; day < 75; day++) {
          await seedSnapshot(canonical, day, day, "2026-11-05T11:00:00Z");
          await seedSnapshot(oldKey, day, -day);
        }
        const snapshots = (await store.forecastHistory(reverse)).snapshots;
        assert.equal(snapshots.length, 60);
        assert.equal(new Set(snapshots.map((entry) => entry.day)).size, 60);
        assert.equal(snapshots[0].day, 15);
        assert.equal(snapshots.at(-1).nowGap, 74, "canonical rows win rather than changing a recorded forecast");
      });

      await t.test("legacy discovery survives a new store and subsequent cross-view edits remain shared", async () => {
        await seedSnapshot(oldKey, 80, -80);
        await seedReason(oldKey, 80, "other");
        const discovered = await store.forecastHistory(reverse);
        const freshPool = new Pool({ connectionString: target.href, max: 2 });
        const freshStore = forecastHistoryStore({
          pool: freshPool,
          workspaceId,
          schemaVersion: async () => 16,
          worldGeneration: async () => 7,
          forgetVersionOnMissing() {},
        });
        try {
          const colleague = await freshStore.forecastHistory(sorted);
          assert.deepEqual(colleague, discovered, "a new store and pool must see the discovered canonical history");
          const held = discovered.reasons.find((entry) => entry.day === 80);
          const edited = await store.recordForecast(reverse, {
            generation: 7,
            reason: { ...reason, day: 80, reason: "capacity_changed" },
            expectedVersion: held.version,
          });
          assert.equal(edited.status, 200);
          const refreshed = await freshStore.forecastHistory(sorted);
          assert.deepEqual(refreshed, edited.body);
          const basis = refreshed.reasons.find((entry) => entry.day === 80).version;
          const simultaneous = await Promise.all([
            store.recordForecast(reverse, {
              generation: 7,
              reason: { ...reason, day: 80, reason: "transfer_cancelled" },
              expectedVersion: basis,
            }),
            freshStore.recordForecast(sorted, {
              generation: 7,
              reason: { ...reason, day: 80, reason: "unexpected_admission" },
              expectedVersion: basis,
            }),
          ]);
          assert.deepEqual(simultaneous.map((entry) => entry.status).sort(), [200, 409]);
          assert.deepEqual(await store.forecastHistory(reverse), await freshStore.forecastHistory(sorted));
        } finally {
          await freshPool.end();
        }
      });

      await t.test(
        "compatibility GET works with the existing runtime grants and never updates a snapshot",
        async () => {
          await seedSnapshot(oldKey, 81, -81);
          await seedReason(oldKey, 81, "other");
          await pool.query("GRANT USAGE ON SCHEMA ward_flow TO wardflow_backend");
          await pool.query("GRANT SELECT, INSERT ON ward_flow.forecast_snapshots TO wardflow_backend");
          await pool.query("GRANT SELECT, INSERT, UPDATE ON ward_flow.forecast_miss_reasons TO wardflow_backend");
          const client = await pool.connect();
          try {
            await client.query("SET ROLE wardflow_backend");
            assert.equal(
              (
                await client.query(
                  "SELECT has_table_privilege(current_user, 'ward_flow.forecast_snapshots', 'UPDATE') AS allowed",
                )
              ).rows[0].allowed,
              false,
            );
            const runtimeStore = forecastHistoryStore({
              pool: client,
              workspaceId,
              schemaVersion: async () => 16,
              worldGeneration: async () => 7,
              forgetVersionOnMissing() {},
            });
            const history = await runtimeStore.forecastHistory(reverse);
            assert.equal(history.snapshots.find((entry) => entry.day === 81).nowGap, -81);
            const basis = history.reasons.find((entry) => entry.day === 81).version;
            const edited = await runtimeStore.recordForecast(reverse, {
              generation: 7,
              reason: { ...reason, day: 81, reason: "capacity_changed" },
              expectedVersion: basis,
            });
            assert.equal(edited.status, 200);
            assert.deepEqual(await runtimeStore.forecastHistory(sorted), edited.body);
          } finally {
            await client.query("RESET ROLE");
            client.release();
          }
        },
      );

      await t.test("reconciliation copies only the visible windows, retains originals and is idempotent", async () => {
        for (let day = 100; day < 165; day++) await seedSnapshot(oldKey, day, -day);
        for (let day = 100; day < 305; day++) await seedReason(oldKey, day, "other");
        const first = await store.forecastHistory(reverse);
        assert.equal(first.snapshots.length, 60);
        assert.equal(first.reasons.length, 200);
        assert.equal(first.snapshots[0].day, 105);
        assert.equal(first.reasons[0].day, 105);
        assert.deepEqual(await store.forecastHistory(reverse), first);
        for (const [table, copied, retained] of [
          ["forecast_snapshots", 60, 65],
          ["forecast_miss_reasons", 200, 205],
        ]) {
          const rows = (
            await pool.query(
              `SELECT scope_key,count(*)::integer AS n FROM ward_flow.${table} WHERE workspace_id=$1 AND world_generation=7 AND demo_day>=100 GROUP BY scope_key ORDER BY scope_key`,
              [workspaceId],
            )
          ).rows;
          assert.deepEqual(
            rows,
            [
              { scope_key: oldKey, n: retained },
              { scope_key: canonical, n: copied },
            ].sort((a, b) => a.scope_key.localeCompare(b.scope_key)),
          );
        }
      });

      await t.test(
        "a failed compatibility copy returns no history and retry completes without overwriting",
        async () => {
          await seedSnapshot(oldKey, 400, -400);
          await seedReason(oldKey, 400, "other");
          let fail = true;
          const flaky = forecastHistoryStore({
            pool: {
              query: async (sql, params) => {
                if (fail && sql.startsWith("INSERT INTO ward_flow.forecast_miss_reasons")) {
                  fail = false;
                  throw new Error("Synthetic compatibility interruption");
                }
                return pool.query(sql, params);
              },
            },
            workspaceId,
            schemaVersion: async () => 16,
            worldGeneration: async () => 7,
            forgetVersionOnMissing() {},
          });
          await assert.rejects(flaky.forecastHistory(reverse), /Synthetic compatibility interruption/);
          const completed = await flaky.forecastHistory(reverse);
          assert.equal(completed.snapshots.find((entry) => entry.day === 400).nowGap, -400);
          assert.equal(completed.reasons.find((entry) => entry.day === 400).reason, "other");
          assert.deepEqual(await store.forecastHistory(sorted), completed);
        },
      );
    } finally {
      await pool.end();
      await dropTestDatabase(admin, database);
      await admin.end();
    }
  },
);
