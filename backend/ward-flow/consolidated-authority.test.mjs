// Synthetic SQL scheduling tests of the actual store; no database or network.
import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "./dist/engine.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const at = new Date("2026-11-04T12:00:00Z");
const actorId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
function fixture({
  endDuringRead = false,
  scopeDuringRead = false,
  expireDuringRead = false,
  many = false,
  existingCover = false,
  version = 16,
  bootstrapCoordinatorIds = /** @type {((atMs: number) => string[]) | undefined} */ (undefined),
} = {}) {
  const world = engine.seedWorld(at);
  const access = { role: "admin", scope: { kind: "statewide" } };
  const expiry = new Date(at.getTime() + 3600000);
  let ended = false;
  let now = at.getTime();
  const granted = existingCover
    ? [
        {
          id: "55555555-5555-4555-8555-555555555555",
          actor_id: "44444444-4444-4444-8444-444444444444",
          role: "ward",
          scope: { kind: "ward", unitIds: [world.state.units[0].id] },
          kind: "cover",
          granted_by: actorId,
          granted_at: at,
          expires_at: new Date(at.getTime() + 1800000),
        },
      ]
    : [];
  let changed = false;
  let locked = false;
  const queries = [];
  const query = async (sql, values = []) => {
    queries.push(sql);
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
    if (sql.startsWith("SELECT max(version)")) return { rows: [{ version: 16 }] };
    if (sql.includes("FROM ward_flow.workspaces")) {
      if (sql.includes("FOR ")) locked = true;
      return { rows: [{ data_mode: "prototype", revision: 1, payload: structuredClone(world), cache_updated_at: at }] };
    }
    if (sql.startsWith("SELECT id, role, scope")) {
      if (ended || new Date(values[2]).getTime() >= expiry.getTime()) return { rows: [] };
      const row = {
        id: membershipId,
        ...access,
        scope: changed ? { kind: "service", service: "North Metro" } : access.scope,
        kind: "role",
        last_used_at: at,
        expires_at: expiry,
      };
      const rows = many
        ? Array.from({ length: 21 }, (_, i) => ({ ...row, id: i === 20 ? membershipId : `synthetic-${i}` }))
        : [row];
      return { rows: sql.includes("LIMIT 20") ? rows.slice(0, 20) : rows };
    }
    if (sql.startsWith("SELECT patient_id, opened_at, until")) return { rows: [] };
    if (sql.includes("FROM ward_flow.audit")) {
      ended = endDuringRead;
      changed = scopeDuringRead;
      if (expireDuringRead) now = expiry.getTime();
      return { rows: [{ sequence: "1", action: "ACCESS_GRANT", changes: {} }] };
    }
    if (sql.startsWith("UPDATE ward_flow.memberships") || sql.startsWith("INSERT INTO ward_flow.audit"))
      return { rows: [] };
    if (sql.startsWith("SELECT * FROM ward_flow.memberships WHERE"))
      return {
        rows: granted.filter(
          (row) =>
            row.actor_id === values[1] &&
            row.role === values[2] &&
            JSON.stringify(row.scope) === values[3] &&
            row.expires_at.getTime() === values[5].getTime() &&
            (!sql.includes("kind='role'") || row.kind === "role"),
        ),
      };
    if (sql.startsWith("INSERT INTO ward_flow.memberships")) {
      const row = {
        id: values[0],
        actor_id: values[2],
        role: values[3],
        scope: values[4],
        granted_by: values[5],
        granted_at: values[6],
        expires_at: values[7],
        kind: "role",
      };
      granted.push(row);
      return { rows: [row] };
    }
    assert.fail(`Unexpected SQL: ${sql}`);
  };
  const store = createWorkspaceStore(
    { query, connect: async () => ({ query, release() {} }) },
    {
      workspaceId: "33333333-3333-4333-8333-333333333333",
      engine,
      clock: () => new Date(now),
      ...(bootstrapCoordinatorIds ? { bootstrapCoordinatorIds } : {}),
    },
  );
  const view = { status: "ok", actorId, membershipId, access, version, grants: [], accessUntil: expiry.getTime() };
  const bootstrap = {
    status: "ok",
    actorId,
    membershipId: null,
    access: engine.STATEWIDE,
    ownAccess: engine.STATEWIDE,
    version,
    grants: [],
    accessUntil: Infinity,
  };
  return { store, view, bootstrap, expiry, queries, isLocked: () => locked };
}

test("audit read refuses membership ending while the protected result is built", async () => {
  const { store, view } = fixture({ endDuringRead: true });
  await assert.rejects(store.auditPage(view), /role-ended/);
});
test("audit read refuses an old projection after scope changes", async () => {
  const { store, view } = fixture({ scopeDuringRead: true });
  await assert.rejects(store.auditPage(view), /role-ended/);
});
test("audit read keeps a legitimate result after rechecking under the workspace lock", async () => {
  const { store, view, isLocked } = fixture();
  assert.equal((await store.auditPage(view)).events.length, 1);
  assert.equal(isLocked(), true);
});
// M113: a bootstrap coordinator (no membership) gets the same locked re-check as a member.
test("audit read keeps a bootstrap coordinator's result while it is still on the list", async () => {
  const { store, bootstrap, isLocked } = fixture({ bootstrapCoordinatorIds: () => [actorId] });
  assert.equal((await store.auditPage(bootstrap)).events.length, 1);
  assert.equal(isLocked(), true);
});
test("audit read refuses a bootstrap coordinator whose end date passes during the read", async () => {
  const expiry = at.getTime() + 3600000;
  const { store, bootstrap } = fixture({
    expireDuringRead: true,
    bootstrapCoordinatorIds: (atMs) => (atMs < expiry ? [actorId] : []),
  });
  await assert.rejects(store.auditPage(bootstrap), /role-ended/);
});
test("audit read refuses a bootstrap view for an account not on the list", async () => {
  const { store, bootstrap } = fixture({ bootstrapCoordinatorIds: () => [] });
  await assert.rejects(store.auditPage(bootstrap), /role-ended/);
});

test("a membership beyond the first twenty remains selectable", async () => {
  const { store } = fixture({ many: true });
  const view = await store.viewer(actorId, { workingAs: membershipId });
  assert.equal(view.status, "ok");
  assert.equal(view.membershipId, membershipId);
});

test("audit read refuses a membership expiring during result construction", async () => {
  const { store, view } = fixture({ expireDuringRead: true });
  await assert.rejects(store.auditPage(view), /role-ended/);
});
test("retrying an identical uncertain grant preserves its membership identity", async () => {
  const { store, view } = fixture();
  const request = {
    actorId: "44444444-4444-4444-8444-444444444444",
    role: "ward",
    scope: { kind: "ward", unitIds: [engine.seedWorld(at).state.units[0].id] },
    expiresAt: new Date(at.getTime() + 1800000),
  };
  const first = await store.grantAccess(view, request);
  const second = await store.grantAccess(view, request);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.membership.id, first.body.membership.id);
});

test("an existing cover cannot satisfy an explicit role grant", async () => {
  const { store, view } = fixture({ existingCover: true });
  const answer = await store.grantAccess(view, {
    actorId: "44444444-4444-4444-8444-444444444444",
    role: "ward",
    scope: { kind: "ward", unitIds: [engine.seedWorld(at).state.units[0].id] },
    expiresAt: new Date(at.getTime() + 1800000),
  });
  assert.equal(answer.status, 200);
  assert.equal(answer.body.membership.kind, "role");
});

test("shared command and JSON restore preserve accepted observation order", () => {
  let world = engine.seedWorld(at);
  const movement = world.state.movements.find((row) => row.id === "WF-011");
  const admission = world.state.admissions.find((row) => row.id === movement.admissionId);
  const changedAt = new Date(at.getTime() + 5 * 60000);
  const token = (kind, row) =>
    JSON.stringify([
      kind,
      row.id,
      row.observation.level,
      row.observation.intervalMinutes,
      row.observation.reviewAt,
      row.observationChanges?.length ?? 0,
    ]);
  for (const ward of [false, true]) {
    const row = ward
      ? world.state.admissions.find((row) => row.id === admission.id)
      : world.state.movements.find((row) => row.id === movement.id);
    const kind = ward ? "admission" : "movement";
    const applied = engine.applyCommand(
      world,
      {
        type: "RECORD_OBSERVATION_LEVEL",
        role: ward ? "ward" : "ed",
        now: engine.worldNow(world, changedAt),
        target: ward
          ? { kind, admissionId: admission.id, actingUnitId: admission.unitId }
          : { kind, movementId: movement.id },
        observation: { level: ward ? "two_staff" : "arms_length", intervalMinutes: null, reviewAt: null },
        expected: token(kind, row),
      },
      changedAt,
    );
    assert.equal(applied.outcome, "accepted", applied.reason ?? "Observation edit was not accepted");
    world = applied.world;
  }
  const restored = JSON.parse(JSON.stringify(world));
  assert.equal(engine.validWorld(restored), true);
  const journeySequence = restored.state.movements
    .find((row) => row.id === movement.id)
    .observationChanges.at(-1).sequence;
  const wardSequence = restored.state.admissions
    .find((row) => row.id === admission.id)
    .observationChanges.at(-1).sequence;
  assert.ok(Number.isSafeInteger(journeySequence));
  assert.ok(wardSequence > journeySequence);
});

test("migration-eight grant retries do not query later membership columns", async () => {
  const { store, view, queries } = fixture({ version: 8 });
  const request = {
    actorId: "44444444-4444-4444-8444-444444444444",
    role: "ward",
    scope: { kind: "ward", unitIds: [engine.seedWorld(at).state.units[0].id] },
    expiresAt: new Date(at.getTime() + 1800000),
  };
  assert.equal((await store.grantAccess(view, request)).status, 200);
  const lookup = queries.find((sql) => sql.startsWith("SELECT * FROM ward_flow.memberships WHERE"));
  assert.ok(lookup);
  assert.equal(lookup.includes("last_used_at"), false);
  assert.equal(lookup.includes("kind="), false);
});
