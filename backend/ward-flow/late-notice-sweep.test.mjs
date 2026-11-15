// @ts-check
// X1b-5 (Josh, 14 Nov 2026, D-221 item 7): the five-minute sweep raises due late notices whether or
// not push is on, as the system actor, idempotent with the notices scheduled at the save. Synthetic
// data only; the real PostgreSQL case runs only against an isolated loopback server.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { SYSTEM_ACTOR_ID, createWorkspaceStore } from "./postgres.mjs";
import { sweep } from "./server.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");

const START = new Date("2026-10-07T02:00:00Z");
const LATE_KINDS = new Set(["arrival_late_referrer", "arrival_late_ward"]);

/** One open synthetic journey with an accepting ward and a sending ED, set as a record saved before
 * notices were scheduled: its ward ETA is typed in, but no late notice and no marker are stored. */
function legacyJourney(engine, at, etaMinutesAgo) {
  const world = structuredClone(engine.seedWorld(at));
  const now = engine.worldNow(world, at);
  const movement = world.state.movements.find(
    (candidate) =>
      !candidate.closure &&
      candidate.originEdId &&
      candidate.acceptedUnitId &&
      candidate.stage !== "arrived" &&
      !candidate.transport?.arrivedAt &&
      !candidate.transport?.diversion,
  );
  assert.ok(movement, "a seeded open synthetic journey with a sending ED and an accepting ward");
  movement.arrivalDetails = {
    mode: "hospital_transfer",
    estimatedArrivalAt: now - etaMinutesAgo,
    recordedAt: now - etaMinutesAgo - 30,
    recordedBy: "ward",
  };
  delete movement.arrivalLateNotifiedAt;
  world.state.notices = world.state.notices.filter(
    (notice) => !(notice.about.movementId === movement.id && LATE_KINDS.has(notice.kind)),
  );
  assert.ok(engine.validWorld(world));
  return { world, movement, now };
}

const lateFor = (world, movementId) =>
  world.state.notices.filter((notice) => notice.about.movementId === movementId && LATE_KINDS.has(notice.kind));

test("the sweep keeps its History line when the day's audit is already full", async () => {
  const engine = await import("./dist/engine.mjs");
  const { world: probe } = legacyJourney(engine, START, 90);
  const [template] = engine.raiseDueLateNotices(probe, START).domainAudit;
  assert.ok(template, "a sweep History line to copy");
  // A day already holding the full 1,000 entries: the bound keeps its length, so the new line can
  // only be found by sequence, never by position.
  const { world, movement } = legacyJourney(engine, START, 90);
  world.state.auditEvents = Array.from({ length: 1000 }, (_, index) => ({
    ...structuredClone(template),
    id: `synthetic-full-day-${index + 1}`,
    sequence: index + 1,
  }));
  world.state.auditSequence = 1000;
  assert.ok(engine.validWorld(world), "a valid full day");
  const swept = engine.raiseDueLateNotices(world, START);
  assert.deepEqual(swept.raised, [movement.id]);
  assert.equal(swept.world.state.auditEvents.length, 1000);
  assert.equal(swept.domainAudit.length, 1);
  assert.equal(swept.domainAudit[0].sequence, 1001);
  assert.equal(swept.domainAudit[0].action, "EVALUATE_ARRIVAL_LATENESS");
});

test("the sweep raises a due late notice once, as the system actor, and then writes nothing", async () => {
  const engine = await import("./dist/engine.mjs");
  const { world, movement, now } = legacyJourney(engine, START, 90);
  const swept = engine.raiseDueLateNotices(world, START);
  assert.deepEqual(swept.raised, [movement.id]);
  const notices = lateFor(swept.world, movement.id);
  assert.deepEqual(
    notices.map((notice) => [notice.kind, notice.to.role, notice.raisedAt]),
    [
      ["arrival_late_referrer", "ed", now],
      ["arrival_late_ward", "ward", now],
    ],
  );
  const saved = swept.world.state.movements.find((candidate) => candidate.id === movement.id);
  assert.equal(saved.arrivalLateNotifiedAt, now);
  // History: every accepted save writes one line (D-222), and the sweep's reads as raised
  // automatically, never a desk's.
  assert.equal(swept.domainAudit.length, 1);
  const [entry] = swept.domainAudit;
  assert.equal(entry.action, "EVALUATE_ARRIVAL_LATENESS");
  assert.equal(entry.outcome, "accepted");
  assert.deepEqual(entry.actor, { role: null, actingUnitId: null, attribution: "system" });
  assert.ok(engine.validWorld(swept.world));

  const again = engine.raiseDueLateNotices(swept.world, new Date(START.getTime() + 5 * 60_000));
  assert.deepEqual(again.raised, []);
  assert.equal(again.world, swept.world, "nothing due: the world is returned as it was");
});

test("a journey not yet late, or told at the save, gives the sweep nothing to do", async () => {
  const engine = await import("./dist/engine.mjs");
  const { world, movement } = legacyJourney(engine, START, 30);
  assert.deepEqual(engine.raiseDueLateNotices(world, START).raised, [], "30 minutes past is not late");

  // The ward saves its ETA: the pair is stored now, raised at the first late minute.
  const unitId = movement.acceptedUnitId;
  const saved = engine.applyCommand(
    world,
    {
      type: "SET_ARRIVAL_DETAILS",
      role: "ward",
      actingUnitId: unitId,
      movementId: movement.id,
      arrivalMode: "hospital_transfer",
      estimatedArrivalAt: engine.worldNow(world, START) + 20,
    },
    START,
  );
  assert.equal(saved.outcome, "accepted");
  const scheduled = lateFor(saved.world, movement.id);
  assert.equal(scheduled.length, 2);
  const raiseAt = scheduled[0].raisedAt;
  // Two hours on, the scheduled pair has been raised by time alone: the sweep adds nothing.
  const later = new Date(START.getTime() + 120 * 60_000);
  assert.ok(engine.worldNow(saved.world, later) > raiseAt);
  const swept = engine.raiseDueLateNotices(saved.world, later);
  assert.deepEqual(swept.raised, []);
  assert.equal(swept.world, saved.world);
});

test("a desk cannot claim a late notice was raised automatically", async () => {
  const engine = await import("./dist/engine.mjs");
  const { world, movement } = legacyJourney(engine, START, 90);
  const command = { type: "EVALUATE_ARRIVAL_LATENESS", role: "coordinator", movementId: movement.id };
  assert.equal(engine.validCommand(command), true);
  assert.equal(engine.validCommand({ ...command, automatic: true }), false);
  assert.throws(() => engine.applyCommand(world, { ...command, automatic: true }, START), /invalid-command/);
});

test("the five-minute sweep raises late notices with push off, and re-checks push only where it is on", async () => {
  const calls = [];
  const store = (pushEnabled, failLate = false) => ({
    pushEnabled,
    sweepLateNotices: async () => {
      calls.push("late");
      if (failLate) throw Object.assign(new Error("synthetic"), { code: "57014" });
      return 0;
    },
    sweepPush: async () => {
      calls.push("push");
    },
  });
  const events = [];
  await sweep(store(false), (event) => events.push(event));
  assert.deepEqual(calls, ["late"], "push off: late notices still swept, push not");
  calls.length = 0;
  await sweep(store(true), (event) => events.push(event));
  assert.deepEqual(calls, ["late", "push"]);
  calls.length = 0;
  await sweep(store(true, true), (event) => events.push(event));
  assert.deepEqual(calls, ["late", "push"], "a failed late-notice sweep never stops the push re-check");
  assert.deepEqual(events, [
    { event: "ward_backend_late_notice_sweep_failure", errorName: "Error", errorCode: "57014" },
  ]);
});

test("real PostgreSQL: the sweep saves once with a system audit row, then writes nothing", { skip: !url }, async () => {
  const engine = await import("./dist/engine.mjs");
  const pool = new Pool({ connectionString: url, max: 2 });
  const workspaceId = randomUUID();
  let at = START;
  try {
    await migrate(pool);
    const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
    const reader = randomUUID();
    const first = await store.read(reader);
    assert.equal(await store.sweepLateNotices(), 0, "a fresh seed is already told");
    assert.equal((await store.read(reader)).revision, first.revision, "nothing due: nothing written");

    // An old record: its ETA was saved before notices were scheduled, so none is stored.
    const { world, movement } = legacyJourney(engine, START, 90);
    world.dayZero = first.payload.dayZero;
    world.startedAt = first.payload.startedAt;
    world.state.clockOffsetMinutes = first.payload.state.clockOffsetMinutes;
    const legacy = engine.worldNow(world, at) - 90;
    world.state.movements.find((candidate) => candidate.id === movement.id).arrivalDetails.estimatedArrivalAt = legacy;
    const stored = await pool.query("SELECT revision FROM ward_flow.workspaces WHERE id=$1", [workspaceId]);
    const revision = Number(stored.rows[0].revision) + 1;
    const { planSave } = await import("./records.mjs");
    const { rows: present } = await pool.query(
      "SELECT collection, record_id, kind, ordinal, revision, body FROM ward_flow.workspace_records WHERE workspace_id=$1",
      [workspaceId],
    );
    const plan = planSave(present, world, revision, undefined);
    await pool.query("DELETE FROM ward_flow.workspace_records WHERE workspace_id=$1", [workspaceId]);
    await pool.query("UPDATE ward_flow.workspaces SET revision=$2, payload=$3 WHERE id=$1", [
      workspaceId,
      revision,
      plan.core,
    ]);
    const fresh = planSave([], world, revision);
    for (const part of fresh.upserts)
      await pool.query(
        "INSERT INTO ward_flow.workspace_records(workspace_id, collection, record_id, kind, ordinal, revision, body) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [workspaceId, part.collection, part.recordId, part.kind, part.ordinal, part.revision, part.body],
      );

    at = new Date(START.getTime() + 60_000);
    assert.equal(await store.sweepLateNotices(), 1);
    const after = await store.read(reader);
    assert.equal(after.revision, revision + 1);
    assert.equal(lateFor(after.payload, movement.id).length, 2);
    const { rows: audit } = await pool.query(
      "SELECT actor_id, action, changes FROM ward_flow.audit WHERE workspace_id=$1 AND revision=$2",
      [workspaceId, revision + 1],
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_id, SYSTEM_ACTOR_ID);
    assert.equal(audit[0].action, "EVALUATE_ARRIVAL_LATENESS");
    assert.equal(audit[0].changes.automatic, true);
    // D-222: the save's one History line, raised automatically by no desk.
    assert.equal(audit[0].changes.domainAudit.length, 1);
    assert.equal(audit[0].changes.domainAudit[0].actor.attribution, "system");

    at = new Date(START.getTime() + 6 * 60_000);
    assert.equal(await store.sweepLateNotices(), 0, "idempotent: told once");
    assert.equal((await store.read(reader)).revision, revision + 1);
  } finally {
    await pool.end();
  }
});
