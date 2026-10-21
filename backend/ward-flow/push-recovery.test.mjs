// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore, MAX_DELIVERY_ATTEMPTS } from "./postgres.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";

test("sweeps retire an interrupted final push claim only after its lease, without sending again (mock pool)", async () => {
  let now = new Date("2026-10-19T10:00:00Z");
  const claimedAt = now.getTime();
  const deliveries = [
    { workspace: "ours", status: "pending", attempts: MAX_DELIVERY_ATTEMPTS, lastAttempt: claimedAt },
    { workspace: "other", status: "pending", attempts: MAX_DELIVERY_ATTEMPTS, lastAttempt: claimedAt },
  ];
  let sends = 0;
  let retireQueries = 0;
  const query = async (sql, values = []) => {
    if (sql.startsWith("UPDATE ward_flow.push_deliveries d SET status='failed'")) {
      retireQueries++;
      assert.match(sql, /s.workspace_id=\$1/);
      assert.match(sql, /d.status='pending' AND d.attempts >= \$2 AND d.last_attempt_at <= \$3/);
      for (const row of deliveries)
        if (
          row.workspace === values[0] &&
          row.status === "pending" &&
          row.attempts >= values[1] &&
          row.lastAttempt <= values[2].getTime()
        )
          row.status = "failed";
    } else if (sql.startsWith("SELECT max(version)")) return { rows: [{ version: LATEST_MIGRATION }] };
    else if (sql.startsWith("UPDATE ward_flow.push_deliveries")) {
      assert.match(sql, /d.attempts < \$3/, "exhausted deliveries are never claimed for another network send");
    } else assert.ok(["BEGIN", "COMMIT"].includes(sql) || sql.includes("FOR UPDATE"), sql);
    return { rows: [] };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const store = createWorkspaceStore(pool, {
    workspaceId: "ours",
    engine: {},
    clock: () => now,
    retryAfterMs: 60_000,
    push: {
      coordinatorIds: [],
      send: async () => {
        sends++;
      },
      payload: () => ({}),
    },
    log: (entry) => assert.fail(JSON.stringify(entry)),
  });
  await store.sweepPush();
  assert.equal(deliveries[0].status, "pending", "the final attempt may still be in flight");
  now = new Date(claimedAt + 59_999);
  await store.sweepPush();
  assert.equal(deliveries[0].status, "pending");
  now = new Date(claimedAt + 60_000);
  await store.sweepPush();
  assert.equal(deliveries[0].status, "failed");
  assert.equal(deliveries[1].status, "pending", "another workspace is untouched");
  assert.equal(retireQueries, 3);
  assert.equal(sends, 0);
});

test("command receipts retain their opaque completion across revision-only replies and replay (mock pool)", async () => {
  const completion = {
    createdReferralId: "RF-created",
    undoStep: { undoType: "UNDO_ED_STEP", subjectId: "RF-created", seq: 9 },
  };
  const row = { data_mode: "prototype", revision: 1, payload: { state: { secretUndoSnapshots: true } } };
  let receipt;
  let applications = 0;
  const query = async (sql, values = []) => {
    if (sql.includes("FROM ward_flow.workspaces")) return { rows: [structuredClone(row)], rowCount: 1 };
    if (sql.startsWith("SELECT fingerprint")) return { rows: receipt ? [receipt] : [], rowCount: receipt ? 1 : 0 };
    if (sql.startsWith("UPDATE ward_flow.workspaces")) {
      row.revision = values[1];
      row.payload = values[2];
    } else if (sql.startsWith("INSERT INTO ward_flow.commands"))
      receipt = { fingerprint: values[3], status: values[4], result: structuredClone(values[5]) };
    else assert.ok(["BEGIN", "COMMIT"].includes(sql) || sql.startsWith("INSERT INTO ward_flow.audit"), sql);
    return { rows: [], rowCount: 0 };
  };
  const store = createWorkspaceStore(
    { query, connect: async () => ({ query, release() {} }) },
    {
      workspaceId: "ours",
      clock: () => new Date("2026-10-19T10:00:00Z"),
      engine: {
        storableCommand: (event) => event,
        validCommand: () => true,
        privacyRefusal: () => null,
        demoOnlyCommand: () => false,
        validWorld: () => true,
        commandRefusal: () => null,
        worldNow: () => 642,
        scopeWorld: () => ({ state: { undoRecords: [] } }),
        applyCommand: (world) => {
          applications++;
          return { world, outcome: "accepted", completion, changes: {}, reason: null };
        },
      },
    },
  );
  const event = { type: "RECEIVE_REFERRAL", role: "ed" };
  const view = { access: { role: "ed", scope: { kind: "ed", edId: "rph-ed" } } };
  const first = await store.command("actor", "command", 1, event, { revisionOnly: true, view });
  const replay = await store.command("actor", "command", 1, event, { revisionOnly: true, view });
  assert.deepEqual(first.body, { outcome: "accepted", commandRevision: 2, ...completion });
  assert.deepEqual(replay.body, { ...first.body, replayed: true });
  assert.equal(applications, 1);
  const snapshotReplay = await store.command("actor", "command", 1, event, { view });
  assert.deepEqual(snapshotReplay.body.snapshot.payload.state.undoRecords, []);
  assert.equal(JSON.stringify(snapshotReplay.body).includes("secretUndoSnapshots"), false);
});
