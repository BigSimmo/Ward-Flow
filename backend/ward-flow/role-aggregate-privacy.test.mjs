import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "./dist/engine.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

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
  assert.deepEqual(snapshot.payload, engine.scopeWorld(world, access, at));
  assert.equal(engine.validWorld(snapshot.payload), true);
  assert.equal(Object.hasOwn(snapshot.payload, "partialView"), false);
  assert.equal(Object.hasOwn(snapshot.payload.state, "partialView"), false);
  assert.equal(JSON.stringify(snapshot.partialView).includes("belongs_to_another_service"), false);
  assert.equal(JSON.stringify(snapshot.partialView).includes("rph-adult-secure"), false);
  assert.equal(JSON.stringify(world), before);
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

test("snapshot sibling is absent for ED, executive, coordinator and an unbound store read", async () => {
  const { world } = fixture();
  for (const access of [
    { role: "ed", scope: { kind: "ed", edId: "jhc-ed" } },
    { role: "executive", scope: { kind: "statewide" } },
    { role: "coordinator", scope: { kind: "statewide" } },
  ]) {
    const snapshot = await readSnapshot(world, access);
    assert.equal(Object.hasOwn(snapshot, "partialView"), false);
    assert.deepEqual(engine.partialViewForWorld(world, access, at), { version: 1, referrals: [], movements: [] });
  }
  const { access } = fixture();
  assert.equal(Object.hasOwn(await readSnapshot(world, access, [], { actorId: undefined }), "partialView"), false);
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
  const stored = { data_mode: "prototype", revision: 7, payload: world };
  let receipt;
  let released = 0;
  const query = async (sql, values = []) => {
    if (sql.startsWith("SELECT data_mode, revision, payload FROM ward_flow.workspaces")) {
      assert.match(sql, /FOR UPDATE$/);
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
