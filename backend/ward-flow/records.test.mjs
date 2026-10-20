// @ts-check
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { MIGRATIONS, RECORDS_MIGRATION, readMigration } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import {
  assembleWorld,
  conflicts,
  coveredRecords,
  markerKind,
  partKey,
  planSave,
  recordToken,
  splitWorld,
} from "./records.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

const at = new Date("2026-10-07T10:00:00Z");
const urgency = (movementId, value) => ({
  type: "CHANGE_URGENCY",
  role: "coordinator",
  now: 600,
  movementId,
  urgency: value,
  reason: "reassessed",
});

/** The rows a save leaves behind, as the database would hold them. */
function stored(rows, plan) {
  const byKey = new Map(rows.map((row) => [partKey(row.collection, row.record_id), row]));
  for (const row of plan.deletes) byKey.delete(partKey(row.collection, row.recordId));
  for (const part of plan.upserts)
    byKey.set(partKey(part.collection, part.recordId), {
      collection: part.collection,
      record_id: part.recordId,
      kind: part.kind,
      ordinal: part.ordinal,
      revision: part.revision,
      body: part.body,
    });
  return [...byKey.values()];
}

test("a world split into rows and put back together is the same world", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const plan = planSave([], world, 1);
  assert.deepEqual(assembleWorld(plan.core, stored([], plan)), world);
  assert.equal(plan.deletes.length, 0);
  // The workspace row keeps only the small fields and a marker for each list or map.
  for (const [field, value] of Object.entries(plan.core.state)) {
    const original = world.state[field];
    if (original && typeof original === "object") assert.ok(markerKind(value), field);
    else assert.equal(value, original);
  }
  assert.ok(JSON.stringify(plan.core).length < 2_000);
  // Referrals, beds (wards) and movements are one row each, keyed by their own id.
  const keys = new Set(plan.upserts.map((part) => partKey(part.collection, part.recordId)));
  for (const field of ["referrals", "units", "movements"])
    for (const record of world.state[field]) assert.ok(keys.has(partKey(field, record.id)), `${field} ${record.id}`);
});

test("a save writes only the records it changed, and each keeps the revision its content last changed at", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const rows = stored([], planSave([], world, 1));
  const applied = engine.applyCommand(world, urgency("WF-001", 2), at);
  assert.equal(applied.outcome, "accepted");
  const plan = planSave(rows, applied.world, 2);
  const changed = plan.upserts
    .filter((part) => part.revision === 2)
    .map((part) => partKey(part.collection, part.recordId));
  assert.ok(changed.includes("movements/WF-001"));
  assert.ok(!changed.some((key) => key.startsWith("movements/") && key !== "movements/WF-001"));
  assert.ok(plan.upserts.length < 10, "an urgency change rewrites a handful of rows, not the workspace");
  const next = stored(rows, plan);
  assert.deepEqual(assembleWorld(plan.core, next), applied.world);
  assert.equal(next.find((row) => row.record_id === "WF-002").revision, 1);
  // A list entry removed by a save is removed from the rows too.
  const fewer = structuredClone(applied.world);
  const gone = fewer.state.leaveBeds.pop();
  assert.deepEqual(planSave(next, fewer, 3).deletes, [{ collection: "leaveBeds", recordId: gone.id }]);
});

test("lists without their own ids are kept by position, so adding to one never clashes", () => {
  const world = { version: 1, state: { log: [{ at: 1 }], tags: ["a", "b"], same: [{ id: "x" }, { id: "x" }] } };
  const { parts } = splitWorld(world);
  assert.deepEqual(
    [...parts.values()].map((part) => [part.collection, part.recordId, part.kind]),
    [
      ["log", "0", "index"],
      ["tags", "0", "index"],
      ["tags", "1", "index"],
      ["same", "0", "index"],
      ["same", "1", "index"],
    ],
  );
  const rows = stored([], planSave([], world, 1));
  const added = { ...world, state: { ...world.state, log: [{ at: 1 }, { at: 2 }] } };
  const plan = planSave(rows, added, 2);
  assert.deepEqual(
    plan.upserts.map((part) => [part.recordId, part.revision]),
    [["1", 2]],
  );
});

test("dropping the oldest entry or adding at the end rewrites no other row", () => {
  const log = (...ids) => ({ version: 1, state: { log: ids.map((id) => ({ id })) } });
  const rows = stored([], planSave([], log("a", "b", "c"), 1));
  // Like the audit list at its cap: the oldest goes, a new one is added.
  const capped = planSave(rows, log("b", "c", "d"), 2);
  assert.deepEqual(
    capped.upserts.map((part) => [part.recordId, part.ordinal, part.revision]),
    [["d", 3, 2]],
  );
  assert.deepEqual(capped.deletes, [{ collection: "log", recordId: "a" }]);
  const next = stored(rows, capped);
  assert.deepEqual(assembleWorld(capped.core, next), log("b", "c", "d"));
  // A real reordering numbers the list again, rewriting only rows whose position changed and
  // keeping each row's revision.
  const moved = planSave(next, log("d", "b", "c"), 3);
  assert.deepEqual(
    moved.upserts.map((part) => [part.recordId, part.ordinal, part.revision]),
    [["d", 0, 2]],
  );
  assert.deepEqual(assembleWorld(moved.core, stored(next, moved)), log("d", "b", "c"));
});

test("a record the sender saw through its own later save is checked from that save (CS-19 follow-up)", async () => {
  // A popup opened at 1. Another desk changed WF-002 (2); the popup saved WF-001 (3). A second save
  // of WF-001 from the same popup must not clash with its own first save, and must still clash with
  // anyone else's change to WF-001 after it, or to WF-002, which the popup never saw.
  const engine = await import("./dist/engine.mjs");
  const base = engine.seedWorld(at);
  const initial = planSave([], base, 1);
  let rows = stored([], initial);
  let core = initial.core;
  let world = base;
  const save = (event, revision) => {
    const applied = engine.applyCommand(world, event, at);
    const plan = planSave(rows, applied.world, revision, core);
    const covered = coveredRecords({ core, before: world, after: applied.world, event });
    rows = stored(rows, plan);
    core = plan.core;
    world = applied.world;
    return covered;
  };
  save(urgency("WF-002", 1), 2);
  const covered = save(urgency("WF-001", 2), 3);
  assert.deepEqual(covered, [recordToken(partKey("movements", "WF-001"))]);
  const seen = Object.fromEntries(covered.map((token) => [token, 3]));
  const check = (event, options) => {
    const applied = engine.applyCommand(world, event, at);
    return conflicts({
      stored: rows,
      core,
      before: world,
      after: applied.outcome === "accepted" ? applied.world : world,
      event,
      expectedRevision: 1,
      ...options,
    });
  };
  assert.equal(check(urgency("WF-001", 3), { priorRevision: 3 }), true, "without seen: its own save clashes");
  assert.equal(check(urgency("WF-001", 3), { priorRevision: 3, seen }), false, "its own save");
  assert.equal(check(urgency("WF-002", 3), { priorRevision: 3, seen }), true, "the other desk's change");
  // A claim past the latest revision is held to it.
  const ahead = Object.fromEntries(covered.map((token) => [token, 99]));
  save(urgency("WF-001", 1), 4);
  assert.equal(check(urgency("WF-001", 3), { priorRevision: 4, seen }), true, "someone else's change after it");
  assert.equal(check(urgency("WF-001", 3), { priorRevision: 4, seen: ahead }), false, "capped at the latest");
});

test("a save against an older revision clashes only with someone else's change to the same record", async () => {
  const engine = await import("./dist/engine.mjs");
  const base = engine.seedWorld(at);
  const initial = planSave([], base, 1);
  const rows = stored([], initial);
  const first = engine.applyCommand(base, urgency("WF-001", 2), at);
  const plan = planSave(rows, first.world, 2, initial.core);
  const now = stored(rows, plan);
  const check = (event) => {
    const applied = engine.applyCommand(first.world, event, at);
    return conflicts({
      stored: now,
      core: plan.core,
      before: first.world,
      after: applied.outcome === "accepted" ? applied.world : first.world,
      event,
      expectedRevision: 1,
      priorRevision: 2,
    });
  };
  assert.equal(check(urgency("WF-002", 1)), false, "another movement");
  assert.equal(check(urgency("WF-001", 3)), true, "the same movement");
  // Naming a ward nobody changed is fine.
  assert.equal(check({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" }), false);
  // A command sent against the latest revision never clashes.
  assert.equal(
    conflicts({
      stored: now,
      core: plan.core,
      before: first.world,
      after: first.world,
      event: urgency("WF-001", 3),
      expectedRevision: 2,
      priorRevision: 2,
    }),
    false,
  );
  // A field still kept whole (from before 10) has no revision of its own: any change since counts.
  const whole = { ...plan.core, state: { ...plan.core.state, movements: first.world.state.movements } };
  const applied = engine.applyCommand(first.world, urgency("WF-002", 1), at);
  assert.equal(
    conflicts({
      stored: now,
      core: whole,
      before: first.world,
      after: applied.world,
      event: urgency("WF-002", 1),
      expectedRevision: 1,
      priorRevision: 2,
    }),
    true,
  );
});

test("independent undoable saves do not clash when the undo history rolls over, including legacy index rows", async () => {
  const engine = await import("./dist/engine.mjs");
  for (const count of [1, 50]) {
    for (const legacy of [false, true]) {
      const base = engine.seedWorld(at);
      const firstStay = base.state.admissions.find((stay) => stay.state === "occupied");
      const secondStay = base.state.admissions.find(
        (stay) => stay.state === "occupied" && stay.unitId !== firstStay.unitId,
      );
      assert.ok(firstStay && secondStay);
      // Valid synthetic history: the persistence boundary must not turn evicting an old undo
      // receipt into a change to every other subject's receipt.
      const history = base.state.admissions
        .filter((stay) => ![firstStay.id, secondStay.id].includes(stay.id))
        .map((stay) => ({
          kind: "bed-placement",
          admissionId: stay.id,
          unitId: stay.unitId,
          at: 600,
          role: "ward",
          beforeBed: null,
          afterBed: 1,
        }));
      assert.ok(history.length >= count, "the seed supplies enough distinct real stay subjects");
      base.state.undoRecords = history.slice(0, count);
      assert.ok(engine.validWorld(base));
      const place = (stay, bedNumber) => ({
        type: "PLACE_IN_BED",
        role: "ward",
        admissionId: stay.id,
        actingUnitId: stay.unitId,
        bedNumber,
      });
      const firstEvent = place(firstStay, 1);
      const secondEvent = place(secondStay, 1);
      const initial = planSave([], base, 1);
      let rows = stored([], initial);
      if (legacy)
        rows = rows.map((row) => (row.collection === "undoRecords" ? { ...row, record_id: String(row.ordinal) } : row));
      assert.deepEqual(assembleWorld(initial.core, rows), base);
      const first = engine.applyCommand(base, firstEvent, at);
      assert.equal(first.outcome, "accepted");
      assert.ok(engine.validWorld(first.world));
      const saved = planSave(rows, first.world, 2, initial.core);
      const now = stored(rows, saved);
      assert.deepEqual(assembleWorld(saved.core, now), first.world);
      const second = engine.applyCommand(first.world, secondEvent, at);
      assert.equal(second.outcome, "accepted");
      assert.equal(
        conflicts({
          stored: now,
          core: saved.core,
          before: first.world,
          after: second.world,
          event: secondEvent,
          expectedRevision: 1,
          priorRevision: 2,
        }),
        false,
        `independent subjects, history=${count}, legacy=${legacy}`,
      );
      const secondSaved = planSave(now, second.world, 3, saved.core);
      assert.deepEqual(assembleWorld(secondSaved.core, stored(now, secondSaved)), second.world);
      // A change to the same subject must still clash, even if it only restores an earlier value.
      const sameSubject = engine.applyCommand(first.world, place(firstStay, 2), at);
      assert.equal(sameSubject.outcome, "accepted");
      assert.equal(
        conflicts({
          stored: now,
          core: saved.core,
          before: first.world,
          after: sameSubject.world,
          event: place(firstStay, 2),
          expectedRevision: 1,
          priorRevision: 2,
        }),
        true,
      );
      // Conversion of old numeric keys keeps every unchanged receipt's content revision.
      for (const row of now.filter((row) => row.collection === "undoRecords"))
        assert.equal(row.revision, row.body.admissionId === firstStay.id ? 2 : 1);
    }
  }
});

test("all undo receipt kinds retain order and same-subject conflicts with old numeric storage keys", () => {
  const receipts = [
    { kind: "bed-placement", admissionId: "stay", at: 1 },
    { kind: "referral-decision", referralId: "referral", at: 1 },
    { kind: "step", undoType: "UNDO_REFER_TO_UNITS", subjectId: "movement", at: 1 },
  ];
  const base = { version: 1, state: { worldGeneration: 1, undoRecords: receipts } };
  const original = structuredClone(base);
  const initial = planSave([], base, 1);
  const rows = stored([], initial);
  assert.deepEqual(base, original, "storage identity never mutates domain undo receipts");
  assert.equal(initial.core.state.undoRecords.$records, "index", "old readers still order these by ordinal");
  assert.ok(rows.every((row) => row.record_id.length <= 200));
  for (let index = 0; index < receipts.length; index++) {
    const changed = {
      ...base,
      state: { ...base.state, undoRecords: receipts.map((row, at) => (at === index ? { ...row, at: 2 } : row)) },
    };
    const saved = planSave(rows, changed, 2, initial.core);
    const legacy = stored(rows, saved).map((row) => ({ ...row, record_id: String(row.ordinal) }));
    assert.deepEqual(assembleWorld(saved.core, legacy), changed);
    const next = {
      ...changed,
      state: {
        ...changed.state,
        undoRecords: changed.state.undoRecords.map((row, at) => (at === index ? { ...row, at: 3 } : row)),
      },
    };
    assert.equal(
      conflicts({
        stored: legacy,
        core: saved.core,
        before: changed,
        after: next,
        event: {},
        expectedRevision: 1,
        priorRevision: 2,
      }),
      true,
      receipts[index].kind,
    );
    const converted = planSave(legacy, changed, 3, saved.core);
    const convertedRows = stored(legacy, converted);
    assert.deepEqual(assembleWorld(converted.core, convertedRows), changed);
    assert.deepEqual(
      convertedRows.map((row) => row.revision),
      stored(rows, saved).map((row) => row.revision),
    );
  }
  // Unrecognised or duplicated shapes must never collapse into one stored row.
  for (const undoRecords of [
    [receipts[0], receipts[0]],
    [{ kind: "unknown" }, receipts[0]],
  ]) {
    const world = { version: 1, state: { undoRecords } };
    const plan = planSave([], world, 1);
    assert.deepEqual(assembleWorld(plan.core, stored([], plan)), world);
  }
});

test("a reset or a clock change someone else made since clashes; new records from two desks do not", async () => {
  const engine = await import("./dist/engine.mjs");
  const base = engine.seedWorld(at);
  const first = planSave([], base, 1);
  const rows1 = stored([], first);
  /** Another desk's change at revision 2, then a check of `event` sent against revision 1. */
  const after = (other, event) => {
    const changed = engine.applyCommand(base, other, at);
    assert.equal(changed.outcome, "accepted", other.type);
    const plan = planSave(rows1, changed.world, 2, first.core);
    const applied = engine.applyCommand(changed.world, event, at);
    return conflicts({
      stored: stored(rows1, plan),
      core: plan.core,
      before: changed.world,
      after: applied.outcome === "accepted" ? applied.world : changed.world,
      event,
      expectedRevision: 1,
      priorRevision: 2,
    });
  };
  const reset = { type: "RESET_SCENARIO", role: "demo", now: 600 };
  const clock = { type: "ADVANCE_CLOCK", role: "demo", now: 600, minutes: 30 };
  // A command from before a reset never lands in the new world, even on a record it recreated.
  assert.equal(after(reset, urgency("WF-002", 1)), true);
  // A reset sent before someone moved the clock would silently undo the clock change.
  assert.equal(after(clock, reset), true);
  // An unrelated change after a clock change still goes through.
  assert.equal(after(clock, urgency("WF-002", 1)), false);
  // The id counters move on with every new record, so they never clash on their own.
  const fresh = { ...base, state: { ...base.state, referralSequence: base.state.referralSequence + 1 } };
  const plan = planSave(rows1, fresh, 2, first.core);
  assert.equal(plan.core.$revisions.referralSequence, 2);
  assert.equal(plan.core.$revisions.worldGeneration, 1);
  assert.equal(
    conflicts({
      stored: stored(rows1, plan),
      core: plan.core,
      before: fresh,
      after: { ...fresh, state: { ...fresh.state, referralSequence: fresh.state.referralSequence + 1 } },
      event: { type: "NOTHING" },
      expectedRevision: 1,
      priorRevision: 2,
    }),
    false,
  );
  // The field revisions never reach the world.
  assert.deepEqual(assembleWorld(plan.core, stored(rows1, plan)), fresh);
});

test(
  "real PostgreSQL: migration 10 moves an existing workspace into rows exactly as the store would, and its rollback restores it",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const admin = new Pool({ connectionString: url, max: 1 });
    const database = `wardflow_records_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(url);
    target.pathname = `/${database}`;
    await admin.query(`CREATE DATABASE ${database}`);
    const pool = new Pool({ connectionString: target.href, max: 2 });
    try {
      // A database at 9 with a workspace saved as one record, a few saves in.
      for (const migration of MIGRATIONS.filter((row) => row.version < RECORDS_MIGRATION))
        await pool.query(await readMigration(migration));
      const workspaceId = randomUUID();
      const world = engine.applyCommand(engine.seedWorld(at), urgency("WF-001", 2), at).world;
      await pool.query("INSERT INTO ward_flow.workspaces(id, revision, payload) VALUES ($1, 4, $2)", [
        workspaceId,
        world,
      ]);
      await migrate(pool);
      const { rows: workspace } = await pool.query("SELECT revision, payload FROM ward_flow.workspaces WHERE id=$1", [
        workspaceId,
      ]);
      const { rows } = await pool.query(
        "SELECT collection, record_id, kind, ordinal, revision, body FROM ward_flow.workspace_records WHERE workspace_id=$1",
        [workspaceId],
      );
      const expected = planSave([], world, 4);
      assert.equal(workspace[0].revision, "4");
      assert.deepEqual(workspace[0].payload, expected.core);
      const shape = (list) =>
        list
          .map((row) => JSON.stringify([row.collection, row.record_id, row.kind, row.ordinal, Number(row.revision)]))
          .sort();
      assert.deepEqual(shape(rows), shape(expected.upserts.map((part) => ({ ...part, record_id: part.recordId }))));
      assert.deepEqual(assembleWorld(workspace[0].payload, rows), world);

      // The store reads the moved workspace as the same world and saves on top of it.
      const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
      assert.deepEqual((await store.read(randomUUID())).payload, world);
      const actor = randomUUID();
      assert.equal((await store.command(actor, randomUUID(), 4, urgency("WF-002", 1))).status, 200);
      assert.equal((await store.command(actor, randomUUID(), 4, urgency("WF-003", 2))).status, 200);
      assert.equal((await store.command(actor, randomUUID(), 4, urgency("WF-002", 3))).status, 409);
      const saved = (await store.read(actor)).payload;
      assert.deepEqual(
        ["WF-001", "WF-002", "WF-003"].map((id) => saved.state.movements.find((row) => row.id === id).urgency),
        [2, 1, 2],
      );

      // The rollback puts every record back in the workspace row, in order (012 and 011 go first).
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          await readFile(new URL("./infra/rollback-012-foreign-key-indexes.sql", import.meta.url), "utf8"),
        );
        await client.query(
          await readFile(new URL("./infra/rollback-011-record-access-and-sign-out.sql", import.meta.url), "utf8"),
        );
        await client.query(
          await readFile(new URL("./infra/rollback-010-workspace-records.sql", import.meta.url), "utf8"),
        );
        await client.query("COMMIT");
      } finally {
        client.release();
      }
      const { rows: after } = await pool.query("SELECT payload FROM ward_flow.workspaces WHERE id=$1", [workspaceId]);
      assert.deepEqual(after[0].payload, saved);
      assert.ok(engine.validWorld(after[0].payload));
      // And migrating again moves it back into rows unchanged.
      await migrate(pool);
      assert.deepEqual((await createWorkspaceStore(pool, { workspaceId, engine }).read(actor)).payload, saved);
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await admin.end();
    }
  },
);
