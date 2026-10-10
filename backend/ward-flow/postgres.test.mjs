import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "./migrate.mjs";
import { createWorkspaceStore } from "./postgres.mjs";
import { pushPayload } from "./push.mjs";

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
    assert.equal((await pool.query("SELECT max(version) AS version FROM ward_flow.migrations")).rows[0].version, 3);
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

test(
  "real PostgreSQL: phone push announces each new act-now item once, to other coordinators",
  { skip: !url },
  async () => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    const actorA = "11111111-1111-4111-8111-111111111111";
    const actorB = "22222222-2222-4222-8222-222222222222";
    const formerCoordinator = "55555555-5555-4555-8555-555555555555";
    const start = Date.parse("2026-10-07T10:00:00Z");
    let at = new Date(start);
    const workspaceId = randomUUID();
    const sent = [];
    const outcome = { e2: "expired" };
    const logs = [];
    const store = createWorkspaceStore(pool, {
      workspaceId,
      engine,
      clock: () => at,
      log: (event) => logs.push(event),
      deliveryWaitMs: 10_000,
      push: {
        send: async (row, payload) => {
          const name = row.endpoint.split("/").pop();
          sent.push({ name, payload });
          return { outcome: outcome[name] ?? "sent" };
        },
        payload: pushPayload,
        coordinatorIds: [actorA, actorB],
        maxPerAccount: 2,
      },
    });
    const device = (name) => ({
      endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
      p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString("base64url"),
      auth: Buffer.alloc(16, 2).toString("base64url"),
    });
    const delivered = () =>
      sent
        .splice(0)
        .map((entry) => entry.name)
        .sort();
    try {
      await migrate(pool);
      await store.ready();
      await store.read(actorA);
      assert.equal(await store.subscribe(actorA, device("e1")), "subscribed");
      assert.equal(await store.subscribe(actorB, device("e2")), "subscribed");
      assert.equal(await store.subscribe(actorB, device("e3")), "subscribed");
      assert.equal(await store.subscribe(actorB, device("e3")), "subscribed", "re-subscribing a device is idempotent");
      assert.equal(await store.subscribe(actorB, device("e5")), "limit");
      // An account removed from the coordinator list keeps no alerts, even with a stored device.
      assert.equal(await store.subscribe(formerCoordinator, device("e4")), "subscribed");

      const jump = { type: "ADVANCE_CLOCK", role: "demo", minutes: 30 };
      const commandId = randomUUID();
      assert.equal((await store.command(actorA, commandId, 1, jump)).status, 200);
      assert.deepEqual(delivered(), ["e2", "e3"], "the acting account and a former coordinator are not sent");
      const removed = await pool.query("SELECT endpoint FROM ward_flow.push_subscriptions WHERE endpoint LIKE '%/e2'");
      assert.equal(removed.rowCount, 0, "a 410 subscription is removed");
      const success = await pool.query(
        "SELECT last_success_at FROM ward_flow.push_subscriptions WHERE endpoint LIKE '%/e3'",
      );
      assert.ok(success.rows[0].last_success_at);

      assert.equal((await store.command(actorA, commandId, 1, jump)).body.replayed, true);
      const refresh = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", unitId: "rph-adult-secure" };
      assert.equal((await store.command(actorA, randomUUID(), 2, refresh)).status, 200);
      assert.deepEqual(delivered(), [], "a retry or a change with no new red item sends nothing");

      at = new Date(start + 30 * 60_000);
      await store.sweepPush();
      const swept = sent.slice();
      assert.deepEqual(delivered(), ["e1", "e3"], "time alone can raise a red item; every coordinator is told");
      await store.sweepPush();
      assert.deepEqual(delivered(), [], "an item still red is not announced twice");
      for (const { payload } of swept) assert.doesNotMatch(JSON.stringify(payload), /WF-|PT-|UM\d/);

      assert.equal(await store.pushStatus(actorB, device("e3").endpoint), true);
      assert.equal(await store.pushStatus(actorA, device("e3").endpoint), false, "ownership is per account");
      assert.equal(await store.unsubscribe(actorA, device("e3").endpoint), "not-found", "only the owner can revoke");
      assert.equal(await store.unsubscribe(actorB, device("e3").endpoint), "unsubscribed");
      at = new Date(start + 90 * 60_000);
      await store.sweepPush();
      assert.deepEqual(delivered(), ["e1"]);
      assert.equal(await store.pushStatus(actorB, device("e3").endpoint), false, "a revoked record is not owned");
      assert.deepEqual(logs, [], "nothing failed, so nothing is logged");
    } finally {
      await pool.end();
    }
  },
);

test(
  "real PostgreSQL: phone push reaches every device, retries failures and never costs a change",
  { skip: !url },
  async (t) => {
    const engine = await import("./dist/engine.mjs");
    const pool = new Pool({ connectionString: url, max: 4 });
    const actorA = "11111111-1111-4111-8111-111111111111";
    const actorB = "22222222-2222-4222-8222-222222222222";
    const at = new Date("2026-10-07T10:00:00Z");
    const jump = { type: "ADVANCE_CLOCK", role: "demo", minutes: 30 };
    const keys = { p256dh: "p", auth: "a" };
    function setup(options = {}) {
      const workspaceId = randomUUID();
      const sent = [];
      const logs = [];
      const store = createWorkspaceStore(pool, {
        workspaceId,
        engine: options.engine ?? engine,
        clock: () => at,
        log: (event) => logs.push(event),
        deliveryWaitMs: options.deliveryWaitMs ?? 10_000,
        push: {
          send: async (row, payload) => {
            sent.push(row.endpoint.split("/").pop());
            return (await options.send?.(row, payload)) ?? { outcome: "sent" };
          },
          payload: pushPayload,
          coordinatorIds: [actorA, actorB],
          maxPerAccount: 10,
        },
      });
      return { workspaceId, sent, logs, store };
    }
    try {
      await migrate(pool);
      await t.test("more than one page of subscriptions: every device is sent", async () => {
        const { workspaceId, sent, store } = setup();
        await store.read(actorA);
        await pool.query(
          "INSERT INTO ward_flow.push_subscriptions(workspace_id, actor_id, endpoint, p256dh, auth) SELECT $1::uuid, $2::uuid, 'https://fcm.googleapis.com/fcm/send/' || $1::text || '-' || n, 'p', 'a' FROM generate_series(1, 205) AS n",
          [workspaceId, actorB],
        );
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        assert.equal(new Set(sent).size, 205);
        assert.equal(sent.length, 205);
      });
      await t.test("a temporary failure is retried by the next sweep; the log names no device", async () => {
        let fail = true;
        const { sent, logs, store } = setup({
          send: async (row) =>
            fail && row.endpoint.endsWith("/f1") ? { outcome: "failed", category: "status 429" } : undefined,
        });
        await store.read(actorA);
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/f1", ...keys });
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/f2", ...keys });
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        assert.deepEqual(sent.splice(0).sort(), ["f1", "f2"]);
        assert.deepEqual(logs, [
          {
            event: "ward_backend_push_delivery_failures",
            sent: 1,
            expired: 0,
            failed: 1,
            failures: { "status 429": 1 },
          },
        ]);
        assert.doesNotMatch(JSON.stringify(logs), /fcm|https?:|Ward Flow:/);
        fail = false;
        await store.sweepPush();
        assert.deepEqual(sent.splice(0).sort(), ["f1", "f2"], "both retried; the device collapses the repeat");
        await store.sweepPush();
        assert.deepEqual(sent, [], "announced once delivery succeeded");
      });
      await t.test("an evaluation error is logged and the command still commits", async () => {
        const broken = {
          ...engine,
          actNowAlerts: () => {
            throw Object.assign(new TypeError("unexpected state"), { code: "ENGINE" });
          },
        };
        const { sent, logs, store } = setup({ engine: broken });
        await store.read(actorA);
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/b1", ...keys });
        const result = await store.command(actorA, randomUUID(), 1, jump);
        assert.equal(result.status, 200);
        assert.equal(result.body.snapshot.revision, 2);
        assert.equal((await store.read(actorA)).revision, 2);
        assert.deepEqual(sent, []);
        assert.deepEqual(logs, [
          {
            event: "ward_backend_push_evaluation_failure",
            errorName: "TypeError",
            errorCode: "ENGINE",
            message: "unexpected state",
          },
        ]);
      });
      await t.test("a slow push service does not hold the save response", async () => {
        let release;
        const held = new Promise((resolve) => {
          release = resolve;
        });
        const { sent, store } = setup({ deliveryWaitMs: 50, send: async () => held });
        await store.read(actorA);
        await store.subscribe(actorB, { endpoint: "https://fcm.googleapis.com/fcm/send/s1", ...keys });
        const started = performance.now();
        assert.equal((await store.command(actorA, randomUUID(), 1, jump)).status, 200);
        assert.ok(performance.now() - started < 1000, "returned before delivery finished");
        assert.deepEqual(sent, ["s1"], "delivery had started");
        release({ outcome: "sent" });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
    } finally {
      await pool.end();
    }
  },
);
