import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * D-222 (R-STRUCT-6): on the signed-in site the server names the desk on every History line, from
 * the membership, never from the browser. Offline: the engine alone, no database.
 */
const at = new Date("2026-10-07T10:00:00Z");
const coordinator = { role: "coordinator", scope: { kind: "statewide" } };

function intake(world, role, extra = {}) {
  const unit = world.state.units.find((candidate) => !candidate.intakeWindow);
  return {
    unitId: unit.id,
    event: {
      type: "SET_INTAKE_WINDOW",
      role,
      unitId: unit.id,
      actingUnitId: unit.id,
      intake: { from: 1000, to: 1200 },
      ...extra,
    },
  };
}

test("a coordinator's step on a ward page is recorded as the coordinator, for that ward", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const { unitId, event } = intake(world, "ward");
  const sent = engine.deskCommand(coordinator, event);
  assert.equal(sent.role, "coordinator");
  const applied = engine.applyCommand(world, sent, at, { access: coordinator });
  assert.equal(applied.outcome, "accepted");
  const [line] = applied.changes.domainAudit;
  assert.equal(applied.changes.domainAudit.length, 1);
  assert.deepEqual(
    { category: line.category, action: line.action, outcome: line.outcome },
    { category: "beds-and-wards", action: "SET_INTAKE_WINDOW", outcome: "accepted" },
  );
  assert.deepEqual(line.actor, {
    role: "coordinator",
    actingUnitId: unitId,
    attribution: "desk-session",
    scope: coordinator.scope,
  });
  const unit = applied.world.state.units.find((candidate) => candidate.id === unitId);
  assert.equal(unit.intakeWindow.by, "Bed coordinator");
});

test("a desk stamp the browser sent is dropped and replaced by the membership's", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const ward = { role: "ward", scope: { kind: "ward", unitIds: [world.state.units[0].id] } };
  const { event } = intake(world, "ward", { desk: { role: "coordinator", scope: { kind: "statewide" } } });
  assert.equal(Object.hasOwn(engine.deskCommand(coordinator, event), "desk"), false);
  assert.equal(Object.hasOwn(engine.deskCommand(ward, event), "desk"), false);
  const applied = engine.applyCommand(
    world,
    { ...event, actingUnitId: ward.scope.unitIds[0], unitId: ward.scope.unitIds[0] },
    at,
    {
      access: ward,
    },
  );
  const line = applied.changes.domainAudit.at(-1);
  assert.equal(line.actor.role, "ward");
  assert.deepEqual(line.actor.scope, ward.scope);
});

test("a save with no membership (before migration 8) keeps today's actor", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const { event } = intake(world, "coordinator", { desk: { role: "ward", scope: { kind: "statewide" } } });
  const applied = engine.applyCommand(world, event, at);
  const line = applied.changes.domainAudit.at(-1);
  assert.equal(line.actor.attribution, "declared-prototype-role");
  assert.equal(line.actor.role, "coordinator");
});

test("a coordinator's Delivered keeps the officer's step, and the line names the coordinator", async () => {
  const engine = await import("./dist/engine.mjs");
  const sent = engine.deskCommand(coordinator, { type: "PATIENT_ARRIVED", role: "officer", movementId: "WF-001" });
  assert.equal(sent.role, "officer");
  const marked = engine.deskCommand(coordinator, { type: "MARK_NOTICE_READ", role: "ward", noticeId: "n" });
  assert.equal(marked.role, "ward");
  const demo = engine.deskCommand(coordinator, { type: "ADVANCE_CLOCK", role: "demo", minutes: 5 });
  assert.equal(demo.role, "demo");
});

test("only a well-formed display name is stamped", async () => {
  const engine = await import("./dist/engine.mjs");
  const world = engine.seedWorld(at);
  const named = (account) =>
    engine.applyCommand(world, intake(world, "coordinator").event, at, { access: coordinator, account }).changes
      .domainAudit[0].actor.account;
  assert.equal(named("L. Hart"), "L. Hart");
  assert.equal(named("<script>"), undefined);
  assert.equal(named(null), undefined);
});
