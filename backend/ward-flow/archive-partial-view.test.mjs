// @ts-check
// History's archived records carry the same kind of sender progress summary as the live workspace
// (the open review finding on PR 745). The summary is worked out on the server from the full,
// unmasked records, never rebuilt from the masked copies a desk is sent. Synthetic data only.
import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "./dist/engine.mjs";
import { LATEST_MIGRATION } from "./migrations.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { planSave } from "./records.mjs";

const at = new Date("2026-10-25T04:00:00Z");
const actorId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const REVISION = 7;

function step(world, event) {
  const applied = engine.applyCommand(world, event, at);
  assert.equal(applied.outcome, "accepted", `Synthetic fixture event ${event.type}`);
  assert.equal(engine.validWorld(applied.world), true);
  return applied.world;
}

/** An emergency department referral declined by the only ward it was sent to (a closed journey). */
function movementFixture() {
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
  world = step(world, {
    type: "DECLINE",
    role: "ward",
    movementId: id,
    unitId: "rph-adult-secure",
    reason: "belongs_to_another_service",
  });
  const siteCode = engine.accessPlaces(world).edSiteCode("jhc-ed");
  return { world, id, foreignUnitIds: ["rph-adult-secure"], siteCode };
}

/** A ward's referral to two wards at another site, declined by both. */
function referralFixture() {
  let world = engine.seedWorld(at);
  const origin = world.state.units.find((unit) => unit.id === "scgh-adult-open");
  const foreignUnitIds = world.state.units
    .filter((unit) => unit.siteCode !== origin.siteCode)
    .slice(0, 2)
    .map((unit) => unit.id);
  assert.equal(foreignUnitIds.length, 2);
  world = step(world, {
    type: "RECEIVE_REFERRAL",
    role: "ward",
    originUnitId: origin.id,
    actingUnitId: origin.id,
    source: "psychiatric_ward",
    ageBand: "Adult",
    destinations: foreignUnitIds.map((unitId) => ({
      kind: "psychiatric_ward",
      unitId,
      sex: "Female",
      gender: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    })),
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    urgency: 2,
    originSiteCode: origin.siteCode,
    transportNeeded: false,
    history: "Synthetic common referral",
  });
  const id = world.state.referrals.at(-1).id;
  for (const unitId of foreignUnitIds)
    world = step(world, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      referralId: id,
      destinationKind: "psychiatric_ward",
      unitId,
      reason: "belongs_to_another_service",
    });
  return { world, id, foreignUnitIds, origin };
}

/**
 * The world with these records moved out of the live lists, as the archive leaves it.
 * @param {any} world
 * @param {{ movementIds?: string[], referralIds?: string[] }} ids
 */
function archived(world, { movementIds = [], referralIds = [] }) {
  const live = structuredClone(world);
  const records = [];
  /** @type {Array<["movements" | "referrals", string[]]>} */
  const groups = [
    ["movements", movementIds],
    ["referrals", referralIds],
  ];
  for (const [collection, ids] of groups) {
    for (const id of ids) {
      const body = live.state[collection].find((/** @type {{ id: string }} */ row) => row.id === id);
      assert.ok(body, `${collection} ${id} is in the fixture`);
      records.push({ collection, id, closedAt: 100, body: structuredClone(body) });
      live.state[collection] = live.state[collection].filter((/** @type {{ id: string }} */ row) => row.id !== id);
    }
  }
  // Real archiving leaves a record live while an undo step still names it; the fixture's steps are old.
  live.state.undoRecords = [];
  assert.equal(engine.validWorld(structuredClone(live)), true, "the live world still passes the shared check");
  return { live, records };
}

function store(live, records, clock = at) {
  const plan = planSave([], live, REVISION);
  const pool = {
    async query(sql) {
      if (/max\(version\)/.test(sql)) return { rows: [{ version: LATEST_MIGRATION }] };
      if (/FROM ward_flow\.archived_records/.test(sql))
        return {
          rows: records.map((record) => ({
            collection: record.collection,
            record_id: record.id,
            closed_at: record.closedAt,
            body: structuredClone(record.body),
            archived: records.length,
          })),
        };
      if (/FROM ward_flow\.workspaces w/.test(sql))
        return {
          rows: [
            {
              data_mode: "prototype",
              revision: String(REVISION),
              payload: structuredClone(plan.core),
              cache_revision: String(REVISION),
              cache_updated_at: new Date(at),
              records: plan.upserts.map((part) => ({
                collection: part.collection,
                record_id: part.recordId,
                kind: part.kind,
                ordinal: part.ordinal,
                revision: part.revision,
                fresh: true,
                body: structuredClone(part.body),
              })),
            },
          ],
        };
      assert.fail(`Unexpected query: ${sql.slice(0, 80)}`);
    },
    connect() {
      assert.fail("The archive read must not open a transaction");
    },
  };
  return createWorkspaceStore(pool, {
    workspaceId,
    engine,
    clock: () => new Date(clock),
    log: () => assert.fail("Unexpected store diagnostic"),
  });
}

const viewFor = (access, extra = {}) => ({ actorId, membershipId: null, access, grants: [], ...extra });
const bedManager = (siteCode) => engine.parseAccess("bed_manager", { kind: "site", siteCode });

test("a bed manager's archive reply carries a bound sender summary for the archived referral, with no foreign unit", async () => {
  const referral = referralFixture();
  const access = bedManager(referral.origin.siteCode);
  assert.ok(access);
  const { live, records } = archived(referral.world, { referralIds: [referral.id] });
  const reply = await store(live, records).archive(viewFor(access));

  assert.ok(reply.partialView, "the reply has a sender summary beside the records");
  assert.equal(reply.partialView.revision, REVISION);
  assert.match(reply.partialView.accessContext, /^[a-f0-9]{64}$/);
  assert.equal(reply.revision, REVISION, "the reply names the revision the summary was worked out at");
  const row = reply.partialView.view.referrals.find((entry) => entry.id === referral.id);
  assert.deepEqual(row, {
    id: referral.id,
    kind: "sender",
    state: "declined",
    withdrawn: false,
    decidedAt: row.decidedAt,
    visibleUntil: row.visibleUntil,
    canWithdraw: false,
    informationNeeds: [],
  });
  assert.equal(Number.isFinite(row.decidedAt), true);
  assert.equal(Number.isFinite(row.visibleUntil), true, "a time only, never a record permission");
  // Only categories: no foreign unit id, name or decline reason anywhere in the sibling.
  const text = JSON.stringify(reply.partialView);
  for (const unitId of referral.foreignUnitIds) assert.equal(text.includes(unitId), false, unitId);
  assert.equal(text.includes("belongs_to_another_service"), false);
  assert.equal(Object.hasOwn(reply.partialView.view, "destinations"), false);
});

test("the summary comes from the full records: the masked copy a desk is sent hides the outcome the summary reports", async () => {
  const referral = referralFixture();
  const access = bedManager(referral.origin.siteCode);
  const { live, records } = archived(referral.world, { referralIds: [referral.id] });
  const reply = await store(live, records).archive(viewFor(access));
  const shown = reply.records.find((record) => record.body.id === referral.id);
  assert.ok(shown, "the desk is sent its own masked copy");
  assert.equal(shown.body.destinations.length, 0, "the masked copy no longer says who declined");
  assert.ok(reply.partialView);
  const row = reply.partialView.view.referrals.find((entry) => entry.id === referral.id);
  assert.equal(row.state, "declined", "the outcome comes from the unmasked source");
  assert.equal(JSON.stringify(reply.partialView).includes(referral.foreignUnitIds[0]), false);
});

test("an archived movement gets destination progress for the bed manager who sent it, with no foreign unit", async () => {
  const movement = movementFixture();
  const access = bedManager(movement.siteCode);
  const { live, records } = archived(movement.world, { movementIds: [movement.id] });
  const reply = await store(live, records).archive(viewFor(access));
  assert.ok(reply.partialView);
  assert.deepEqual(
    reply.partialView.view.movements.find((entry) => entry.id === movement.id),
    {
      id: movement.id,
      kind: "sender",
      destinationStatus: "none_found",
      nextStep: "escalate",
      progress: "none_found",
      visibleUntil: null,
    },
  );
  const text = JSON.stringify(reply.partialView);
  for (const unitId of movement.foreignUnitIds) assert.equal(text.includes(unitId), false, unitId);
  assert.equal(text.includes("belongs_to_another_service"), false);
});

test("the archive summary is exactly the engine's, limited to the archived records the desk is shown", async () => {
  const referral = referralFixture();
  const access = bedManager(referral.origin.siteCode);
  const { live, records } = archived(referral.world, { referralIds: [referral.id] });
  const reply = await store(live, records).archive(viewFor(access));
  assert.ok(reply.partialView);
  assert.deepEqual(
    reply.partialView.view,
    engine.archivePartialViewForWorld(structuredClone(live), records, access, at, []),
  );
  const shown = new Set(reply.records.map((record) => record.body.id));
  for (const row of [...reply.partialView.view.referrals, ...reply.partialView.view.movements])
    assert.equal(shown.has(row.id), true, `${row.id} is an archived record this desk is shown`);
});

test("a desk that cannot see an archived record gets no summary for it", async () => {
  const referral = referralFixture();
  const { live, records } = archived(referral.world, { referralIds: [referral.id] });
  // A ward that neither sent the referral nor was one of its destinations.
  const unrelated = referral.world.state.units.find(
    (unit) => unit.id !== referral.origin.id && !referral.foreignUnitIds.includes(unit.id),
  );
  const other = engine.parseAccess("ward", { kind: "ward", unitIds: [unrelated.id] });
  assert.ok(other);
  const reply = await store(live, records).archive(viewFor(other));
  assert.equal(
    reply.records.some((record) => record.body.id === referral.id),
    false,
  );
  assert.ok(reply.partialView, "a sender desk still gets the (empty) bound sibling");
  assert.deepEqual(reply.partialView.view, { version: 1, referrals: [], movements: [] });
  assert.equal(JSON.stringify(reply.partialView).includes(referral.id), false);
});

test("roles that are not sender desks, and an unbound read, get records as before and no summary", async () => {
  const referral = referralFixture();
  const { live, records } = archived(referral.world, { referralIds: [referral.id] });
  for (const access of [
    { role: "ed", scope: { kind: "ed", edId: "jhc-ed" } },
    { role: "executive", scope: { kind: "statewide" } },
    { role: "coordinator", scope: { kind: "statewide" } },
  ]) {
    const reply = await store(live, records).archive(viewFor(access));
    assert.equal(Object.hasOwn(reply, "partialView"), false, access.role);
    assert.equal(
      engine.archivePartialViewForWorld(live, records, access, at).referrals.length +
        engine.archivePartialViewForWorld(live, records, access, at).movements.length,
      0,
      access.role,
    );
  }
  const unbound = await store(live, records).archive(undefined);
  assert.equal(Object.hasOwn(unbound, "partialView"), false);
  assert.equal(unbound.records.length, records.length);
});

test("a ward desk past its sender window gets no sender summary for an old archived referral", async () => {
  const referral = referralFixture();
  const { live, records } = archived(referral.world, { referralIds: [referral.id] });
  const access = engine.parseAccess("ward", { kind: "ward", unitIds: [referral.origin.id] });
  assert.ok(access);
  const soon = await store(live, records).archive(viewFor(access));
  assert.ok(soon.partialView);
  assert.equal(soon.partialView.view.referrals.find((entry) => entry.id === referral.id)?.kind, "sender");
  const later = new Date(at.getTime() + 60 * 24 * 60 * 60_000);
  const old = await store(live, records, later).archive(viewFor(access));
  assert.ok(old.partialView);
  assert.notEqual(old.partialView.view.referrals.find((entry) => entry.id === referral.id)?.kind, "sender");
  assert.equal(JSON.stringify(old.partialView).includes(referral.foreignUnitIds[0]), false);
});

test("the archive summary is bound to the desk's access view and changes with it", async () => {
  const referral = referralFixture();
  const { live, records } = archived(referral.world, { referralIds: [referral.id] });
  const read = (access, extra) => store(live, records).archive(viewFor(access, extra));
  const first = await read(bedManager(referral.origin.siteCode));
  const again = await read(bedManager(referral.origin.siteCode));
  assert.ok(first.partialView && again.partialView);
  assert.equal(first.partialView.accessContext, again.partialView.accessContext);
  const ward = await read(engine.parseAccess("ward", { kind: "ward", unitIds: [referral.origin.id] }));
  assert.ok(ward.partialView);
  assert.notEqual(first.partialView.accessContext, ward.partialView.accessContext);
});

test("a ward the referral was sent to gets no sender progress for it, and nothing about the other destination", async () => {
  const referral = referralFixture();
  const { live, records } = archived(referral.world, { referralIds: [referral.id] });
  const [first, second] = referral.foreignUnitIds;
  const receiver = engine.parseAccess("ward", { kind: "ward", unitIds: [first] });
  assert.ok(receiver);
  const reply = await store(live, records).archive(viewFor(receiver));
  assert.ok(reply.partialView);
  const rows = reply.partialView.view.referrals.filter((entry) => entry.id === referral.id);
  assert.equal(
    rows.every((entry) => entry.kind === "restricted"),
    true,
  );
  assert.equal(JSON.stringify(reply).includes(second), false, "the other destination is never named");
});
