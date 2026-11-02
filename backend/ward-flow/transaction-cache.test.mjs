// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";
import { assembleWorld, planSave } from "./records.mjs";

const AT = new Date("2026-11-02T00:00:00.000Z");
const ACTOR = "22222222-2222-4222-8222-222222222222";
const WORKSPACE = "11111111-1111-4111-8111-111111111111";
const commandId = (number) => `33333333-3333-4333-8333-${String(number).padStart(12, "0")}`;
const refresh = (unitId) => ({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId });

/** A deterministic response barrier; no timers or database connections. */
function barrier() {
  let resolve = () => {};
  /** @type {Promise<void>} */
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/**
 * The production store/cache and record splitter run unchanged. This narrow SQL protocol fixture
 * models committed rows, transaction rollback and the exact revision/timestamp cache CASE; it
 * does not claim PostgreSQL lock proof. Schedules serialize writes, except delayed COMMIT replies
 * after their writes have committed. The minimal engine changes one synthetic unit counter, so
 * these tests isolate cache ownership from unrelated workflow rules. No sockets or providers.
 */
function fixture() {
  const world = {
    version: 1,
    startedAt: AT.toISOString(),
    state: {
      worldGeneration: 1,
      clockOffsetMinutes: 0,
      patients: [],
      units: [
        { id: "UNIT-SYN-A", requests: 0 },
        { id: "UNIT-SYN-B", requests: 0 },
      ],
    },
  };
  const rowOf = (part) => ({
    collection: part.collection,
    record_id: part.recordId,
    kind: part.kind,
    ordinal: part.ordinal,
    revision: part.revision,
    body: structuredClone(part.body),
  });
  const seed = planSave([], world, 1);
  let committed = {
    revision: 1,
    payload: seed.core,
    updatedAt: new Date(AT.getTime() - 1),
    records: seed.upserts.map(rowOf),
    receipts: /** @type {any[]} */ ([]),
  };
  const result = (rows) => ({ rows: structuredClone(rows), rowCount: rows.length });
  const engine = {
    ACCESS_MAX_TERM_MINUTES: 525_600,
    validWorld: (value) => value?.version === 1,
    worldNow: () => 0,
    storableCommand: (event) => event,
    privacyRefusal: () => null,
    validCommand: () => true,
    demoOnlyCommand: () => false,
    applyCommand(before, event) {
      const after = structuredClone(before);
      after.state.units.find((unit) => unit.id === event.unitId).requests += 1;
      return { world: after, outcome: "accepted", changes: {}, completion: {}, reason: null };
    },
  };

  function server(offset = 0) {
    const controls = {
      failAudit: false,
      failCommit: false,
      loseCommitReply: false,
      failBegin: false,
      heldCommit: /** @type {{ entered: ReturnType<typeof barrier>, release: ReturnType<typeof barrier> } | null} */ (
        null
      ),
      recordsSent: 0,
    };
    /** @param {string} sql @param {any[]} [parameters] @param {{ working: any } | null} [transaction] */
    async function query(sql, parameters = [], transaction = null) {
      const current = transaction?.working ?? committed;
      if (sql === "BEGIN") {
        assert.ok(transaction);
        if (controls.failBegin) {
          controls.failBegin = false;
          throw new Error("synthetic begin failure");
        }
        transaction.working = structuredClone(committed);
      } else if (sql === "ROLLBACK") {
        assert.ok(transaction);
        transaction.working = null;
      } else if (sql === "COMMIT") {
        assert.ok(transaction);
        if (controls.failCommit) {
          controls.failCommit = false;
          throw new Error("synthetic commit rejection");
        }
        committed = structuredClone(transaction.working);
        transaction.working = null;
        if (controls.loseCommitReply) {
          controls.loseCommitReply = false;
          throw Object.assign(new Error("synthetic lost commit reply"), { code: "08006" });
        }
        const held = controls.heldCommit;
        controls.heldCommit = null;
        if (held) {
          held.entered.resolve();
          await held.release.promise;
        }
      } else if (sql.includes("max(version)")) return result([{ version: 10 }]);
      else if (sql.includes("FROM ward_flow.workspaces w")) {
        const row = { data_mode: "prototype", revision: String(current.revision), payload: current.payload };
        if (!sql.includes("cache_revision")) return result([row]);
        const sameStamp =
          current.revision === parameters[1] && current.updatedAt.getTime() === parameters[2]?.getTime();
        const records = sameStamp ? null : changedRows(current, parameters[3]);
        controls.recordsSent += records?.length ?? 0;
        return result([
          {
            ...row,
            cache_revision: String(current.revision),
            cache_updated_at: current.updatedAt,
            records,
          },
        ]);
      } else if (sql.includes("FROM ward_flow.workspaces WHERE") && sql.includes("FOR UPDATE"))
        return result([
          {
            data_mode: "prototype",
            revision: String(current.revision),
            payload: current.payload,
            cache_updated_at: current.updatedAt,
          },
        ]);
      else if (sql.startsWith("SELECT ") && sql.includes("FROM ward_flow.workspace_records")) {
        const records = changedRows(current, parameters[1]);
        controls.recordsSent += records.length;
        return result(records);
      } else if (sql.startsWith("UPDATE ward_flow.workspaces")) {
        current.revision = parameters[1];
        current.payload = structuredClone(parameters[2]);
        current.updatedAt = structuredClone(parameters[3]);
      } else if (sql.startsWith("INSERT INTO ward_flow.workspace_records")) {
        for (const row of JSON.parse(parameters[1])) {
          const index = current.records.findIndex(
            (kept) => kept.collection === row.collection && kept.record_id === row.record_id,
          );
          if (index < 0) current.records.push(row);
          else current.records[index] = row;
        }
      } else if (sql.startsWith("SELECT fingerprint"))
        return result(current.receipts.filter((row) => row.command_id === parameters[2]));
      else if (sql.startsWith("INSERT INTO ward_flow.commands"))
        current.receipts.push({
          command_id: parameters[2],
          fingerprint: parameters[3],
          status: parameters[4],
          result: structuredClone(parameters[5]),
        });
      else if (sql.startsWith("INSERT INTO ward_flow.audit")) {
        if (controls.failAudit) {
          controls.failAudit = false;
          throw new Error("synthetic audit failure");
        }
      } else assert.fail(`Unexpected SQL in cache fixture: ${sql.slice(0, 100)}`);
      return result([]);
    }
    const pool = {
      query,
      connect: async () => {
        const transaction = { working: null };
        return { query: (sql, parameters) => query(sql, parameters, transaction), release() {} };
      },
    };
    const store = createWorkspaceStore(pool, {
      workspaceId: WORKSPACE,
      engine,
      clock: () => new Date(AT.getTime() + offset),
      log() {},
      alert() {},
    });
    return { store, controls };
  }
  function changedRows(current, since) {
    return current.records.map((row) => ({
      ...row,
      revision: String(row.revision),
      fresh: row.revision > since,
      body: row.revision > since ? row.body : null,
    }));
  }
  return { server, truth: () => assembleWorld(committed.payload, committed.records) };
}

const counts = (world) => world.state.units.map((unit) => unit.requests);

for (const failure of ["failAudit", "failCommit"]) {
  test(`SC01: ${failure} cannot lend its cache to another server's same-revision, same-millisecond save`, async () => {
    const { server, truth } = fixture();
    const first = server();
    const other = server();
    await first.store.read(ACTOR);
    first.controls[failure] = true;
    await assert.rejects(first.store.command(ACTOR, commandId(1), 1, refresh("UNIT-SYN-A")), /synthetic/);
    assert.deepEqual(counts(truth()), [0, 0], "failed transaction rolled back");
    assert.equal((await other.store.command(ACTOR, commandId(2), 1, refresh("UNIT-SYN-B"))).status, 200);
    assert.deepEqual(counts(truth()), [0, 1]);
    for (let read = 0; read < 2; read += 1)
      assert.deepEqual((await first.store.read(ACTOR)).payload, truth(), "no failed facts or missing committed facts");
  });
}

test("SC01: a different-millisecond save also converges after a rollback", async () => {
  const { server, truth } = fixture();
  const first = server();
  const other = server(1);
  await first.store.read(ACTOR);
  first.controls.failAudit = true;
  await assert.rejects(first.store.command(ACTOR, commandId(1), 1, refresh("UNIT-SYN-A")), /synthetic/);
  await other.store.command(ACTOR, commandId(2), 1, refresh("UNIT-SYN-B"));
  assert.deepEqual((await first.store.read(ACTOR)).payload, truth());
});

test("SC01: a successful candidate survives an unrelated transaction failure without rereading records", async () => {
  const { server, truth } = fixture();
  const { store, controls } = server();
  await store.read(ACTOR);
  await store.command(ACTOR, commandId(1), 1, refresh("UNIT-SYN-A"));
  controls.failBegin = true;
  await assert.rejects(store.command(ACTOR, commandId(2), 2, refresh("UNIT-SYN-B")), /synthetic begin/);
  controls.recordsSent = 0;
  assert.deepEqual((await store.read(ACTOR)).payload, truth());
  assert.equal(controls.recordsSent, 0, "a different transaction cannot discard the committed candidate");
});

test("SC01: late COMMIT acknowledgements cannot replace a newer committed cache candidate", async () => {
  const { server, truth } = fixture();
  const { store, controls } = server();
  await store.read(ACTOR);
  const held = { entered: barrier(), release: barrier() };
  controls.heldCommit = held;
  const older = store.command(ACTOR, commandId(1), 1, refresh("UNIT-SYN-A"));
  try {
    await held.entered.promise;
    assert.equal((await store.command(ACTOR, commandId(2), 2, refresh("UNIT-SYN-B"))).status, 200);
  } finally {
    held.release.resolve();
    await older;
  }
  controls.recordsSent = 0;
  assert.deepEqual((await store.read(ACTOR)).payload, truth());
  assert.equal(controls.recordsSent, 0, "the newest committed candidate still avoids a records read");
});

test("SC01: an unknown COMMIT outcome resynchronises from committed rows", async () => {
  const { server, truth } = fixture();
  const { store, controls } = server();
  await store.read(ACTOR);
  controls.loseCommitReply = true;
  await assert.rejects(store.command(ACTOR, commandId(1), 1, refresh("UNIT-SYN-A")), /synthetic lost commit/);
  assert.deepEqual(counts(truth()), [1, 0], "the server committed before its reply was lost");
  assert.deepEqual((await store.read(ACTOR)).payload, truth());
});
