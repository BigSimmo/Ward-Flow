import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "./dist/engine.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { withoutRecordDetail } from "./record-detail.mjs";

// Production store and reporting engine; the double only schedules the locked SQL reads.
/** @param {{ archived?: any[], count?: number, deadline?: number, project?: (...args: any[]) => any }} [options] */
function executiveBoundary({
  archived = [],
  count = archived.length,
  deadline,
  project = engine.executiveReport,
} = {}) {
  let time = at.getTime();
  let expiry = deadline ?? time + 3_600_000;
  let revision = 7;
  let projections = 0;
  let archiveReads = 0;
  let locked = false;
  let receipt;
  let world = engine.seedWorld(at);
  const access = { role: "executive", scope: { kind: "service", service: "North Metro" } };
  const membershipId = "55555555-5555-4555-8555-555555555555";
  const view = { actorId, membershipId, access, version: 14, grants: [], accessUntil: expiry };
  const query = async (sql, values = []) => {
    if (sql === "BEGIN") return { rows: [] };
    if (sql === "COMMIT" || sql === "ROLLBACK") {
      locked = false;
      return { rows: [] };
    }
    if (sql.startsWith("SELECT max(version)")) return { rows: [{ version: 14 }] };
    if (sql.includes("FROM ward_flow.workspaces") && sql.includes("FOR ")) {
      locked = true;
      return {
        rows: [{ data_mode: "prototype", revision, payload: structuredClone(world), cache_updated_at: new Date(at) }],
      };
    }
    if (sql.includes("FROM ward_flow.workspace_records")) return { rows: [] };
    if (sql.startsWith("SELECT id, role, scope")) {
      assert.equal(locked, true);
      return {
        rows: [
          { id: membershipId, ...access, kind: "role", last_used_at: new Date(time), expires_at: new Date(expiry) },
        ],
      };
    }
    if (sql.startsWith("SELECT patient_id, opened_at, until")) return { rows: [] };
    if (sql.startsWith("SAVEPOINT") || sql.startsWith("RELEASE SAVEPOINT")) return { rows: [] };
    if (sql.startsWith("SELECT count(*)::integer AS archived")) return { rows: [{ archived: count }] };
    if (sql.startsWith("SELECT collection, record_id, closed_at, body FROM ward_flow.archived_records")) {
      assert.equal(locked, true, "Archive hydration uses the locked transaction connection");
      assert.deepEqual(values, [workspaceId, world.state.worldGeneration]);
      assert.match(sql, /ORDER BY closed_at DESC, collection, record_id LIMIT 5000$/);
      archiveReads++;
      return { rows: structuredClone(archived) };
    }
    if (sql.startsWith("SELECT fingerprint, status, result"))
      return { rows: receipt ? [receipt] : [], rowCount: receipt ? 1 : 0 };
    if (sql.startsWith("INSERT INTO ward_flow.commands")) {
      receipt = { fingerprint: values[3], status: values[4], result: values[5] };
      return { rows: [] };
    }
    if (sql.startsWith("SELECT status, result")) return { rows: receipt ? [receipt] : [] };
    if (sql.startsWith("INSERT INTO ward_flow.audit")) return { rows: [] };
    assert.fail(`Unexpected executive boundary SQL: ${sql.slice(0, 100)}`);
  };
  const store = createWorkspaceStore(
    { query, connect: async () => ({ query, release() {} }) },
    {
      workspaceId,
      engine: {
        ...engine,
        executiveReport(...args) {
          projections++;
          return project(...args);
        },
      },
      clock: () => new Date(time),
      // A slow runner must not add a command timing line (P011) to a log that fails on any line.
      slowCommandMs: 60_000,
      log: () => assert.fail("Unexpected diagnostic"),
    },
  );
  return {
    store,
    view,
    access,
    world,
    counts: () => ({ projections, archiveReads }),
    advance: (minutes) => {
      time += minutes * 60_000;
    },
    expire: (value) => {
      expiry = value;
    },
    replace: (next) => {
      world = next;
      revision++;
    },
  };
}

function assertExecutiveSnapshot(snapshot) {
  assert.deepEqual(
    Object.keys(snapshot).sort(),
    ["kind", "dataMode", "actorId", "revision", "accessContext", "accessUntil", "now", "report", "demoControls"].sort(),
  );
  assert.equal(snapshot.kind, "executive-aggregate");
  assert.equal(snapshot.actorId, actorId);
  assert.match(snapshot.accessContext, /^[a-f0-9]{64}$/);
  assert.equal(Number.isFinite(snapshot.accessUntil), true);
  assert.equal(snapshot.now, snapshot.report.network.asAt.now);
  assert.equal(snapshot.demoControls, false);
}

test("executive locked read and unchanged poll deliver only the complete aggregate, caching the report by committed inputs", async () => {
  const boundary = executiveBoundary();
  const first = await boundary.store.read(actorId, boundary.view);
  assertExecutiveSnapshot(first);
  const started = performance.now();
  const poll = await boundary.store.poll(actorId, first.revision, boundary.view, first.accessContext);
  const elapsed = performance.now() - started;
  assert.equal(poll.notModified, false);
  assertExecutiveSnapshot(poll.snapshot);
  assert.equal(poll.snapshot.report, first.report);
  assert.deepEqual(boundary.counts(), { projections: 1, archiveReads: 1 });
  console.log(`Executive cache-hit locked poll: ${elapsed.toFixed(1)} ms`);
  assert.equal(JSON.stringify(first).includes(boundary.world.state.patients[0].id), false);
  boundary.advance(1);
  const later = await boundary.store.poll(actorId, first.revision, boundary.view, first.accessContext);
  assertExecutiveSnapshot(later.snapshot);
  assert.equal(later.snapshot.now, first.now + 1);
  assert.equal(boundary.counts().projections, 2);
});

test("executive archive hydration precedes service scope, prefers live ids and rejects incomplete retention", async () => {
  const world = engine.seedWorld(at);
  const live = world.state.movements[0];
  const alert = {
    id: "SYN-ARCHIVED-ALERT",
    title: "Synthetic archive test",
    message: "Synthetic archive test",
    severity: "advisory",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "All wards",
    durationMinutes: 60,
    dispatchedAt: 0,
    expiresAt: 60,
    dispatchedByRole: "coordinator",
    dispatchedByName: "Synthetic desk",
    status: "stood_down",
    stoodDownAt: 0,
    acknowledgedUnits: [],
  };
  const boundary = executiveBoundary({
    archived: [
      {
        collection: "movements",
        record_id: live.id,
        closed_at: 0,
        body: { ...live, patientId: "invalid-duplicate-must-not-win" },
      },
      { collection: "broadcastAlerts", record_id: alert.id, closed_at: 0, body: alert },
    ],
    project(full, access, time) {
      assert.equal(full.state.movements.filter((row) => row.id === live.id).length, 1);
      assert.equal(full.state.movements.find((row) => row.id === live.id).patientId, live.patientId);
      assert.ok(
        full.state.broadcastAlerts.some((row) => row.id === alert.id),
        "Retained global archive is hydrated before the reporting projector scopes it",
      );
      assert.deepEqual(access.scope, { kind: "service", service: "North Metro" });
      return engine.executiveReport(full, access, time);
    },
  });
  assertExecutiveSnapshot(await boundary.store.read(actorId, boundary.view));
  for (const options of [
    { count: 5001 },
    { count: 1 },
    { archived: [{ collection: "patients", record_id: "unknown", closed_at: 0, body: { id: "unknown" } }] },
  ]) {
    const invalid = executiveBoundary(options);
    await assert.rejects(invalid.store.read(actorId, invalid.view), /Executive reporting is unavailable/);
    assert.equal(invalid.counts().projections, 0);
  }
});

test("executive membership lifetime is finite and rechecked after expensive projection", async () => {
  for (const deadline of [Infinity, NaN, at.getTime() - 1]) {
    const boundary = executiveBoundary({ deadline });
    await assert.rejects(boundary.store.read(actorId, boundary.view), /role-ended/);
    assert.equal(boundary.counts().projections, 0);
  }
  let boundary;
  boundary = executiveBoundary({
    project(...args) {
      const report = engine.executiveReport(...args);
      boundary.advance(61);
      return report;
    },
  });
  await assert.rejects(boundary.store.read(actorId, boundary.view), /role-ended/);
  await assert.rejects(boundary.store.archive(boundary.view), /does not include record access/);
  assert.equal((await boundary.store.logView(boundary.view, "synthetic-record", "patient")).status, 403);
});

test("executive command denial, replay and mismatched-command conflict all use the aggregate boundary", async () => {
  const boundary = executiveBoundary();
  await boundary.store.read(actorId, boundary.view);
  const event = { type: "ADVANCE_CLOCK", role: "demo", minutes: 1 };
  const first = await boundary.store.command(actorId, "executive-refusal", 7, event, { view: boundary.view });
  assert.equal(first.status, 422);
  assertExecutiveSnapshot(first.body.snapshot);
  const replay = await boundary.store.command(actorId, "executive-refusal", 7, event, { view: boundary.view });
  assert.equal(replay.body.replayed, true);
  assertExecutiveSnapshot(replay.body.snapshot);
  const conflict = await boundary.store.command(actorId, "executive-refusal", 6, event, { view: boundary.view });
  assert.equal(conflict.status, 422);
  assertExecutiveSnapshot(conflict.body.snapshot);
  const receipt = await boundary.store.receipt(actorId, "executive-refusal");
  assert.ok(receipt);
  assert.deepEqual(Object.keys(receipt).sort(), ["commandRevision", "outcome"]);
  assert.equal(JSON.stringify([first, replay, conflict, receipt]).includes(boundary.world.state.patients[0].id), false);
  assert.deepEqual(
    boundary.counts(),
    { projections: 4, archiveReads: 4 },
    "Uncommitted transaction replies never enter the report cache",
  );
});

const at = new Date("2026-10-25T04:00:00Z");
const actorId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";

function step(world, event) {
  const applied = engine.applyCommand(world, event, at);
  assert.equal(applied.outcome, "accepted", `Synthetic fixture event ${event.type}`);
  assert.equal(engine.validWorld(applied.world), true);
  return applied.world;
}

function fixture(answer = "declined") {
  let world = engine.seedWorld(at);
  world = step(world, {
    type: "RAISE_REFERRAL",
    role: "ed",
    edId: "jhc-ed",
    draft: {
      cohort: "Adult",
      security: "Secure",
      sex: "Male",
      gender: "Male",
      observation: { level: "general", intervalMinutes: null, reviewAt: null },
      highAcuity: false,
      legalStatus: "Voluntary",
      urgency: 2,
      legalFormCode: null,
    },
  });
  const id = world.state.movements.at(-1).id;
  world = step(world, { type: "REFER_TO_UNITS", role: "coordinator", movementId: id, unitIds: ["rph-adult-secure"] });
  if (answer === "declined")
    world = step(world, {
      type: "DECLINE",
      role: "ward",
      movementId: id,
      unitId: "rph-adult-secure",
      reason: "belongs_to_another_service",
    });
  if (answer === "accepted")
    world = step(world, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId: id,
      unitId: "rph-adult-secure",
    });
  const places = engine.accessPlaces(world);
  const siteCode = places.edSiteCode("jhc-ed");
  const access = engine.parseAccess("bed_manager", { kind: "site", siteCode });
  assert.ok(access);
  return { world, id, access };
}

async function readSnapshot(world, access, grants = [], extra = {}) {
  let reads = 0;
  const row = { data_mode: "prototype", revision: "7", payload: world };
  const store = createWorkspaceStore(
    {
      async query(sql, values) {
        assert.match(sql, /^SELECT data_mode, revision, payload FROM ward_flow\.workspaces /);
        assert.deepEqual(values, [workspaceId]);
        reads++;
        return { rows: [structuredClone(row)] };
      },
      connect() {
        assert.fail("This explicit read pool double must not open a database connection");
      },
    },
    { workspaceId, engine, clock: () => new Date(at), log: () => assert.fail("Unexpected store diagnostic") },
  );
  const view = { actorId, membershipId: null, access, grants, ...extra };
  const snapshot = await store.read(actorId, view);
  assert.equal(reads, 1);
  return snapshot;
}

test("snapshot factory adds a lifetime-bound sender sibling without changing its scoped payload (pool double)", async () => {
  const { world, id, access } = fixture();
  const before = JSON.stringify(world);
  const snapshot = await readSnapshot(world, access);
  assert.ok(snapshot.partialView, "Sender response sibling is present");
  assert.match(snapshot.accessContext, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.partialView.revision, snapshot.revision);
  assert.equal(snapshot.partialView.accessContext, snapshot.accessContext);
  assert.equal(snapshot.partialView.view.version, 1);
  assert.deepEqual(
    snapshot.partialView.view.movements.find((row) => row.id === id),
    {
      id,
      kind: "sender",
      destinationStatus: "none_found",
      nextStep: "escalate",
      progress: "none_found",
      visibleUntil: null,
    },
  );
  assert.deepEqual(snapshot.payload, withoutRecordDetail(engine.scopeWorld(world, access, at)));
  assert.equal(engine.validWorld(snapshot.payload), true);
  assert.equal(Object.hasOwn(snapshot.payload, "partialView"), false);
  assert.equal(Object.hasOwn(snapshot.payload.state, "partialView"), false);
  assert.equal(JSON.stringify(snapshot.partialView).includes("belongs_to_another_service"), false);
  assert.equal(JSON.stringify(snapshot.partialView).includes("rph-adult-secure"), false);
  assert.equal(JSON.stringify(world), before);
});

test("a sender snapshot keeps the access expiry and the sender sibling together without leaking either into the other", async () => {
  const { world, access } = fixture();
  const accessUntil = at.getTime() + 3_600_000;
  const snapshot = await readSnapshot(world, access, [], { accessUntil });
  assert.equal(snapshot.accessUntil, accessUntil);
  assert.ok(snapshot.partialView, "Sender response sibling is present beside the expiry");
  assert.equal(snapshot.partialView.accessContext, snapshot.accessContext);
  assert.equal(Object.hasOwn(snapshot.partialView, "accessUntil"), false);
  assert.equal(Object.hasOwn(snapshot.partialView.view, "accessUntil"), false);
  assert.equal(JSON.stringify(snapshot.partialView).includes("rph-adult-secure"), false);
  assert.deepEqual(snapshot.payload, withoutRecordDetail(engine.scopeWorld(world, access, at)));
});

test("engine summary uses the full world for queued and accepted destination progress without mutation", () => {
  for (const answer of ["queued", "accepted"]) {
    const { world, id, access } = fixture(answer);
    const before = JSON.stringify(world);
    const view = engine.partialViewForWorld(world, access, at);
    assert.deepEqual(
      view.movements.find((row) => row.id === id),
      {
        id,
        kind: "sender",
        destinationStatus: answer === "accepted" ? "accepted" : "awaiting_answer",
        nextStep: answer === "accepted" ? "pull" : "wait",
        progress: answer === "accepted" ? "accepted" : "awaiting_answer",
        visibleUntil: null,
      },
    );
    assert.equal(JSON.stringify(world), before);
  }
});

function senderReferralFixture(community = false) {
  let world = engine.seedWorld(at);
  const origin = world.state.units.find((unit) => unit.id === "scgh-adult-open");
  const unitIds = world.state.units
    .filter((unit) => unit.siteCode !== origin.siteCode)
    .slice(0, 2)
    .map((unit) => unit.id);
  assert.equal(unitIds.length, 2);
  const destinations = unitIds.map((unitId) => ({
    kind: "psychiatric_ward",
    unitId,
    sex: "Female",
    gender: "Female",
    secureBedNeeded: false,
    involuntaryBedNeeded: false,
    highAcuityNursingNeeded: false,
  }));
  if (community) destinations.splice(1, 1, { kind: "community_team", teamName: "Inner City Clinic" });
  world = step(world, {
    type: "RECEIVE_REFERRAL",
    role: "ward",
    originUnitId: origin.id,
    actingUnitId: origin.id,
    source: "psychiatric_ward",
    ageBand: "Adult",
    destinations,
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    urgency: 2,
    originSiteCode: origin.siteCode,
    transportNeeded: false,
    history: "Synthetic common referral",
  });
  return {
    world,
    id: world.state.referrals.at(-1).id,
    unitIds,
    accesses: [
      { role: "ward", scope: { kind: "ward", unitIds: [origin.id] } },
      { role: "bed_manager", scope: { kind: "site", siteCode: origin.siteCode } },
    ],
  };
}

test("queued sender summaries omit partial answer times from the public sibling (actual producers)", async () => {
  for (const community of [true, false]) {
    const fixture = senderReferralFixture(community);
    const world = step(
      fixture.world,
      community
        ? {
            type: "ACCEPT_REFERRAL",
            role: "community",
            referralId: fixture.id,
            destinationKind: "community_team",
            reassessmentNote: "Synthetic follow-up accepted",
            clinicalUpdate: true,
          }
        : {
            type: "DECLINE_REFERRAL",
            role: "coordinator",
            referralId: fixture.id,
            destinationKind: "psychiatric_ward",
            unitId: fixture.unitIds[0],
            reason: "belongs_to_another_service",
          },
    );
    const source = world.state.referrals.find((row) => row.id === fixture.id);
    assert.ok(source.destinations.some((row) => typeof row.decidedAt === "number"));
    const before = JSON.stringify(world);
    for (const access of fixture.accesses) {
      const direct = engine.partialViewForWorld(world, access, at).referrals.find((row) => row.id === fixture.id);
      const snapshot = await readSnapshot(world, access);
      const summary = snapshot.partialView.view.referrals.find((row) => row.id === fixture.id);
      assert.deepEqual(summary, direct);
      assert.equal(summary.kind, "sender");
      assert.equal(summary.state, "queued");
      assert.equal(summary.withdrawn, false);
      assert.equal(summary.visibleUntil, null);
      assert.equal(summary.canWithdraw, access.role === "ward");
      assert.equal(
        summary.decidedAt,
        null,
        `${access.role}: partial ${community ? "community acceptance" : "ward decline"} is not an overall decision`,
      );
      assert.equal(engine.validWorld(snapshot.payload), true);
      assert.equal(snapshot.payload.state.referrals.find((row) => row.id === fixture.id).destinations.length, 0);
    }
    assert.equal(JSON.stringify(world), before);
  }
});

test("settled and withdrawn sender summaries retain their actual decision times (actual producers)", async () => {
  for (const withdrawn of [false, true]) {
    const fixture = senderReferralFixture();
    let world = fixture.world;
    if (withdrawn)
      world = step(world, {
        type: "RECORD_REFERRER_WITHDRAWAL",
        role: "ward",
        actingUnitId: world.state.referrals.at(-1).originUnitId,
        referralId: fixture.id,
      });
    else
      for (const unitId of fixture.unitIds)
        world = step(world, {
          type: "DECLINE_REFERRAL",
          role: "coordinator",
          referralId: fixture.id,
          destinationKind: "psychiatric_ward",
          unitId,
          reason: "belongs_to_another_service",
        });
    const source = world.state.referrals.find((row) => row.id === fixture.id);
    const latest = Math.max(...source.destinations.map((row) => row.decidedAt ?? row.withdrawnAt));
    assert.equal(Number.isFinite(latest), true);
    for (const access of fixture.accesses) {
      const snapshot = await readSnapshot(world, access);
      const summary = snapshot.partialView.view.referrals.find((row) => row.id === fixture.id);
      assert.equal(summary.state, withdrawn ? "queued" : "declined");
      assert.equal(summary.withdrawn, withdrawn);
      assert.equal(summary.decidedAt, latest);
      assert.equal(summary.canWithdraw, false);
      assert.equal(engine.validWorld(snapshot.payload), true);
    }
  }
});

test("snapshot sibling is absent for ED, coordinator and an unbound store read; executive requires a membership", async () => {
  const { world } = fixture();
  for (const access of [
    { role: "ed", scope: { kind: "ed", edId: "jhc-ed" } },
    { role: "coordinator", scope: { kind: "statewide" } },
  ]) {
    const snapshot = await readSnapshot(world, access);
    assert.equal(Object.hasOwn(snapshot, "partialView"), false);
    assert.deepEqual(engine.partialViewForWorld(world, access, at), { version: 1, referrals: [], movements: [] });
  }
  const { access } = fixture();
  assert.equal(Object.hasOwn(await readSnapshot(world, access, [], { actorId: undefined }), "partialView"), false);
  await assert.rejects(readSnapshot(world, { role: "executive", scope: { kind: "statewide" } }), /role-ended/);
});

test("ward grant summaries expose restriction only and use the actual absolute grant lifetime", async () => {
  const world = engine.seedWorld(at);
  assert.equal(engine.validWorld(world), true);
  let chosen;
  for (const unit of world.state.units) {
    const candidate = { role: "ward", scope: { kind: "ward", unitIds: [unit.id] } };
    const shown = new Set(engine.scopeWorld(world, candidate, at).state.movements.map((row) => row.id));
    const movement = world.state.movements.find((row) => row.patientId && !shown.has(row.id));
    if (movement) {
      chosen = { access: candidate, id: movement.id, patientId: movement.patientId };
      break;
    }
  }
  assert.ok(chosen, "Synthetic patient-linked foreign record exists outside a ward's normal read population");
  const { access, id, patientId } = chosen;
  const before = JSON.stringify(world);
  const grants = [{ patientId, until: new Date(at.getTime() + 60_000) }];
  const snapshot = await readSnapshot(world, access, grants);
  assert.deepEqual(
    snapshot.partialView.view.movements.find((row) => row.id === id),
    {
      id,
      kind: "restricted",
      restriction: "grant",
    },
  );
  assert.equal(engine.validWorld(snapshot.payload), true);
  const expired = [{ patientId, until: at }];
  assert.equal(
    engine.partialViewForWorld(world, access, at, expired).movements.some((row) => row.id === id),
    false,
  );
  const afterExpiry = await readSnapshot(world, access, expired);
  assert.notEqual(snapshot.accessContext, afterExpiry.accessContext);
  assert.equal(afterExpiry.partialView.accessContext, afterExpiry.accessContext);
  assert.equal(JSON.stringify(world), before);
});

test("refused commands and replay use the same bound response factory without persisting display data (pool double)", async () => {
  const { world, id, access } = fixture();
  const before = JSON.stringify(world);
  const stored = { data_mode: "prototype", revision: 7, payload: world, cache_updated_at: at.toISOString() };
  let receipt;
  let released = 0;
  const query = async (sql, values = []) => {
    if (sql.startsWith("SELECT data_mode, revision, payload, date_trunc('milliseconds', updated_at)")) {
      assert.equal(
        sql,
        "SELECT data_mode, revision, payload, date_trunc('milliseconds', updated_at) AS cache_updated_at FROM ward_flow.workspaces WHERE id=$1 AND data_mode='prototype' FOR UPDATE",
      );
      assert.deepEqual(values, [workspaceId]);
      return { rows: [structuredClone(stored)], rowCount: 1 };
    }
    if (sql.startsWith("SELECT fingerprint, status, result FROM ward_flow.commands"))
      return { rows: receipt ? [structuredClone(receipt)] : [], rowCount: receipt ? 1 : 0 };
    if (sql.startsWith("INSERT INTO ward_flow.commands")) {
      receipt = { fingerprint: values[3], status: values[4], result: structuredClone(values[5]) };
      return { rows: [] };
    }
    assert.ok(["BEGIN", "COMMIT"].includes(sql) || sql.startsWith("INSERT INTO ward_flow.audit"), sql);
    return { rows: [] };
  };
  const pool = {
    query,
    connect: async () => ({
      query,
      release() {
        released++;
      },
    }),
  };
  const store = createWorkspaceStore(pool, {
    workspaceId,
    engine,
    clock: () => new Date(at),
    log: () => assert.fail("Unexpected store diagnostic"),
  });
  const view = { actorId, membershipId: null, access, grants: [] };
  // This real ward command is outside a site bed manager's existing permission. The refusal
  // must remain authoritative; the newly added read summary cannot permit the action.
  const event = {
    type: "DECLINE",
    role: "ward",
    movementId: id,
    unitId: "rph-adult-secure",
    reason: "belongs_to_another_service",
  };
  const first = await store.command(actorId, "synthetic-refused-command", 7, event, { view });
  const replay = await store.command(actorId, "synthetic-refused-command", 7, event, { view });
  assert.equal(first.status, 422);
  assert.equal(replay.status, 422);
  assert.equal(replay.body.replayed, true);
  for (const response of [first, replay]) {
    const snapshot = response.body.snapshot;
    assert.equal(snapshot.partialView.revision, snapshot.revision);
    assert.equal(snapshot.partialView.accessContext, snapshot.accessContext);
    assert.deepEqual(snapshot.partialView.view, engine.partialViewForWorld(world, access, at));
    assert.equal(engine.validWorld(snapshot.payload), true);
  }
  assert.equal(JSON.stringify(receipt).includes("partialView"), false);
  assert.equal(JSON.stringify(world), before);
  assert.equal(released, 2);
});

function senderAlertFixture() {
  let { world, id, access } = fixture("queued");
  const targets = ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure"];
  for (const unitId of targets) {
    if (unitId !== targets[0])
      world = step(world, { type: "REFER_TO_UNITS", role: "coordinator", movementId: id, unitIds: [unitId] });
    world = step(world, {
      type: "DECLINE",
      role: "ward",
      movementId: id,
      unitId,
      reason: "belongs_to_another_service",
    });
  }
  return { world, id, access, targets };
}

test("a sender still hears the existing multiple-decline alert after its wire copy hides foreign answers", () => {
  const { world, id, access, targets } = senderAlertFixture();
  const before = JSON.stringify(world);
  const wire = engine.scopeWorld(world, access, at);
  assert.deepEqual(wire.state.movements.find((row) => row.id === id).declines, []);
  const expected = engine.actNowAlerts(world, at).find((row) => row.id === `declines-${id}`);
  assert.ok(expected, "The actual command-produced full world has the existing alert");
  assert.deepEqual(
    engine.scopedActNowAlerts(world, access, at).find((row) => row.id === expected.id),
    expected,
  );
  assert.deepEqual(Object.keys(expected).sort(), ["id", "kind", "site"]);
  for (const unitId of targets)
    assert.equal(JSON.stringify(engine.scopedActNowAlerts(world, access, at)).includes(unitId), false);
  assert.equal(JSON.stringify(world), before);
});

test("a sender still hears an overdue referral-decision alert while foreign pending units remain masked", () => {
  const { world, id, access } = fixture("queued");
  const later = new Date(at.getTime() + (world.state.configuration.referralDecisionTargetMinutes + 1) * 60_000);
  const before = JSON.stringify(world);
  const wire = engine.scopeWorld(world, access, later);
  assert.deepEqual(wire.state.movements.find((row) => row.id === id).referredUnitIds, []);
  const expected = engine.actNowAlerts(world, later).find((row) => row.id === `target-referral-decision-${id}`);
  assert.ok(expected, "The real pending request reaches its configured target");
  assert.deepEqual(
    engine.scopedActNowAlerts(world, access, later).find((row) => row.id === expected.id),
    expected,
  );
  assert.equal(JSON.stringify(world), before);
});

test("receiving desks and other roles keep their ordinary scoped alert population", () => {
  let { world, id } = senderAlertFixture();
  world = step(world, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    movementId: id,
    unitIds: ["bty-adult-secure"],
  });
  const receiver = { role: "ward", scope: { kind: "ward", unitIds: ["bty-adult-secure"] } };
  assert.equal(
    engine.partialViewForWorld(world, receiver, at).movements.find((row) => row.id === id)?.kind,
    "restricted",
  );
  const places = engine.accessPlaces(world);
  const site = places.unitSiteCode("bty-adult-secure");
  for (const access of [
    receiver,
    { role: "bed_manager", scope: { kind: "site", siteCode: site } },
    { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } },
    { role: "ed", scope: { kind: "ed", edId: "jhc-ed" } },
    { role: "officer", scope: { kind: "jobs", service: "North Metro" } },
  ]) {
    const expected = engine
      .actNowAlerts(engine.scopeWorld(world, access, at), at)
      .filter((alert) => alert.kind === (access.role === "officer" ? "job" : "act-now"));
    assert.deepEqual(engine.scopedActNowAlerts(world, access, at), expected);
  }
  assert.equal(
    engine.scopedActNowAlerts(world, receiver, at).some((row) => row.id === `declines-${id}`),
    false,
  );
  assert.deepEqual(engine.scopedActNowAlerts(world, { role: "executive", scope: { kind: "statewide" } }, at), []);
});

test("sender alert restoration ends with its actual source-stay entitlement while a receiving row survives", () => {
  const fixture = senderAlertFixture();
  const world = structuredClone(fixture.world);
  const template = world.state.admissions.find((row) => row.patientId && !fixture.targets.includes(row.unitId));
  assert.ok(template, "The synthetic world supplies a joined own stay outside the foreign targets");
  const now = engine.worldNow(world, at);
  const leftAt = now - 1;
  const stay = {
    ...template,
    id: "AD-SYNTHETIC-ALERT-SOURCE",
    state: "departed",
    pulledAt: leftAt - 30,
    arrivedAt: leftAt - 20,
    leftAt,
    movementId: null,
    referralId: null,
  };
  delete stay.bedNumber;
  world.state.admissions.push(stay);
  const movement = world.state.movements.find((row) => row.id === fixture.id);
  Object.assign(movement, { patientId: stay.patientId, sourceAdmissionId: stay.id, referredUnitIds: [stay.unitId] });
  const access = { role: "ward", scope: { kind: "ward", unitIds: [stay.unitId] } };
  assert.equal(engine.validWorld(world), true);
  const before = JSON.stringify(world);
  const alertId = `declines-${fixture.id}`;
  const summary = engine.partialViewForWorld(world, access, at).movements.find((row) => row.id === fixture.id);
  assert.equal(summary?.kind, "sender");
  assert.equal(typeof summary.visibleUntil, "number");
  const boundary = new Date(at.getTime() + (summary.visibleUntil - now) * 60_000);
  assert.ok(engine.scopedActNowAlerts(world, access, boundary).some((row) => row.id === alertId));
  const after = new Date(boundary.getTime() + 60_000);
  assert.equal(
    engine.scopeWorld(world, access, after).state.movements.some((row) => row.id === fixture.id),
    true,
  );
  assert.equal(
    engine.partialViewForWorld(world, access, after).movements.find((row) => row.id === fixture.id)?.kind,
    "restricted",
  );
  assert.equal(
    engine.scopedActNowAlerts(world, access, after).some((row) => row.id === alertId),
    false,
  );
  assert.equal(JSON.stringify(world), before);
});

test("sender alert parity retains existing snooze and target boundary rules", () => {
  const { world, id, access } = senderAlertFixture();
  const now = engine.worldNow(world, at);
  const alertId = `declines-${id}`;
  world.state.inboxSnoozes[alertId] = [
    { at: now, by: "coordinator", kind: "snoozed", until: now + 10, reason: "awaiting_call_back" },
  ];
  assert.equal(engine.validWorld(world), true);
  assert.equal(
    engine.scopedActNowAlerts(world, access, at).some((row) => row.id === alertId),
    false,
  );
  const returns = new Date(at.getTime() + 10 * 60_000);
  assert.ok(engine.scopedActNowAlerts(world, access, returns).some((row) => row.id === alertId));
  const pending = fixture("queued");
  const due = new Date(at.getTime() + pending.world.state.configuration.referralDecisionTargetMinutes * 60_000);
  const decisionId = `target-referral-decision-${pending.id}`;
  assert.equal(
    engine.scopedActNowAlerts(pending.world, pending.access, due).some((row) => row.id === decisionId),
    false,
  );
  assert.ok(
    engine
      .scopedActNowAlerts(pending.world, pending.access, new Date(due.getTime() + 60_000))
      .some((row) => row.id === decisionId),
  );
});
