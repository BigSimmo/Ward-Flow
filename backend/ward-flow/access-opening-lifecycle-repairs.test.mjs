// @ts-check
import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkspaceStore } from "./postgres.mjs";
import * as engine from "./dist/engine.mjs";

// Persisting SQL double around the real store/resolver/engine. This does not execute SQL or
// establish PostgreSQL transaction/locking behaviour. Schema 9 avoids unrelated split-row storage.
function fixture() {
  const workspaceId = "synthetic-opening-workspace";
  const actorId = "synthetic-opening-actor";
  const membershipId = "synthetic-opening-desk";
  let now = new Date("2026-11-04T12:00:00Z");
  let world = engine.seedWorld(now);
  let revision = 1;
  const unitId = world.state.units[0].id;
  const access = engine.parseAccess("ward", { kind: "ward", unitIds: [unitId] });
  assert.ok(access);
  const own = engine.scopeWorld(world, access, now);
  const foreign = world.state.patients.find((patient) => !own.state.patients.some(({ id }) => id === patient.id));
  assert.ok(foreign);
  const openings = [];
  const audits = [];
  const statements = [];
  async function query(sql, params = []) {
    statements.push(sql);
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("max(version)")) return { rows: [{ version: 9 }] };
    if (sql.includes("FROM ward_flow.workspaces"))
      return { rows: [{ data_mode: "prototype", revision, payload: world, cache_updated_at: now }] };
    if (sql.includes("FROM ward_flow.memberships")) {
      assert.equal(params[0], workspaceId);
      assert.equal(params[1], actorId);
      return {
        rows: [
          {
            id: membershipId,
            role: "ward",
            scope: access?.scope,
            kind: "role",
            last_used_at: now,
            expires_at: new Date(now.getTime() + 24 * 60 * 60_000),
          },
        ],
      };
    }
    if (sql.startsWith("INSERT INTO ward_flow.break_glass")) {
      assert.match(sql, /RETURNING id::text AS id/);
      const [workspace_id, actor_id, membership_id, patient_id, reason, opened_at, until] = params;
      const opening = {
        id: String(openings.length + 1),
        workspace_id,
        actor_id,
        membership_id,
        patient_id,
        reason,
        opened_at: new Date(opened_at),
        until: new Date(until),
      };
      openings.push(opening);
      return { rows: [{ id: opening.id }], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO ward_flow.audit")) {
      const [workspace_id, actor_id, , action, outcome, , , changes] = params;
      audits.push({ workspace_id, actor_id, action, outcome, changes: structuredClone(changes) });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SELECT count(*)::int AS count FROM ward_flow.break_glass"))
      return { rows: [{ count: openings.length }] };
    if (sql.includes("FROM ward_flow.break_glass b")) {
      // Check that persisted generation is associated with THIS immutable opening, not whichever
      // audit happened last for the same patient. Equal timestamps/expiry deliberately exercise it.
      for (const binding of [
        "a.workspace_id=b.workspace_id",
        "a.actor_id=b.actor_id",
        "a.changes->>'membershipId'=b.membership_id::text",
        "a.changes->>'patientId'=b.patient_id",
        "a.changes->>'openingId'=b.id::text",
      ])
        assert.ok(sql.includes(binding), `missing immutable audit binding: ${binding}`);
      return {
        rows: openings
          .filter(
            (opening) =>
              opening.workspace_id === params[0] &&
              opening.actor_id === params[1] &&
              opening.membership_id === params[2] &&
              opening.until > params[3],
          )
          .map((opening) => {
            const audit = audits.findLast(
              (entry) =>
                entry.workspace_id === opening.workspace_id &&
                entry.actor_id === opening.actor_id &&
                entry.action === "BREAK_GLASS" &&
                entry.changes.membershipId === opening.membership_id &&
                entry.changes.patientId === opening.patient_id &&
                entry.changes.openingId === opening.id,
            );
            return { ...opening, generation: audit?.changes.worldGeneration ?? null };
          }),
      };
    }
    assert.fail(`Unexpected SQL: ${sql.slice(0, 100)}`);
  }
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const store = createWorkspaceStore(pool, { workspaceId, engine, clock: () => now });
  const viewer = () => store.viewer(actorId, { workingAs: membershipId });
  const read = async () => store.read(actorId, await viewer());
  const sees = (snapshot) => snapshot.payload.state.patients.some(({ id }) => id === foreign.id);
  return {
    store,
    viewer,
    read,
    sees,
    openings,
    audits,
    statements,
    foreign,
    get world() {
      return world;
    },
    reset() {
      const result = engine.applyCommand(world, { type: "RESET_SCENARIO", role: "demo" }, now);
      assert.equal(result.outcome, "accepted");
      world = result.world;
      revision++;
    },
    expire() {
      now = new Date(now.getTime() + (engine.BREAK_GLASS_MINUTES + 1) * 60_000);
    },
    addLegacy() {
      openings.push({
        id: String(openings.length + 1),
        workspace_id: workspaceId,
        actor_id: actorId,
        membership_id: membershipId,
        patient_id: foreign.id,
        reason: "handover",
        opened_at: new Date(now),
        until: new Date(now.getTime() + engine.BREAK_GLASS_MINUTES * 60_000),
      });
    },
  };
}

test("stored exceptional opening stays with its original generation through reset and a fresh reopening", async () => {
  const f = fixture();
  assert.equal(f.sees(await f.read()), false);
  const opened = await f.store.breakGlass(await f.viewer(), f.foreign.id, "handover");
  assert.equal(opened.status, 200);
  assert.equal(f.sees(opened.body.snapshot), true);
  assert.equal(f.audits[0].changes.openingId, f.openings[0].id);
  assert.equal(f.audits[0].changes.worldGeneration, 0);
  assert.equal((await f.viewer()).grants[0].generation, 0);
  assert.equal(f.sees(await f.read()), true);

  f.reset(); // Real engine reset, committed by replacing the double's persisted workspace row.
  assert.equal(f.world.state.worldGeneration, 1);
  assert.ok(
    f.world.state.patients.some(({ id }) => id === f.foreign.id),
    "reset reuses the synthetic ID",
  );
  assert.equal(f.sees(await f.read()), false, "old opening does not authorise the new generation");
  const reopened = await f.store.breakGlass(await f.viewer(), f.foreign.id, "handover");
  assert.equal(reopened.status, 200);
  assert.equal(f.sees(reopened.body.snapshot), true);
  assert.equal(f.openings[0].until.getTime(), f.openings[1].until.getTime(), "expiry is not record identity");
  assert.notEqual(f.openings[0].id, f.openings[1].id);
  assert.deepEqual(
    (await f.viewer()).grants.map(({ generation }) => generation),
    [0, 1],
  );
  assert.equal(f.sees(await f.read()), true);
  assert.deepEqual(
    f.audits.map(({ changes }) => changes.worldGeneration),
    [0, 1],
    "history remains intact",
  );
  f.expire();
  assert.equal(f.sees(await f.read()), false);
});

test("legacy opening without generation applies only in the original generation", async () => {
  const f = fixture();
  f.addLegacy();
  assert.equal((await f.viewer()).grants[0].generation, 0);
  assert.equal(f.sees(await f.read()), true);
  f.reset();
  assert.equal(f.sees(await f.read()), false);
  assert.equal(f.openings.length, 1, "reset preserves the historical opening");
});
