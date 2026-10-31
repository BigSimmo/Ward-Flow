// @ts-check
// Josh's access decisions of 31 Oct 2026 ("yes to all as amended"), enforced by the shared server's
// engine. Synthetic seed wards, teams and journeys only.
import assert from "node:assert/strict";
import { test } from "node:test";

const at = new Date("2026-10-07T10:00:00Z");

async function setup() {
  const engine = await import("./dist/engine.mjs");
  return { engine, world: engine.seedWorld(at) };
}

test("41: a ward desk is sent its own ward's sign-offs only, and may sign off no other ward", async () => {
  const { engine, world } = await setup();
  const [wardA, wardB] = world.state.units;
  const signed = {
    ...world,
    state: {
      ...world.state,
      handoverSignOffs: [
        { at: 1, by: "coordinator" },
        { at: 2, by: "ward", unitId: wardA.id },
        { at: 3, by: "ward", unitId: wardB.id },
      ],
    },
  };
  const ward = engine.parseAccess("ward", { kind: "ward", unitIds: [wardA.id] });
  assert.ok(ward, "a synthetic ward desk");
  assert.deepEqual(engine.scopeWorld(signed, ward, at).state.handoverSignOffs, [
    { at: 2, by: "ward", unitId: wardA.id },
  ]);
  // A sign-off saved before it named a ward is never given one: only the statewide desk reads it.
  assert.equal(engine.scopeWorld(signed, engine.STATEWIDE, at).state.handoverSignOffs.length, 3);
  const command = (unitId) => ({ type: "RECORD_HANDOVER_SIGN_OFF", role: "ward", ...(unitId ? { unitId } : {}) });
  assert.equal(engine.commandRefusal(world, ward, command(), at), "A ward's handover sign-off names its ward.");
  assert.notEqual(engine.commandRefusal(world, ward, command(wardB.id), at), null);
  assert.equal(engine.commandRefusal(world, ward, command(wardA.id), at), null);
  const { world: next } = engine.applyCommand(world, command(wardA.id), at);
  assert.deepEqual(next.state.handoverSignOffs.at(-1)?.unitId, wardA.id);
});

test("42: a service access admin gives its own service's team and officer roles; a service coordinator gives none", async () => {
  const { engine, world } = await setup();
  const south = { kind: "service", service: "South Metro" };
  assert.equal(engine.scopeWithin(world, { kind: "team", teamName: "Rockingham" }, south), true);
  assert.equal(engine.scopeWithin(world, { kind: "team", teamName: "Joondalup" }, south), false);
  assert.equal(engine.scopeWithin(world, { kind: "jobs", service: "South Metro" }, south), true);
  assert.equal(engine.scopeWithin(world, { kind: "jobs", service: "North Metro" }, south), false);
  const admin = engine.parseAccess("admin", south);
  const coordinator = engine.parseAccess("coordinator", south);
  assert.ok(admin && coordinator, "synthetic service desks");
  assert.equal(engine.managesAccess(admin), true);
  assert.equal(engine.managesAccess(coordinator), false);
  const officer = engine.parseAccess("officer", { kind: "jobs", service: "South Metro" });
  assert.ok(officer, "a synthetic South Metro officer role");
  const membership = { kind: "role", grantedBy: "someone-else", access: officer };
  assert.equal(engine.revokeRefusal(world, admin, "admin-1", membership), null);
  assert.equal(
    engine.revokeRefusal(world, coordinator, "coordinator-1", membership),
    "Granting and removing roles is not part of your role.",
  );
});

test("43: an ED desk may no longer record a clinical contact", async () => {
  const { engine, world } = await setup();
  const ed = engine.parseAccess("ed", { kind: "ed", edId: "fsh-ed" });
  assert.ok(ed, "a synthetic ED desk");
  const contact = { type: "RECORD_CLINICAL_CONTACT", role: "ed", teamId: "rockingham" };
  assert.equal(engine.commandRefusal(world, ed, contact, at), "This change is not part of your role.");
});

test("44: the access admin's feed carries no patient-linked broadcast, only notices that name nobody", async () => {
  const { engine, world } = await setup();
  const unit = world.state.units[0];
  const notice = {
    id: "BA-SYN-DOWNTIME",
    kind: "directive",
    title: "Synthetic downtime notice",
    message: "Demo alert. Not a live broadcast. Ward Flow is down for maintenance at 22:00.",
    severity: "advisory",
    category: "statutory_advisory",
    targetScope: "all",
    targetScopeLabel: "All desks",
    durationMinutes: 60,
    dispatchedAt: 0,
    expiresAt: 60,
    dispatchedByRole: "coordinator",
    dispatchedByName: "Bed coordinator",
    status: "active",
    acknowledgedUnits: [],
  };
  const pullNow = {
    ...notice,
    id: "BA-SYN-PULL",
    kind: "pull_now",
    movementId: world.state.movements[0].id,
    targetUnitIds: [unit.id],
  };
  const withAlerts = { ...world, state: { ...world.state, broadcastAlerts: [notice, pullNow] } };
  for (const scope of [{ kind: "statewide" }, { kind: "service", service: "East Metro" }]) {
    const admin = engine.parseAccess("admin", scope);
    assert.ok(admin, "a synthetic access admin");
    const sent = engine.scopeWorld(withAlerts, admin, at).state.broadcastAlerts.map((alert) => alert.id);
    assert.deepEqual(sent, ["BA-SYN-DOWNTIME"]);
  }
});

test("46: a site bed manager is sent no other site's patient for its bed meeting agenda", async () => {
  const { engine, world } = await setup();
  const places = engine.accessPlaces(world);
  const siteCode = world.state.units[0].siteCode;
  const bedManager = engine.parseAccess("bed_manager", { kind: "site", siteCode });
  assert.ok(bedManager, "a synthetic site bed manager");
  const sent = engine.scopeWorld(world, bedManager, at).state;
  const otherSite = world.state.admissions.filter((admission) => places.unitSiteCode(admission.unitId) !== siteCode);
  assert.ok(otherSite.length > 0, "the seed has patients at other sites");
  const sentIds = new Set(sent.admissions.map((admission) => admission.id));
  for (const admission of otherSite) assert.equal(sentIds.has(admission.id), false, "another site's stay is not sent");
  for (const admission of sent.admissions) assert.equal(places.unitSiteCode(admission.unitId), siteCode);
  // A patient with no stay at this site and no journey from its ED or to its wards is another site's.
  const atSite = (unitId) => typeof unitId === "string" && places.unitSiteCode(unitId) === siteCode;
  const linked = new Set([
    ...world.state.admissions.filter((admission) => atSite(admission.unitId)).map((a) => a.patientId),
    ...world.state.movements
      .filter(
        (movement) =>
          places.edSiteCode(movement.originEdId) === siteCode ||
          atSite(movement.acceptedUnitId) ||
          (movement.referredUnitIds ?? []).some(atSite),
      )
      .map((movement) => movement.patientId),
  ]);
  const elsewhere = otherSite.map((admission) => admission.patientId).filter((id) => id && !linked.has(id));
  assert.ok(elsewhere.length > 0, "the seed has patients with no link to this site");
  const sentPatients = new Set(sent.patients.map((patient) => patient.id));
  for (const id of elsewhere) assert.equal(sentPatients.has(id), false, "another site's patient is not sent");
  // Read only: the agenda's own action is the coordinator's, so the server refuses it from this desk.
  const record = {
    type: "RECORD_BED_MEETING_ACTION",
    role: "bed_manager",
    subject: { kind: "admission", id: sent.admissions[0]?.id ?? "none" },
  };
  assert.equal(engine.commandRefusal(world, bedManager, record, at), "This change is not part of your role.");
});
