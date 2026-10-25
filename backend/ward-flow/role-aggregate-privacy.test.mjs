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
