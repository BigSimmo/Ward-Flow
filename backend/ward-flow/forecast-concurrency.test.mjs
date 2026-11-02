// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { forecastHistoryStore, forecastScopeKey } from "./forecast-history.mjs";

const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const VIEW = { actorId: ACTOR, access: { role: "coordinator", scope: { kind: "statewide" } } };
const operationId = (number) => `33333333-3333-4333-8333-${String(number).padStart(12, "0")}`;
const reason = (day, value = "capacity_changed", at = 4800) => ({ day, reason: value, by: "coordinator", at });
const choice = (number, value, expectedDayVersion = 0) => ({
  generation: 1,
  scopeKey: forecastScopeKey(VIEW),
  operationId: operationId(number),
  expectedDayVersion,
  reason: value,
});

/**
 * Deterministic SQL protocol fixture: production forecast store, transactional copies and a
 * shared workspace lock across server instances. No provider/socket. PostgreSQL itself remains
 * a separate integration boundary. Every unexpected query fails closed.
 */
function fixture(version = 17) {
  /** @type {{ generation: number, revision: number, snapshots: any[], reasons: any[], receipts: any[], audit: any[] }} */
  let committed = { generation: 1, revision: 1, snapshots: [], reasons: [], receipts: [], audit: [] };
  let tail = Promise.resolve();
  const controls = { failReceipt: false, holds: 0 };
  const key = (parameters) => JSON.stringify(parameters.slice(0, 4));
  const result = (rows) => ({ rows: structuredClone(rows), rowCount: rows.length });
  async function query(state, sql, parameters = []) {
    if (sql.startsWith("SELECT demo_day, taken_at"))
      return result(
        state.snapshots
          .filter((row) => row.key.startsWith(JSON.stringify(parameters).slice(0, -1)))
          .sort((a, b) => b.demo_day - a.demo_day),
      );
    if (sql.startsWith("SELECT demo_day, reason"))
      return result(
        state.reasons
          .filter((row) => row.key.startsWith(JSON.stringify(parameters).slice(0, -1)))
          .sort((a, b) => b.demo_day - a.demo_day),
      );
    if (sql.startsWith("SELECT fingerprint"))
      return result(state.receipts.filter((row) => row.actorId === parameters[1] && row.operationId === parameters[2]));
    if (sql.startsWith("SELECT reason, chosen_by"))
      return result(state.reasons.filter((row) => row.key === key(parameters)));
    if (sql.startsWith("INSERT INTO ward_flow.forecast_snapshots")) {
      if (state.snapshots.some((row) => row.key === key(parameters))) return result([]);
      const row = {
        key: key(parameters),
        demo_day: parameters[3],
        taken_at: parameters[4],
        ready_gap_now: parameters[5],
        tomorrow_low: parameters[6],
        tomorrow_likely: parameters[7],
        tomorrow_high: parameters[8],
      };
      state.snapshots.push(row);
      return result([row]);
    }
    if (sql.startsWith("INSERT INTO ward_flow.forecast_miss_reasons")) {
      const previous = state.reasons.findIndex((row) => row.key === key(parameters));
      if (
        sql.includes("WHERE ward_flow.forecast_miss_reasons.revision =") &&
        previous >= 0 &&
        state.reasons[previous].revision !== parameters[9]
      )
        return result([]);
      const row = {
        key: key(parameters),
        demo_day: parameters[3],
        reason: parameters[4],
        chosen_by: parameters[5],
        chosen_at: parameters[6],
        actor_id: parameters[7],
        revision: parameters[8] ?? 1,
      };
      if (previous >= 0) state.reasons[previous] = row;
      else state.reasons.push(row);
      return result([row]);
    }
    if (sql.startsWith("INSERT INTO ward_flow.commands")) {
      if (controls.failReceipt) {
        controls.failReceipt = false;
        throw new Error("synthetic receipt failure");
      }
      state.receipts.push({
        actorId: parameters[1],
        operationId: parameters[2],
        fingerprint: parameters[3],
        status: parameters[4],
        result: structuredClone(parameters[5]),
      });
      return result([]);
    }
    assert.fail(`Unexpected forecast SQL: ${sql.slice(0, 110)}`);
  }
  function server() {
    const dependencies = {
      // The old implementation uses this unprotected path; the repaired one must use withWorkspace.
      pool: { query: (sql, parameters) => query(committed, sql, parameters) },
      workspaceId: WORKSPACE,
      schemaVersion: async () => version,
      worldGeneration: async () => committed.generation,
      forgetVersionOnMissing() {},
      withWorkspace: async (_view, _write, run) => {
        const before = tail;
        let release = () => {};
        tail = new Promise((resolve) => {
          release = resolve;
        });
        await before;
        controls.holds += 1;
        const state = structuredClone(committed);
        const context = {
          client: { query: (sql, parameters) => query(state, sql, parameters) },
          generation: state.generation,
          revision: state.revision,
          advance: async () => {
            state.revision += 1;
            context.revision = state.revision;
            return state.revision;
          },
          audit: async (entry) => {
            state.audit.push(entry);
          },
        };
        try {
          const answer = await run(context);
          committed = state;
          return answer;
        } finally {
          release();
        }
      },
    };
    return forecastHistoryStore(dependencies);
  }
  return { server, controls, truth: () => structuredClone(committed) };
}

test("SC03: lost acknowledgement retry replays A while preserving B's newer reason", async () => {
  const { server, truth } = fixture();
  const first = server();
  const other = server();
  const a = choice(1, reason(3, "discharge_postponed", 4800));
  const acceptedA = await first.recordForecast(VIEW, a); // Accepted reply deliberately not delivered.
  const acceptedB = await other.recordForecast(VIEW, choice(2, reason(3, "capacity_changed", 4810), 2));
  assert.equal(acceptedA.status, 200);
  assert.equal(acceptedB.status, 200);
  const replay = await first.recordForecast(VIEW, a);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.commandRevision, 2);
  assert.equal(replay.body.historyRevision, 3);
  assert.deepEqual(replay.body.reasons, [reason(3, "capacity_changed", 4810)]);
  assert.equal(truth().reasons[0].reason, "capacity_changed");
  assert.equal(truth().audit.length, 2, "a retry records no duplicate action");
});

test("SC03: competing stale edits conflict; edits to different days both survive", async () => {
  const { server, truth } = fixture();
  const first = server();
  const other = server();
  const outcomes = await Promise.all([
    first.recordForecast(VIEW, choice(1, reason(3))),
    other.recordForecast(VIEW, choice(2, reason(3, "other"))),
  ]);
  assert.deepEqual(
    outcomes.map((entry) => entry.status),
    [200, 409],
  );
  assert.equal(outcomes[1].body.code, "forecast-conflict");
  assert.equal(outcomes[1].body.reasonVersions[3], 2);
  const distinct = await Promise.all([
    first.recordForecast(VIEW, choice(3, reason(4))),
    other.recordForecast(VIEW, choice(4, reason(5))),
  ]);
  assert.deepEqual(
    distinct.map((entry) => entry.status),
    [200, 200],
  );
  assert.deepEqual(
    truth()
      .reasons.map((entry) => entry.demo_day)
      .sort(),
    [3, 4, 5],
  );
});

test("SC03: reused operation identity cannot change payload or borrow another desk's receipt", async () => {
  const { server, truth } = fixture();
  const store = server();
  await store.recordForecast(VIEW, choice(1, reason(3)));
  assert.equal((await store.recordForecast(VIEW, choice(1, reason(3, "other"), 2))).status, 422);
  const ward = { ...VIEW, access: { role: "ward", scope: { kind: "ward", unitIds: ["UNIT-SYN-A"] } } };
  const switched = await store.recordForecast(ward, choice(1, reason(3)));
  assert.equal(switched.status, 409);
  assert.equal(switched.body.code, "forecast-scope-changed");
  assert.deepEqual(switched.body.reasons, []);
  assert.equal(switched.body.scopeKey, forecastScopeKey(ward));
  assert.equal(truth().revision, 2);
  const firstDelivery = await store.recordForecast(ward, choice(2, reason(4)));
  assert.equal(firstDelivery.status, 409, "an old desk's first delivery cannot create a choice in the new scope");
  assert.equal(truth().revision, 2);
});

test("SC03: receipt failure rolls back the reason and history revision together", async () => {
  const { server, controls, truth } = fixture();
  controls.failReceipt = true;
  await assert.rejects(server().recordForecast(VIEW, choice(1, reason(3))), /synthetic receipt/);
  assert.equal(truth().revision, 1);
  assert.deepEqual(truth().reasons, []);
  assert.deepEqual(truth().audit, []);
});

test("SC03: a stale reason in a combined save cannot partially capture a snapshot", async () => {
  const { server, truth } = fixture();
  const store = server();
  await store.recordForecast(VIEW, choice(1, reason(3)));
  const snapshot = { day: 9, at: 4800, nowGap: 0, tomorrow: { low: -1, likely: 0, high: 1 } };
  const result = await store.recordForecast(VIEW, { ...choice(2, reason(3, "other")), snapshot });
  assert.equal(result.status, 409);
  assert.equal(truth().revision, 2);
  assert.deepEqual(truth().snapshots, []);
});

test("SC03/05: shared reads carry an atomic scope and revision; snapshots remain first-of-day", async () => {
  const { server, controls } = fixture();
  const store = server();
  const snapshot = { day: 3, at: 4800, nowGap: 0, tomorrow: { low: -1, likely: 0, high: 1 } };
  await store.recordForecast(VIEW, {
    generation: 1,
    scopeKey: forecastScopeKey(VIEW),
    operationId: operationId(1),
    snapshot,
  });
  await store.recordForecast(VIEW, {
    generation: 1,
    scopeKey: forecastScopeKey(VIEW),
    operationId: operationId(2),
    snapshot: { ...snapshot, nowGap: 99 },
  });
  const read = await store.forecastHistory(VIEW);
  assert.equal(read.historyRevision, 2, "duplicate first-of-day capture changes no history");
  assert.equal(read.writable, true);
  assert.equal(read.scopeKey, forecastScopeKey(VIEW));
  assert.deepEqual(read.snapshots, [snapshot]);
  assert.equal(controls.holds, 3, "both writes and the read use the authoritative workspace boundary");
});

test("SC03: stale generations and unversioned legacy writes cannot overwrite shared history", async () => {
  const latest = fixture();
  const stale = await latest.server().recordForecast(VIEW, { ...choice(1, reason(3)), generation: 0 });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, "world-changed");
  assert.equal((await latest.server().recordForecast(VIEW, { generation: 1, reason: reason(3) })).status, 409);
  const legacy = fixture(16);
  assert.equal((await legacy.server().forecastHistory(VIEW)).writable, false);
  const refused = await legacy.server().recordForecast(VIEW, choice(1, reason(3)));
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "forecast-upgrade-required");
  assert.deepEqual(legacy.truth().reasons, []);
});
