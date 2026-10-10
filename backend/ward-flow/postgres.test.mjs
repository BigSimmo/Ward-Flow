import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";

const url = process.env.WARD_TEST_DATABASE_URL;
if (url && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname))
  throw new Error("Database tests require an isolated loopback PostgreSQL server");
test("real PostgreSQL: shared commands, last-bed contention, retry, audit and recovery", { skip: !url }, async (t) => {
  const engine = await import("./dist/engine.mjs");
  const pool = new Pool({ connectionString: url, max: 8 });
  let idleConnectionFailed = false;
  pool.on("error", () => {
    idleConnectionFailed = true;
  });
  const actorA = "11111111-1111-4111-8111-111111111111";
  const actorB = "22222222-2222-4222-8222-222222222222";
  const at = new Date("2026-10-07T10:00:00Z");
  const workspaceId = randomUUID();
  const storeA = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
  const storeB = createWorkspaceStore(pool, { workspaceId, engine, clock: () => at });
  try {
    await migrate(pool);
    await migrate(pool);
    await storeA.ready();
    const seed = await storeA.read(actorA);
    assert.equal(seed.revision, 1);
    assert.equal(seed.dataMode, "prototype");
    assert.equal((await pool.query("SELECT max(version) AS version FROM ward_flow.migrations")).rows[0].version, 2);
    assert.ok(engine.validWorld(seed.payload));
    // Prepare two independent, valid movements targeting one allocatable secure bed.
    const world = structuredClone(seed.payload);
    const unitId = "rph-adult-secure";
    const movement = world.state.movements.find((row) => row.id === "WF-012");
    world.state.units = world.state.units.map((unit) =>
      unit.id === unitId
        ? {
            ...unit,
            empty: { ...unit.empty, value: 6, confirmedAt: 642 },
            allocatable: { ...unit.allocatable, value: 6, confirmedAt: 642 },
            allocatableLocked: 6,
          }
        : unit,
    );
    world.state.bedReleases = world.state.bedReleases.filter((release) => release.unitId !== unitId);
    world.state.movements.push({ ...structuredClone(movement), id: "WF-TEST-SECOND" });
    let prepared = world;
    for (const movementId of ["WF-012", "WF-TEST-SECOND"]) {
      for (const event of [
        {
          type: "REFER_TO_UNITS",
          role: "coordinator",
          unitIds: [unitId],
          genderPlacementReason: "A single room is available on this ward",
          genderPlacementChecked: true,
        },
        { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId },
      ]) {
        const result = engine.applyCommand(prepared, { ...event, movementId }, at);
        assert.equal(result.outcome, "accepted", "the fixture must be eligible before exercising concurrency");
        prepared = result.world;
      }
    }
    prepared.state.units = prepared.state.units.map((unit) =>
      unit.id === unitId ? { ...unit, allocatable: { ...unit.allocatable, value: 1 }, allocatableLocked: 1 } : unit,
    );
    assert.ok(engine.validWorld(prepared));
    await pool.query("UPDATE ward_flow.workspaces SET payload=$2 WHERE id=$1", [workspaceId, prepared]);
    const pull = (movementId) => ({ type: "PULL_PATIENT", role: "coordinator", now: -999, movementId, unitId });
    const commandA = randomUUID();
    const commandB = randomUUID();
    let winner;
    await t.test("two accounts competing for the last bed have exactly one winner", async () => {
      const results = await Promise.all([
        storeA.command(actorA, commandA, 1, pull("WF-012")),
        storeB.command(actorB, commandB, 1, pull("WF-TEST-SECOND")),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
      winner =
        results[0].status === 200
          ? { actor: actorA, id: commandA, movement: "WF-012", result: results[0] }
          : { actor: actorB, id: commandB, movement: "WF-TEST-SECOND", result: results[1] };
      assert.equal(winner.result.body.snapshot.revision, 2);
      const state = winner.result.body.snapshot.payload.state;
      assert.equal(state.units.find((unit) => unit.id === unitId).allocatable.value, 0);
      assert.equal(
        state.movements.filter((row) => ["WF-012", "WF-TEST-SECOND"].includes(row.id) && row.stage === "pulled").length,
        1,
      );
    });
    await t.test("a lost-response retry does not apply or audit the command twice", async () => {
      const result = await storeA.command(winner.actor, winner.id, 1, pull(winner.movement));
      assert.equal(result.status, 200);
      assert.equal(result.body.replayed, true);
      assert.equal(result.body.snapshot.revision, 2);
      const audit = await storeA.audit();
      assert.equal(audit.filter((row) => row.outcome === "accepted" && row.action === "PULL_PATIENT").length, 1);
      assert.equal(
        audit.find((row) => row.action === "PULL_PATIENT" && row.outcome === "accepted").actor_id,
        winner.actor,
      );
      const facts = audit.find((row) => row.action === "PULL_PATIENT" && row.outcome === "accepted").changes.facts;
      assert.equal(facts.units.before.find((unit) => unit.id === unitId).allocatable.value, 1);
      assert.equal(facts.units.after.find((unit) => unit.id === unitId).allocatable.value, 0);
    });
    await t.test("reusing a command ID for different content is rejected", async () => {
      assert.equal((await storeA.command(winner.actor, winner.id, 2, pull(winner.movement))).status, 422);
    });
    await t.test("reconnecting with a new store sees durable committed state", async () => {
      const restored = await createWorkspaceStore(pool, { workspaceId, engine, clock: () => at }).read(actorB);
      assert.equal(restored.revision, 2);
      assert.equal(restored.payload.state.movements.find((row) => row.id === winner.movement).stage, "pulled");
      assert.equal(restored.payload.state.units.find((row) => row.id === unitId).allocatable.confirmedAt, 642);
    });
    await t.test("audit entries cannot be changed or removed", async () => {
      await assert.rejects(
        pool.query("UPDATE ward_flow.audit SET action='FORGED' WHERE workspace_id=$1", [workspaceId]),
        /append-only/,
      );
      await assert.rejects(
        pool.query("DELETE FROM ward_flow.audit WHERE workspace_id=$1", [workspaceId]),
        /append-only/,
      );
    });
    await t.test("workspace mode cannot be relabelled and receipts retain prototype provenance", async () => {
      await assert.rejects(
        pool.query("UPDATE ward_flow.workspaces SET data_mode='live' WHERE id=$1", [workspaceId]),
        /data mode cannot be changed/,
      );
      assert.ok((await storeA.audit()).every((row) => row.data_mode === "prototype"));
      const receipts = await pool.query("SELECT data_mode FROM ward_flow.commands WHERE workspace_id=$1", [
        workspaceId,
      ]);
      assert.ok(receipts.rows.length && receipts.rows.every((row) => row.data_mode === "prototype"));
      await assert.rejects(
        pool.query(
          "INSERT INTO ward_flow.commands(workspace_id, actor_id, command_id, fingerprint, status, result, data_mode) VALUES($1,$2,$3,'test',200,'{}','live')",
          [workspaceId, actorA, randomUUID()],
        ),
        /command_workspace_mode/,
      );
    });
    await t.test("a prototype connection never reads or changes a live-tagged workspace", async () => {
      const liveId = randomUUID();
      // Invented fixture tagged live to prove separation, never real patient data.
      await pool.query("INSERT INTO ward_flow.workspaces(id,revision,payload,data_mode) VALUES($1,1,$2,'live')", [
        liveId,
        seed.payload,
      ]);
      const wrongStore = createWorkspaceStore(pool, { workspaceId: liveId, engine, clock: () => at });
      await assert.rejects(wrongStore.read(actorA), /data mode mismatch/);
      await assert.rejects(wrongStore.command(actorA, randomUUID(), 1, pull(winner.movement)), /data mode mismatch/);
      assert.equal(
        (await pool.query("SELECT revision FROM ward_flow.workspaces WHERE id=$1", [liveId])).rows[0].revision,
        "1",
      );
      assert.equal((await wrongStore.audit()).length, 0);
    });
    await t.test("audit failure rolls back the workflow state and receipt", async () => {
      const failingId = randomUUID();
      await pool.query(
        "CREATE FUNCTION ward_flow.test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$",
      );
      await pool.query(
        "CREATE TRIGGER test_fail_audit BEFORE INSERT ON ward_flow.audit FOR EACH ROW EXECUTE FUNCTION ward_flow.test_fail_audit()",
      );
      try {
        await assert.rejects(
          storeA.command(actorA, failingId, 2, { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId }),
          /injected audit failure/,
        );
        assert.equal((await storeA.read(actorA)).revision, 2);
        assert.equal(
          (await pool.query("SELECT * FROM ward_flow.commands WHERE command_id=$1", [failingId])).rowCount,
          0,
        );
      } finally {
        await pool.query("DROP TRIGGER test_fail_audit ON ward_flow.audit");
        await pool.query("DROP FUNCTION ward_flow.test_fail_audit()");
      }
    });
  } finally {
    await pool.end();
    assert.equal(idleConnectionFailed, false, "PostgreSQL test pool reported an idle connection failure");
  }
});
