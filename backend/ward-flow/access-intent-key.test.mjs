// @ts-check
// M58 (Josh approved 10 Nov 2026): an opening or cover sent with the browser's key for that one
// intent is done once. Offline store boundary: real engine, an in-memory SQL double, synthetic data.
import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "./dist/engine.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const at = new Date("2026-10-27T04:00:00Z");
const actorId = "11111111-1111-4111-8111-111111111111";
const membershipId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const colleague = "44444444-4444-4444-8444-444444444444";
const keyA = "55555555-5555-4555-8555-555555555555";
const keyB = "66666666-6666-4666-8666-666666666666";

function setup(access, version = 9) {
  const world = engine.seedWorld(at);
  const stored = {
    data_mode: "prototype",
    revision: 7,
    payload: structuredClone(world),
    cache_updated_at: new Date(at),
  };
  const receipts = new Map();
  const openings = [];
  const memberships = [];
  const audits = [];
  const query = async (sql, values = []) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
    if (sql.startsWith("SELECT max(version)")) return { rows: [{ version }] };
    if (sql.includes("FROM ward_flow.workspaces") && sql.includes("FOR ")) return { rows: [structuredClone(stored)] };
    if (sql.startsWith("SELECT id, role, scope"))
      return {
        rows: [
          {
            id: membershipId,
            ...access,
            kind: "role",
            last_used_at: at,
            expires_at: new Date(at.getTime() + 86_400_000),
          },
        ],
      };
    if (sql.startsWith("SELECT fingerprint, status, result")) {
      const receipt = receipts.get(values[2]);
      return { rows: receipt ? [structuredClone(receipt)] : [], rowCount: receipt ? 1 : 0 };
    }
    if (sql.startsWith("INSERT INTO ward_flow.commands")) {
      assert.ok(!receipts.has(values[2]), "One receipt per key");
      receipts.set(values[2], { fingerprint: values[3], status: values[4], result: structuredClone(values[5]) });
      return { rows: [] };
    }
    if (sql.startsWith("INSERT INTO ward_flow.break_glass")) {
      openings.push({ actor_id: values[1], patient_id: values[3], opened_at: values[5], until: values[6] });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT count(*)::int AS count FROM ward_flow.break_glass"))
      return {
        rows: [{ count: openings.filter((row) => row.actor_id === values[1] && row.opened_at > values[2]).length }],
      };
    if (sql.startsWith("SELECT role FROM ward_flow.memberships")) return { rows: [{ role: "ward" }] };
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
    if (sql.startsWith("SELECT * FROM ward_flow.memberships WHERE id=$1"))
      return { rows: memberships.filter((row) => row.id === values[0]).map((row) => structuredClone(row)) };
    if (sql.startsWith("INSERT INTO ward_flow.audit")) {
      audits.push({ commandId: values[2], action: values[3], changes: values[7] });
      return { rows: [] };
    }
    // Reads the snapshot makes along the way (openings in force, reviews) find nothing here.
    if (sql.startsWith("SELECT")) return { rows: [], rowCount: 0 };
    assert.fail(`Unexpected SQL in offline double: ${sql.slice(0, 100)}`);
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const store = createWorkspaceStore(pool, {
    workspaceId,
    engine,
    clock: () => new Date(at),
    log: () => {},
  });
  const view = {
    actorId,
    membershipId,
    version,
    access,
    ownAccess: access,
    grants: [],
    accessUntil: at.getTime() + 3_600_000,
  };
  return { store, view, world, openings, memberships, audits, receipts };
}

/** A ward desk, and a patient outside its care that it may open. */
function wardOutsideCare() {
  const world = engine.seedWorld(at);
  for (const unit of world.state.units) {
    const access = engine.parseAccess("ward", { kind: "ward", unitIds: [unit.id] });
    if (!access) continue;
    const patient = world.state.patients.find((row) => engine.breakGlassRefusal(world, access, row.id, at) === null);
    if (patient) return { access, patientId: patient.id, unitId: unit.id };
  }
  throw new Error("Synthetic seed has a patient outside some ward's care");
}

test("the same opening retried with its key gives one row, one audit line and the same pattern flag", async () => {
  const { access, patientId } = wardOutsideCare();
  const { store, view, openings, audits } = setup(access);
  const first = await store.breakGlass(view, patientId, "handover", keyA);
  assert.equal(first.status, 200, JSON.stringify(first.body?.error));
  const retried = await store.breakGlass(view, patientId, "handover", keyA);
  assert.equal(retried.status, 200);
  assert.equal(retried.body.until, first.body.until);
  assert.equal(retried.body.pattern, first.body.pattern);
  assert.ok(retried.body.snapshot, "A retry still answers with the board");
  assert.equal(openings.length, 1);
  const lines = audits.filter((row) => row.action === "BREAK_GLASS");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].commandId, keyA);
});

test("two genuine openings, each with its own key, still count twice", async () => {
  const { access, patientId } = wardOutsideCare();
  const { store, view, openings, audits } = setup(access);
  assert.equal((await store.breakGlass(view, patientId, "handover", keyA)).status, 200);
  assert.equal((await store.breakGlass(view, patientId, "handover", keyB)).status, 200);
  assert.equal(openings.length, 2);
  assert.equal(audits.filter((row) => row.action === "BREAK_GLASS").length, 2);
});

test("an opening with no key behaves as before: each request is its own opening", async () => {
  const { access, patientId } = wardOutsideCare();
  const { store, view, openings, receipts } = setup(access);
  await store.breakGlass(view, patientId, "handover");
  await store.breakGlass(view, patientId, "handover");
  assert.equal(openings.length, 2);
  assert.equal(receipts.size, 0);
});

test("a key reused for a different opening is refused, and adds nothing", async () => {
  const { access, patientId } = wardOutsideCare();
  const { store, view, openings } = setup(access);
  assert.equal((await store.breakGlass(view, patientId, "handover", keyA)).status, 200);
  const other = await store.breakGlass(view, patientId, "bed-search", keyA);
  assert.equal(other.status, 422);
  assert.equal(openings.length, 1);
});

test("the same cover retried with its key gives one cover and one audit line", async () => {
  const { access, unitId } = wardOutsideCare();
  const { store, view, memberships, audits } = setup(access);
  const request = { actorId: colleague, scope: { kind: "ward", unitIds: [unitId] }, minutes: 60, intentKey: keyA };
  const first = await store.giveCover(view, request);
  assert.equal(first.status, 200, JSON.stringify(first.body?.error));
  const retried = await store.giveCover(view, request);
  assert.equal(retried.status, 200);
  assert.deepEqual(retried.body.membership, first.body.membership);
  assert.equal(memberships.length, 1);
  assert.equal(audits.filter((row) => row.action === "ACCESS_COVER").length, 1);
  const again = await store.giveCover(view, { ...request, intentKey: keyB });
  assert.equal(again.status, 200);
  assert.equal(memberships.length, 2, "A new intent is a new cover");
});
