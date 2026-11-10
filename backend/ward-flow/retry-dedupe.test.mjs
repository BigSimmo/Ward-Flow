// @ts-check
// Audit A2-01, A2-02 and A2-03 (10 Nov 2026): a retried role grant, opening or cover is not a
// second one. Offline store boundary (real engine, an in-memory SQL double) plus, when an isolated
// loopback WARD_TEST_DATABASE_URL is set, real PostgreSQL. Synthetic data only, no provider calls.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import * as engine from "./dist/engine.mjs";
import { dropTestDatabase } from "./drop-test-database.test-support.mjs";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Retry tests require isolated loopback PostgreSQL");

const start = new Date("2026-10-27T04:00:00Z");
const actorId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const colleague = "44444444-4444-4444-8444-444444444444";

/** An in-memory double that answers the store's retry lookups the way PostgreSQL would. */
function offline(access) {
  let now = new Date(start);
  const world = engine.seedWorld(start);
  const stored = { data_mode: "prototype", revision: 7, payload: structuredClone(world), cache_updated_at: start };
  const openings = [];
  const memberships = [];
  const audits = [];
  const query = async (sql, values = []) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
    if (sql.startsWith("SELECT max(version)")) return { rows: [{ version: 9 }] };
    if (sql.includes("FROM ward_flow.workspaces") && sql.includes("FOR ")) return { rows: [structuredClone(stored)] };
    if (sql.startsWith("SELECT id, role, scope"))
      return {
        rows: [
          {
            id: membershipId,
            ...access,
            kind: "role",
            last_used_at: now,
            expires_at: new Date(start.getTime() + 86_400_000),
          },
        ],
      };
    if (sql.startsWith("INSERT INTO ward_flow.break_glass")) {
      openings.push({
        actor_id: values[1],
        membership_id: values[2],
        patient_id: values[3],
        reason: values[4],
        opened_at: values[5],
        until: values[6],
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT opened_at, until FROM ward_flow.break_glass b")) {
      const generation = JSON.stringify(stored.payload.state.worldGeneration ?? 0);
      assert.equal(values[7], generation);
      const found = openings.filter(
        (row) =>
          row.actor_id === values[1] &&
          row.membership_id === values[2] &&
          row.patient_id === values[3] &&
          row.reason === values[4] &&
          row.opened_at > values[5] &&
          row.until > values[6],
      );
      return { rows: found.slice(0, 1).map((row) => ({ opened_at: row.opened_at, until: row.until })) };
    }
    if (sql.startsWith("SELECT count(*)::int AS count FROM ward_flow.break_glass"))
      return {
        rows: [
          {
            count: openings.filter(
              (row) =>
                row.actor_id === values[1] &&
                row.opened_at > values[2] &&
                (values[3] === undefined || row.opened_at <= values[3]),
            ).length,
          },
        ],
      };
    if (sql.startsWith("SELECT role FROM ward_flow.memberships")) return { rows: [{ role: "ward" }] };
    if (sql.startsWith("SELECT * FROM ward_flow.memberships") && sql.includes("kind='cover'")) {
      const found = memberships.filter(
        (row) =>
          row.actor_id === values[1] &&
          row.role === values[2] &&
          JSON.stringify(row.scope) === values[3] &&
          row.granted_by === values[4] &&
          row.revoked_at === null &&
          row.granted_at > values[5] &&
          row.expires_at > values[6] &&
          row.expires_at.getTime() - row.granted_at.getTime() === values[7] * 60_000,
      );
      return { rows: found.slice(0, 1).map((row) => structuredClone(row)) };
    }
    if (sql.startsWith("INSERT INTO ward_flow.memberships")) {
      const row = {
        id: values[0],
        actor_id: values[2],
        role: values[3],
        scope: values[4],
        granted_by: values[5],
        granted_at: values[6],
        expires_at: values[7],
        kind: "cover",
        revoked_at: null,
        last_used_at: null,
      };
      memberships.push(row);
      return { rows: [structuredClone(row)] };
    }
    if (sql.startsWith("INSERT INTO ward_flow.audit")) {
      audits.push({ action: values[3], changes: values[7] });
      return { rows: [] };
    }
    // Reads the snapshot makes along the way (openings in force, reviews) find nothing here.
    if (sql.startsWith("SELECT")) return { rows: [], rowCount: 0 };
    assert.fail(`Unexpected SQL in offline double: ${sql.slice(0, 100)}`);
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => new Date(now), log: () => {} });
  const view = {
    actorId,
    membershipId,
    version: 9,
    access,
    ownAccess: access,
    grants: [],
    accessUntil: start.getTime() + 3_600_000,
  };
  const advance = (ms) => {
    now = new Date(now.getTime() + ms);
  };
  return { store, view, openings, memberships, audits, advance };
}

/** A ward desk, and a patient outside its care that it may open. */
function wardOutsideCare(world = engine.seedWorld(start), at = start) {
  for (const unit of world.state.units) {
    const access = engine.parseAccess("ward", { kind: "ward", unitIds: [unit.id] });
    if (!access) continue;
    const patient = world.state.patients.find((row) => engine.breakGlassRefusal(world, access, row.id, at) === null);
    if (patient) return { access, patientId: patient.id, unitId: unit.id };
  }
  throw new Error("Synthetic seed has a patient outside some ward's care");
}

test("offline: four unkeyed retries of one opening give one row, one audit line and no pattern", async () => {
  assert.ok(engine.BREAK_GLASS_PER_SHIFT < 4, "Four separate openings would be a pattern");
  const { access, patientId } = wardOutsideCare();
  const { store, view, openings, audits, advance } = offline(access);
  const answers = [];
  for (let index = 0; index < 4; index++) {
    answers.push(await store.breakGlass(view, patientId, "handover"));
    advance(5_000);
  }
  for (const answer of answers) {
    assert.equal(answer.status, 200, JSON.stringify(answer.body?.error));
    assert.equal(answer.body.until, answers[0].body.until);
    assert.equal(answer.body.pattern, false);
    assert.ok(answer.body.snapshot);
  }
  assert.equal(openings.length, 1);
  assert.equal(audits.filter((row) => row.action === "BREAK_GLASS").length, 1);
});

test("offline: an unkeyed opening after the retry window, or for another reason, is its own opening", async () => {
  const { access, patientId } = wardOutsideCare();
  const { store, view, openings, advance } = offline(access);
  const first = await store.breakGlass(view, patientId, "handover");
  advance(60_001);
  const later = await store.breakGlass(view, patientId, "handover");
  assert.equal(later.status, 200);
  assert.notEqual(later.body.until, first.body.until);
  assert.equal((await store.breakGlass(view, patientId, "bed-search")).status, 200);
  assert.equal(openings.length, 3);
});

test("offline: two unkeyed covers give one membership; a different length or a later one is new", async () => {
  const { access, unitId } = wardOutsideCare();
  const { store, view, memberships, audits, advance } = offline(access);
  const request = {
    actorId: colleague,
    scope: { kind: "ward", unitIds: [unitId] },
    minutes: 60,
    reason: engine.COVER_REASON_IDS[0],
  };
  const first = await store.giveCover(view, request);
  assert.equal(first.status, 200, JSON.stringify(first.body?.error));
  advance(3_000);
  const retried = await store.giveCover(view, request);
  assert.equal(retried.status, 200);
  assert.equal(retried.body.membership.id, first.body.membership.id);
  assert.equal(retried.body.membership.expiresAt, first.body.membership.expiresAt);
  assert.equal(memberships.length, 1);
  assert.equal(audits.filter((row) => row.action === "ACCESS_COVER").length, 1);
  assert.equal((await store.giveCover(view, { ...request, minutes: 120 })).status, 200);
  assert.equal(memberships.length, 2, "A different length is a different cover");
  advance(60_001);
  assert.equal((await store.giveCover(view, request)).status, 200);
  assert.equal(memberships.length, 3, "After the window a cover is new");
});

async function databaseFixture(run) {
  const admin = new Pool({ connectionString: url, max: 1 });
  const database = `wardflow_retry_${randomUUID().replaceAll("-", "")}`;
  const target = new URL(/** @type {string} */ (url));
  target.pathname = `/${database}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = new Pool({ connectionString: target.href, max: 4 });
  try {
    await migrate(pool);
    await run(pool);
  } finally {
    await pool.end();
    await dropTestDatabase(admin, database);
    await admin.end();
  }
}

test("real PostgreSQL: a retried grant is one role, and revoking it leaves no live role", { skip: !url }, async () => {
  await databaseFixture(async (pool) => {
    let at = new Date("2026-11-05T00:00:00Z");
    const lead = randomUUID(),
      nurse = randomUUID(),
      other = randomUUID();
    const store = createWorkspaceStore(pool, { workspaceId: randomUUID(), engine, clock: () => new Date(at) });
    const leadView = await store.viewer(lead, { bootstrap: true });
    const world = (await store.read(lead, leadView)).payload;
    const ward = { role: "ward", scope: { kind: "ward", unitIds: [world.state.units[0].id] } };
    const grant = (actorId, minutes) =>
      store.grantAccess(leadView, { actorId, ...ward, expiresAt: new Date(at.getTime() + minutes * 60_000) });
    const live = async (actorId) =>
      (
        await pool.query(
          "SELECT count(*)::int AS count FROM ward_flow.memberships WHERE actor_id=$1 AND revoked_at IS NULL",
          [actorId],
        )
      ).rows[0].count;

    // A double tap: the server sets each end on its own clock, a few seconds apart.
    const first = await grant(nurse, 60);
    assert.equal(first.status, 200);
    at = new Date(at.getTime() + 4_000);
    const repeat = await grant(nurse, 60);
    assert.equal(repeat.status, 200);
    assert.equal(repeat.body.membership.id, first.body.membership.id);
    assert.equal(repeat.body.membership.expiresAt, first.body.membership.expiresAt, "The first end stands");
    assert.equal(await live(nurse), 1);
    const nurseView = await store.viewer(nurse);
    assert.equal(nurseView.status, "ok");

    assert.equal((await store.revokeAccess(leadView, first.body.membership.id)).status, 200);
    assert.equal(await live(nurse), 0);
    assert.deepEqual(await store.viewer(nurse), { status: "none" });
    await assert.rejects(store.read(nurse, nurseView), /role-ended/);

    // Unchanged: a clearly different end (an hour longer) is a second, separate role.
    const short = await grant(other, 60);
    const long = await grant(other, 120);
    assert.equal(long.status, 200);
    assert.notEqual(long.body.membership.id, short.body.membership.id);
    assert.equal(await live(other), 2);
  });
});

test("real PostgreSQL: unkeyed retried openings and covers add one row each", { skip: !url }, async () => {
  await databaseFixture(async (pool) => {
    let at = new Date("2026-11-05T00:00:00Z");
    const lead = randomUUID(),
      nurse = randomUUID(),
      colleagueId = randomUUID();
    const store = createWorkspaceStore(pool, { workspaceId: randomUUID(), engine, clock: () => new Date(at) });
    const leadView = await store.viewer(lead, { bootstrap: true });
    const world = (await store.read(lead, leadView)).payload;
    const { access, patientId } = wardOutsideCare(world, at);
    const expiresAt = new Date(at.getTime() + 86_400_000);
    const granted = await store.grantAccess(leadView, { actorId: nurse, ...access, expiresAt });
    assert.equal(granted.status, 200);
    assert.equal((await store.grantAccess(leadView, { actorId: colleagueId, ...access, expiresAt })).status, 200);
    const nurseView = await store.viewer(nurse);
    assert.equal(nurseView.status, "ok");
    const count = async (sql) => (await pool.query(sql)).rows[0].count;

    const answers = [];
    for (let index = 0; index < 4; index++) {
      answers.push(await store.breakGlass(nurseView, patientId, "handover"));
      at = new Date(at.getTime() + 5_000);
    }
    for (const answer of answers) {
      assert.equal(answer.status, 200, JSON.stringify(answer.body?.error));
      assert.equal(answer.body.until, answers[0].body.until);
      assert.equal(answer.body.pattern, false);
    }
    assert.equal(await count("SELECT count(*)::int AS count FROM ward_flow.break_glass"), 1);
    assert.equal(
      await count("SELECT count(*)::int AS count FROM ward_flow.audit WHERE action='BREAK_GLASS'"),
      1,
      "No audit line for a retry",
    );
    at = new Date(at.getTime() + 60_000);
    assert.equal((await store.breakGlass(nurseView, patientId, "handover")).status, 200);
    assert.equal(await count("SELECT count(*)::int AS count FROM ward_flow.break_glass"), 2, "After the window");

    // Cover of another ward for the colleague, from the whole-network lead.
    const own = access.scope.unitIds ?? [];
    const coverScope = {
      kind: "ward",
      unitIds: [world.state.units.find((u) => !own.includes(u.id)).id],
    };
    const request = { actorId: colleagueId, scope: coverScope, minutes: 60, reason: engine.COVER_REASON_IDS[0] };
    const cover = await store.giveCover(leadView, request);
    assert.equal(cover.status, 200, JSON.stringify(cover.body?.error));
    at = new Date(at.getTime() + 3_000);
    const again = await store.giveCover(leadView, request);
    assert.equal(again.status, 200);
    assert.equal(again.body.membership.id, cover.body.membership.id);
    assert.equal(await count("SELECT count(*)::int AS count FROM ward_flow.memberships WHERE kind='cover'"), 1);
    assert.equal(await count("SELECT count(*)::int AS count FROM ward_flow.audit WHERE action='ACCESS_COVER'"), 1);
  });
});
